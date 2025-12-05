"""
Standalone Speech-to-Text (STT) Module

This module provides real-time speech-to-text transcription using faster-whisper.
It is designed as an isolated component that can be integrated into the main
MindEase application later.

Main components:
- SpeechToTextService: Core STT service class
- stt_live.py: CLI script for live microphone transcription
"""

__version__ = "1.0.0"

from .stt_service import SpeechToTextService

__all__ = ["SpeechToTextService"]

