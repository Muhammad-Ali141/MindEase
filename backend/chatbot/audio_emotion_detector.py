"""
Speech Emotion Recognition (SER) - emotion detection from audio.
Uses a wav2vec2-based model to detect emotion from the user's voice (prosody, tone)
instead of from transcribed text. Used in the voice chat pipeline.
"""
import os
import logging
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

# RAVDESS-style labels (8 emotions) - matches ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition
SER_EMOTION_LABELS = [
    "angry", "calm", "disgust", "fearful", "happy", "neutral", "sad", "surprised"
]


class AudioEmotionDetector:
    """
    Detects emotions from raw audio using a wav2vec2-based Speech Emotion Recognition model.
    Returns (emotion, probability) tuples compatible with the text EmotionDetector format.
    """

    def __init__(self, model_id: str = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition", device: Optional[str] = None):
        """
        Initialize the SER model (lazy-loaded on first use to avoid slowing app startup).
        """
        self.model_id = model_id
        self._device = device
        self._model = None
        self._processor = None

    def _ensure_loaded(self):
        if self._model is not None:
            return
        import torch
        from huggingface_hub import hf_hub_download

        # Support different transformers versions: 4.35+ may not export Wav2Vec2 at top level
        try:
            from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor, AutoConfig
        except ImportError:
            try:
                from transformers.models.wav2vec2.modeling_wav2vec2 import Wav2Vec2ForSequenceClassification
                from transformers.models.wav2vec2.feature_extraction_wav2vec2 import Wav2Vec2FeatureExtractor
                from transformers import AutoConfig
            except ImportError:
                from transformers import AutoModelForAudioClassification, AutoProcessor, AutoConfig
                Wav2Vec2ForSequenceClassification = None
                Wav2Vec2FeatureExtractor = None

        self._device = self._device or ("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading Speech Emotion Recognition model: %s", self.model_id)

        if Wav2Vec2FeatureExtractor is not None:
            self._processor = Wav2Vec2FeatureExtractor.from_pretrained(self.model_id)
        else:
            self._processor = AutoProcessor.from_pretrained(self.model_id)

        config = AutoConfig.from_pretrained(self.model_id)
        if Wav2Vec2ForSequenceClassification is not None:
            if not getattr(config, "classifier_proj_size", None) or getattr(config, "classifier_proj_size") == 256:
                config.classifier_proj_size = 1024
                logger.info("SER: using classifier_proj_size=1024 to match checkpoint head")
            self._model = Wav2Vec2ForSequenceClassification.from_pretrained(self.model_id, config=config)
        else:
            self._model = AutoModelForAudioClassification.from_pretrained(self.model_id)

        # Remap checkpoint head keys (classifier.dense / classifier.output -> projector / classifier)
        # and load so we use the trained head.
        try:
            bin_path = hf_hub_download(self.model_id, "pytorch_model.bin")
        except Exception:
            try:
                bin_path = hf_hub_download(self.model_id, "model.safetensors")
            except Exception:
                bin_path = None
        if bin_path:
            if bin_path.endswith(".safetensors"):
                from safetensors.torch import load_file
                ckpt = load_file(bin_path)
            else:
                try:
                    raw = torch.load(bin_path, map_location="cpu", weights_only=True)
                except TypeError:
                    raw = torch.load(bin_path, map_location="cpu")
                ckpt = raw.get("state_dict", raw) if isinstance(raw, dict) else raw
            head_key_map = {
                "classifier.dense.weight": "projector.weight",
                "classifier.dense.bias": "projector.bias",
                "classifier.output.weight": "classifier.weight",
                "classifier.output.bias": "classifier.bias",
            }
            model_sd = self._model.state_dict()
            remapped = {}
            for k, v in ckpt.items():
                if k in head_key_map:
                    new_k = head_key_map[k]
                    if new_k in model_sd and v.shape == model_sd[new_k].shape:
                        remapped[new_k] = v
                    else:
                        logger.warning(
                            "SER: head key %s -> %s shape mismatch (ckpt %s vs model %s)",
                            k, new_k, v.shape, model_sd.get(new_k, torch.Tensor()).shape,
                        )
                elif k in model_sd:
                    remapped[k] = v
            missing, unexpected = self._model.load_state_dict(remapped, strict=False)
            if "projector.weight" in remapped:
                logger.info("SER: loaded classifier head from checkpoint (projector + classifier)")
            if missing:
                logger.warning("SER: after load still missing: %s", missing[:8])
        else:
            logger.warning("SER: could not load classifier weights; emotions may be poor.")

        self._model.to(self._device)
        self._model.eval()
        logger.info("SER model loaded on %s", self._device)

    def _load_audio_to_16k_mono(self, file_path: str):
        """Load audio file to float32 mono at 16kHz (required by wav2vec2)."""
        import soundfile as sf
        import numpy as np

        ext = os.path.splitext(file_path)[1].lower()
        if ext in ('.webm', '.mp4', '.m4a', '.ogg'):
            try:
                from pydub import AudioSegment
                import tempfile
                segment = AudioSegment.from_file(file_path)
                segment = segment.set_channels(1).set_frame_rate(16000)
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
                    segment.export(f.name, format='wav')
                    audio, sr = sf.read(f.name, dtype='float32')
                    try:
                        os.unlink(f.name)
                    except Exception:
                        pass
                    if len(audio.shape) > 1:
                        audio = np.mean(audio, axis=1)
                    return audio, 16000
            except Exception as e:
                logger.warning("SER: pydub conversion failed for %s: %s", file_path, e)
                return None, None
        try:
            audio, sr = sf.read(file_path, dtype='float32')
            if len(audio.shape) > 1:
                audio = audio.mean(axis=1)
            if sr != 16000:
                import resampy
                audio = resampy.resample(audio, sr, 16000)
                sr = 16000
            return audio, sr
        except Exception as e:
            logger.warning("SER: failed to read %s: %s", file_path, e)
            return None, None

    def detect_emotions_from_audio(
        self,
        file_path: str,
        top_k: int = 2,
        threshold: float = 0.2,
    ) -> List[Tuple[str, float]]:
        """
        Detect emotions from an audio file (e.g. user's voice recording).

        Args:
            file_path: Path to audio file (WAV, WebM, MP3, etc.)
            top_k: Number of top emotions to return
            threshold: Minimum probability threshold

        Returns:
            List of (emotion, probability) tuples, same format as EmotionDetector.
        """
        import torch
        import numpy as np

        audio, sr = self._load_audio_to_16k_mono(file_path)
        if audio is None or len(audio) < 1600:
            return [("neutral", 1.0)]

        self._ensure_loaded()
        inputs = self._processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=16000 * 30,
        )
        inputs = {k: v.to(self._device) for k, v in inputs.items()}

        with torch.no_grad():
            logits = self._model(**inputs).logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]

        id2label = getattr(self._model.config, "id2label", None)
        if id2label is not None:
            labels = [id2label.get(str(i), f"label_{i}") for i in range(len(probs))]
        else:
            labels = SER_EMOTION_LABELS[: len(probs)]
        emotion_probs = [(labels[i], float(probs[i])) for i in range(len(probs))]
        filtered = [(e, p) for e, p in emotion_probs if p >= threshold]
        filtered.sort(key=lambda x: x[1], reverse=True)
        top = filtered[:top_k]
        return top if top else [("neutral", 1.0)]

    def format_emotions_for_llm(self, emotions: List[Tuple[str, float]]) -> str:
        """Same format as text EmotionDetector for LLM prompt."""
        if not emotions:
            return "No specific emotions detected from voice."
        parts = [f"{e} ({p:.2f})" for e, p in emotions]
        return f"Detected emotions (from voice): {', '.join(parts)}"
