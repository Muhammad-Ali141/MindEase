"""
Facebook MMS-TTS adapter for Urdu (Arabic script).
Model: facebook/mms-tts-urd-script_arabic  (~350 MB, VITS-based)
Requires: transformers>=4.33 (already in requirements), soundfile, torch.
No reference audio needed. Auto-downloads model weights on first call.
"""
import io
import logging
import os
import re
import threading
import time
from typing import List

import numpy as np

logger = logging.getLogger(__name__)

_SENTENCE_RE = re.compile(r'(?<=[۔؟!.?!])\s+')


def _split_text(text: str, max_chars: int = 400) -> List[str]:
    """Split on sentence boundaries; hard-split only if a sentence exceeds max_chars."""
    text = " ".join(text.strip().split())
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    sentences = [s.strip() for s in _SENTENCE_RE.split(text) if s.strip()]
    chunks: List[str] = []
    cur = ""
    for s in sentences:
        if not cur:
            cur = s
        elif len(cur) + 1 + len(s) <= max_chars:
            cur = cur + " " + s
        else:
            chunks.append(cur)
            cur = s
    if cur:
        chunks.append(cur)

    # Hard-split any chunk that's still too long
    final: List[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            final.append(chunk)
        else:
            for i in range(0, len(chunk), max_chars):
                final.append(chunk[i:i + max_chars])
    return [c for c in final if c.strip()]


class MmsUrduTTSAdapter:
    """
    Drop-in TTS adapter using facebook/mms-tts-urd-script_arabic.
    Exposes synthesize_to_wav_bytes() and synthesize_to_file() matching
    the same interface as Qwen3TTSAdapter and TTSService.
    """

    MODEL_ID = "facebook/mms-tts-urd-script_arabic"

    def __init__(self):
        self._model = None
        self._tokenizer = None
        self._device = None
        self._sr = 16000
        self._load_lock = threading.Lock()
        self._infer_lock = threading.Lock()

    def _ensure_model(self) -> None:
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            try:
                import torch
                from transformers import AutoTokenizer, VitsModel
            except ImportError as e:
                raise RuntimeError(
                    "MMS-TTS adapter requires transformers>=4.33 and torch. "
                    "Both are already in requirements.txt."
                ) from e

            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info("Loading MMS-TTS model %s on %s", self.MODEL_ID, device)
            t0 = time.perf_counter()
            self._tokenizer = AutoTokenizer.from_pretrained(self.MODEL_ID)
            model = VitsModel.from_pretrained(self.MODEL_ID)
            model = model.to(device)
            model.eval()
            self._model = model
            self._device = device
            self._sr = int(model.config.sampling_rate)
            logger.info(
                "MMS-TTS model loaded in %.1fs  sr=%s device=%s",
                time.perf_counter() - t0,
                self._sr,
                device,
            )

    @staticmethod
    def _env_float(name: str, default: float, lo: float, hi: float) -> float:
        try:
            v = float(os.environ.get(name, default))
            return max(lo, min(hi, v))
        except (TypeError, ValueError):
            return default

    def _synthesize_chunk(self, text: str) -> np.ndarray:
        """Synthesize a single chunk; returns float32 mono array."""
        import torch

        # Apply voice style from env vars (read per-call so changes take effect without restart)
        speaking_rate = self._env_float("URDU_TTS_SPEAKING_RATE", 1.0, 0.5, 2.0)
        noise_scale   = self._env_float("URDU_TTS_NOISE_SCALE",   0.667, 0.1, 1.5)
        self._model.config.speaking_rate = speaking_rate
        self._model.config.noise_scale   = noise_scale

        inputs = self._tokenizer(text, return_tensors="pt")
        inputs = {k: v.to(self._device) for k, v in inputs.items()}
        with torch.no_grad():
            output = self._model(**inputs).waveform
        return output.squeeze().cpu().numpy().astype(np.float32)

    def _synthesize_text(self, text: str) -> np.ndarray:
        """Split text into safe chunks, synthesize each, concatenate with a short pause."""
        chunks = _split_text(text)
        if not chunks:
            raise ValueError("Text cannot be empty")

        pause_samples = max(1, int(self._sr * 0.05))
        parts: List[np.ndarray] = []

        with self._infer_lock:
            for i, chunk in enumerate(chunks):
                arr = self._synthesize_chunk(chunk)
                if i > 0:
                    parts.append(np.zeros(pause_samples, dtype=np.float32))
                parts.append(arr)

        return np.concatenate(parts) if len(parts) > 1 else parts[0]

    def synthesize_to_wav_bytes(self, text: str, language: str = "ur") -> bytes:
        """Return WAV file as bytes (in-memory). language param accepted but ignored (model is Urdu-only)."""
        import soundfile as sf

        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        self._ensure_model()
        t0 = time.perf_counter()
        wav = self._synthesize_text(text)
        buf = io.BytesIO()
        sf.write(buf, wav, self._sr, format="WAV", subtype="PCM_16")
        raw = buf.getvalue()
        logger.debug(
            "MMS-TTS synthesize_to_wav_bytes: total_ms=%.1f bytes=%s",
            (time.perf_counter() - t0) * 1000.0,
            len(raw),
        )
        return raw

    def synthesize_to_file(
        self,
        text: str,
        output_path: str,
        language: str = "ur",
        speaker_wav=None,
    ) -> str:
        """Write WAV to output_path and return path. Matches TTSService/Qwen3TTSAdapter signature."""
        import os
        import soundfile as sf

        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        self._ensure_model()
        t0 = time.perf_counter()
        wav = self._synthesize_text(text)
        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        sf.write(output_path, wav, self._sr, subtype="PCM_16")
        logger.debug(
            "MMS-TTS synthesize_to_file: total_ms=%.1f path=%s",
            (time.perf_counter() - t0) * 1000.0,
            output_path,
        )
        return output_path
