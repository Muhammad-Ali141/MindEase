import logging
import os
import sys

from django.apps import AppConfig

logger = logging.getLogger(__name__)


def _should_warm_qwen3_tts() -> bool:
    if os.environ.get("MINDEASE_QWEN3_WARMUP", "").strip().lower() in ("0", "false", "no"):
        return False
    if os.environ.get("TTS_BACKEND", "").strip().lower() == "xtts":
        return False
    argv = sys.argv
    if os.environ.get("MINDEASE_QWEN3_WARMUP", "").strip().lower() in ("1", "true", "yes"):
        if len(argv) >= 2 and argv[1] == "runserver":
            if os.environ.get("RUN_MAIN") != "true":
                return False
        return True
    if len(argv) >= 2 and argv[1] == "runserver":
        return os.environ.get("RUN_MAIN") == "true"
    prog = argv[0].replace("\\", "/").lower()
    if any(x in prog for x in ("gunicorn", "uvicorn", "daphne")):
        return True
    return False


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"
    label = "api"
    verbose_name = "API"

    def ready(self) -> None:
        # Warm Urdu emotion model (XLM-R) in background so first Urdu chat msg has 0 load cost.
        # Only in the real worker process (not Django's autoreload parent).
        if os.environ.get("RUN_MAIN") == "true" or any(
            x in sys.argv[0].replace("\\", "/").lower()
            for x in ("gunicorn", "uvicorn", "daphne")
        ):
            import threading, time

            def _warm_urdu_emotion():
                try:
                    import sys as _sys
                    from chatbot.urdu_emotion_detector import warmup_urdu_emotion_model, detect_emotions_urdu
                    t0 = time.perf_counter()
                    load_s = warmup_urdu_emotion_model()
                    # One dummy inference so CUDA kernels are compiled too
                    detect_emotions_urdu("test", top_k=1, threshold=0.0)
                    total = time.perf_counter() - t0
                    print(f"[urdu-emotion] startup warmup complete — load {load_s:.2f}s, ready in {total:.2f}s",
                          file=_sys.stderr, flush=True)
                except Exception as exc:
                    logger.warning("Urdu emotion warmup failed: %s", exc)

            threading.Thread(target=_warm_urdu_emotion, daemon=True).start()

            def _warm_en_stt():
                try:
                    import sys as _sys
                    import numpy as np
                    from api.views import _get_en_stt_service
                    t0 = time.perf_counter()
                    svc = _get_en_stt_service()
                    load_s = time.perf_counter() - t0
                    # 1s of silence @16kHz to compile CUDA kernels / first-pass JIT
                    svc.transcribe_audio_array(np.zeros(16000, dtype="float32"), 16000, language="en")
                    total = time.perf_counter() - t0
                    print(f"[en-stt] startup warmup complete — load {load_s:.2f}s, ready in {total:.2f}s",
                          file=_sys.stderr, flush=True)
                except Exception as exc:
                    logger.warning("English STT warmup failed: %s", exc)

            def _warm_urdu_stt():
                try:
                    import sys as _sys
                    import numpy as np
                    from api.views import _get_urdu_stt_service
                    t0 = time.perf_counter()
                    svc = _get_urdu_stt_service()
                    load_s = time.perf_counter() - t0
                    svc.transcribe_audio_array(np.zeros(16000, dtype="float32"), 16000, language="ur")
                    total = time.perf_counter() - t0
                    print(f"[urdu-stt] startup warmup complete — load {load_s:.2f}s, ready in {total:.2f}s",
                          file=_sys.stderr, flush=True)
                except Exception as exc:
                    logger.warning("Urdu STT warmup failed: %s", exc)

            threading.Thread(target=_warm_en_stt, daemon=True).start()
            threading.Thread(target=_warm_urdu_stt, daemon=True).start()

            def _warm_ser():
                try:
                    import sys as _sys
                    import tempfile, wave, struct
                    from api.views import _get_ser_detector
                    t0 = time.perf_counter()
                    det = _get_ser_detector()
                    load_s = time.perf_counter() - t0
                    # 1s of silence as a real wav file (SER reads from disk path)
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                        wav_path = f.name
                    try:
                        with wave.open(wav_path, "wb") as w:
                            w.setnchannels(1)
                            w.setsampwidth(2)
                            w.setframerate(16000)
                            w.writeframes(struct.pack("<" + "h" * 16000, *([0] * 16000)))
                        det.detect_emotions_from_audio(wav_path, top_k=1, threshold=0.0)
                    finally:
                        try:
                            os.unlink(wav_path)
                        except Exception:
                            pass
                    total = time.perf_counter() - t0
                    print(f"[ser] startup warmup complete — load {load_s:.2f}s, ready in {total:.2f}s",
                          file=_sys.stderr, flush=True)
                except Exception as exc:
                    logger.warning("SER warmup failed: %s", exc)

            threading.Thread(target=_warm_ser, daemon=True).start()

        if not _should_warm_qwen3_tts():
            return
        try:
            from api.views import _get_qwen3_tts_service

            _get_qwen3_tts_service()._ensure_model()
            logger.info("Qwen3 TTS warmup complete (weights loaded in this process).")
        except Exception as exc:
            logger.warning(
                "Qwen3 TTS warmup failed; first synthesis will load the model: %s",
                exc,
            )
