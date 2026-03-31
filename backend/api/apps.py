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
