#!/usr/bin/env python3
"""
Terminal-based Text-to-Speech CLI

Interactive and file-based TTS synthesis using Coqui XTTS v2.
Supports text input, file input, audio playback, and file saving.
"""

import argparse
import logging
import os
import re
import sys
import time
from typing import Optional

import numpy as np
import sounddevice as sd
import warnings

# Handle both module import and direct execution
try:
    from .tts_service import TTSService
except ImportError:
    from tts_service import TTSService

# Suppress warnings
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=FutureWarning)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)

logger = logging.getLogger(__name__)


def split_into_sentences(text: str) -> list:
    """
    Split text into sentences for better synthesis of long texts.
    
    Args:
        text: Input text
    
    Returns:
        List of sentences
    """
    # Simple sentence splitting by punctuation
    # Split on . ! ? followed by space or newline
    sentences = re.split(r'([.!?]+[\s\n]+)', text)
    
    # Recombine sentences with their punctuation
    result = []
    i = 0
    while i < len(sentences):
        if i + 1 < len(sentences) and re.match(r'[.!?]+[\s\n]+', sentences[i + 1]):
            result.append(sentences[i] + sentences[i + 1])
            i += 2
        else:
            if sentences[i].strip():
                result.append(sentences[i])
            i += 1
    
    # Filter empty sentences
    result = [s.strip() for s in result if s.strip()]
    
    # If no sentences found, return the original text as a single sentence
    if not result:
        return [text.strip()] if text.strip() else []
    
    return result


def play_audio(audio: np.ndarray, sample_rate: int = 22050):
    """
    Play audio using sounddevice with quality improvements.
    
    Args:
        audio: NumPy array of audio samples
        sample_rate: Sample rate of the audio
    """
    try:
        # Ensure audio is float32 and in [-1, 1] range
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        
        # Convert to mono if stereo
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=1)
        
        # Remove DC offset
        audio = audio - np.mean(audio)
        
        # Normalize to prevent clipping while maintaining quality
        max_val = np.abs(audio).max()
        if max_val > 0:
            # Normalize to 0.9 to avoid clipping and distortion
            if max_val > 0.9:
                audio = audio * (0.9 / max_val)
            elif max_val < 0.1:
                # Boost quiet audio slightly
                audio = audio * (0.3 / max_val)
        
        # Ensure values are in valid range
        audio = np.clip(audio, -1.0, 1.0)
        
        # Play audio with high quality settings
        sd.play(audio, samplerate=sample_rate, blocking=True)
        
    except Exception as e:
        logger.error(f"Error playing audio: {e}")
        print(f"Warning: Could not play audio: {e}")


