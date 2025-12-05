"""
Standalone Text-to-Speech (TTS) Module

This module provides text-to-speech synthesis using Coqui XTTS v2.
It is designed as an isolated component that can be integrated into the main
MindEase application later.

Main components:
- TTSService: Core TTS service class
- tts_live.py: CLI script for terminal-based TTS testing
"""

__version__ = "1.0.0"

from .tts_service import TTSService

__all__ = ["TTSService"]

