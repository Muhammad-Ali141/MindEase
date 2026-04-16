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
