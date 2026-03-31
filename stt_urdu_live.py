#!/usr/bin/env python3
"""
Live Microphone Urdu Speech-to-Text Transcription

Real-time microphone transcription using faster-whisper.
Mirrors English pipeline (stt_live.py): chunk+overlap, silence-aware flush.
"""

import argparse
import logging
import os
import queue
import re
import sys
import threading
import time
from collections import deque
from typing import Optional

import numpy as np
import sounddevice as sd
import warnings

try:
    from .stt_urdu_service import MODEL_ID, UrduSpeechToTextService
except ImportError:
    from stt_urdu_service import MODEL_ID, UrduSpeechToTextService

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*pkg_resources.*")

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("faster_whisper").setLevel(logging.WARNING)
logging.getLogger("stt_urdu_service").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)


class LiveUrduSTT:
    """
    Live Urdu microphone transcription with chunk+overlap and silence-aware flush.
    Mirrors English LiveSTT logic.
    """

    def __init__(
        self,
        stt_service: UrduSpeechToTextService,
        sample_rate: int = 16000,
        chunk_duration: float = 3.0,
        overlap_duration: float = 0.5,
        device: Optional[int] = None,
        language: str = "ur",
        silence_threshold: float = 0.0025,
        silence_duration: float = 1.0,
    ):
        self.stt_service = stt_service
        self.sample_rate = sample_rate
        self.chunk_duration = chunk_duration
        self.overlap_duration = overlap_duration
        self.device = device
        self.language = "ur" if language in (None, "", "auto") else language
        self.silence_threshold = silence_threshold
        self.silence_duration = silence_duration

        self.chunk_samples = int(chunk_duration * sample_rate)
        self.overlap_samples = int(overlap_duration * sample_rate)
        self.silence_tail_samples = max(1, int(sample_rate * silence_duration))

        self.consecutive_silent_chunks = 0
        self.silent_chunks_needed = max(2, int(silence_duration / chunk_duration))
        self.last_audio_activity_time = time.time()
        # Give more time to finish long Urdu sentences before forcing a flush.
        self.max_silence_timeout = 6.0

        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.session_transcript = ""
        self.chunk_count = 0
        self.pending_text = ""
        self.last_chunk_text = ""

    def audio_callback(self, indata, frames, time_info, status):
        if status:
            logger.warning(f"Audio callback status: {status}")
        if self.is_recording:
            audio_data = indata[:, 0].astype(np.float32)
            self.audio_queue.put(audio_data.copy())

    def process_audio_chunks(self):
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

                while len(buffer) >= self.chunk_samples:
                    chunk_start = len(buffer) - self.chunk_samples
                    chunk_end = len(buffer)
                    chunk_array = np.array(list(buffer)[chunk_start:chunk_end], dtype=np.float32)
                    self._process_chunk(chunk_array)

                    samples_to_remove = self.chunk_samples - self.overlap_samples
                    for _ in range(min(samples_to_remove, len(buffer))):
                        buffer.popleft()
            except Exception as e:
                logger.error(f"Error processing audio: {e}", exc_info=True)

        if buffer:
            chunk_array = np.array(list(buffer), dtype=np.float32)
            self._process_chunk(chunk_array, final_chunk=True)
        self._flush_pending_text()

    def _process_chunk(self, chunk_array: np.ndarray, final_chunk: bool = False):
        silent = self._is_chunk_silent(chunk_array)
        # Hallucinations typically happen when we try to decode near-silence.
        # Mirror the English pipeline behavior: only decode when there is speech
        # or when we're flushing the final buffer.
        # Important: chunk tails can be silent even when the chunk contains speech.
        # We only skip decoding if the whole chunk is basically silence.
        if silent and not final_chunk and (not self._chunk_has_speech(chunk_array)):
            self.consecutive_silent_chunks += 1
            time_since_activity = time.time() - self.last_audio_activity_time
            should_flush = (
                self.pending_text
                and (
                    self.consecutive_silent_chunks >= self.silent_chunks_needed
                    or time_since_activity >= self.max_silence_timeout
                )
            )
            if should_flush:
                self._flush_pending_text()
                self.consecutive_silent_chunks = 0
            return

        transcript = self.stt_service.transcribe_audio_array(
            chunk_array,
            self.sample_rate,
            language=self.language,
        ).strip()

        if transcript:
            self._append_pending_text(transcript)
            self.consecutive_silent_chunks = 0
            self.last_audio_activity_time = time.time()
        elif silent:
            self.consecutive_silent_chunks += 1
        else:
            self.consecutive_silent_chunks = 0
            self.last_audio_activity_time = time.time()

        time_since_activity = time.time() - self.last_audio_activity_time
        should_flush = (
            final_chunk
            or (self.pending_text and self.consecutive_silent_chunks >= self.silent_chunks_needed)
            or (self.pending_text and time_since_activity >= self.max_silence_timeout)
        )

        if should_flush:
            self._flush_pending_text()
            self.consecutive_silent_chunks = 0

    def _append_pending_text(self, chunk_text: str):
        if not chunk_text:
            return
        if not self.pending_text:
            self.pending_text = chunk_text
            self.last_chunk_text = chunk_text
            return

        # Keep Urdu (Arabic block) chars during overlap detection.
        # \w doesn't reliably cover Urdu letters across environments.
        def clean_text(text: str) -> str:
            text = text.lower()
            text = re.sub(r"[^\w\s\u0600-\u06FF]", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            return text

        pending_lower = self.pending_text.lower()
        chunk_lower = chunk_text.lower().strip()
        pending_clean = clean_text(self.pending_text)
        chunk_clean = clean_text(chunk_text)

        if chunk_clean.strip() in pending_clean:
            self.last_chunk_text = chunk_text
            return

        def get_words(text: str):
            return [w for w in clean_text(text).split(" ") if w]

        pending_words = get_words(self.pending_text)
        new_words = get_words(chunk_text)
        max_overlap = 0
        max_len = min(len(pending_words), len(new_words))

        for overlap_len in range(max_len, 0, -1):
            if pending_words[-overlap_len:] == new_words[:overlap_len]:
                max_overlap = overlap_len
                break

        if max_overlap > 0:
            original_new_words = chunk_text.split()
            if max_overlap < len(original_new_words):
                incremental_words = original_new_words[max_overlap:]
                incremental = " ".join(incremental_words).strip()
                if incremental and incremental.lower() not in pending_lower:
                    self.pending_text += " " + incremental
        else:
            overlap_chars = 0
            for i in range(min(len(pending_clean), len(chunk_clean)), 0, -1):
                if i >= 3 and pending_clean[-i:].strip() == chunk_clean[:i].strip():
                    overlap_chars = i
                    break

            if overlap_chars > 0:
                chunk_words = chunk_text.split()
                char_count = 0
                words_in_overlap = 0
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
        tail_start = max(0, len(chunk_array) - self.silence_tail_samples)
        tail = chunk_array[tail_start:]
        if len(tail) == 0:
            return True
        rms = float(np.sqrt(np.mean(np.square(tail))))
        peak = float(np.abs(tail).max())
        return rms < self.silence_threshold and peak < (self.silence_threshold * 2)

    def _chunk_has_speech(self, chunk_array: np.ndarray) -> bool:
        """Detect if there is speech anywhere in the chunk (not just the tail)."""
        if chunk_array.size == 0:
            return False
        rms = float(np.sqrt(np.mean(np.square(chunk_array))))
        peak = float(np.abs(chunk_array).max())
        # Be lenient here: if there was any real energy, we should decode to capture sentence endings.
        return rms >= (self.silence_threshold * 0.7) or peak >= (self.silence_threshold * 6)

    def start(self):
        self.is_recording = True
        self.session_transcript = ""
        self.chunk_count = 0
        self.pending_text = ""
        self.last_chunk_text = ""
        self.consecutive_silent_chunks = 0
        self.last_audio_activity_time = time.time()

        process_thread = threading.Thread(target=self.process_audio_chunks, daemon=True)
        process_thread.start()

        try:
            with sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype="float32",
                device=self.device,
                callback=self.audio_callback,
                blocksize=int(self.sample_rate * 0.1),
            ):
                print("Listening (Urdu)... Press Ctrl+C to stop.")
                while self.is_recording:
                    time.sleep(0.1)
        except KeyboardInterrupt:
            self.stop()
        except Exception as e:
            logger.error(f"Recording error: {e}", exc_info=True)
            self.stop()

    def stop(self):
        self.is_recording = False
        time.sleep(0.5)
        self._flush_pending_text()
        print("\nStopped.")


