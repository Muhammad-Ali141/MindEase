#!/usr/bin/env python3
"""
Live Microphone Speech-to-Text Transcription

Real-time microphone transcription using faster-whisper.
Captures audio in chunks with overlap to avoid dropped words.
"""

import argparse
import logging
import queue
import sys
import threading
import time
from collections import deque
from typing import Optional

import numpy as np
import sounddevice as sd
import soundfile as sf
import warnings

# Handle both module import and direct execution
try:
    from .stt_service import SpeechToTextService
except ImportError:
    from stt_service import SpeechToTextService

# Suppress all warnings
import os
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', message='.*pkg_resources.*')

# Configure logging - suppress verbose messages
logging.basicConfig(
    level=logging.WARNING,  # Only show warnings and errors
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)

# Suppress faster_whisper and stt_service verbose logging
logging.getLogger('faster_whisper').setLevel(logging.WARNING)
logging.getLogger('stt_service').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)  # Suppress our own INFO logs too


class LiveSTT:
    """
    Live microphone transcription with chunking, overlap, and silence-aware flushing.
    """
    
    def __init__(
        self,
        stt_service: SpeechToTextService,
        sample_rate: int = 16000,
        chunk_duration: float = 3.0,
        overlap_duration: float = 0.5,
        device: Optional[int] = None,
        language: str = "en",
        silence_threshold: float = 0.0025,
        silence_duration: float = 0.4,
    ):
        """
        Initialize live STT.
        
        Args:
            stt_service: SpeechToTextService instance
            sample_rate: Audio sample rate (default: 16000)
            chunk_duration: Duration of each chunk in seconds (default: 3.0)
            overlap_duration: Overlap between chunks in seconds (default: 0.5)
            device: Sounddevice device index (None = default)
            language: Language code passed to the STT model (None/auto enables detection)
            silence_threshold: RMS threshold to consider the tail of a chunk silent
            silence_duration: Tail duration (seconds) used for silence detection
        """
        self.stt_service = stt_service
        self.sample_rate = sample_rate
        self.chunk_duration = chunk_duration
        self.overlap_duration = overlap_duration
        self.device = device
        # Force English only - no auto-detection
        self.language = "en" if language in (None, "", "auto", "detect") else language
        self.silence_threshold = silence_threshold
        self.silence_duration = silence_duration
        
        self.chunk_samples = int(chunk_duration * sample_rate)
        self.overlap_samples = int(overlap_duration * sample_rate)
        self.silence_tail_samples = max(1, int(sample_rate * silence_duration))
        
        # Track consecutive silent chunks for better detection
        self.consecutive_silent_chunks = 0
        self.silent_chunks_needed = max(2, int(silence_duration / chunk_duration))  # Need multiple silent chunks
        self.last_audio_activity_time = time.time()
        self.max_silence_timeout = 3.0  # Force flush after 3 seconds of no activity
        
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.session_transcript = ""
        self.chunk_count = 0
        self.pending_text = ""
        self.last_chunk_text = ""

    def audio_callback(self, indata, frames, time_info, status):
        """Callback function for sounddevice stream."""
        if status:
            logger.warning(f"Audio callback status: {status}")
        
        if self.is_recording:
            # Convert to float32 and ensure mono
            audio_data = indata[:, 0].astype(np.float32)
            self.audio_queue.put(audio_data.copy())
    
    def process_audio_chunks(self):
        """Process audio chunks in a separate thread."""
        buffer = deque()
        
        while self.is_recording or not self.audio_queue.empty():
            try:
                try:
                    chunk = self.audio_queue.get(timeout=0.1)
                except queue.Empty:
                    continue
                
                if chunk.size == 0:
                    continue
                
                buffer.extend(chunk)
                
                # Process while we have enough samples for a chunk
                while len(buffer) >= self.chunk_samples:
                    chunk_start = len(buffer) - self.chunk_samples
                    chunk_end = len(buffer)
                    chunk_array = np.array(list(buffer)[chunk_start:chunk_end], dtype=np.float32)
                    
                    self._process_chunk(chunk_array)
                    
                    samples_to_remove = self.chunk_samples - self.overlap_samples
                    for _ in range(min(samples_to_remove, len(buffer))):
                        buffer.popleft()
            
            except Exception as e:
                logger.error(f"Error processing audio chunk: {e}", exc_info=True)
        
        # Process any remaining audio after recording stops
        if buffer:
            chunk_array = np.array(list(buffer), dtype=np.float32)
            self._process_chunk(chunk_array, final_chunk=True)
        self._flush_pending_text()

    def _process_chunk(self, chunk_array: np.ndarray, final_chunk: bool = False):
        transcript = self.stt_service.transcribe_audio_array(
            chunk_array,
            self.sample_rate,
            language=self.language,
        ).strip()
        
        silent = self._is_chunk_silent(chunk_array)
        
        if transcript:
            self._append_pending_text(transcript)
            self.consecutive_silent_chunks = 0
            self.last_audio_activity_time = time.time()
            # Don't flush immediately after getting new transcript - wait for silence
        elif silent:
            self.consecutive_silent_chunks += 1
        else:
            # Audio present but no transcript - reset counter but don't flush
            self.consecutive_silent_chunks = 0
            self.last_audio_activity_time = time.time()
        
        # Check if we should flush: multiple silent chunks OR timeout OR final chunk
        # Only flush if we have pending text AND enough silence
        time_since_activity = time.time() - self.last_audio_activity_time
        should_flush = (
            final_chunk or
            (self.pending_text and self.consecutive_silent_chunks >= self.silent_chunks_needed) or
            (self.pending_text and time_since_activity >= self.max_silence_timeout)
        )
        
        if should_flush:
            self._flush_pending_text()
            self.consecutive_silent_chunks = 0

    def _append_pending_text(self, chunk_text: str):
        if not chunk_text:
            return
        
        # If no previous text, just use the new text
        if not self.pending_text:
            self.pending_text = chunk_text
            self.last_chunk_text = chunk_text
            return
        
        import re
        
        # First check: Is the entire new chunk already in pending text?
        pending_lower = self.pending_text.lower()
        chunk_lower = chunk_text.lower().strip()
        
        # Remove punctuation for comparison
        def clean_text(text):
            return re.sub(r'[^\w\s]', ' ', text.lower())
        
        pending_clean = clean_text(self.pending_text)
        chunk_clean = clean_text(chunk_text)
        
        # Check if chunk is already contained (exact duplicate)
        if chunk_clean.strip() in pending_clean:
            self.last_chunk_text = chunk_text
            return
        
        # Normalize for word-level comparison
        def get_words(text):
            return [w for w in clean_text(text).split() if w]
        
        pending_words = get_words(self.pending_text)
        new_words = get_words(chunk_text)
        
        # Find longest word sequence overlap
        max_overlap = 0
        max_len = min(len(pending_words), len(new_words))
        
        # Check from longest possible overlap down to 1 word
        for overlap_len in range(max_len, 0, -1):
            if pending_words[-overlap_len:] == new_words[:overlap_len]:
                max_overlap = overlap_len
                break
        
        if max_overlap > 0:
            # Found word overlap - get non-overlapping part
            original_new_words = chunk_text.split()
            if max_overlap < len(original_new_words):
                incremental_words = original_new_words[max_overlap:]
                incremental = " ".join(incremental_words).strip()
                
                # Double-check incremental isn't already in pending
                if incremental and incremental.lower() not in pending_lower:
                    self.pending_text += " " + incremental
        else:
            # No word overlap - check character-level overlap
            # This handles cases like "anxiety" -> "anxiety issues"
            overlap_chars = 0
            for i in range(min(len(pending_clean), len(chunk_clean)), 0, -1):
                if i >= 3 and pending_clean[-i:].strip() == chunk_clean[:i].strip():
                    overlap_chars = i
                    break
            
            if overlap_chars > 0:
                # Found character overlap - extract remaining part
                # Find where overlap ends in original chunk_text
                remaining = chunk_text
                # Approximate: find first word that's not in overlap
                chunk_words = chunk_text.split()
                overlap_text = chunk_clean[:overlap_chars].strip()
                
                # Find which words are in the overlap
                words_in_overlap = 0
                char_count = 0
                for word in chunk_words:
                    word_clean = clean_text(word)
                    if char_count + len(word_clean) <= overlap_chars:
                        words_in_overlap += 1
                        char_count += len(word_clean) + 1
                    else:
                        break
                
                if words_in_overlap < len(chunk_words):
                    incremental_words = chunk_words[words_in_overlap:]
                    incremental = " ".join(incremental_words).strip()
                    if incremental and incremental.lower() not in pending_lower:
                        self.pending_text += " " + incremental
            else:
                # No overlap - it's completely new content
                if chunk_lower not in pending_lower:
                    self.pending_text += " " + chunk_text
        
        self.last_chunk_text = chunk_text

    def _flush_pending_text(self):
        if not self.pending_text:
            return
        
        text = self.pending_text.strip()
        if text:
            self.chunk_count += 1
            print(text)
            if self.session_transcript:
                self.session_transcript += " " + text
            else:
                self.session_transcript = text
        
        self.pending_text = ""
        self.last_chunk_text = ""

    def _is_chunk_silent(self, chunk_array: np.ndarray) -> bool:
        if chunk_array.size == 0:
            return True
        
        # Check the tail portion for silence
        tail_start = max(0, len(chunk_array) - self.silence_tail_samples)
        tail = chunk_array[tail_start:]
        
        if len(tail) == 0:
            return True
        
        # Calculate RMS (Root Mean Square) energy
        rms = float(np.sqrt(np.mean(np.square(tail))))
        
        # Also check peak amplitude for better detection
        peak = float(np.abs(tail).max())
        
        # Consider silent if both RMS and peak are below threshold
        return rms < self.silence_threshold and peak < (self.silence_threshold * 2)
    
    def start(self):
        """Start live transcription."""
        self.is_recording = True
        self.session_transcript = ""
        self.chunk_count = 0
        self.pending_text = ""
        self.last_chunk_text = ""
        self.consecutive_silent_chunks = 0
        self.last_audio_activity_time = time.time()
        
        # Start processing thread
        process_thread = threading.Thread(target=self.process_audio_chunks, daemon=True)
        process_thread.start()
        
        try:
            # Start audio stream
            with sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype='float32',
                device=self.device,
                callback=self.audio_callback,
                blocksize=int(self.sample_rate * 0.1),  # 100ms blocks
            ):
                print("Listening... (Press Ctrl+C to stop)")
                
                # Keep main thread alive
                while self.is_recording:
                    time.sleep(0.1)
        
        except KeyboardInterrupt:
            self.stop()
        except Exception as e:
            logger.error(f"Error during recording: {e}", exc_info=True)
            self.stop()
    
    def stop(self):
        """Stop live transcription."""
        self.is_recording = False
        time.sleep(0.5)  # Give processing thread time to finish
        self._flush_pending_text()
        
        print("\nStopped.")


