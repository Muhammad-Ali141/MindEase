"""
Speech-to-Text Service

Core STT service class using faster-whisper for real-time transcription.
Supports CUDA acceleration when available (float16), falls back to CPU (int8).
"""

import logging
import os
import time
from typing import Optional

import numpy as np
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


class SpeechToTextService:
    """
    Speech-to-Text service using faster-whisper.
    
    Automatically detects and uses CUDA if available, otherwise falls back to CPU.
    Optimized for real-time transcription with configurable compute types.
    """
    
    def __init__(
        self,
        model_id: str = "Systran/faster-whisper-large-v3",
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        beam_size: int = 5,
        best_of: int = 5,
        temperature: float = 0.0,
        vad_filter: bool = True,
    ):
        """
        Initialize the STT service.
        
        Args:
            model_id: HuggingFace model ID (default: "Systran/faster-whisper-large-v3")
            device: Force device ("cuda" or "cpu"). If None, auto-detects CUDA.
            compute_type: Force compute type ("float16", "int8", "float32").
                         If None, auto-selects based on device.
            beam_size: Beam size for decoding.
            best_of: Number of best candidates to consider when temperature > 0.
            temperature: Softmax temperature (0 = deterministic).
            vad_filter: Enable VAD filter inside faster-whisper.
        """
        self.model_id = model_id
        self.model = None
        self.device = device
        self.compute_type = compute_type
        self.beam_size = beam_size
        self.best_of = best_of
        self.temperature = temperature
        self.vad_filter = vad_filter
        
        # Device selection: explicit arg > env MINDEASE_STT_DEVICE > auto-detect CUDA
        if self.device is None:
            env_device = os.environ.get("MINDEASE_STT_DEVICE", "").strip().lower()
            if env_device in ("cuda", "cpu"):
                self.device = env_device
                logger.info(f"STT device from env MINDEASE_STT_DEVICE: {self.device}")
            else:
                try:
                    import torch
                    self.device = "cuda" if torch.cuda.is_available() else "cpu"
                    if self.device == "cuda":
                        logger.info("STT using CUDA (GPU acceleration)")
                    else:
                        logger.info("STT using CPU (no GPU or CUDA not available)")
                except ImportError:
                    self.device = "cpu"
                    logger.warning("PyTorch not available, STT defaulting to CPU")
        
        # Auto-select compute type: CUDA -> float16, CPU -> int8
        if self.compute_type is None:
            if self.device == "cuda":
                self.compute_type = "float16"
            else:
                self.compute_type = "int8"
        
        self._load_model()
    
    def _load_model(self):
        """Load the Whisper model with specified device and compute type."""
        logger.info(f"Loading model: {self.model_id}")
        logger.info(f"Device: {self.device}, Compute type: {self.compute_type}")
        
        start_time = time.time()
        
        try:
            self.model = WhisperModel(
                self.model_id,
                device=self.device,
                compute_type=self.compute_type,
            )
            load_time = time.time() - start_time
            logger.info(f"STT model loaded successfully in {load_time:.2f} seconds")
            logger.info(f"STT device: {self.device}, compute_type: {self.compute_type}" + (" (CUDA)" if self.device == "cuda" else " (CPU)"))
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            # Fallback to CPU if CUDA fails
            if self.device == "cuda":
                logger.warning("CUDA load failed, falling back to CPU")
                self.device = "cpu"
                self.compute_type = "int8"
                self.model = WhisperModel(
                    self.model_id,
                    device=self.device,
                    compute_type=self.compute_type,
                )
                load_time = time.time() - start_time
                logger.info(f"Model loaded on CPU in {load_time:.2f} seconds")
            else:
                raise
    
    def transcribe_audio_array(
        self,
        audio: np.ndarray,
        sample_rate: int,
        language: Optional[str] = None,
        beam_size: Optional[int] = None,
        vad_filter: Optional[bool] = None,
    ) -> str:
        """
        Transcribe audio array to text.
        
        Args:
            audio: NumPy array of audio samples (float32, mono)
            sample_rate: Sample rate of the audio (will be resampled to 16kHz if needed)
            language: Language code (None/"auto" enables auto-detect)
            beam_size: Beam size override
            vad_filter: Override for voice activity detection filter
        
        Returns:
            Transcribed text string
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call _load_model() first.")
        
        # Ensure audio is float32 and mono
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        
        # Normalize audio to [-1, 1] range if needed
        if audio.max() > 1.0 or audio.min() < -1.0:
            max_val = np.abs(audio).max()
            if max_val > 0:
                audio = audio / max_val
        
        # Resample to 16kHz if needed (faster-whisper handles this, but we can do it explicitly)
        target_sample_rate = 16000
        if sample_rate != target_sample_rate:
            import resampy
            audio = resampy.resample(audio, sample_rate, target_sample_rate)
            sample_rate = target_sample_rate
        
        # Force English only - no auto-detection
        chosen_language = "en" if language in (None, "", "auto", "detect") else language
        chosen_beam = beam_size or self.beam_size
        use_vad = self.vad_filter if vad_filter is None else vad_filter
        
        try:
            # Transcribe using faster-whisper with very conservative settings to prevent hallucinations
            segments, info = self.model.transcribe(
                audio,
                language=chosen_language,
                beam_size=chosen_beam,
                best_of=self.best_of,
                temperature=self.temperature,
                vad_filter=use_vad,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    threshold=0.5,
                ) if use_vad else None,
                compression_ratio_threshold=2.4,  # Filter out repetitive text (hallucinations)
                log_prob_threshold=-1.0,  # Filter low-confidence predictions
                condition_on_previous_text=False,  # Disable to prevent hallucination propagation
                # NO initial_prompt - it causes hallucinations
                word_timestamps=False,
                no_speech_threshold=0.6,  # Higher threshold to avoid transcribing silence
                repetition_penalty=1.2,  # Penalize repetition (reduces hallucinations)
                suppress_blank=True,  # Suppress blank outputs
                suppress_tokens=[-1],  # Suppress special tokens that might cause hallucinations
            )
            
            # Collect all segments into a single text
            transcript_parts = []
            for segment in segments:
                text = segment.text.strip()
                if text:
                    # Filter out common hallucinations
                    text = self._filter_hallucinations(text)
                    if text:  # Only add if text remains after filtering
                        transcript_parts.append(text)
            
            transcript = " ".join(transcript_parts).strip()
            
            # Final pass: filter the entire transcript for any remaining hallucinations
            if transcript:
                transcript = self._filter_hallucinations(transcript)
            
            return transcript
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""
    
    def _filter_hallucinations(self, text: str) -> str:
        """
        Filter out common hallucination phrases that Whisper sometimes adds.
        Only removes "thank you" when it appears in suspicious contexts (likely hallucinations),
        but preserves it when it's part of natural conversation.
        """
        import re
        
        # Common hallucination phrases that should ALWAYS be removed (YouTube-style)
        always_remove = [
            "thank you for watching",
            "thanks for watching",
            "please subscribe",
            "like and subscribe",
            "don't forget to subscribe",
            "hit the like button",
            "comment below",
            "thanks for listening",
            "thank you for listening",
            "see you next time",
            "until next time",
            "that's all for today",
            "thanks for tuning in",
            "thank you for tuning in",
        ]
        
        text_lower = text.lower()
        original_text = text
        
        # Remove complete hallucination phrases (YouTube-style)
        for phrase in always_remove:
            if phrase in text_lower:
                pattern = re.compile(re.escape(phrase), re.IGNORECASE)
                text = pattern.sub('', text).strip()
                text_lower = text.lower()
        
        # Now handle "thank you" more carefully - only remove if it's suspicious
        # Split by sentence boundaries
        sentences = re.split(r'([.!?]\s*)', text)
        filtered_sentences = []
        
        i = 0
        while i < len(sentences):
            sentence = sentences[i]
            sentence_clean = sentence.strip().lower()
            
            # Skip empty sentences
            if not sentence_clean:
                i += 1
                continue
            
            # Remove standalone "thank you" sentences (these are almost always hallucinations)
            # Examples: "Thank you." "Thanks." "Thank you!" etc.
            if sentence_clean in ['thank you', 'thanks', 'thank you.', 'thanks.', 'thank you!', 'thanks!', 'thank you?', 'thanks?']:
                # Skip this sentence and its punctuation
                if i + 1 < len(sentences) and sentences[i + 1].strip() in ['.', '!', '?']:
                    i += 2
                else:
                    i += 1
                continue
            
            # Remove sentences that END with just "thank you" or "thanks" (common hallucination)
            # But only if the sentence is very short (likely hallucination)
            # Examples: "That's all. Thank you." -> remove "Thank you."
            words = sentence_clean.split()
            if len(words) <= 3 and (sentence_clean.endswith('thank you') or sentence_clean.endswith('thanks')):
                # Very short sentence ending with thank you = likely hallucination
                if i + 1 < len(sentences) and sentences[i + 1].strip() in ['.', '!', '?']:
                    i += 2
                else:
                    i += 1
                continue
            
            # Remove sentences that START with "thank you" if they're very short
            # Examples: "Thank you. Can you help?" -> remove "Thank you."
            if (sentence_clean.startswith('thank you') or sentence_clean.startswith('thanks')):
                if len(words) <= 2:  # Very short = likely hallucination
                    if i + 1 < len(sentences) and sentences[i + 1].strip() in ['.', '!', '?']:
                        i += 2
                    else:
                        i += 1
                    continue
            
            # Keep the sentence (including legitimate "thank you" in longer sentences)
            filtered_sentences.append(sentence)
            i += 1
        
        text = ''.join(filtered_sentences).strip()
        
        # Clean up extra spaces and punctuation artifacts
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\s+([.!?,])', r'\1', text)  # Remove space before punctuation
        text = re.sub(r'([.!?])\s*([.!?])+', r'\1', text)  # Remove duplicate punctuation
        
        # If text became too short after filtering, it might have been mostly hallucination
        if len(text) < 3 and len(original_text) > 10:
            return ""  # Return empty if we filtered out too much
        
        return text.strip()
            
    
    def transcribe_file(
        self,
        file_path: str,
        language: Optional[str] = None,
        beam_size: Optional[int] = None,
        vad_filter: Optional[bool] = None,
    ) -> str:
        """
        Transcribe an audio file.
        
        Args:
            file_path: Path to audio file (WAV, MP3, WebM, etc.)
            language: Language code (default: "en")
            beam_size: Beam size for decoding (default: 5)
            vad_filter: Enable voice activity detection filter (default: True)
        
        Returns:
            Transcribed text string
        """
        import soundfile as sf
        import os
        import tempfile
        
        # Check if file is WebM or MP4 (browser formats that soundfile can't read)
        file_ext = os.path.splitext(file_path)[1].lower()
        needs_conversion = file_ext in ['.webm', '.mp4', '.m4a', '.ogg']
        
        temp_wav_path = None
        
        try:
            if needs_conversion:
                # Convert to WAV using pydub (requires ffmpeg)
                try:
                    from pydub import AudioSegment
                    
                    # Load audio file
                    audio_segment = AudioSegment.from_file(file_path)
                    
                    # Convert to mono and 16kHz
                    audio_segment = audio_segment.set_channels(1)  # Mono
                    audio_segment = audio_segment.set_frame_rate(16000)  # 16kHz
                    
                    # Export to temporary WAV file
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_wav:
                        temp_wav_path = temp_wav.name
                        audio_segment.export(temp_wav_path, format="wav")
                    
                    # Read the converted WAV file
                    audio, sample_rate = sf.read(temp_wav_path, dtype='float32')
                except ImportError:
                    raise RuntimeError(
                        "pydub is required for WebM/MP4 audio files. "
                        "Install it with: pip install pydub. "
                        "Also ensure ffmpeg is installed on your system. "
                        "For Windows: Download from https://ffmpeg.org/download.html "
                        "or use: winget install ffmpeg"
                    )
                except Exception as e:
                    error_msg = str(e)
                    if "ffmpeg" in error_msg.lower() or "not found" in error_msg.lower():
                        raise RuntimeError(
                            f"FFmpeg is required to convert WebM files. "
                            f"Please install ffmpeg: {error_msg}. "
                            f"For Windows: Download from https://ffmpeg.org/download.html "
                            f"or use: winget install ffmpeg"
                        )
                    raise RuntimeError(f"Failed to convert audio file: {error_msg}")
            else:
                # Use soundfile directly for supported formats (WAV, MP3, FLAC, etc.)
                audio, sample_rate = sf.read(file_path, dtype='float32')
                
                # Convert to mono if stereo
                if len(audio.shape) > 1:
                    audio = np.mean(audio, axis=1)
            
            return self.transcribe_audio_array(
                audio,
                sample_rate,
                language=language,
                beam_size=beam_size,
                vad_filter=vad_filter,
            )
        finally:
            # Clean up temporary WAV file if created
            if temp_wav_path and os.path.exists(temp_wav_path):
                try:
                    os.unlink(temp_wav_path)
                except Exception:
                    pass
    
    def close(self):
        """Clean up model and release resources."""
        if self.model is not None:
            # faster-whisper models don't need explicit cleanup, but we can clear reference
            self.model = None
            logger.info("STT service closed")
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

