"""
Urdu Speech-to-Text Service

Core STT service using faster-whisper for Urdu transcription.
Mirrors the English pipeline (stt_service.py) structure.
"""

import argparse
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Optional, Literal

import numpy as np
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


def _find_ffmpeg() -> str | None:
    """Return ffmpeg executable path, checking PATH then known Windows install locations."""
    import shutil, glob
    found = shutil.which("ffmpeg")
    if found:
        return found
    candidates = [
        r"C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe",
        r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    # Last resort: glob for any WinGet ffmpeg
    for c in glob.glob(r"C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg*\**\ffmpeg.exe", recursive=True):
        return c
    return None


def _patch_faster_whisper_mels(model: WhisperModel, model_dir: Path) -> None:
    """
    HF preprocessor_config.json nests keys under feature_extractor; faster_whisper only
    reads flat keys, so it defaults to 80 mels. CT2 large-v3 exports expect 128 mels.
    """
    import json

    from faster_whisper.feature_extractor import FeatureExtractor

    n_mels = getattr(model.model, "n_mels", None)
    kwargs = dict(
        feature_size=80,
        sampling_rate=16000,
        hop_length=160,
        chunk_length=30,
        n_fft=400,
    )
    prep = model_dir / "preprocessor_config.json"
    if prep.is_file():
        try:
            cfg = json.loads(prep.read_text(encoding="utf-8"))
            inner = cfg.get("feature_extractor") or cfg
            if isinstance(inner, dict):
                if inner.get("feature_size") is not None:
                    kwargs["feature_size"] = int(inner["feature_size"])
                if inner.get("hop_length") is not None:
                    kwargs["hop_length"] = int(inner["hop_length"])
                if inner.get("n_fft") is not None:
                    kwargs["n_fft"] = int(inner["n_fft"])
                if inner.get("chunk_length") is not None:
                    kwargs["chunk_length"] = int(inner["chunk_length"])
        except (json.JSONDecodeError, OSError, TypeError, ValueError) as e:
            logger.warning("Could not parse preprocessor_config.json: %s", e)
    if n_mels is not None and kwargs["feature_size"] != n_mels:
        logger.info(
            "Feature size %s -> %s (CT2 model n_mels)",
            kwargs["feature_size"],
            n_mels,
        )
        kwargs["feature_size"] = int(n_mels)

    model.feature_extractor = FeatureExtractor(**kwargs)
    model.input_stride = 2
    model.num_samples_per_token = (
        model.feature_extractor.hop_length * model.input_stride
    )
    model.frames_per_second = (
        model.feature_extractor.sampling_rate // model.feature_extractor.hop_length
    )
    model.tokens_per_second = (
        model.feature_extractor.sampling_rate // model.num_samples_per_token
    )


def _default_urdu_stt_model() -> str:
    """Prefer local finetuned CT2 export if present, else Systran base large-v3."""
    local_ct2 = Path(__file__).resolve().parent / "finetuned_urdu_whisper" / "ct2_model"
    if local_ct2.is_dir() and (local_ct2 / "model.bin").exists():
        return str(local_ct2)
    return "Systran/faster-whisper-large-v3"


MODEL_ID = _default_urdu_stt_model()


class UrduSpeechToTextService:
    """
    Urdu Speech-to-Text service using faster-whisper.
    Mirrors English SpeechToTextService API for consistency.
    """

    def __init__(
        self,
        model_id: str = MODEL_ID,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        beam_size: int = 6,
        best_of: int = 8,
        temperature: float = 0.2,
        vad_filter: bool = True,
    ):
        self.model_id = model_id
        self.backend: Literal["faster_whisper", "transformers"] = "faster_whisper"
        self.model = None  # faster-whisper model
        self.hf_model = None  # transformers model (optional)
        self.hf_processor = None  # transformers processor (optional)
        self.device = device
        self.compute_type = compute_type
        self.beam_size = beam_size
        self.best_of = best_of
        self.temperature = temperature
        self.vad_filter = vad_filter
        # Anti-hallucination defaults (can be adjusted if needed)
        self.repetition_penalty = 1.05
        self.no_repeat_ngram_size = 3
        # Whisper max_length=448; forced prompt tokens (~4) reduce usable space to 444
        self.max_new_tokens = 444

        if self.device is None:
            env_device = os.environ.get("URDU_STT_DEVICE", "").strip().lower()
            if env_device in ("cuda", "cpu"):
                self.device = env_device
                logger.info(f"Urdu STT device from env: {self.device}")
            else:
                try:
                    import torch
                    self.device = "cuda" if torch.cuda.is_available() else "cpu"
                except ImportError:
                    self.device = "cpu"

        if self.compute_type is None:
            if self.device == "cuda":
                self.compute_type = "int8_float16"
            else:
                self.compute_type = "int8"

        self._load_model()

    def _load_model(self):
        logger.info(f"Loading Urdu model: {self.model_id}")
        start_time = time.time()
        model_path = Path(str(self.model_id))
        # If user passes a local path, support either:
        # - CTranslate2 faster-whisper folder (contains model.bin)
        # - Merged HF transformers model folder (contains config.json)
        if model_path.exists() and model_path.is_dir():
            if (model_path / "model.bin").exists():
                self.backend = "faster_whisper"
            elif (model_path / "config.json").exists():
                self.backend = "transformers"
            else:
                # default to faster-whisper behavior; will error with useful message if invalid
                self.backend = "faster_whisper"

        try:
            if self.backend == "faster_whisper":
                self.model = WhisperModel(
                    self.model_id,
                    device=self.device,
                    compute_type=self.compute_type,
                )
                if model_path.is_dir() and (model_path / "model.bin").exists():
                    _patch_faster_whisper_mels(self.model, model_path)
            else:
                try:
                    from transformers import WhisperForConditionalGeneration, WhisperProcessor
                except Exception as e:
                    raise RuntimeError(
                        "Transformers backend selected (local merged model folder), "
                        "but transformers is not installed. Install finetune requirements."
                    ) from e

                import torch

                self.hf_processor = WhisperProcessor.from_pretrained(str(model_path))
                self.hf_model = WhisperForConditionalGeneration.from_pretrained(str(model_path))
                self.hf_model.to(self.device)
                self.hf_model.eval()

                # Force Urdu at inference and avoid unexpected forced ids
                try:
                    self.hf_model.generation_config.forced_decoder_ids = (
                        self.hf_processor.get_decoder_prompt_ids(language="ur", task="transcribe")
                    )
                except Exception:
                    self.hf_model.generation_config.forced_decoder_ids = None
            logger.info(f"Urdu STT model loaded in {time.time() - start_time:.2f}s")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            if self.device == "cuda":
                logger.warning("Falling back to CPU")
                self.device = "cpu"
                self.compute_type = "int8"
                if self.backend == "faster_whisper":
                    self.model = WhisperModel(
                        self.model_id,
                        device=self.device,
                        compute_type=self.compute_type,
                    )
                    if model_path.is_dir() and (model_path / "model.bin").exists():
                        _patch_faster_whisper_mels(self.model, model_path)
                else:
                    # Transformers backend CPU fallback
                    self.hf_model.to("cpu")
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
        """Transcribe audio array to Urdu text."""
        if self.backend == "faster_whisper" and self.model is None:
            raise RuntimeError("Model not loaded.")
        if self.backend == "transformers" and (self.hf_model is None or self.hf_processor is None):
            raise RuntimeError("Transformers model not loaded.")

        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        if audio.max() > 1.0 or audio.min() < -1.0:
            max_val = np.abs(audio).max()
            if max_val > 0:
                audio = audio / max_val

        target_sample_rate = 16000
        if sample_rate != target_sample_rate:
            try:
                import resampy
                audio = resampy.resample(audio, sample_rate, target_sample_rate)
                sample_rate = target_sample_rate
            except ImportError:
                logger.warning("resampy not installed, assuming 16kHz")

        lang = "ur" if language in (None, "", "auto") else language
        beam = beam_size or self.beam_size
        use_vad = self.vad_filter if vad_filter is None else vad_filter

        if self.backend == "faster_whisper":
            # Only apply an Urdu bias prompt for hub multilingual models.
            # For local finetuned CT2 models, prompts can increase hallucinations.
            model_path = Path(str(self.model_id))
            initial_prompt = None
            if not (model_path.exists() and model_path.is_dir() and (model_path / "model.bin").exists()):
                initial_prompt = "یہ اردو میں ہے۔"
            segments, _ = self.model.transcribe(
                audio,
                language=lang,
                beam_size=beam,
                best_of=self.best_of,
                # Sampling (temperature>0) is only stable/meaningful when beam_size == 1.
                # For beam search (beam_size>1) force temperature=0 for stability.
                temperature=(0.0 if beam > 1 else self.temperature),
                repetition_penalty=self.repetition_penalty,
                no_repeat_ngram_size=self.no_repeat_ngram_size,
                without_timestamps=False,
                vad_filter=use_vad,
                vad_parameters=dict(
                    threshold=0.3,
                    min_silence_duration_ms=1200,
                    speech_pad_ms=400,
                ) if use_vad else None,
                initial_prompt=initial_prompt,
                condition_on_previous_text=False,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.5,         # was -0.7: complex Urdu words were below threshold → segment discarded
                no_speech_threshold=0.9,         # was 0.8: more permissive
                hallucination_silence_threshold=2.0,  # was 0.5: 500ms pause between sentences was triggering this
            )

            parts = []
            for seg in segments:
                t = seg.text.strip()
                if t:
                    parts.append(t)
            return " ".join(parts).strip()

        # Transformers backend (for testing local merged model before CT2 conversion)
        import torch

        inputs = self.hf_processor.feature_extractor(
            audio, sampling_rate=16000, return_tensors="pt"
        )
        input_features = inputs["input_features"].to(self.device)
        # match model dtype for stability on CUDA
        if self.device == "cuda":
            input_features = input_features.half()

        with torch.no_grad():
            generated_ids = self.hf_model.generate(
                input_features=input_features,
                num_beams=1 if beam <= 1 else beam,
                max_new_tokens=128,
            )
        text = self.hf_processor.tokenizer.batch_decode(
            generated_ids, skip_special_tokens=True
        )[0]
        return text.strip()

    def transcribe_file(
        self,
        file_path: str,
        language: Optional[str] = None,
        beam_size: Optional[int] = None,
        vad_filter: Optional[bool] = None,
    ) -> str:
        """Transcribe an audio file to Urdu text."""
        import soundfile as sf

        file_path = str(file_path)
        ext = Path(file_path).suffix.lower()
        needs_conversion = ext in [".webm", ".mp4", ".m4a", ".ogg"]
        temp_wav = None

        try:
            if needs_conversion:
                ffmpeg_exe = _find_ffmpeg()
                if ffmpeg_exe:
                    import subprocess
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                        temp_wav = f.name
                    result = subprocess.run(
                        [ffmpeg_exe, "-y", "-i", file_path,
                         "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", temp_wav],
                        capture_output=True, timeout=60,
                    )
                    if result.returncode != 0:
                        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')}")
                    audio, sample_rate = sf.read(temp_wav, dtype="float32")
                else:
                    try:
                        from pydub import AudioSegment
                        seg = AudioSegment.from_file(file_path)
                        seg = seg.set_channels(1).set_frame_rate(16000)
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                            temp_wav = f.name
                            seg.export(temp_wav, format="wav")
                        audio, sample_rate = sf.read(temp_wav, dtype="float32")
                    except ImportError:
                        raise RuntimeError("ffmpeg not found and pydub not installed. Cannot convert WebM audio.")
            else:
                audio, sample_rate = sf.read(file_path, dtype="float32")

            if len(audio.shape) > 1:
                audio = np.mean(audio, axis=1)

            duration_s = len(audio) / sample_rate
            logger.info("Urdu STT: audio duration=%.2fs  samples=%d  sr=%d", duration_s, len(audio), sample_rate)
            print(f"[urdu-stt] audio duration={duration_s:.2f}s  samples={len(audio)}")

            return self.transcribe_audio_array(
                audio,
                sample_rate,
                language=language,
                beam_size=beam_size,
                vad_filter=vad_filter,
            )
        finally:
            if temp_wav and Path(temp_wav).exists():
                try:
                    Path(temp_wav).unlink(missing_ok=True)
                except Exception:
                    pass

    def close(self):
        self.model = None
        self.hf_model = None
        self.hf_processor = None
        logger.info("Urdu STT service closed")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# CLI and backward compatibility
def transcribe_file(
    model: WhisperModel,
    audio_path: str | Path,
    *,
    language: str = "ur",
    vad_filter: bool = True,
    word_timestamps: bool = False,
) -> tuple[str, object]:
    """Legacy function for programmatic use. Prefer UrduSpeechToTextService."""
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        beam_size=5,
        condition_on_previous_text=False,
        vad_filter=vad_filter,
        word_timestamps=word_timestamps,
    )
    segments = list(segments)
    text = " ".join(s.text.strip() for s in segments).strip()
    return text, info


def run_cli():
    parser = argparse.ArgumentParser(description="Transcribe audio file to Urdu")
    parser.add_argument("audio_path", type=Path, help="Path to audio file")
    parser.add_argument("-o", "--output", type=Path, default=None)
    parser.add_argument("--model", default=MODEL_ID)
    parser.add_argument("--device", choices=["cpu", "cuda"], default=None)
    parser.add_argument("--no-vad", action="store_true")
    args = parser.parse_args()

    if not args.audio_path.exists():
        raise SystemExit(f"File not found: {args.audio_path}")

    with UrduSpeechToTextService(
        model_id=args.model,
        device=args.device,
        vad_filter=not args.no_vad,
    ) as svc:
        text = svc.transcribe_file(str(args.audio_path))
        if args.output:
            args.output.write_text(text, encoding="utf-8")
            print(f"Saved to {args.output}")
        else:
            print(text)


if __name__ == "__main__":
    run_cli()