def synthesize_text(
    tts_service: TTSService,
    text: str,
    language: str = "en",
    output_path: Optional[str] = None,
    play: bool = False,
    speaker_wav: Optional[str] = None,
) -> Optional[tuple[np.ndarray, int]]:
    """
    Synthesize text to speech.
    
    Args:
        tts_service: TTSService instance
        text: Text to synthesize
        language: Language code
        output_path: Optional path to save audio file
        play: Whether to play audio after synthesis
        speaker_wav: Optional path to reference audio for voice cloning
    
    Returns:
        Tuple of (audio array, sample_rate) if not saved to file, None otherwise
    """
    if not text or not text.strip():
        print("Warning: Empty text provided")
        return None
    
    print(f"Synthesizing: {text[:50]}{'...' if len(text) > 50 else ''}")
    
    try:
        start_time = time.time()
        
        # For long texts, split into sentences and synthesize separately
        sentences = split_into_sentences(text)
        
        if len(sentences) > 1:
            print(f"Processing {len(sentences)} sentences...")
            audio_chunks = []
            
            for i, sentence in enumerate(sentences, 1):
                print(f"  [{i}/{len(sentences)}] Synthesizing sentence...")
                
                # Synthesize each sentence
                if output_path and i == len(sentences):
                    # Save only the last sentence to file, or combine all
                    temp_path = output_path if i == len(sentences) else None
                else:
                    temp_path = None
                
                result = tts_service.synthesize(
                    text=sentence,
                    language=language,
                    speaker_wav=speaker_wav,
                    output_path=temp_path,
                )
                
                if result is not None:
                    audio, sample_rate = result
                    if audio is not None and len(audio) > 0:
                        audio_chunks.append((audio, sample_rate))
            
            # Concatenate all audio chunks (ensure same sample rate)
            if audio_chunks:
                # Get sample rate from first chunk (should be same for all)
                sample_rate = audio_chunks[0][1]
                
                # Extract audio arrays
                audio_arrays = [chunk[0] for chunk in audio_chunks]
                full_audio = np.concatenate(audio_arrays)
                
                # Save combined audio if output path specified
                if output_path and len(sentences) > 1:
                    import soundfile as sf
                    sf.write(output_path, full_audio, sample_rate)
                    print(f"Audio saved to: {output_path}")
                
                synthesis_time = time.time() - start_time
                audio_duration = len(full_audio) / sample_rate
                print(f"Synthesis complete in {synthesis_time:.2f}s (audio: {audio_duration:.2f}s, sample rate: {sample_rate} Hz)")
                
                if play:
                    print("Playing audio...")
                    play_audio(full_audio, sample_rate=sample_rate)
                
                return (full_audio, sample_rate) if not output_path else None
            else:
                print("Error: No audio generated")
                return None
        else:
            # Single sentence or short text
            result = tts_service.synthesize(
                text=text,
                language=language,
                speaker_wav=speaker_wav,
                output_path=output_path,
            )
            
            synthesis_time = time.time() - start_time
            if result is not None:
                audio, sample_rate = result
                if audio is not None and len(audio) > 0:
                    audio_duration = len(audio) / sample_rate
                    print(f"Synthesis complete in {synthesis_time:.2f}s (audio: {audio_duration:.2f}s, sample rate: {sample_rate} Hz)")
                    
                    if output_path:
                        print(f"Audio saved to: {output_path}")
                    
                    if play:
                        print("Playing audio...")
                        play_audio(audio, sample_rate=sample_rate)
                    
                    return (audio, sample_rate) if not output_path else None
            else:
                print("Error: No audio generated")
                return None
                
    except Exception as e:
        logger.error(f"Synthesis error: {e}", exc_info=True)
        print(f"Error: Failed to synthesize speech: {e}")
        return None


def interactive_mode(tts_service: TTSService, language: str = "en", play: bool = True):
    """
    Interactive mode: Read text from stdin and synthesize.
    
    Args:
        tts_service: TTSService instance
        language: Language code
        play: Whether to play audio after synthesis
    """
    print("Interactive TTS Mode")
    print("Enter text to synthesize (or 'quit' to exit):")
    print("-" * 60)
    
    try:
        while True:
            try:
                text = input("\n> ").strip()
                
                if not text:
                    continue
                
                if text.lower() in ['quit', 'exit', 'q']:
                    print("Exiting...")
                    break
                
                # Synthesize and play
                synthesize_text(
                    tts_service=tts_service,
                    text=text,
                    language=language,
                    play=play,
                )
                
            except KeyboardInterrupt:
                print("\nExiting...")
                break
            except EOFError:
                print("\nExiting...")
                break
                
    except Exception as e:
        logger.error(f"Interactive mode error: {e}", exc_info=True)
        print(f"Error: {e}")


