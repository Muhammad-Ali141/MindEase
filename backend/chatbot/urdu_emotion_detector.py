"""
Emotion Detection for Roman Urdu using fine-tuned XLM-RoBERTa.
Model: Khubaib01/roman-urdu-emotion-xlmr-v2 (7 emotions, ~99% accuracy)
Labels (per model card): anger, disgust, fear, happy, sad, surprise, none
"""
import os
import sys
import warnings
from typing import List, Tuple

# transformers' tokenizer loader calls HfApi.model_info() during
# _patch_mistral_regex — this fails hard if HF_HUB_OFFLINE is set, even
# when the model is fully cached. Unset it for this process before the
# transformers import so the loader can no-op the online check.
for _flag in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE"):
    if os.environ.get(_flag, "").strip() in ("1", "true", "True", "yes"):
        os.environ[_flag] = "0"

import logging
import torch
from transformers import pipeline as hf_pipeline
from transformers import logging as hf_logging

# Silence the "not supported for text-classification" noise — the custom class
# (XLMRobertaForEmotionClassification) runs fine via trust_remote_code=True.
hf_logging.set_verbosity_error()
warnings.filterwarnings("ignore", message=".*not supported for text-classification.*")


class _SuppressUnsupportedModelFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "not supported for text-classification" not in record.getMessage()


for _name in ("transformers", "transformers.pipelines", "transformers.pipelines.base"):
    logging.getLogger(_name).addFilter(_SuppressUnsupportedModelFilter())

_MODEL_ID = "Khubaib01/roman-urdu-emotion-xlmr-v2"
_pipe = None
_last_load_seconds: float = 0.0


def _get_pipe():
    global _pipe, _last_load_seconds
    if _pipe is None:
        import time as _time
        device = 0 if torch.cuda.is_available() else -1
        t0 = _time.perf_counter()
        _pipe = hf_pipeline(
            "text-classification",
            model=_MODEL_ID,
            trust_remote_code=True,
            top_k=None,
            device=device,
        )
        _last_load_seconds = _time.perf_counter() - t0
    return _pipe


def warmup_urdu_emotion_model() -> float:
    """Preload the emotion model. Returns load time in seconds (0 if already loaded)."""
    global _last_load_seconds
    was_loaded = _pipe is not None
    _get_pipe()
    return 0.0 if was_loaded else _last_load_seconds


def detect_emotions_urdu(
    text: str,
    top_k: int = 2,
    threshold: float = 0.3,
) -> List[Tuple[str, float]]:
    """Detect emotions from Roman Urdu text.

    Returns list of (emotion, score) tuples — same format as EmotionDetector.detect_emotions.
    """
    pipe = _get_pipe()
    raw = pipe(text.strip())
    results = raw[0] if isinstance(raw, list) and raw and isinstance(raw[0], list) else raw

    # Exclude the neutral "none" class; keep everything above threshold
    filtered = [
        (r["label"], round(float(r["score"]), 4))
        for r in results
        if float(r["score"]) >= threshold and r["label"].lower() not in ("none", "neutral")
    ]
    filtered.sort(key=lambda x: x[1], reverse=True)

    top = filtered[:top_k]
    return top if top else [("neutral", 1.0)]


def format_emotions_for_llm(emotions: List[Tuple[str, float]]) -> str:
    """Format detected emotions as a string for LLM prompt."""
    if not emotions:
        return "No specific emotions detected."
    emotion_strs = [f"{emotion} ({prob:.2f})" for emotion, prob in emotions]
    return f"Detected emotions: {', '.join(emotion_strs)}"
