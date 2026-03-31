"""
Qwen3-TTS adapter: same interface as TTSService for pipeline testing.
Use when tts_backend=qwen3 in the API. Optional dependency: pip install qwen-tts.
"""
import io
import logging
import os
import re
import threading
import time
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


def _env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes")


def _resolve_cuda_dtype(torch_mod, device: str):
    """Explicit dtype for Qwen3 load: env MINDEASE_QWEN3_DTYPE or auto bf16/fp16 on CUDA."""
    if device != "cuda":
        return torch_mod.float32
    raw = os.environ.get("MINDEASE_QWEN3_DTYPE", "").strip().lower()
    if raw in ("bf16", "bfloat16"):
        return torch_mod.bfloat16
    if raw in ("fp16", "float16"):
        return torch_mod.float16
    if raw in ("auto", ""):
        return (
            torch_mod.bfloat16
            if torch_mod.cuda.is_bf16_supported()
            else torch_mod.float16
        )
    logger.warning(
        "Unknown MINDEASE_QWEN3_DTYPE=%r; using auto bfloat16/float16",
        os.environ.get("MINDEASE_QWEN3_DTYPE"),
    )
    return (
        torch_mod.bfloat16
        if torch_mod.cuda.is_bf16_supported()
        else torch_mod.float16
    )


def _dtype_label(dtype) -> str:
    import torch

    if dtype == torch.float32:
        return "float32"
    if dtype == torch.float16:
        return "float16"
    if dtype == torch.bfloat16:
        return "bfloat16"
    return str(dtype)


def _collect_attn_implementations(root_module) -> List[str]:
    """
    Unique attn_implementation values from HF PreTrainedModel submodules.
    Qwen3TTSModel is a thin wrapper without .modules(); unwrap .model first.
    """
    if root_module is None:
        return []
    modules_fn = getattr(root_module, "modules", None)
    if not callable(modules_fn):
        inner = getattr(root_module, "model", None)
        if inner is not None and inner is not root_module:
            return _collect_attn_implementations(inner)
        cfg = getattr(root_module, "config", None)
        impl = getattr(cfg, "attn_implementation", None) if cfg else None
        return [str(impl)] if impl else []

    order: List[str] = []
    seen = set()
    for mod in modules_fn():
        cfg = getattr(mod, "config", None)
        if cfg is None:
            continue
        impl = getattr(cfg, "attn_implementation", None)
        if impl and impl not in seen:
            seen.add(impl)
            order.append(str(impl))
    return order


