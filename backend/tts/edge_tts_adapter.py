"""
Microsoft Edge TTS adapter for English voice chat.
Uses the edge-tts package (free, no API key, ~300-700ms per request).
Falls back gracefully so the caller can switch to Qwen3 on any error.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)

# Good therapy-appropriate voices. Override via EDGE_TTS_VOICE env var.
DEFAULT_VOICE = "en-US-AriaNeural"


class EdgeTTSAdapter:

    def __init__(self, voice: str = DEFAULT_VOICE):
        self._voice = voice
        logger.info("EdgeTTSAdapter: voice=%s", self._voice)

    # ------------------------------------------------------------------
    # Async core
    # ------------------------------------------------------------------

    @staticmethod
    async def _synthesize_mp3_async(text: str, voice: str, rate: str = None) -> bytes:
        import edge_tts
        if rate:
            communicate = edge_tts.Communicate(text, voice, rate=rate)
        else:
            communicate = edge_tts.Communicate(text, voice)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        if not chunks:
            raise RuntimeError("Edge TTS returned no audio data")
        return b"".join(chunks)

    def _synthesize_mp3(self, text: str, voice: str = None, rate: str = None) -> bytes:
        """Run async synthesis from sync Django views. Windows-safe: uses SelectorEventLoop."""
        import sys
        coro = self._synthesize_mp3_async(text, voice or self._voice, rate=rate)
        # aiohttp (used by edge-tts internally) requires SelectorEventLoop on Windows.
        # The default ProactorEventLoop on Windows does not support it.
        if sys.platform == "win32":
            loop = asyncio.SelectorEventLoop()
        else:
            loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(coro)
        finally:
            try:
                loop.close()
            except Exception:
                pass
            asyncio.set_event_loop(None)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def synthesize_to_mp3_bytes(self, text: str, language: str = "en", voice: str = None) -> bytes:
        """Return raw MP3 bytes — no ffmpeg/sox needed. Browser Audio() handles MP3 natively."""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        import time
        t0 = time.perf_counter()
        # English: slow down 10% for a calmer therapy cadence. Urdu: leave default.
        is_urdu = str(language).lower() in ("ur", "urdu")
        rate = None if is_urdu else "-10%"
        mp3 = self._synthesize_mp3(text.strip(), voice, rate=rate)
        print(f"[edge-tts] voice={voice or self._voice}  rate={rate or 'default'}  {(time.perf_counter() - t0)*1000:.0f}ms  chars={len(text)}  bytes={len(mp3)}")
        return mp3

    def synthesize_to_file(
        self,
        text: str,
        output_path: str,
        language: str = "en",
        voice: str = None,
        speaker_wav=None,
    ) -> str:
        """Write MP3 to output_path (callers that pass a .wav path still get valid audio)."""
        import os
        mp3_bytes = self.synthesize_to_mp3_bytes(text, language, voice)
        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(mp3_bytes)
        return output_path