def file_mode(
    tts_service: TTSService,
    file_path: str,
    output_path: Optional[str] = None,
    language: str = "en",
    play: bool = False,
):
    """
    File mode: Read text from file and synthesize.
    
    Args:
        tts_service: TTSService instance
        file_path: Path to input text file
        output_path: Optional path to save audio file
        language: Language code
        play: Whether to play audio after synthesis
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return
    
    try:
        # Read text from file
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        
        if not text:
            print("Error: File is empty")
            return
        
        print(f"Reading text from: {file_path}")
        print(f"Text length: {len(text)} characters")
        
        # Generate output path if not specified
        if not output_path:
            base_name = os.path.splitext(file_path)[0]
            output_path = f"{base_name}_output.wav"
        
        # Synthesize
        synthesize_text(
            tts_service=tts_service,
            text=text,
            language=language,
            output_path=output_path,
            play=play,
        )
        
    except Exception as e:
        logger.error(f"File mode error: {e}", exc_info=True)
        print(f"Error: Failed to process file: {e}")


def main():
    """Main entry point for TTS CLI."""
    parser = argparse.ArgumentParser(
        description="Terminal-based Text-to-Speech using Coqui XTTS v2",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode
  python tts_live.py
  
  # Direct text input with playback
  python tts_live.py --text "Hello, how are you?" --play
  
  # File input with save
  python tts_live.py --file input.txt --output output.wav
  
  # Urdu text
  python tts_live.py --text "آپ کیسے ہیں؟" --lang ur --play
  
  # Voice cloning (requires reference audio)
  python tts_live.py --text "Hello" --speaker speaker.wav --play
        """
    )
    
    parser.add_argument(
        "--text",
        type=str,
        default=None,
        help="Text to synthesize (if not provided, uses interactive or file mode)"
    )
    
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Input text file path"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output audio file path (WAV format)"
    )
    
    parser.add_argument(
        "--lang",
        type=str,
        default="en",
        help="Language code (default: en). Supported: en, ur, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh-cn, ja, hu, ko"
    )
    
    parser.add_argument(
        "--play",
        action="store_true",
        help="Automatically play audio after synthesis"
    )
    
    parser.add_argument(
        "--no-play",
        action="store_true",
        help="Don't play audio (useful when saving to file)"
    )
    
    parser.add_argument(
        "--device",
        type=str,
        choices=["cuda", "cpu"],
        default=None,
        help="Force device (cuda or cpu). If not specified, auto-detects."
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default="tts_models/multilingual/multi-dataset/xtts_v2",
        help="TTS model name (default: xtts_v2)"
    )
    
    parser.add_argument(
        "--speaker",
        type=str,
        default=None,
        help="Path to reference audio file for voice cloning (3-10 seconds)"
    )
    
    parser.add_argument(
        "--list-languages",
        action="store_true",
        help="List supported languages and exit"
    )
    
    args = parser.parse_args()
    
    # List languages if requested
    if args.list_languages:
        print("Supported languages:")
        print("en (English), ur (Urdu), es (Spanish), fr (French), de (German),")
        print("it (Italian), pt (Portuguese), pl (Polish), tr (Turkish), ru (Russian),")
        print("nl (Dutch), cs (Czech), ar (Arabic), zh-cn (Chinese), ja (Japanese),")
        print("hu (Hungarian), ko (Korean)")
        return
    
    # Determine play mode
    play_audio = args.play and not args.no_play
    
    # Initialize TTS service
    try:
        print("Initializing TTS service...")
        print(f"Model: {args.model}")
        print(f"Device: {args.device or 'auto-detect'}")
        
        tts_service = TTSService(
            model_name=args.model,
            device=args.device,
        )
        
        print("TTS service ready!")
        print("-" * 60)
        
    except Exception as e:
        print(f"Error: Failed to initialize TTS service: {e}")
        logger.error(f"TTS initialization error: {e}", exc_info=True)
        sys.exit(1)
    
    try:
        # Determine mode
        if args.text:
            # Direct text mode
            synthesize_text(
                tts_service=tts_service,
                text=args.text,
                language=args.lang,
                output_path=args.output,
                play=play_audio,
                speaker_wav=args.speaker,
            )
        elif args.file:
            # File mode
            file_mode(
                tts_service=tts_service,
                file_path=args.file,
                output_path=args.output,
                language=args.lang,
                play=play_audio,
            )
        else:
            # Interactive mode
            interactive_mode(
                tts_service=tts_service,
                language=args.lang,
                play=play_audio,
            )
    
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"Error: {e}")
        logger.error(f"Runtime error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        tts_service.close()


if __name__ == "__main__":
    main()

