"""
Text-to-Speech Service

Core TTS service class using Coqui TTS (XTTS v2) for high-quality,
multilingual text-to-speech synthesis.
Supports CUDA acceleration when available, falls back to CPU.
"""

import logging
import os
import shutil
import tempfile
import time
from typing import Optional, List

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


class TTSService:
    """
    Text-to-Speech service using Coqui TTS (XTTS v2).
    
    Automatically detects and uses CUDA if available, otherwise falls back to CPU.
    Supports multilingual synthesis with high-quality voices.
    """
    
    def __init__(
        self,
        model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2",
        device: Optional[str] = None,
        gpu: Optional[bool] = None,
    ):
        """
        Initialize the TTS service.
        
        Args:
            model_name: Coqui TTS model name (default: XTTS v2)
            device: Force device ("cuda" or "cpu"). If None, auto-detects CUDA.
            gpu: Force GPU usage (True/False). If None, auto-detects.
        """
        self.model_name = model_name
        self.device = device
        self.gpu = gpu
        self.model = None
        self.tts = None
        self._default_speaker_wav = None  # Cached default speaker reference
        
        # Auto-detect device if not specified
        if self.device is None:
            try:
                import torch
                if self.gpu is not None:
                    self.device = "cuda" if self.gpu else "cpu"
                else:
                    self.device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                self.device = "cpu"
                logger.warning("PyTorch not available, defaulting to CPU")
        
        self._load_model()
    
    def _load_model(self):
        """Load the TTS model with specified device."""
        logger.info(f"Loading TTS model: {self.model_name}")
        logger.info(f"Device: {self.device}")
        
        start_time = time.time()
        
        try:
            # Patch transformers so Coqui TTS can import BeamSearchScorer (moved in newer transformers)
            import transformers as _tf
            if not getattr(_tf, "BeamSearchScorer", None):
                try:
                    from transformers.generation.beam_search import BeamSearchScorer
                    _tf.BeamSearchScorer = BeamSearchScorer
                except ImportError:
                    try:
                        from transformers.generation import BeamSearchScorer
                        _tf.BeamSearchScorer = BeamSearchScorer
                    except ImportError:
                        pass
            # Patch torch.load for PyTorch 2.6+ compatibility
            # PyTorch 2.6+ defaults to weights_only=True, but TTS models need weights_only=False
            import torch
            torch._original_load = torch.load
            
            def patched_load(*args, **kwargs):
                # If weights_only is not explicitly set, default to False for TTS models
                if 'weights_only' not in kwargs:
                    kwargs['weights_only'] = False
                return torch._original_load(*args, **kwargs)
            
            # Apply the patch
            torch.load = patched_load
            
            from TTS.api import TTS
            
            # Initialize TTS
            # Use gpu parameter explicitly for better control
            use_gpu = self.device == "cuda"
            self.tts = TTS(model_name=self.model_name, progress_bar=True, gpu=use_gpu)
            
            # Restore original torch.load after model loading
            torch.load = torch._original_load
            
            # Move model to device if CUDA
            if self.device == "cuda":
                try:
                    # XTTS models automatically use GPU if available
                    logger.info("Using CUDA for TTS synthesis")
                except Exception as e:
                    logger.warning(f"CUDA initialization warning: {e}")
            
            load_time = time.time() - start_time
            logger.info(f"TTS model loaded successfully in {load_time:.2f} seconds")
            logger.info(f"Using device: {self.device}")
            
        except Exception as e:
            logger.error(f"Failed to load TTS model: {e}")
            # Restore original torch.load if patch was applied
            try:
                import torch
                if hasattr(torch, '_original_load'):
                    torch.load = torch._original_load
            except:
                pass
            
            # Fallback to CPU if CUDA fails
            if self.device == "cuda":
                logger.warning("CUDA load failed, falling back to CPU")
                self.device = "cpu"
                try:
                    # Re-apply patch for CPU fallback
                    import torch
                    torch._original_load = torch.load
                    def patched_load(*args, **kwargs):
                        if 'weights_only' not in kwargs:
                            kwargs['weights_only'] = False
                        return torch._original_load(*args, **kwargs)
                    torch.load = patched_load
                    
                    from TTS.api import TTS
                    self.tts = TTS(model_name=self.model_name, progress_bar=True)
                    
                    # Restore original torch.load
                    torch.load = torch._original_load
                    
                    load_time = time.time() - start_time
                    logger.info(f"TTS model loaded on CPU in {load_time:.2f} seconds")
                except Exception as e2:
                    # Restore original torch.load on error
                    try:
                        import torch
                        if hasattr(torch, '_original_load'):
                            torch.load = torch._original_load
                    except:
                        pass
                    raise RuntimeError(f"Failed to load TTS model on CPU: {e2}")
            else:
                raise
    
    def synthesize(
        self,
        text: str,
        language: str = "en",
        speaker_wav: Optional[str] = None,
        output_path: Optional[str] = None,
    ) -> tuple[np.ndarray, int]:
        """
        Synthesize speech from text.
        
        Args:
            text: Text to synthesize
            language: Language code (e.g., "en", "ur", "es", "fr")
            speaker_wav: Optional path to reference audio for voice cloning
            output_path: Optional path to save audio file. If None, returns numpy array.
        
        Returns:
            Tuple of (NumPy array of audio samples (float32, mono), sample_rate in Hz)
        """
        if self.tts is None:
            raise RuntimeError("Model not loaded. Call _load_model() first.")
        
        if not text or not text.strip():
            logger.warning("Empty text provided for synthesis")
            return np.array([], dtype=np.float32), 22050
        
        try:
            # Preprocess text (remove extra whitespace, handle newlines)
            text = " ".join(text.split())
            
            # XTTS v2 synthesis
            # Always use temp file approach for consistency
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
                temp_path = tmp.name
            
            try:
                # Get speaker reference
                if not speaker_wav:
                    speaker_wav = self._get_default_speaker_wav(language)
                
                if not os.path.exists(speaker_wav):
                    raise FileNotFoundError(f"Speaker reference audio not found: {speaker_wav}")
                
                # Try to access synthesizer directly for parameter control
                # This allows us to adjust parameters for more natural output
                try:
                    synthesizer = self.tts.synthesizer
                    if synthesizer and hasattr(synthesizer, 'model'):
                        # Try to adjust XTTS parameters for more natural speech
                        # Lower temperature = more consistent, less robotic
                        # Adjust gpt_cond_len for better conditioning
                        if hasattr(synthesizer.model, 'inference'):
                            # Access inference parameters if available
                            pass  # Parameters might be set during model init
                except (AttributeError, Exception) as e:
                    logger.debug(f"Could not access synthesizer parameters: {e}")
                
                # Use tts_to_file for XTTS v2
                # The model's natural output is preserved with minimal post-processing
                self.tts.tts_to_file(
                    text=text,
                    file_path=temp_path,
                    speaker_wav=speaker_wav,
                    language=language,
                )
                
                # Load the generated audio
                audio, sample_rate = sf.read(temp_path, dtype='float32')
                
                # Ensure we have a valid sample rate (XTTS typically uses 22050 or 24000)
                if sample_rate is None or sample_rate <= 0:
                    sample_rate = 22050  # Default fallback
                    logger.warning(f"Invalid sample rate detected, using default: {sample_rate}")
                
                # Post-process audio for clarity and quality
                audio = self._post_process_audio(audio, sample_rate)
                
                # If output_path specified, save the processed audio
                if output_path:
                    sf.write(output_path, audio, int(sample_rate), subtype='PCM_16')
                
                return audio, int(sample_rate)
                
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                    except Exception:
                        pass
                    
        except Exception as e:
            logger.error(f"TTS synthesis error: {e}", exc_info=True)
            raise RuntimeError(f"Failed to synthesize speech: {e}")
    
    def synthesize_to_file(
        self,
        text: str,
        output_path: str,
        language: str = "en",
        speaker_wav: Optional[str] = None,
    ) -> str:
        """
        Synthesize speech from text and save to file.
        
        Args:
            text: Text to synthesize
            output_path: Path to save audio file (WAV format)
            language: Language code (e.g., "en", "ur")
            speaker_wav: Optional path to reference audio for voice cloning
        
        Returns:
            Path to saved audio file
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Synthesize and save
        self.synthesize(
            text=text,
            language=language,
            speaker_wav=speaker_wav,
            output_path=output_path,
        )
        
        return output_path
    
    def list_voices(self, language: str = "en") -> List[str]:
        """
        List available voices for a language.
        
        Args:
            language: Language code
        
        Returns:
            List of available voice names/IDs
        """
        if self.tts is None:
            raise RuntimeError("Model not loaded. Call _load_model() first.")
        
        try:
            # XTTS v2 uses speaker embeddings, not discrete voices
            # Return language info instead
            # For XTTS, voices are created via voice cloning or use default speaker
            return [f"default_{language}"]
        except Exception as e:
            logger.error(f"Error listing voices: {e}")
            return []
    
    def _post_process_audio(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        """
        Minimal post-processing to preserve natural XTTS output.
        Only removes DC offset and prevents clipping - no filtering or enhancement.
        The reference audio is already perfect, so we preserve the model's natural output.
        
        Args:
            audio: Audio array (float32)
            sample_rate: Sample rate in Hz
        
        Returns:
            Processed audio array
        """
        if audio.size == 0:
            return audio
        
        # Convert to mono if stereo
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=1)
        
        # Ensure float32
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        
        # Only remove DC offset (prevents clicks/pops)
        audio = audio - np.mean(audio)
        
        # Only prevent clipping - no normalization, no compression, no filtering
        # This preserves the natural dynamics and characteristics of the XTTS output
        max_val = np.abs(audio).max()
        if max_val > 0.99:
            # Only scale down if it would clip
            audio = audio * (0.99 / max_val)
        
        # Final safety clip (shouldn't be needed after above check)
        audio = np.clip(audio, -1.0, 1.0)
        
        return audio
    
    def _get_default_speaker_wav(self, language: str = "en") -> str:
        """
        Get the default speaker reference audio file for XTTS v2.
        Looks for audio files in backend/tts/Audios/ directory.
        
        Args:
            language: Language code (for future language-specific references)
        
        Returns:
            Path to default speaker reference audio file
        """
        # Check if we already have a cached default speaker
        if self._default_speaker_wav and os.path.exists(self._default_speaker_wav):
            return self._default_speaker_wav
        
        # Look for default speaker in backend/tts/Audios/ directory
        # Get the directory where this file is located
        current_dir = os.path.dirname(os.path.abspath(__file__))
        audios_dir = os.path.join(current_dir, "Audios")
        
        # Try to find Audio1.wav (or other default files)
        default_files = [
            os.path.join(audios_dir, "Default Speaker.wav"),
            os.path.join(audios_dir, "default_speaker.wav"),
            os.path.join(audios_dir, "therapist_voice.wav"),
            os.path.join(audios_dir, f"default_{language}.wav"),
        ]
        
        # Check each potential file
        for audio_file in default_files:
            if os.path.exists(audio_file):
                self._default_speaker_wav = audio_file
                logger.info(f"Using default speaker reference: {audio_file}")
                return audio_file
        
        # If no file found, check if Audios directory exists and list available files
        if os.path.exists(audios_dir):
            available_files = [f for f in os.listdir(audios_dir) if f.lower().endswith('.wav')]
            if available_files:
                # Use the first available WAV file
                first_wav = os.path.join(audios_dir, available_files[0])
                self._default_speaker_wav = first_wav
                logger.info(f"Using first available speaker reference: {first_wav}")
                return first_wav
        
        # If still no file found, raise helpful error
        raise RuntimeError(
            f"XTTS v2 requires a speaker reference audio file (speaker_wav) for voice cloning.\n"
            f"No default speaker file found in: {audios_dir}\n"
            f"\nPlease either:\n"
            f"  1. Place a WAV file (3-10 seconds) in: {audios_dir}\n"
            f"     (Name it: Audio1.wav, default_speaker.wav, or therapist_voice.wav)\n"
            f"  2. Or provide a reference audio file using the --speaker option.\n"
            f"\nExample usage:\n"
            f"  python tts_live.py --text 'Your text here' --speaker reference.wav --lang {language} --play"
        )
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported languages.
        
        Returns:
            List of language codes
        """
        # XTTS v2 supports 17 languages
        return [
            "en",  # English
            "es",  # Spanish
            "fr",  # French
            "de",  # German
            "it",  # Italian
            "pt",  # Portuguese
            "pl",  # Polish
            "tr",  # Turkish
            "ru",  # Russian
            "nl",  # Dutch
            "cs",  # Czech
            "ar",  # Arabic
            "zh-cn",  # Chinese (Simplified)
            "ja",  # Japanese
            "hu",  # Hungarian
            "ko",  # Korean
            "ur",  # Urdu
        ]
    
    def close(self):
        """Clean up model and release resources."""
        if self.tts is not None:
            # Clear TTS instance
            self.tts = None
            logger.info("TTS service closed")
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