def list_audio_devices():
    devices = sd.query_devices()
    print("\nAvailable audio input devices:")
    print("-" * 80)
    for i, device in enumerate(devices):
        if device["max_input_channels"] > 0:
            default = " (DEFAULT)" if i == sd.default.device[0] else ""
            print(f"{i}: {device['name']}{default}")
            print(f"   Channels: {device['max_input_channels']}, Sample rate: {device['default_samplerate']:.0f} Hz")
    print("-" * 80)


def main():
    parser = argparse.ArgumentParser(
        description="Live Urdu microphone speech-to-text",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--device", type=int, default=None, help="Audio device index")
    # Accuracy-focused defaults for Urdu: longer chunk + moderate overlap
    parser.add_argument("--chunk", type=float, default=4.0, help="Chunk duration in seconds")
    parser.add_argument("--overlap", type=float, default=0.5, help="Overlap duration in seconds")
    parser.add_argument("--lang", type=str, default="ur", help="Language code")
    parser.add_argument(
        "--model",
        type=str,
        default=MODEL_ID,
        help="CT2 model dir (default: finetuned_urdu_whisper/ct2_model if present)",
    )
    parser.add_argument("--beam-size", type=int, default=6, help="Higher = more accurate, slower")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--silence-threshold", type=float, default=0.0025)
    parser.add_argument("--silence-duration", type=float, default=1.0)
    parser.add_argument("--file", type=str, default=None, help="Transcribe file instead of mic")
    parser.add_argument("--list-devices", action="store_true")
    args = parser.parse_args()

    if args.list_devices:
        list_audio_devices()
        return

    if args.chunk <= 0:
        logger.error("Chunk duration must be positive")
        sys.exit(1)
    if args.overlap < 0 or args.overlap >= args.chunk:
        logger.error("Overlap must be non-negative and less than chunk")
        sys.exit(1)

    try:
        root_logger = logging.getLogger()
        prev_level = root_logger.level
        root_logger.setLevel(logging.ERROR)
        stt_service = UrduSpeechToTextService(model_id=args.model, beam_size=args.beam_size)
        root_logger.setLevel(prev_level)
    except Exception as e:
        print(f"Error: Failed to load Urdu STT: {e}")
        sys.exit(1)

    if args.file:
        try:
            text = stt_service.transcribe_file(args.file, language="ur")
            print(text)
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
        finally:
            stt_service.close()
        return

    try:
        live = LiveUrduSTT(
            stt_service=stt_service,
            sample_rate=args.sample_rate,
            chunk_duration=args.chunk,
            overlap_duration=args.overlap,
            device=args.device,
            language="ur",
            silence_threshold=args.silence_threshold,
            silence_duration=args.silence_duration,
        )
        live.start()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        stt_service.close()


if __name__ == "__main__":
    main()
