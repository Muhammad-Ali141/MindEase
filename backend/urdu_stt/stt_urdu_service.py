"""
Adapter module for Urdu STT.

Your finetuned Urdu Whisper code currently lives at the repo root:
`stt_urdu_service.py`.

This wrapper re-exports `UrduSpeechToTextService` and `MODEL_ID` from that
file so Django can import it from `backend/urdu_stt/`.
"""

from __future__ import annotations

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from stt_urdu_service import MODEL_ID, UrduSpeechToTextService  # noqa: E402

__all__ = ["UrduSpeechToTextService", "MODEL_ID"]

