"""
Qwen3-TTS adapter: same interface as TTSService for pipeline testing.
Use when tts_backend=qwen3 in the API. Optional dependency: pip install qwen-tts.
"""
import logging
import os
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# Language code (API) -> Qwen3-TTS language name
_LANG_MAP = {
    "en": "English",
    "zh-cn": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "de": "German",
    "fr": "French",
    "ru": "Russian",
    "pt": "Portuguese",
    "es": "Spanish",
    "it": "Italian",
}


def _qwen3_language(language: str) -> str:
    return _LANG_MAP.get(language.lower() if language else "en", "English")


class Qwen3TTSAdapter:
    """
    Adapter that exposes synthesize_to_file(text, output_path, language, speaker_wav=None)
    so it can be used in place of TTSService for pipeline testing.
    """

    def __init__(self, model_size: str = "0.6B"):
        self.model_size = model_size
        self._model = None
        self._lock = threading.Lock()

    def _ensure_model(self):
        with self._lock:
            if self._model is not None:
                return
            try:
                import torch
                import soundfile as sf  # noqa: F401 - used at runtime
            except ImportError as e:
                raise RuntimeError(
                    "Qwen3-TTS adapter requires qwen-tts and dependencies. "
                    "Install with: pip install qwen-tts soundfile"
                ) from e
            try:
                from qwen_tts import Qwen3TTSModel
            except ImportError as e:
                raise RuntimeError(
                    "Qwen3-TTS adapter requires qwen-tts. Install with: pip install qwen-tts"
                ) from e

            model_id = (
                "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
                if self.model_size == "0.6B"
                else "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
            )
            device = "cuda" if torch.cuda.is_available() else "cpu"
            # Use float32 for numerical stability (avoids inf/nan in sampling; uses more VRAM)
            dtype = torch.float32
            device_map = "cuda:0" if device == "cuda" else "cpu"
            load_kwargs = {"device_map": device_map, "torch_dtype": dtype}
            try:
                import flash_attn  # noqa: F401
                load_kwargs["attn_implementation"] = "flash_attention_2"
            except ImportError:
                pass
            logger.info("Loading Qwen3-TTS model %s on %s (float32)", model_id, device_map)
            self._model = Qwen3TTSModel.from_pretrained(model_id, **load_kwargs)
            logger.info("Qwen3-TTS model loaded")

    def synthesize_to_file(
        self,
        text: str,
        output_path: str,
        language: str = "en",
        speaker_wav: Optional[str] = None,
    ) -> str:
        """
        Same signature as TTSService.synthesize_to_file for drop-in pipeline use.
        speaker_wav is ignored (CustomVoice uses built-in speakers).
        Uses Sohee voice with therapist-style instruction for supportive tone.
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        self._ensure_model()
        import soundfile as sf

        qwen_lang = _qwen3_language(language)
        # Aiden: sunny American male voice with a clear midrange (English-native, non-Asian)
        speaker = "Aiden"
        # Therapist-style instruction: warm, calm, natural English pace
        instruct = (
            "Speak in a warm, calm, and empathetic tone like a supportive therapist. "
            "Natural conversational pacing, emotionally attuned and reassuring."
        )
        # Prefer stable sampling kwargs to avoid inf/nan in probability tensor
        try:
            wavs, sr = self._model.generate_custom_voice(
                text=text.strip(),
                language=qwen_lang,
                speaker=speaker,
                instruct=instruct,
                temperature=0.9,
                top_p=0.95,
            )
        except TypeError:
            wavs, sr = self._model.generate_custom_voice(
                text=text.strip(),
                language=qwen_lang,
                speaker=speaker,
                instruct=instruct,
            )
        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        sf.write(output_path, wavs[0], sr)
        return output_path