def list_audio_devices():
    """List all available audio input devices."""
    devices = sd.query_devices()
    print("\nAvailable audio input devices:")
    print("-" * 80)
    for i, device in enumerate(devices):
        if device['max_input_channels'] > 0:
            default = " (DEFAULT)" if i == sd.default.device[0] else ""
            print(f"{i}: {device['name']}{default}")
            print(f"   Channels: {device['max_input_channels']}, "
                  f"Sample rate: {device['default_samplerate']:.0f} Hz")
    print("-" * 80)


def main():
    """Main entry point for live STT CLI."""
    parser = argparse.ArgumentParser(
        description="Live microphone speech-to-text transcription",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Use default settings
  python stt_live.py
  
  # Specify audio device
  python stt_live.py --device 1
  
  # Custom chunk size and overlap
  python stt_live.py --chunk 4.0 --overlap 1.0
  
  # Transcribe a file instead of microphone
  python stt_live.py --file audio.wav
  
  # List available audio devices
  python stt_live.py --list-devices
        """
    )
    
    parser.add_argument(
        "--device",
        type=int,
        default=None,
        help="Audio device index (use --list-devices to see available devices)"
    )
    
    parser.add_argument(
        "--chunk",
        type=float,
        default=3.0,
        help="Chunk duration in seconds (default: 3.0)"
    )
    
    parser.add_argument(
        "--overlap",
        type=float,
        default=0.8,
        help="Overlap duration in seconds (default: 0.5)"
    )
    
    parser.add_argument(
        "--lang",
        type=str,
        default="en",
        help="Language code (default: en, English only)"
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default="Systran/faster-whisper-large-v3",
        help="Model ID (default: Systran/faster-whisper-large-v3)"
    )
    
    parser.add_argument(
        "--beam-size",
        type=int,
        default=15,
        help="Beam size for decoding (default: 8, higher = more accurate but slower)"
    )
    
    parser.add_argument(
        "--best-of",
        type=int,
        default=5,
        help="Number of best candidates to consider when temperature > 0 (default: 5)"
    )
    
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Softmax temperature (0 for deterministic decoding, higher = more diverse)"
    )
    
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=16000,
        help="Audio sample rate (default: 16000)"
    )
    
    parser.add_argument(
        "--silence-threshold",
        type=float,
        default=0.0025,
        help="RMS threshold (0-1) used to detect silence pauses (default: 0.0025)"
    )
    
    parser.add_argument(
        "--silence-duration",
        type=float,
        default=1,
        help="Tail duration in seconds evaluated for silence (default: 1)"
    )
    
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Transcribe a file instead of microphone"
    )
    
    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="List available audio input devices and exit"
    )
    
    args = parser.parse_args()
    
    # List devices if requested
    if args.list_devices:
        list_audio_devices()
        return
    
    # Validate arguments
    if args.chunk <= 0:
        logger.error("Chunk duration must be positive")
        sys.exit(1)
    
    if args.overlap < 0 or args.overlap >= args.chunk:
        logger.error("Overlap must be non-negative and less than chunk duration")
        sys.exit(1)
    
    # Initialize STT service (suppress loading messages)
    try:
        # Temporarily suppress all logging during model load
        root_logger = logging.getLogger()
        previous_level = root_logger.level
        root_logger.setLevel(logging.ERROR)
        stt_service = SpeechToTextService(
            model_id=args.model,
            beam_size=args.beam_size,
            best_of=args.best_of,
            temperature=args.temperature,
        )
        root_logger.setLevel(previous_level)
    except Exception as e:
        print(f"Error: Failed to initialize STT service: {e}")
        sys.exit(1)
    
    # Handle file transcription
    if args.file:
        try:
            # Force English only
            lang = "en" if args.lang in (None, "", "auto", "detect") else args.lang
            transcript = stt_service.transcribe_file(
                args.file,
                language=lang,
            )
            print(transcript)
        except Exception as e:
            print(f"Error: File transcription failed: {e}")
            sys.exit(1)
        finally:
            stt_service.close()
        return
    
    # Force English only - override any auto-detect
    lang = "en" if args.lang in (None, "", "auto", "detect") else args.lang
    
    # Live microphone transcription
    try:
        live_stt = LiveSTT(
            stt_service=stt_service,
            sample_rate=args.sample_rate,
            chunk_duration=args.chunk,
            overlap_duration=args.overlap,
            device=args.device,
            language=lang,
            silence_threshold=args.silence_threshold,
            silence_duration=args.silence_duration,
        )
        
        live_stt.start()
    
    except KeyboardInterrupt:
        pass  # Already handled in start()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        stt_service.close()


if __name__ == "__main__":
    main()

