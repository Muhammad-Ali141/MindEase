"""
Adapter module for Urdu live STT.

The live microphone transcription implementation currently lives at the repo
root: `stt_urdu_live.py`.

This wrapper re-exports it from `backend/urdu_stt/` so the rest of the Django
project has a stable import path.
"""

from __future__ import annotations

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from stt_urdu_live import LiveUrduSTT, list_audio_devices, main  # noqa: E402

__all__ = ["LiveUrduSTT", "list_audio_devices", "main"]