# Language code (API) -> Qwen3-TTS language name
_LANG_MAP = {
    "en": "English",
    "ur": "Urdu",
    "urdu": "Urdu",
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

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+")


def _qwen3_language(language: str) -> str:
    return _LANG_MAP.get(language.lower() if language else "en", "English")


def _merge_tiny_chunks(chunks: List[str], max_chars: int, tiny_limit: int = 72) -> List[str]:
    """Join very short chunks with the next neighbor when under max_chars (natural flow)."""
    if not chunks:
        return []
    out: List[str] = []
    i = 0
    while i < len(chunks):
        cur = chunks[i]
        while (
            i + 1 < len(chunks)
            and len(cur) < tiny_limit
            and len(cur) + 1 + len(chunks[i + 1]) <= max_chars
        ):
            i += 1
            cur = f"{cur} {chunks[i]}".strip()
        out.append(cur)
        i += 1
    return [c for c in out if c.strip()]


def _text_chunks_for_parallel_tts(
    text: str,
    max_chars: int,
    min_split_chars: int,
) -> List[str]:
    """
    Single chunk for inputs up to min_split_chars (typical short replies).
    Longer text: pack sentences into batches up to max_chars; hard-split only oversized sentences.
    """
    text = " ".join(text.strip().split())
    if not text:
        return []
    if len(text) <= min_split_chars:
        return [text]

    raw = _SENTENCE_SPLIT.split(text)
    sentences: List[str] = []
    for seg in raw:
        seg = seg.strip()
        if not seg:
            continue
        if sentences and len(seg) < 48:
            sentences[-1] = f"{sentences[-1]} {seg}".strip()
        else:
            sentences.append(seg)

    chunks: List[str] = []
    cur: List[str] = []
    cur_len = 0
    for seg in sentences:
        add = len(seg) if not cur else cur_len + 1 + len(seg)
        if add <= max_chars:
            cur.append(seg)
            cur_len = add
        else:
            if cur:
                chunks.append(" ".join(cur))
            if len(seg) > max_chars:
                for i in range(0, len(seg), max_chars):
                    chunks.append(seg[i : i + max_chars])
                cur = []
                cur_len = 0
            else:
                cur = [seg]
                cur_len = len(seg)
    if cur:
        chunks.append(" ".join(cur))

    chunks = [c for c in chunks if c.strip()]
    chunks = _merge_tiny_chunks(chunks, max_chars)
    return chunks


class Qwen3TTSAdapter:
    """
    Adapter that exposes synthesize_to_file(text, output_path, language, speaker_wav=None)
    so it can be used in place of TTSService for pipeline testing.
    """

    def __init__(self, model_size: str = "0.6B"):
        self.model_size = model_size
        self._model = None
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
            disable_flash = _env_truthy("MINDEASE_QWEN3_DISABLE_FLASH")
            require_flash = _env_truthy("MINDEASE_QWEN3_REQUIRE_FLASH")
            dtype = _resolve_cuda_dtype(torch, device)
            if require_flash and device != "cuda":
                raise RuntimeError(
                    "MINDEASE_QWEN3_REQUIRE_FLASH=1 needs CUDA; Flash Attention 2 is not used on CPU."
                )
            device_map = "cuda:0" if device == "cuda" else "cpu"
            load_kwargs: dict = {"device_map": device_map, "dtype": dtype}
            requested_fa2 = False
            flash_pkg_ok = False
            if (
                device == "cuda"
                and dtype in (torch.float16, torch.bfloat16)
                and not disable_flash
            ):
                try:
                    import flash_attn  # noqa: F401
                    flash_pkg_ok = True
                except ImportError:
                    msg = (
                        "flash-attn is not installed; cannot use Flash Attention 2 on GPU. "
                        "Install flash-attn or set MINDEASE_QWEN3_DISABLE_FLASH=1 to allow "
                        "non-FA2 load."
                    )
                    if require_flash:
                        raise RuntimeError(msg) from None
                    logger.error("Qwen3-TTS: %s", msg)
                if flash_pkg_ok:
                    load_kwargs["attn_implementation"] = "flash_attention_2"
                    requested_fa2 = True
            elif require_flash and device == "cuda":
                raise RuntimeError(
                    "MINDEASE_QWEN3_REQUIRE_FLASH=1 but Flash Attention 2 is disabled "
                    "(CPU, MINDEASE_QWEN3_DISABLE_FLASH, or dtype is float32)."
                )
            logger.info(
                "Loading Qwen3-TTS model %s on %s dtype=%s attn_implementation=%s",
                model_id,
                device_map,
                _dtype_label(dtype),
                load_kwargs.get("attn_implementation", "(default)"),
            )
            self._model = Qwen3TTSModel.from_pretrained(model_id, **load_kwargs)
            impls = _collect_attn_implementations(self._model)
            fa2_active = "flash_attention_2" in impls
            if requested_fa2:
                if not impls:
                    msg = (
                        "Flash Attention 2 was requested but attn_implementation could not "
                        "be read from loaded module configs (upgrade transformers/qwen-tts "
                        "or inspect the model)."
                    )
                    if require_flash:
                        raise RuntimeError(msg)
                    logger.warning("Qwen3-TTS: %s", msg)
                elif not fa2_active:
                    msg = (
                        "Flash Attention 2 was requested but loaded model reports "
                        f"attn_implementation={impls}. "
                        "Transformers may have fallen back; check flash-attn / CUDA build."
                    )
                    if require_flash:
                        raise RuntimeError(msg)
                    logger.error("Qwen3-TTS: %s", msg)
                else:
                    logger.info(
                        "Qwen3-TTS: Flash Attention 2 active (attn_implementation=%s)",
                        impls,
                    )
            logger.info(
                "Qwen3-TTS model loaded dtype=%s attn=%s",
                _dtype_label(dtype),
                impls or ["(unknown)"],
            )

    def _generation_kwargs(self) -> dict:
        return {
            "temperature": 0.8,
            "top_p": 0.92,
            "top_k": 32,
            "subtalker_top_k": 32,
            "subtalker_top_p": 0.92,
            "subtalker_temperature": 0.8,
        }

    def _synthesize_to_numpy(
        self,
        text: str,
        language: str,
        speaker: str,
        instruct: str,
    ) -> Tuple[np.ndarray, int]:
        """Run inference; returns mono float32 audio and sample rate. Thread-safe GPU access."""
        self._ensure_model()

        try:
            chunk_max = int(os.environ.get("MINDEASE_QWEN3_TTS_CHUNK_CHARS", "720"))
        except ValueError:
            chunk_max = 720
        chunk_max = max(400, min(1200, chunk_max))

        try:
            min_split = int(os.environ.get("MINDEASE_QWEN3_TTS_MIN_SPLIT_CHARS", "880"))
        except ValueError:
            min_split = 880
        min_split = max(400, min(2500, min_split))

        t_chunk = time.perf_counter()
        chunks = _text_chunks_for_parallel_tts(text.strip(), max_chars=chunk_max, min_split_chars=min_split)
        chunk_ms = (time.perf_counter() - t_chunk) * 1000.0
        if not chunks:
            raise ValueError("Text cannot be empty")

        gen_kw = self._generation_kwargs()

        def _run_generate(use_gen_kw: bool):
            import torch as _torch

            with _torch.inference_mode():
                if len(chunks) == 1:
                    args = {
                        "text": chunks[0],
                        "language": language,
                        "speaker": speaker,
                        "instruct": instruct,
                    }
                    if use_gen_kw:
                        args.update(gen_kw)
                    return self._model.generate_custom_voice(**args)
                n = len(chunks)
                args = {
                    "text": chunks,
                    "language": [language] * n,
                    "speaker": [speaker] * n,
                    "instruct": [instruct] * n,
                }
                if use_gen_kw:
                    args.update(gen_kw)
                try:
                    return self._model.generate_custom_voice(**args)
                except Exception as batch_err:
                    logger.warning(
                        "Batched Qwen3-TTS failed (%s); synthesizing %s chunks sequentially",
                        batch_err,
                        n,
                    )
                    wav_parts = []
                    sr_out: Optional[int] = None
                    for ch in chunks:
                        w, sr_one = self._model.generate_custom_voice(
                            text=ch,
                            language=language,
                            speaker=speaker,
                            instruct=instruct,
                            **(gen_kw if use_gen_kw else {}),
                        )
                        wav_parts.append(w[0])
                        sr_out = sr_one
                    return wav_parts, sr_out if sr_out is not None else 24000

        t_gen = time.perf_counter()
        with self._infer_lock:
            try:
                wavs, sr = _run_generate(use_gen_kw=True)
            except TypeError:
                wavs, sr = _run_generate(use_gen_kw=False)
        gen_ms = (time.perf_counter() - t_gen) * 1000.0

        pause_samples = max(1, int(sr * 0.04))
        if len(wavs) == 1:
            out_wav = np.asarray(wavs[0], dtype=np.float32)
        else:
            pieces: List[np.ndarray] = []
            for i, w in enumerate(wavs):
                arr = np.asarray(w, dtype=np.float32).reshape(-1)
                if i > 0:
                    pieces.append(np.zeros(pause_samples, dtype=np.float32))
                pieces.append(arr)
            out_wav = np.concatenate(pieces)

        logger.debug(
            "Qwen3-TTS: chunks=%s chunking_ms=%.1f infer_ms=%.1f samples=%s sr=%s text_len=%s",
            len(chunks),
            chunk_ms,
            gen_ms,
            out_wav.shape[0],
            sr,
            len(text),
        )
        return out_wav, int(sr)

    def synthesize_to_wav_bytes(
        self,
        text: str,
        language: str = "en",
        speaker_wav: Optional[str] = None,
    ) -> bytes:
        """Full WAV file bytes in memory (no temp path). speaker_wav ignored."""
        import soundfile as sf

        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        qwen_lang = _qwen3_language(language)
        speaker = "Aiden"
        instruct = (
            "Speak in a warm, calm, and empathetic tone like a supportive therapist. "
            "Natural conversational pacing, emotionally attuned and reassuring."
        )
        t0 = time.perf_counter()
        out_wav, sr = self._synthesize_to_numpy(text, qwen_lang, speaker, instruct)
        buf = io.BytesIO()
        sf.write(buf, out_wav, sr, format="WAV", subtype="PCM_16")
        raw = buf.getvalue()
        logger.debug(
            "Qwen3-TTS synthesize_to_wav_bytes: total_ms=%.1f bytes=%s",
            (time.perf_counter() - t0) * 1000.0,
            len(raw),
        )
        return raw

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
        """
        import soundfile as sf

        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        qwen_lang = _qwen3_language(language)
        speaker = "Aiden"
        instruct = (
            "Speak in a warm, calm, and empathetic tone like a supportive therapist. "
            "Natural conversational pacing, emotionally attuned and reassuring."
        )
        t0 = time.perf_counter()
        out_wav, sr = self._synthesize_to_numpy(text, qwen_lang, speaker, instruct)
        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        sf.write(output_path, out_wav, sr, subtype="PCM_16")
        logger.debug(
            "Qwen3-TTS synthesize_to_file: total_ms=%.1f path=%s",
            (time.perf_counter() - t0) * 1000.0,
            output_path,
        )
        return output_path
