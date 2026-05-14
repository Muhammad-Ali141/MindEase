"""
ElevenLabs TTS adapter for Urdu voice chat.
Uses eleven_multilingual_v2 model which supports Urdu.
Looks up Jessica's voice ID from the API on first use.
Falls back gracefully so the caller can switch to MMS on any error.
"""
import io
import logging
import threading
import time

logger = logging.getLogger(__name__)

# Known ElevenLabs premade voice IDs (used when voices list API is unavailable)
_KNOWN_VOICE_IDS = {
    "bill":    "pqHfZKP75CvOlQylNhV4",
    "jessica": "cgSgspJ2msm6clMCkdW9",
    "rachel":  "21m00Tcm4TlvDq8ikWAM",
    "adam":    "pNInz6obpgDQGcFmaJgB",
    "josh":    "TxGEqnHWrfWFTfGW9XjX",
    "bella":   "EXAVITQu4vr4xnSDxMaL",
    "antoni":  "ErXwobaYiN019PkySvjV",
    "elli":    "MF3mGyEYCl7XYWbV9V6O",
    "sam":     "yoZ06aMxZJJ28mfd3POQ",
    # Deep / mid-age male voices
    "daniel":  "onwK4e9ZLuTAKqWW03F9",
    "george":  "JBFqnCBsd6RMkjVDRZzb",
    "brian":   "nPczCjzI2devNBz1zQrb",
    "clyde":   "2EiwWnXFnvU5JabPnv8n",
    # Hindi/Urdu voices
    "haseeb":  "aPfeouerZvEVukwmLSP0",
}
_DEFAULT_FALLBACK_ID = "nPczCjzI2devNBz1zQrb"  # Brian
_MODEL_ID = "eleven_multilingual_v2"

# Global gate — free tier allows max 2 concurrent requests across the whole
# account. We serialize to 1 in-flight so we never trip the limit even when
# welcome-audio synthesis overlaps with a user TTS call.
_GLOBAL_INFLIGHT = threading.Semaphore(1)


class ElevenLabsTTSAdapter:

    def __init__(self, api_key: str, voice_name: str = "Jessica"):
        self._api_key = api_key
        self._voice_name = voice_name
        self._voice_id: str | None = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Voice ID resolution
    # ------------------------------------------------------------------

    def _resolve_voice_id(self) -> str:
        """Resolve voice ID: known dict → API lookup → default fallback."""
        if self._voice_id:
            return self._voice_id
        with self._lock:
            if self._voice_id:
                return self._voice_id

            # 1. Check known voice IDs first (works even when voices list API is restricted)
            known = _KNOWN_VOICE_IDS.get(self._voice_name.lower())
            if known:
                self._voice_id = known
                logger.info(
                    "ElevenLabs: resolved voice '%s' → %s (from known IDs)",
                    self._voice_name, self._voice_id,
                )
                return self._voice_id

            # 2. Try the voices list API
            import requests
            try:
                resp = requests.get(
                    "https://api.elevenlabs.io/v1/voices",
                    headers={"xi-api-key": self._api_key},
                    timeout=10,
                )
                resp.raise_for_status()
                voices = resp.json().get("voices", [])
                for v in voices:
                    if v.get("name", "").lower() == self._voice_name.lower():
                        self._voice_id = v["voice_id"]
                        logger.info(
                            "ElevenLabs: resolved voice '%s' → %s (from API)",
                            self._voice_name, self._voice_id,
                        )
                        return self._voice_id
            except Exception as e:
                logger.warning("ElevenLabs: could not fetch voice list (%s)", e)

            # 3. Default fallback
            self._voice_id = _DEFAULT_FALLBACK_ID
            logger.warning(
                "ElevenLabs: voice '%s' not resolved; using default fallback ID %s",
                self._voice_name, self._voice_id,
            )
            return self._voice_id

    # ------------------------------------------------------------------
    # Synthesis helpers
    # ------------------------------------------------------------------

    def _call_api(self, text: str) -> bytes:
        """POST to ElevenLabs TTS endpoint and return MP3 bytes. Raises on any error."""
        import requests

        voice_id = self._resolve_voice_id()
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        body = {
            "text": text,
            "model_id": _MODEL_ID,
            "speed": 0.85,
            "voice_settings": {
                "stability": 0.6,
                "similarity_boost": 0.80,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }
        t0 = time.perf_counter()
        resp = None
        with _GLOBAL_INFLIGHT:
            for attempt in range(4):
                resp = requests.post(url, headers=headers, json=body, timeout=30)
                if resp.status_code == 429:
                    retry_after = resp.headers.get("retry-after")
                    delay = float(retry_after) if retry_after else (0.5 * (2 ** attempt))
                    logger.warning(
                        "ElevenLabs 429 (attempt %d/4) body=%s retry-after=%s sleeping=%.2fs",
                        attempt + 1, resp.text[:200], retry_after, delay,
                    )
                    if attempt < 3:
                        time.sleep(delay)
                        continue
                break
        # Surface quota/auth errors clearly so the caller can fall back to MMS
        if resp.status_code == 401:
            raise RuntimeError("ElevenLabs: invalid API key (401)")
        if resp.status_code == 402:
            raise RuntimeError("ElevenLabs: free plan cannot use library voices via API — upgrade or use a premade voice (402)")
        if resp.status_code == 429:
            raise RuntimeError(f"ElevenLabs: rate limited after retries (429): {resp.text[:200]}")
        resp.raise_for_status()
        logger.debug(
            "ElevenLabs API call: %.1f ms  bytes=%s",
            (time.perf_counter() - t0) * 1000,
            len(resp.content),
        )
        return resp.content  # MP3 bytes

    @staticmethod
    def _mp3_to_wav_bytes(mp3_bytes: bytes) -> bytes:
        """Convert MP3 bytes → WAV bytes using pydub (ffmpeg on PATH)."""
        from pydub import AudioSegment

        audio = AudioSegment.from_mp3(io.BytesIO(mp3_bytes))
        buf = io.BytesIO()
        audio.export(buf, format="wav")
        return buf.getvalue()

    # ------------------------------------------------------------------
    # Public interface (matches MmsUrduTTSAdapter / TTSService)
    # ------------------------------------------------------------------

    def synthesize_to_mp3_bytes(self, text: str, language: str = "ur") -> bytes:
        """Return raw MP3 bytes from ElevenLabs (no pydub needed)."""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        return self._call_api(text.strip())

    def synthesize_to_wav_bytes(self, text: str, language: str = "ur") -> bytes:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        mp3 = self._call_api(text.strip())
        return self._mp3_to_wav_bytes(mp3)

    def synthesize_to_file(
        self,
        text: str,
        output_path: str,
        language: str = "ur",
        speaker_wav=None,
    ) -> str:
        import os

        wav_bytes = self.synthesize_to_wav_bytes(text, language)
        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(wav_bytes)
        return output_path
