import json
import random
import re
import secrets
import threading
import uuid
from datetime import timedelta


_SUMMARY_PREFIX_RE = re.compile(
    r"^(session\s+(recap|summary|note)|clinical\s+note|therapist\s+note|summary|recap|note|brief\s+summary|short\s+summary)\s*[:\-–—]\s*",
    re.IGNORECASE,
)
_SEP_LINE_RE = re.compile(r"(?m)^\s*[-*_=~]{3,}\s*$")
_LONG_DASH_RUN_RE = re.compile(r"[-–—]{3,}")
_TRAILING_PUNCT_RE = re.compile(r"[\s\-–—_*#]+$")
_MULTIBLANK_RE = re.compile(r"\n{3,}")


def _sanitize_summary(text: str) -> str:
    """Clean LLM summary output: strip separator lines, ---- trails, wrapping
    quotes, common label prefixes, and collapse excess whitespace."""
    if not text:
        return ""
    cleaned = str(text).replace("\r\n", "\n").replace("\r", "\n").strip()
    # Drop wrapping quotes
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in ('"', "'", "`"):
        cleaned = cleaned[1:-1].strip()
    # Strip leading label prefixes repeatedly
    for _ in range(3):
        new = _SUMMARY_PREFIX_RE.sub("", cleaned).strip()
        if new == cleaned:
            break
        cleaned = new
    # Remove separator-only lines
    cleaned = _SEP_LINE_RE.sub("", cleaned)
    # Remove inline runs of 3+ dashes
    cleaned = _LONG_DASH_RUN_RE.sub("", cleaned)
    # Strip markdown bold/italic markers and hash headings (plain-text rendering)
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"\1", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"(?m)^#{1,6}\s+", "", cleaned)
    # Trim trailing dashes/symbols on each line
    cleaned = "\n".join(_TRAILING_PUNCT_RE.sub("", line).rstrip() for line in cleaned.split("\n"))
    # Collapse excess blank lines
    cleaned = _MULTIBLANK_RE.sub("\n\n", cleaned).strip()
    return cleaned

import requests

from django.conf import settings
from django.db.models import Exists, OuterRef
from django.contrib.auth.hashers import check_password, make_password
from django.http import JsonResponse, StreamingHttpResponse, FileResponse, Http404
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from datetime import date
import os

from api.models import EmailVerification, Message, Session, User, Testresult, Therapistdirectory
from api.services.session_service import SessionService
from api.services.diagnostic_test_service import DiagnosticTestService
from chatbot.conversation_memory import ConversationMemory
from chatbot.llm_client import LLMClient

# Legacy in-memory caches removed; persistence handled by SessionService.

# TTS Service cache (singleton pattern for performance)
_tts_service_cache = None
_tts_service_lock = None

def _get_tts_service():
    """Get or create TTS service instance (cached for performance)."""
    global _tts_service_cache, _tts_service_lock
    
    if _tts_service_cache is None:
        import sys
        import os
        import threading
        
        if _tts_service_lock is None:
            _tts_service_lock = threading.Lock()
        
        with _tts_service_lock:
            # Double-check pattern
            if _tts_service_cache is None:
                tts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tts')
                if tts_dir not in sys.path:
                    sys.path.insert(0, tts_dir)
                
                from tts.tts_service import TTSService
                
                _tts_service_cache = TTSService(
                    model_name="tts_models/multilingual/multi-dataset/xtts_v2",
                    device=None,
                    gpu=None,
                )
    
    return _tts_service_cache


# Qwen3-TTS adapter cache (default TTS backend)
_qwen3_tts_cache = None
_qwen3_tts_lock = None


# ElevenLabs TTS adapter cache (Urdu primary)
_elevenlabs_tts_cache = None
_elevenlabs_tts_lock = None

# MMS-TTS adapter cache (Urdu fallback)
_mms_urdu_tts_cache = None
_mms_urdu_tts_lock = None

# Edge TTS adapter cache (English primary)
_edge_tts_cache = None
_edge_tts_lock = None


def _get_elevenlabs_tts_service():
    """Get or create ElevenLabs adapter (cached). Returns None if API key not configured."""
    global _elevenlabs_tts_cache, _elevenlabs_tts_lock
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        return None
    if _elevenlabs_tts_cache is None:
        if _elevenlabs_tts_lock is None:
            _elevenlabs_tts_lock = threading.Lock()
        with _elevenlabs_tts_lock:
            if _elevenlabs_tts_cache is None:
                import sys
                tts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tts')
                if tts_dir not in sys.path:
                    sys.path.insert(0, tts_dir)
                from tts.elevenlabs_tts_adapter import ElevenLabsTTSAdapter
                _elevenlabs_tts_cache = ElevenLabsTTSAdapter(
                    api_key=api_key,
                    voice_name=os.environ.get("ELEVENLABS_VOICE_NAME", "Jessica"),
                )
    return _elevenlabs_tts_cache


def _get_mms_urdu_tts_service():
    """Get or create MMS-TTS adapter for Urdu (cached singleton)."""
    global _mms_urdu_tts_cache, _mms_urdu_tts_lock
    if _mms_urdu_tts_cache is None:
        if _mms_urdu_tts_lock is None:
            _mms_urdu_tts_lock = threading.Lock()
        with _mms_urdu_tts_lock:
            if _mms_urdu_tts_cache is None:
                import sys
                tts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tts')
                if tts_dir not in sys.path:
                    sys.path.insert(0, tts_dir)
                from tts.mms_urdu_tts_adapter import MmsUrduTTSAdapter
                _mms_urdu_tts_cache = MmsUrduTTSAdapter()
    return _mms_urdu_tts_cache


def _get_edge_tts_service():
    """Get or create Edge TTS adapter (cached singleton). No model download — cloud API."""
    global _edge_tts_cache, _edge_tts_lock
    if _edge_tts_cache is None:
        if _edge_tts_lock is None:
            _edge_tts_lock = threading.Lock()
        with _edge_tts_lock:
            if _edge_tts_cache is None:
                import sys
                tts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tts')
                if tts_dir not in sys.path:
                    sys.path.insert(0, tts_dir)
                from tts.edge_tts_adapter import EdgeTTSAdapter
                voice = os.environ.get("EDGE_TTS_VOICE", "en-US-AriaNeural")
                _edge_tts_cache = EdgeTTSAdapter(voice=voice)
    return _edge_tts_cache


def _get_qwen3_tts_service():
    """Get or create Qwen3-TTS adapter (cached). Default TTS backend for the API."""
    global _qwen3_tts_cache, _qwen3_tts_lock
    if _qwen3_tts_cache is None:
        if _qwen3_tts_lock is None:
            _qwen3_tts_lock = threading.Lock()
        with _qwen3_tts_lock:
            if _qwen3_tts_cache is None:
                import sys
                tts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tts')
                if tts_dir not in sys.path:
                    sys.path.insert(0, tts_dir)
                from tts.qwen3_tts_adapter import Qwen3TTSAdapter
                _qwen3_tts_cache = Qwen3TTSAdapter(model_size="0.6B")
    return _qwen3_tts_cache


def _resolve_tts_backend(data, language=None):
    """
    Both English and Urdu default to Edge TTS (Microsoft cloud, ~500ms, no GPU).
    English fallback: Qwen3. Urdu fallback: MMS.
    Override via JSON body `tts_backend` or env `TTS_BACKEND`.
    """
    req = (data.get("tts_backend") or "").strip().lower()
    if req in ("xtts", "qwen3", "mms_urdu", "edge_tts"):
        return req
    env = (os.environ.get("TTS_BACKEND") or "").strip().lower()
    if env in ("xtts", "qwen3", "mms_urdu", "edge_tts"):
        return env
    return "edge_tts"


def _sanitize_test_context_key(key):
    """Safe filename fragment from test context key (e.g. result_id)."""
    if key is None:
        return None
    import re
    return re.sub(r"[^a-zA-Z0-9_-]", "_", str(key)).strip("_") or None


def _urdu_voice_welcome_arabic_script(user_first_name=None):
    """
    Voice intro in Urdu (Arabic script), readable in RTL UIs.
    Latin names use LRI/PDI isolates; product name is Urdu 'مائنڈ ایز' (MindEase) to avoid bidi jumps.
    """
    lri, pdi = "\u2066", "\u2069"  # LTR isolate / pop (Unicode TR #9)
    brand = "مائنڈ ایز"
    closing = (
        "\n\nآج آپ کیسا محسوس کر رہے ہیں؟ آپ کے ذہن میں کیا ہے؟"
    )
    if user_first_name and str(user_first_name).strip():
        name = str(user_first_name).strip()
        if any(c.isascii() and c.isalpha() for c in name):
            name_disp = f"{lri}{name}{pdi}"
        else:
            name_disp = name
        return (
            f"{name_disp}، {brand} میں خوش آمدید۔ "
            f"میں آپ کی ذہنی اور جذباتی بہبود کے لیے یہاں ہوں۔{closing}"
        )
    return f"{brand} میں خوش آمدید۔ میں آپ کی ذہنی اور جذباتی بہبود کے لیے یہاں ہوں۔{closing}"


def _welcome_audio_lang_suffix(lang_pref, voice_welcome_urdu_script=False):
    """Urdu cached files share one `_ur` bucket regardless of script variant:
    the `.txt` slot holds Roman Urdu (text chat) and the `.wav` slot holds
    native-script Urdu (voice chat). Keeping one suffix keeps the on-disk
    footprint at 8 files per user (2 per language per mode)."""
    if lang_pref and str(lang_pref).lower() in ("ur", "urdu"):
        return "_ur"
    return ""


def _get_welcome_audio_path(
    user_id, include_context=False, test_context_key=None, lang_pref=None, voice_welcome_urdu_script=False
):
    """Path to cached welcome audio. With context: keyed by test_context_key so each test result has its own cache."""
    base = getattr(settings, "MEDIA_ROOT", None) or os.path.join(settings.BASE_DIR, "media")
    welcome_dir = os.path.join(base, "welcome_audio")
    os.makedirs(welcome_dir, exist_ok=True)
    lang_suffix = _welcome_audio_lang_suffix(lang_pref, voice_welcome_urdu_script=voice_welcome_urdu_script)
    if include_context and test_context_key:
        safe_key = _sanitize_test_context_key(test_context_key)
        mid = f"_with_context_{safe_key}" if safe_key else "_with_context"
    else:
        mid = "_with_context" if include_context else ""
    return os.path.join(welcome_dir, f"{user_id}{lang_suffix}{mid}.wav")


def _get_welcome_text_path(
    user_id, include_context=False, test_context_key=None, lang_pref=None, voice_welcome_urdu_script=False
):
    """Path to cached welcome text (mirror of audio path, .txt)."""
    base = getattr(settings, "MEDIA_ROOT", None) or os.path.join(settings.BASE_DIR, "media")
    text_dir = os.path.join(base, "welcome_text")
    os.makedirs(text_dir, exist_ok=True)
    lang_suffix = _welcome_audio_lang_suffix(lang_pref, voice_welcome_urdu_script=voice_welcome_urdu_script)
    if include_context and test_context_key:
        safe_key = _sanitize_test_context_key(test_context_key)
        mid = f"_with_context_{safe_key}" if safe_key else "_with_context"
    else:
        mid = "_with_context" if include_context else ""
    return os.path.join(text_dir, f"{user_id}{lang_suffix}{mid}.txt")


# ---- Welcome cache single-flight locks (per cache path) ----
_welcome_cache_locks = {}
_welcome_cache_locks_mutex = threading.Lock()


def _get_cache_lock(key: str) -> threading.Lock:
    with _welcome_cache_locks_mutex:
        lock = _welcome_cache_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _welcome_cache_locks[key] = lock
        return lock


def _atomic_write_bytes(path: str, data: bytes):
    tmp = f"{path}.tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)


def _atomic_write_text(path: str, text: str):
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def _build_assessment_test_context(test_result, lang_pref=None) -> str:
    """Backend mirror of components/share-test-modal.tsx:buildAssessmentTestContext.
    Used by background precompute so we don't depend on the client sending the context."""
    is_urdu = bool(lang_pref) and str(lang_pref).lower() in ("urdu", "ur")
    try:
        test_name = DiagnosticTestService.get_test_name(test_result.test_type)
    except Exception:
        test_name = test_result.test_type
    score = test_result.score
    sev = (test_result.severity_level or "").strip()
    try:
        taken_at = test_result.taken_at
        date_str = taken_at.strftime("%d %B %Y")
    except Exception:
        date_str = ""
    if is_urdu:
        urdu_sev_map = {
            "minimal": "bohot kam", "mild": "halka", "moderate": "darmiyani",
            "moderately severe": "darmiyani se shadeed", "severe": "shadeed",
            "extremely severe": "bohot shadeed", "none": "koi nahi", "normal": "normal",
        }
        sev_disp = urdu_sev_map.get(sev.lower(), sev)
        return (
            f"User ne {test_name} assessment mukammal ki hai.\n\n"
            f"Natayij:\n"
            f"- Assessment: {test_name}\n"
            f"- Kul score: {score} (zyada score ka matlab zyada alamat; Daily Mood Check-In mein zyada score behtar mood ka ishara hai)\n"
            f"- Shadeediyat: {sev_disp}\n"
            f"- Mukammal hone ki tareekh: {date_str}\n\n"
            f"Is maloomat se user ki zehni sehat ki halat samjhein aur munasib, shakhsi madad den. Assessment dobara poochne ki zaroorat nahi."
        )
    sev_disp = sev.title() if sev else ""
    return (
        f"The user has completed a {test_name} assessment.\n\n"
        f"Assessment results:\n"
        f"- Assessment: {test_name}\n"
        f"- Total score: {score} (higher scores indicate greater symptom burden, except for Daily Mood Check-In where higher means better mood)\n"
        f"- Severity: {sev_disp}\n"
        f"- Date completed: {date_str}\n\n"
        f"Use this information to understand the user's current mental health context and provide appropriate, personalized support. You do not need to ask them to repeat their assessment results."
    )


def _strip_welcome_meta_phrases(welcome_msg: str) -> str:
    welcome_msg = (welcome_msg or "").strip()
    meta_phrases = [
        "Here is a warm message for the user:", "Here's a warm message for the user:",
        "Here is a warm message:", "Here's a warm message:",
        "Here is warm message for user:", "Here's warm message for user:",
        "Here is warm message:", "Here's warm message:",
        "Here is the welcome message:", "Here's the welcome message:",
    ]
    for phrase in meta_phrases:
        if welcome_msg.lower().startswith(phrase.lower()):
            welcome_msg = welcome_msg[len(phrase):].strip()
            if welcome_msg.startswith('"') and welcome_msg.endswith('"'):
                welcome_msg = welcome_msg[1:-1].strip()
            if welcome_msg.startswith("'") and welcome_msg.endswith("'"):
                welcome_msg = welcome_msg[1:-1].strip()
            break
    return welcome_msg


def _generate_welcome_text(user_first_name, test_context, lang_pref, voice_welcome_urdu_script=False) -> str:
    """Generate a welcome message (LLM if test_context, else static). Pure function."""
    is_urdu = bool(lang_pref) and str(lang_pref).lower() in ("urdu", "ur")

    if test_context:
        import sys as _sys
        chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chatbot")
        if chatbot_dir not in _sys.path:
            _sys.path.insert(0, chatbot_dir)
        if is_urdu:
            if voice_welcome_urdu_script:
                from chatbot.urdu_qwen_chat import welcome_with_assessment_arabic_urdu
                return welcome_with_assessment_arabic_urdu(test_context, user_first_name).strip()
            from chatbot.urdu_qwen_chat import welcome_with_assessment_roman_urdu
            return welcome_with_assessment_roman_urdu(test_context, user_first_name).strip()
        from chatbot.llm_client import LLMClient
        llm_client = LLMClient()
        system_prompt = f"""You are a compassionate mental health therapist speaking directly to the user in first person. The user has shared their assessment results with you.

Test Context:
{test_context}

Write a direct, warm welcome message (NOT a description of what to write, but the actual message itself) that:
1. Greets the user warmly using their name: {user_first_name or 'there'}
2. Briefly acknowledges you've reviewed their assessment results
3. Shows understanding of their current condition
4. Invites them to share what's on their mind

STRICT RULES:
- Speak ONLY as "I" / "me" / "my". NEVER use "we", "we've", "we're", "us", or "our". You are one therapist, not a team.
- Do NOT include meta-commentary like "Here is", "Here's a", or "I'll write".
- Write the actual welcome message directly, as if speaking to the user.

Keep it concise (2-3 sentences) and natural. Start directly with the greeting."""
        msg = llm_client.generate_response(
            user_message="Hello, I'm ready to chat.",
            system_prompt_override=system_prompt,
            user_first_name=user_first_name,
        ).strip()
        return _strip_welcome_meta_phrases(msg)

    # No test_context: static strings
    if is_urdu:
        if voice_welcome_urdu_script:
            return _urdu_voice_welcome_arabic_script(user_first_name)
        if user_first_name:
            return f"MindEase mein khush aamdeed, {user_first_name}. Main aap ki zehni aur jazbati behbood ke liye yahan hoon.\n\nAaj aap kaisa mehsoos kar rahe hain? Aap ke zehan mein kya hai?"
        return "MindEase mein khush aamdeed. Main aap ki zehni aur jazbati behbood ke liye yahan hoon.\n\nAaj aap kaisa mehsoos kar rahe hain? Aap ke zehan mein kya hai?"
    if user_first_name:
        return f"Welcome to MindEase, {user_first_name}. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"
    return "Welcome to MindEase. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"


def _synthesize_welcome_audio(welcome_message: str, audio_path: str, lang_pref=None):
    """TTS the welcome message to audio_path (atomic). Also writes sidecar .json with the text."""
    language = "ur" if (lang_pref and str(lang_pref).lower() in ("urdu", "ur")) else "en"
    backend = _resolve_tts_backend({}, language=language)
    if backend == "xtts":
        tts_service = _get_tts_service()
    elif backend == "edge_tts":
        is_urdu = language == "ur"
        voice = (
            os.environ.get("EDGE_TTS_VOICE_UR", "ur-PK-AsadNeural") if is_urdu
            else os.environ.get("EDGE_TTS_VOICE", "en-US-AriaNeural")
        )
        root, ext = os.path.splitext(audio_path)
        tmp_audio = f"{root}.part.mp3"
        try:
            edge_service = _get_edge_tts_service()
            edge_service.synthesize_to_file(text=welcome_message, output_path=tmp_audio, language=language, voice=voice)
            os.replace(tmp_audio, audio_path)
        except Exception as edge_err:
            print(f"[TTS] Edge TTS welcome audio failed ({edge_err}), using fallback")
            if os.path.exists(tmp_audio):
                try: os.unlink(tmp_audio)
                except Exception: pass
            fallback = _get_mms_urdu_tts_service() if is_urdu else _get_qwen3_tts_service()
            tmp_wav = f"{root}.part{ext or '.wav'}"
            fallback.synthesize_to_file(text=welcome_message, output_path=tmp_wav, language=language)
            os.replace(tmp_wav, audio_path)
        sidecar = audio_path.replace(".wav", ".json")
        try:
            _atomic_write_text(sidecar, json.dumps({"welcome_message": welcome_message}, ensure_ascii=False))
        except Exception:
            pass
        return
    else:
        tts_service = _get_qwen3_tts_service()
    # soundfile infers format from extension → keep .wav on the tmp file
    root, ext = os.path.splitext(audio_path)
    tmp_audio = f"{root}.part{ext or '.wav'}"
    tts_service.synthesize_to_file(text=welcome_message, output_path=tmp_audio, language=language)
    os.replace(tmp_audio, audio_path)
    sidecar = audio_path.replace(".wav", ".json")
    try:
        _atomic_write_text(sidecar, json.dumps({"welcome_message": welcome_message}, ensure_ascii=False))
    except Exception:
        pass


def _ensure_welcome_text_cached(
    user_id, user_first_name, test_context, lang_pref,
    include_context=False, test_context_key=None, voice_welcome_urdu_script=False,
) -> str:
    """Return welcome text, generating and caching under single-flight lock if missing.
    The Urdu text cache slot always stores Roman Urdu (for text chat); any
    native-script request is force-downgraded so the slot can't be clobbered."""
    is_urdu = bool(lang_pref) and str(lang_pref).lower() in ("urdu", "ur")
    if is_urdu:
        voice_welcome_urdu_script = False
    path = _get_welcome_text_path(
        user_id, include_context=include_context, test_context_key=test_context_key,
        lang_pref=lang_pref, voice_welcome_urdu_script=voice_welcome_urdu_script,
    )
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            pass
    lock = _get_cache_lock(path)
    with lock:
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()
            except Exception:
                pass
        welcome_msg = _generate_welcome_text(
            user_first_name, test_context, lang_pref,
            voice_welcome_urdu_script=voice_welcome_urdu_script,
        )
        try:
            _atomic_write_text(path, welcome_msg)
        except Exception as e:
            print(f"[welcome-cache] text write failed: {e}")
        return welcome_msg


def _ensure_welcome_audio_cached(
    user_id, user_first_name, test_context, lang_pref,
    include_context=False, test_context_key=None, voice_welcome_urdu_script=False,
    welcome_message_override=None,
) -> str:
    """Return path to cached welcome audio, generating under single-flight lock if missing."""
    path = _get_welcome_audio_path(
        user_id, include_context=include_context, test_context_key=test_context_key,
        lang_pref=lang_pref, voice_welcome_urdu_script=voice_welcome_urdu_script,
    )
    if os.path.isfile(path):
        return path
    lock = _get_cache_lock(path)
    with lock:
        if os.path.isfile(path):
            return path
        if welcome_message_override:
            welcome_msg = welcome_message_override
        else:
            # For Urdu voice the audio must speak native-script Urdu, but the
            # shared `.txt` slot holds Roman Urdu (used by text chat). Generate
            # native-script text fresh without touching the text cache; the
            # sidecar .json next to the .wav preserves it for the client.
            is_urdu = bool(lang_pref) and str(lang_pref).lower() in ("urdu", "ur")
            if is_urdu and voice_welcome_urdu_script:
                welcome_msg = _generate_welcome_text(
                    user_first_name, test_context, lang_pref,
                    voice_welcome_urdu_script=True,
                )
            else:
                welcome_msg = _ensure_welcome_text_cached(
                    user_id, user_first_name, test_context, lang_pref,
                    include_context=include_context, test_context_key=test_context_key,
                    voice_welcome_urdu_script=voice_welcome_urdu_script,
                )
        _synthesize_welcome_audio(welcome_msg, path, lang_pref=lang_pref)
        return path


# Two language buckets; each bucket gets 4 cache files (text ctx/no-ctx, audio
# ctx/no-ctx) for a total of 8 content files per user. For Urdu, `.txt` holds
# Roman Urdu (for text chat) and `.wav` holds native-script Urdu (for voice
# chat) — we do not split those into separate on-disk buckets.
# Tuple: (lang_pref_for_cache, text_vus, audio_vus)
#   text_vus/audio_vus select content style; both map to the same `_ur` path.
_WELCOME_VARIANTS = (
    ("english", False, False),  # English — vus flag ignored by generator
    ("urdu",    False, True),   # text = Roman Urdu, audio = native-script Urdu
)


def _variant_label(vlang, *_args):
    """Human-readable variant tag for logs."""
    return "urdu" if str(vlang).lower() in ("urdu", "ur") else "english"


def _legacy_cleanup_ur_ar(user_id):
    """Remove stale `_ur_ar*` files from the prior split-bucket layout so
    users that already have a test result collapse to the new 8-file layout."""
    base = getattr(settings, "MEDIA_ROOT", None) or os.path.join(settings.BASE_DIR, "media")
    for sub in ("welcome_audio", "welcome_text"):
        d = os.path.join(base, sub)
        if not os.path.isdir(d):
            continue
        try:
            for name in os.listdir(d):
                if name.startswith(f"{user_id}_ur_ar"):
                    try:
                        os.unlink(os.path.join(d, name))
                    except Exception:
                        pass
        except Exception:
            pass


def _precompute_welcomes_for_test_result(user_id, user_first_name, lang_pref, test_result_id, test_context):
    """Generate and cache welcome text + audio for every chat mode so
    switching language/mode mid-use has no wait. Writes 8 content files per
    user: 2 text + 2 audio per language (with-context + no-context)."""
    def _worker():
        try:
            tr = Testresult.objects.get(result_id=test_result_id)
        except Exception:
            tr = None

        _legacy_cleanup_ur_ar(user_id)

        for vlang, text_vus, audio_vus in _WELCOME_VARIANTS:
            tag = _variant_label(vlang)
            print(f"[welcome-precompute] user={user_id} variant={tag} starting")
            ctx = _build_assessment_test_context(tr, lang_pref=vlang) if tr else test_context

            # Text: ctx + no-ctx
            try:
                _ensure_welcome_text_cached(
                    user_id, user_first_name, ctx, vlang,
                    include_context=True, test_context_key=test_result_id,
                    voice_welcome_urdu_script=text_vus,
                )
            except Exception as e:
                print(f"[welcome-precompute] text(ctx) failed [{tag}]: {e}")
            try:
                _ensure_welcome_text_cached(
                    user_id, user_first_name, None, vlang,
                    include_context=False, test_context_key=None,
                    voice_welcome_urdu_script=text_vus,
                )
            except Exception as e:
                print(f"[welcome-precompute] text(no-ctx) failed [{tag}]: {e}")

            # Audio: ctx + no-ctx (audio content uses audio_vus; for Urdu this is
            # native script even though the path collides with the Roman text).
            try:
                _ensure_welcome_audio_cached(
                    user_id, user_first_name, ctx, vlang,
                    include_context=True, test_context_key=test_result_id,
                    voice_welcome_urdu_script=audio_vus,
                )
            except Exception as e:
                print(f"[welcome-precompute] audio(ctx) failed [{tag}]: {e}")
            try:
                _ensure_welcome_audio_cached(
                    user_id, user_first_name, None, vlang,
                    include_context=False, test_context_key=None,
                    voice_welcome_urdu_script=audio_vus,
                )
            except Exception as e:
                print(f"[welcome-precompute] audio(no-ctx) failed [{tag}]: {e}")
            print(f"[welcome-precompute] user={user_id} variant={tag} done")
    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _refresh_welcomes_if_stale(user):
    """Login-time safety net: if any of the 8 cached files for the user's
    latest test result is missing or older than the test, delete the stale
    ones and trigger a background precompute."""
    def _worker():
        try:
            latest_test = Testresult.objects.filter(user_id=user.user_id).order_by("-taken_at").first()
        except Exception as e:
            print(f"[welcome-refresh] could not query latest test: {e}")
            return
        if not latest_test:
            return
        try:
            cutoff_ts = latest_test.taken_at.timestamp()
        except Exception:
            return
        result_id = latest_test.result_id

        def _try_unlink(path):
            try:
                if os.path.isfile(path):
                    os.unlink(path)
            except Exception:
                pass

        _legacy_cleanup_ur_ar(user.user_id)

        stale_variants = []
        for vlang, text_vus, audio_vus in _WELCOME_VARIANTS:
            tag = _variant_label(vlang)
            text_ctx_path = _get_welcome_text_path(
                user.user_id, include_context=True, test_context_key=result_id,
                lang_pref=vlang, voice_welcome_urdu_script=text_vus,
            )
            text_noctx_path = _get_welcome_text_path(
                user.user_id, include_context=False, test_context_key=None,
                lang_pref=vlang, voice_welcome_urdu_script=text_vus,
            )
            audio_ctx_path = _get_welcome_audio_path(
                user.user_id, include_context=True, test_context_key=result_id,
                lang_pref=vlang, voice_welcome_urdu_script=audio_vus,
            )
            audio_noctx_path = _get_welcome_audio_path(
                user.user_id, include_context=False, test_context_key=None,
                lang_pref=vlang, voice_welcome_urdu_script=audio_vus,
            )
            sidecar_ctx = audio_ctx_path.replace(".wav", ".json")
            sidecar_noctx = audio_noctx_path.replace(".wav", ".json")

            checks = [
                (text_ctx_path, "text-ctx"),
                (text_noctx_path, "text-noctx"),
                (audio_ctx_path, "audio-ctx"),
                (audio_noctx_path, "audio-noctx"),
                (sidecar_ctx, "sidecar-ctx"),
                (sidecar_noctx, "sidecar-noctx"),
            ]

            variant_stale = False
            reasons = []
            for p, kind in checks:
                if not os.path.isfile(p):
                    variant_stale = True; reasons.append(f"{kind}-missing")
                else:
                    try:
                        if os.path.getmtime(p) < cutoff_ts:
                            variant_stale = True; reasons.append(f"{kind}-older-than-test")
                    except Exception:
                        variant_stale = True; reasons.append(f"{kind}-stat-failed")

            if variant_stale:
                for p, _ in checks:
                    _try_unlink(p)
                stale_variants.append((tag, reasons))

        if not stale_variants:
            return

        for tag, reasons in stale_variants:
            print(f"[welcome-refresh] stale variant [{tag}] for user {user.user_id}: {', '.join(reasons)}")
        ctx_fallback = _build_assessment_test_context(latest_test, lang_pref=user.lang_pref)
        _precompute_welcomes_for_test_result(
            user_id=user.user_id,
            user_first_name=user.first_name,
            lang_pref=user.lang_pref,
            test_result_id=result_id,
            test_context=ctx_fallback,
        )

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _resolve_session_for_user(user_id, identifier):
    """
    Resolve a session for the given user. Accepts either UUID strings or integer IDs.
    Raises ValueError for invalid identifiers and Session.DoesNotExist when not found.
    """
    if identifier is None:
        raise ValueError("invalid_session_identifier")

    session_qs = Session.objects.filter(user_id=user_id)

    try:
        session_uuid = uuid.UUID(str(identifier))
    except (ValueError, TypeError):
        try:
            session_id_int = int(identifier)
        except (ValueError, TypeError):
            raise ValueError("invalid_session_identifier") from None
        return session_qs.get(session_id=session_id_int)

    return session_qs.get(session_uuid=session_uuid)


# -------------------------
# REGISTER USER
# -------------------------
@csrf_exempt
def register(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            # Extract fields from request
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            email = data.get("email")
            password = data.get("password")
            dob = data.get("dob")
            gender = data.get("gender")
            lang_pref = data.get("lang_pref")
            city = data.get("city")
            nearest_major_city = data.get("nearest_major_city")
            if lang_pref == "en":
                lang_pref = "english"
            elif lang_pref == "ur":
                lang_pref = "urdu"

            # Check for missing fields
            if not all([first_name, last_name, email, password, dob, gender, lang_pref, city, nearest_major_city]):
                return JsonResponse({"error": "All fields are required."}, status=400)

            # Normalize email to lowercase for case-insensitive comparison
            email_normalized = email.lower()

            # Check if email already exists (case-insensitive)
            if User.objects.filter(email__iexact=email_normalized).exists():
                return JsonResponse({"error": "User with this email already exists."}, status=400)

            # Check if email is verified
            try:
                verification = EmailVerification.objects.get(user_email=email_normalized, is_verified=True)
            except EmailVerification.DoesNotExist:
                return JsonResponse({"error": "Please verify your email first."}, status=400)

            nearest_major_city_clean = nearest_major_city.strip() if nearest_major_city else ""
            if not nearest_major_city_clean:
                return JsonResponse({"error": "Nearest major city is required."}, status=400)

            # Parse and validate DOB
            dob_parsed = parse_date(dob)
            if not dob_parsed:
                return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

            # Create user record
            user = User.objects.create(
                first_name=first_name,
                last_name=last_name,
                email=email_normalized,
                password=make_password(password),
                dob=dob_parsed,
                gender=gender,
                lang_pref=lang_pref,
                city=city.strip() if city else None,
                nearest_major_city=nearest_major_city_clean,
            )

            return JsonResponse({
                "message": "User registered successfully!",
                "user_id": user.user_id,
                "email": user.email
            }, status=201)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# LOGIN VIA OAUTH (e.g. Google via Clerk)
# -------------------------
@csrf_exempt
def login_oauth(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=405)
    try:
        data = json.loads(request.body)
        email = data.get("email")
        if not email:
            return JsonResponse({"error": "Email is required."}, status=400)
        email_normalized = email.lower()
        try:
            user = User.objects.get(email=email_normalized)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found. Complete sign up first."}, status=404)

        # Safety net: refresh any stale / missing precomputed welcome files.
        try:
            _refresh_welcomes_if_stale(user)
        except Exception as e:
            print(f"[welcome-refresh] oauth login hook failed: {e}")

        # Return same shape as login for frontend setAuth
        return JsonResponse({
            "message": "Login successful.",
            "user_id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name or "",
            "email": user.email,
            "gender": user.gender or "Other",
            "lang_pref": user.lang_pref,
            "city": user.city or "",
            "nearest_major_city": user.nearest_major_city or "",
            "dashboard_tour_seen": user.dashboard_tour_seen,
            "primary_condition": user.primary_condition,
            "generic_screening_completed": user.generic_screening_completed,
        }, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# REGISTER VIA OAUTH (after OTP verified) — complete profile
# -------------------------
@csrf_exempt
def register_oauth(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=405)
    try:
        data = json.loads(request.body)
        email = data.get("email")
        first_name = data.get("first_name") or ""
        last_name = data.get("last_name") or ""
        city = data.get("city") or ""
        nearest_major_city = (data.get("nearest_major_city") or "").strip()
        dob = data.get("dob")
        gender = data.get("gender") or "Other"
        lang_pref = data.get("preferred_language") or data.get("lang_pref") or "en"
        if lang_pref == "en":
            lang_pref = "english"
        elif lang_pref == "ur":
            lang_pref = "urdu"

        if not email:
            return JsonResponse({"error": "Email is required."}, status=400)
        email_normalized = email.lower()
        oauth_verified = data.get("oauth_verified") is True  # Skip OTP when user came from Google OAuth

        if User.objects.filter(email__iexact=email_normalized).exists():
            return JsonResponse({"error": "User with this email already exists."}, status=400)

        if not oauth_verified:
            try:
                verification = EmailVerification.objects.get(user_email=email_normalized, is_verified=True)
            except EmailVerification.DoesNotExist:
                return JsonResponse({"error": "Please verify your email with OTP first."}, status=400)

        if not nearest_major_city:
            return JsonResponse({"error": "Nearest major city is required."}, status=400)
        dob_parsed = parse_date(dob)
        if not dob_parsed:
            return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        user = User.objects.create(
            first_name=first_name or "User",
            last_name=last_name,
            email=email_normalized,
            password=make_password(secrets.token_urlsafe(32)),
            dob=dob_parsed,
            gender=gender,
            lang_pref=lang_pref,
            city=city or None,
            nearest_major_city=nearest_major_city,
        )
        return JsonResponse({
            "message": "User registered successfully!",
            "user_id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name or "",
            "email": user.email,
            "gender": user.gender or "Other",
            "lang_pref": user.lang_pref,
            "city": user.city or "",
            "nearest_major_city": user.nearest_major_city or "",
            "dashboard_tour_seen": user.dashboard_tour_seen,
            "primary_condition": user.primary_condition,
            "generic_screening_completed": user.generic_screening_completed,
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# SEND OTP
# -------------------------
@csrf_exempt
def send_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")

            if not email:
                return JsonResponse({"error": "Email is required."}, status=400)

            # Normalize email to lowercase
            email_normalized = email.lower()

            # Check if user already exists
            if User.objects.filter(email__iexact=email_normalized).exists():
                return JsonResponse({"error": "User with this email already exists."}, status=400)

            # Generate 6-digit OTP
            otp_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])

            # Delete any existing OTPs for this email
            EmailVerification.objects.filter(user_email=email_normalized, is_verified=False).delete()

            # Create new OTP record
            EmailVerification.objects.create(
                user_email=email_normalized,
                otp_code=otp_code,
                is_verified=False
            )

            # Send OTP via n8n webhook (workflow sends email to user's Gmail)
            webhook_url = getattr(
                settings, 'N8N_SEND_OTP_WEBHOOK_URL',
                'http://localhost:5678/webhook-test/send-otp-mindease'
            )
            try:
                resp = requests.post(
                    webhook_url,
                    json={"email": email_normalized, "otp": otp_code},
                    headers={"Content-Type": "application/json"},
                    timeout=15,
                )
                resp.raise_for_status()
            except requests.RequestException as e:
                return JsonResponse({
                    "error": "Failed to send verification email. Please try again.",
                }, status=500)

            return JsonResponse({
                "message": "OTP sent successfully to your email.",
                "email": email_normalized
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# VERIFY OTP
# -------------------------
@csrf_exempt
def verify_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            otp = data.get("otp")

            if not email or not otp:
                return JsonResponse({"error": "Email and OTP are required."}, status=400)

            # Normalize email to lowercase
            email_normalized = email.lower()

            # Find the OTP record
            try:
                verification = EmailVerification.objects.get(
                    user_email=email_normalized,
                    otp_code=otp,
                    is_verified=False
                )
            except EmailVerification.DoesNotExist:
                return JsonResponse({"error": "Invalid OTP code."}, status=400)

            # Check if OTP is expired (5 minutes)
            time_diff = timezone.now() - verification.created_at
            if time_diff > timedelta(minutes=5):
                return JsonResponse({"error": "OTP has expired. Please request a new one."}, status=400)

            # Mark as verified
            verification.is_verified = True
            verification.save()

            return JsonResponse({
                "message": "Email verified successfully!",
                "email": email_normalized
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# CHECK EMAIL EXISTS
# -------------------------
@csrf_exempt
def check_email(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")

            if not email:
                return JsonResponse({"error": "Email is required."}, status=400)

            # Normalize email to lowercase for case-insensitive comparison
            email_normalized = email.lower()

            # Check if email already exists
            email_exists = User.objects.filter(email__iexact=email_normalized).exists()

            return JsonResponse({
                "exists": email_exists,
                "email": email_normalized
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# LOGIN USER
# -------------------------
@csrf_exempt
def login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")

            if not email or not password:
                return JsonResponse({"error": "Email and password are required."}, status=400)

            # Normalize email to lowercase for case-insensitive comparison
            email_normalized = email.lower()

            try:
                user = User.objects.get(email=email_normalized)
            except User.DoesNotExist:
                return JsonResponse({"error": "Invalid email or password."}, status=401)

            if not check_password(password, user.password):
                return JsonResponse({"error": "Invalid email or password."}, status=401)

            # Safety net: if any precomputed welcome files are missing or older
            # than the user's latest test, regenerate them in the background.
            try:
                _refresh_welcomes_if_stale(user)
            except Exception as e:
                print(f"[welcome-refresh] login hook failed: {e}")

            return JsonResponse({
                "message": "Login successful.",
                "user_id": user.user_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "gender": user.gender or "Other",
                "lang_pref": user.lang_pref,  # ✅ consistent field name
                "city": user.city or "",
                "nearest_major_city": user.nearest_major_city or "",
                "dashboard_tour_seen": user.dashboard_tour_seen,
                "primary_condition": user.primary_condition,
                "generic_screening_completed": user.generic_screening_completed,
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# CHAT MESSAGE
# -------------------------
@csrf_exempt
def chat_message(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            message = data.get("message")
            user_id = data.get("user_id")
            user_first_name = data.get("user_first_name")
            user_gender = data.get("user_gender")
            conversation_history = data.get("conversation_history", [])
            test_context = data.get("test_context")  # Optional test context
            emotions_from_client = data.get("emotions")  # Optional: from voice SER
            lang_pref = data.get("lang_pref")  # Optional: "english"/"en" or "urdu"/"ur" for Urdu text chat

            if not message:
                return JsonResponse({"error": "Message is required."}, status=400)

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Import chatbot (lazy import to avoid circular dependencies)
            import sys
            import os
            chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chatbot')
            if chatbot_dir not in sys.path:
                sys.path.insert(0, chatbot_dir)
            
            from chatbot.chat import get_cached_chatbot
            chatbot = get_cached_chatbot(
                user_first_name=user_first_name,
                test_context=test_context,
                lang_pref=lang_pref,
            )
            
            # Populate conversation history from frontend (bulk load, no periodic summary)
            chatbot.memory.load_history(conversation_history)
            
            emotions_override = None
            if emotions_from_client and isinstance(emotions_from_client, list):
                emotions_override = [(e.get("emotion"), float(e.get("score", 0))) for e in emotions_from_client if e.get("emotion")]
                if emotions_override:
                    print("[Voice chat] Using emotions from audio (SER):", emotions_override)
            
            response = chatbot._process_message(message, test_context=test_context, emotions_override=emotions_override)

            updated_history = [
                msg for msg in chatbot.memory.get_history()
                if msg.get('role') in ['user', 'assistant']
            ]

            # Reuse emotions already computed inside _process_message — avoid duplicate DeBERTa call.
            if emotions_override:
                emotions = emotions_override
            else:
                emotions = getattr(chatbot, "last_emotions", None) or []
            
            # Format emotions for response
            emotions_list = []
            if emotions:
                for emotion, score in emotions:
                    emotions_list.append({
                        "emotion": emotion,
                        "score": float(score)
                    })
            
            return JsonResponse({
                "response": response,
                "emotions": emotions_list,
                "user_id": user_id,
                "conversation_history": updated_history
            }, status=200)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# CHAT MESSAGE (STREAMING)
# -------------------------
@csrf_exempt
def chat_message_stream(request):
    """Stream LLM response as SSE; client can TTS per sentence and play while stream continues."""
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=405)
    try:
        data = json.loads(request.body)
        message = data.get("message")
        user_id = data.get("user_id")
        user_first_name = data.get("user_first_name")
        user_gender = data.get("user_gender")
        conversation_history = data.get("conversation_history", [])
        test_context = data.get("test_context")
        emotions_from_client = data.get("emotions")  # Optional: from audio SER (voice chat)
        lang_pref = data.get("lang_pref")  # Optional: for Urdu text chat
        if not message:
            return JsonResponse({"error": "Message is required."}, status=400)
        if not user_id:
            return JsonResponse({"error": "User ID is required."}, status=400)
        import sys
        chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chatbot')
        if chatbot_dir not in sys.path:
            sys.path.insert(0, chatbot_dir)
        from chatbot.chat import get_cached_chatbot
        chatbot = get_cached_chatbot(
            user_first_name=user_first_name,
            test_context=test_context,
            lang_pref=lang_pref,
        )
        for msg in conversation_history:
            role, content = msg.get("role"), msg.get("content")
            if role and content:
                chatbot.memory.add_message(role, content)
        emotions_override = None
        if emotions_from_client and isinstance(emotions_from_client, list):
            emotions_override = [(e.get("emotion"), float(e.get("score", 0))) for e in emotions_from_client if e.get("emotion")]
            if emotions_override:
                print("[Voice chat stream] Using emotions from audio (SER):", emotions_override)
        full_response = []

        def event_stream():
            for chunk in chatbot._process_message_stream(message, test_context=test_context, emotions_override=emotions_override):
                full_response.append(chunk)
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
            full_text = "".join(full_response)
            chatbot.memory.add_exchange(message, full_text)
            if emotions_override:
                emotions_list = [{"emotion": e, "score": s} for e, s in emotions_override]
            else:
                emotions = chatbot.emotion_detector.detect_emotions(message, top_k=2, threshold=0.3)
                emotions_list = [{"emotion": e, "score": float(s)} for e, s in (emotions or [])]
            yield f"data: {json.dumps({'done': True, 'full_response': full_text, 'emotions': emotions_list})}\n\n"

        return StreamingHttpResponse(
            event_stream(),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# VOICE PROCESS (STT + SER) - get transcript and emotions-from-audio for voice chat
# -------------------------
@csrf_exempt
def voice_process(request):
    """
    Accept audio file; run STT and Speech Emotion Recognition (SER) in parallel.
    Returns { transcript, emotions } so the frontend can use transcript + emotions-from-voice
    when calling the chat stream (emotion from how they said it, not from text).
    """
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=405)
    try:
        if "audio" not in request.FILES:
            return JsonResponse({"error": "Audio file is required."}, status=400)
        import time as _time
        t0 = _time.perf_counter()
        audio_file = request.FILES["audio"]
        language = request.POST.get("language", "en")
        is_urdu = language and str(language).lower() in ("urdu", "ur")
        import tempfile
        import sys
        import concurrent.futures
        chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chatbot")
        stt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "stt")
        if chatbot_dir not in sys.path:
            sys.path.insert(0, chatbot_dir)
        if stt_dir not in sys.path:
            sys.path.insert(0, stt_dir)
        suffix = os.path.splitext(getattr(audio_file, "name", ""))[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in audio_file.chunks():
                tmp.write(chunk)
            audio_path = tmp.name
        t_saved = _time.perf_counter()
        lang_tag = "ur" if is_urdu else language
        audio_save_s = t_saved - t0
        audio_size_b = os.path.getsize(audio_path)
        print(f"[voice-timing] lang={lang_tag}  audio_save: {audio_save_s:.3f}s  file={suffix}  size={audio_size_b}B")
        try:
            stt_start = _time.perf_counter()
            ser_start_ref = [0.0]
            stt_time_ref = [0.0]
            ser_time_ref = [0.0]
            stt_label_ref = ["en_stt"]

            def run_stt():
                t = _time.perf_counter()
                if is_urdu:
                    svc = _get_urdu_stt_service()
                    result = svc.transcribe_file(audio_path, language="ur")
                    elapsed = _time.perf_counter() - t
                    stt_time_ref[0] = elapsed
                    stt_label_ref[0] = "urdu_stt"
                    print(f"[voice-timing] urdu_stt: {elapsed:.3f}s  chars={len(result or '')}")
                    return result

                svc = _get_en_stt_service()
                result = svc.transcribe_file(audio_path, language=language if language != "auto" else None)
                elapsed = _time.perf_counter() - t
                stt_time_ref[0] = elapsed
                stt_label_ref[0] = "en_stt"
                print(f"[voice-timing] en_stt: {elapsed:.3f}s  chars={len(result or '')}")
                return result

            def run_ser():
                t = _time.perf_counter()
                try:
                    det = _get_ser_detector()
                    result = det.detect_emotions_from_audio(audio_path, top_k=2, threshold=0.2)
                    elapsed = _time.perf_counter() - t
                    ser_time_ref[0] = elapsed
                    print(f"[voice-timing] ser: {elapsed:.3f}s")
                    return result
                except Exception as ser_err:
                    import logging
                    logging.getLogger(__name__).warning("SER failed: %s", ser_err)
                    return []

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
                fut_stt = ex.submit(run_stt)
                fut_ser = ex.submit(run_ser)
                transcript = (fut_stt.result() or "").strip()
                try:
                    ser_emotions = fut_ser.result() or []
                except Exception:
                    ser_emotions = []

            t_done = _time.perf_counter()
            total_s = t_done - t0
            parallel_s = t_done - stt_start
            emotions_list = [{"emotion": e, "score": float(s)} for e, s in ser_emotions]
            print(f"[voice-timing] TOTAL: {total_s:.3f}s  transcript_len={len(transcript)}")
            print(f"[Voice] SER emotions from audio: {emotions_list}")
            print("================ VOICE PIPELINE SUMMARY ================")
            print(f"  lang                : {lang_tag}")
            print(f"  audio file          : {suffix}  size={audio_size_b}B")
            print(f"  audio save (disk)   : {audio_save_s:7.3f}s")
            print(f"  {stt_label_ref[0]:<20}: {stt_time_ref[0]:7.3f}s  chars={len(transcript)}")
            print(f"  ser                 : {ser_time_ref[0]:7.3f}s  emotions={len(emotions_list)}")
            print(f"  parallel block      : {parallel_s:7.3f}s  (stt + ser ran together)")
            print(f"  TOTAL               : {total_s:7.3f}s")
            print("========================================================")
            return JsonResponse({"transcript": transcript, "emotions": emotions_list}, status=200)
        finally:
            try:
                os.unlink(audio_path)
            except Exception:
                pass
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def voice_welcome_audio(request):
    """GET: return cached welcome audio. Query: user_id, include_context, test_context_key (required when include_context true).
     Returns X-Welcome-Message header (base64) when we have stored text so client can show matching text.
     POST: generate TTS, save to cache (and sidecar .json with welcome_message), return audio blob.
     Body: user_id, welcome_message, lang_pref, include_test_context, test_context_key (required when include_test_context true)."""
    from io import BytesIO
    import base64
    if request.method == "GET":
        user_id = request.GET.get("user_id")
        if not user_id:
            return JsonResponse({"error": "user_id required."}, status=400)
        include_context = request.GET.get("include_context", "false").lower() in ("true", "1", "yes")
        test_context_key = request.GET.get("test_context_key") or None
        lang_pref = request.GET.get("lang_pref") or request.GET.get("language") or None
        voice_welcome_urdu_script = request.GET.get("voice_welcome_urdu_script", "").lower() in ("1", "true", "yes")
        if include_context and not test_context_key:
            return JsonResponse({"error": "test_context_key required when include_context is true."}, status=400)
        path = _get_welcome_audio_path(
            user_id,
            include_context=include_context,
            test_context_key=test_context_key,
            lang_pref=lang_pref,
            voice_welcome_urdu_script=voice_welcome_urdu_script,
        )
        if not os.path.isfile(path):
            raise Http404("Welcome audio not found")
        with open(path, "rb") as f:
            data = f.read()
        response = FileResponse(BytesIO(data), content_type="audio/wav", as_attachment=False)
        # Attach stored welcome text so client can show text that matches this audio
        sidecar = path.replace(".wav", ".json")
        if os.path.isfile(sidecar):
            try:
                with open(sidecar, "r", encoding="utf-8") as sf:
                    meta = json.load(sf)
                    msg = meta.get("welcome_message")
                    if msg:
                        response["X-Welcome-Message"] = base64.b64encode(msg.encode("utf-8")).decode("ascii")
            except Exception:
                pass
        return response
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            welcome_message = data.get("welcome_message")
            lang_pref = data.get("lang_pref")
            include_test_context = data.get("include_test_context", False)
            test_context_key = data.get("test_context_key") or None
            voice_welcome_urdu_script = bool(data.get("voice_welcome_urdu_script"))
            if not user_id or not welcome_message:
                return JsonResponse({"error": "user_id and welcome_message required."}, status=400)
            if include_test_context and not test_context_key:
                return JsonResponse({"error": "test_context_key required when include_test_context is true."}, status=400)
            path = _get_welcome_audio_path(
                user_id,
                include_context=bool(include_test_context),
                test_context_key=test_context_key,
                lang_pref=lang_pref,
                voice_welcome_urdu_script=voice_welcome_urdu_script,
            )
            # Single-flight: if cached (possibly by background precompute), skip TTS entirely.
            lock = _get_cache_lock(path)
            with lock:
                if not os.path.isfile(path):
                    _synthesize_welcome_audio(welcome_message, path, lang_pref=lang_pref)
            with open(path, "rb") as f:
                audio_data = f.read()
            return FileResponse(BytesIO(audio_data), content_type="audio/wav", as_attachment=False)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Method not allowed."}, status=405)


# -------------------------
# GET WELCOME MESSAGE
# -------------------------
@csrf_exempt
def chat_welcome(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_first_name = data.get("user_first_name")
            user_id = data.get("user_id")
            test_context = data.get("test_context")
            test_context_key = data.get("test_context_key")  # e.g. result_id; enables caching
            lang_pref = data.get("lang_pref")
            is_urdu = lang_pref and str(lang_pref).lower() in ("urdu", "ur")
            voice_welcome_urdu_script = bool(data.get("voice_welcome_urdu_script"))

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Warm up chatbot models in background so first message is fast
            import threading
            def _warmup():
                try:
                    from chatbot.chat import get_cached_chatbot
                    get_cached_chatbot(lang_pref=lang_pref)
                except Exception:
                    pass
            threading.Thread(target=_warmup, daemon=True).start()

            # Cache fast-path (with-context + test_context_key) — hit cache or single-flight generate
            if test_context and test_context_key:
                welcome_msg = _ensure_welcome_text_cached(
                    user_id, user_first_name, test_context, lang_pref,
                    include_context=True, test_context_key=test_context_key,
                    voice_welcome_urdu_script=voice_welcome_urdu_script,
                )
                return JsonResponse({"welcome_message": welcome_msg, "user_id": user_id}, status=200)

            # Generate welcome message with test context if provided (no cache key — call helper directly)
            if test_context:
                welcome_msg = _generate_welcome_text(
                    user_first_name, test_context, lang_pref,
                    voice_welcome_urdu_script=voice_welcome_urdu_script,
                )
            else:
                # Standard welcome message - Urdu or English based on lang_pref
                if is_urdu:
                    if voice_welcome_urdu_script:
                        welcome_msg = _urdu_voice_welcome_arabic_script(user_first_name)
                    elif user_first_name:
                        welcome_msg = f"MindEase mein khush aamdeed, {user_first_name}. Main aap ki zehni aur jazbati behbood ke liye yahan hoon.\n\nAaj aap kaisa mehsoos kar rahe hain? Aap ke zehan mein kya hai?"
                    else:
                        welcome_msg = "MindEase mein khush aamdeed. Main aap ki zehni aur jazbati behbood ke liye yahan hoon.\n\nAaj aap kaisa mehsoos kar rahe hain? Aap ke zehan mein kya hai?"
                else:
                    if user_first_name:
                        welcome_msg = f"Welcome to MindEase, {user_first_name}. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"
                    else:
                        welcome_msg = "Welcome to MindEase. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"

            return JsonResponse({
                "welcome_message": welcome_msg,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET CHAT SUMMARY
# -------------------------
@csrf_exempt
def chat_summary(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            user_first_name = data.get("user_first_name")
            user_gender = data.get("user_gender")
            conversation_history = data.get("conversation_history", [])
            
            # Check if there's actual conversation (more than just welcome message)
            # Filter out welcome messages and check if there are user messages
            user_messages = [
                msg for msg in conversation_history 
                if msg.get("role") == "user"
            ]
            lang_pref = data.get("lang_pref")
            is_urdu = lang_pref and str(lang_pref).lower() in ("urdu", "ur")

            if len(user_messages) == 0:
                return JsonResponse({
                    "summary": (
                        "Session khatam ho gayi bina aap ke koi paigham ke."
                        if is_urdu
                        else "No conversation to summarize. The session ended without any messages from the user."
                    ),
                    "user_id": user_id,
                    "no_user_messages": True,
                }, status=200)

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Create memory instance and populate with history
            memory = ConversationMemory(max_history_length=20)
            for msg in conversation_history:
                role = msg.get("role")
                content = msg.get("content")
                if role and content:
                    memory.add_message(role, content)
            
            llm_client = LLMClient()
            summary = memory.get_conversation_summary(
                llm_client=llm_client,
                user_first_name=user_first_name,
                user_gender=user_gender,
                lang_pref=lang_pref,
            )
            
            return JsonResponse({
                "summary": summary,
                "user_id": user_id,
                "no_user_messages": False,
            }, status=200)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET SESSION COUNT
# -------------------------
@csrf_exempt
def get_session_count(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            session_count = SessionService.get_session_count(user_id)

            return JsonResponse({
                "session_count": session_count,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GENERATE SESSION TITLE
# -------------------------
def _generate_session_title(conversation_history, llm_client, user_first_name=None):
    """Generate a concise, descriptive heading for the session.

    The heading is shown to the user as the chat's description in the session
    list, so it must be a clean noun phrase (no quotes, punctuation trails, or
    meta commentary).
    """
    try:
        user_messages = [
            msg.get("content", "")
            for msg in conversation_history
            if msg.get("role") == "user" and msg.get("content")
        ]
        if not user_messages:
            return "New Chat"

        preview_turns = []
        for msg in conversation_history[:10]:
            role = msg.get("role")
            content = (msg.get("content") or "").strip()
            if not content or role not in ("user", "assistant"):
                continue
            label = "Client" if role == "user" else "Therapist"
            preview_turns.append(f"{label}: {content}")
        conversation_preview = "\n".join(preview_turns)

        title_prompt = (
            "Read the therapy conversation excerpt below and produce a short, "
            "descriptive heading (3 to 7 words) that captures what the session "
            "was about from a clinical standpoint.\n\n"
            "Rules:\n"
            "- Noun phrase in Title Case (e.g. 'Exam Anxiety and Sleep Disruption').\n"
            "- Describe the theme, not the client by name.\n"
            "- No quotes, no trailing punctuation, no emojis, no dashes, no colons.\n"
            "- Do not write 'Session on ...' or 'Chat about ...'. Just the topic.\n\n"
            f"Excerpt:\n{conversation_preview}\n\nHeading:"
        )

        raw = llm_client.generate_response(
            user_message=title_prompt,
            emotions="",
            context="",
            conversation_history=[],
            system_prompt_override=(
                "You generate clean, descriptive headings for therapy sessions. "
                "Output only the heading itself, nothing else."
            ),
        )
        title = _sanitize_summary(raw)
        title = title.splitlines()[0] if title else ""
        title = title.strip(" .:-–—\"'`")
        if len(title) > 60:
            title = title[:57].rstrip() + "..."
        return title or "Therapy Session"
    except Exception as e:
        print(f"Error generating session title: {e}")
        return "Therapy Session"


# -------------------------
# GENERATE SHORT SUMMARY
# -------------------------
def _generate_short_summary(conversation_history, llm_client, user_first_name=None, user_gender=None):
    """Generate a concise clinical-style 2-3 sentence blurb for the session list.

    Written as a therapist's note: third person, focused on the client's
    presentation and what was explored. No direct address, no filler.
    """
    try:
        turns = []
        for msg in conversation_history:
            role = msg.get("role")
            content = (msg.get("content") or "").strip()
            if not content or role not in ("user", "assistant"):
                continue
            label = "Client" if role == "user" else "Therapist"
            turns.append(f"{label}: {content}")
        if not any(t.startswith("Client:") for t in turns):
            return "No client messages were exchanged this session."

        transcript = "\n".join(turns[:40])

        prompt = (
            "Write a short, warm blurb (2 to 3 sentences) that will be shown on a "
            "therapy session card in the user's session history. It should help the "
            "person quickly remember what this session was about.\n\n"
            "Rules:\n"
            "- Address the person as 'you'. Do not use their name, and never use the "
            "words 'client' or 'patient'.\n"
            "- Capture what they brought to the session, how they were feeling, and "
            "what was explored. Warm and validating, not clinical.\n"
            "- Factual, grounded only in the transcript. No invention, no quotes.\n"
            "- Plain prose only. No bullets, no headings, no dashes, no markdown.\n"
            "- Under 60 words total.\n\n"
            f"Transcript:\n{transcript}\n\nBlurb:"
        )

        raw = llm_client.generate_response(
            user_message=prompt,
            emotions="",
            context="",
            conversation_history=[],
            system_prompt_override=(
                "You write short, warm second-person blurbs for a therapy session "
                "history. Address the reader as 'you'. Never use 'client' or "
                "'patient'. Output plain prose only: no headings, bullets, dashes, "
                "or markdown."
            ),
        )
        short = _sanitize_summary(raw)
        # Collapse any remaining line breaks into a single line
        short = " ".join(s for s in short.split("\n") if s.strip()).strip()

        if len(short) > 260:
            sentences = re.split(r"(?<=[.!?])\s+", short)
            buf = ""
            for sentence in sentences:
                if len(buf) + len(sentence) + 1 > 260:
                    break
                buf = (buf + " " + sentence).strip()
            short = buf
            if short and short[-1] not in ".!?":
                short += "."
        return short or "Brief session with limited content to summarise."
    except Exception as e:
        print(f"Error generating short summary: {e}")
        return "Brief session with limited content to summarise."


# -------------------------
# COMBINED TITLE + SHORT_SUMMARY (single LLM call)
# -------------------------
def _generate_title_and_summary(conversation_history, llm_client, user_first_name=None, user_gender=None):
    """Generate session title and short_summary in a single LLM call (JSON response).

    Returns (title, short_summary) tuple. On any failure (JSON parse error, missing keys,
    empty values) falls back to calling the original two separate helpers so nothing breaks.
    """
    try:
        # Build conversation preview (same as individual helpers)
        preview_turns = []
        all_turns = []
        for msg in conversation_history[:40]:
            role = msg.get("role")
            content = (msg.get("content") or "").strip()
            if not content or role not in ("user", "assistant"):
                continue
            label = "Client" if role == "user" else "Therapist"
            all_turns.append(f"{label}: {content}")
            if len(preview_turns) < 10:
                preview_turns.append(f"{label}: {content}")

        if not any(t.startswith("Client:") for t in all_turns):
            # No user content at all — use safe defaults
            return "Therapy Session", "No client messages were exchanged this session."

        preview = "\n".join(preview_turns)
        transcript = "\n".join(all_turns)

        combined_prompt = (
            "You are generating metadata for a therapy session card.\n\n"
            "Return ONLY valid JSON (no markdown fences, no extra text) in this exact shape:\n"
            '{"title": "...", "short_summary": "..."}\n\n'
            "Rules for title:\n"
            "- Noun phrase in Title Case, 3 to 7 words.\n"
            "- Captures the session theme clinically (e.g. 'Exam Anxiety and Sleep Disruption').\n"
            "- No quotes, no trailing punctuation, no emojis, no dashes, no colons.\n\n"
            "Rules for short_summary:\n"
            "- 2 to 3 sentences, plain prose, under 60 words.\n"
            "- Address the person as 'you'. Never use 'client' or 'patient'.\n"
            "- Warm and validating. Only facts from the transcript.\n"
            "- No bullets, no headings, no markdown.\n\n"
            f"Conversation excerpt (for title):\n{preview}\n\n"
            f"Full transcript (for summary):\n{transcript}\n\n"
            "JSON:"
        )

        raw = llm_client.generate_response(
            user_message=combined_prompt,
            emotions="",
            context="",
            conversation_history=[],
            system_prompt_override=(
                "You output only valid JSON with keys 'title' and 'short_summary'. "
                "No markdown fences, no extra commentary."
            ),
        )

        # Strip any accidental markdown fences
        raw_stripped = raw.strip()
        if raw_stripped.startswith("```"):
            raw_stripped = raw_stripped.split("```")[1]
            if raw_stripped.startswith("json"):
                raw_stripped = raw_stripped[4:]
            raw_stripped = raw_stripped.strip()

        parsed = json.loads(raw_stripped)
        title = (parsed.get("title") or "").strip(" .:-–—\"'`")
        short_summary = (parsed.get("short_summary") or "").strip()

        # Validate non-empty
        if not title or not short_summary:
            raise ValueError("Empty title or short_summary in parsed JSON")

        # Apply same post-processing as individual helpers
        title = _sanitize_summary(title)
        title = title.splitlines()[0].strip(" .:-–—\"'`") if title else ""
        if len(title) > 60:
            title = title[:57].rstrip() + "..."

        short_summary = _sanitize_summary(short_summary)
        short_summary = " ".join(s for s in short_summary.split("\n") if s.strip()).strip()
        if len(short_summary) > 260:
            sentences = re.split(r"(?<=[.!?])\s+", short_summary)
            buf = ""
            for sentence in sentences:
                if len(buf) + len(sentence) + 1 > 260:
                    break
                buf = (buf + " " + sentence).strip()
            short_summary = buf
            if short_summary and short_summary[-1] not in ".!?":
                short_summary += "."

        return (title or "Therapy Session"), (short_summary or "Brief session with limited content to summarise.")

    except Exception as e:
        print(f"[INFO] Combined title+summary LLM call failed ({e}); falling back to two-call path.")
        title = _generate_session_title(conversation_history, llm_client, user_first_name)
        short_summary = _generate_short_summary(conversation_history, llm_client, user_first_name, user_gender)
        return title, short_summary


# -------------------------
# SAVE SESSION
# -------------------------
@csrf_exempt
def save_session(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            conversation_history = data.get("conversation_history", [])
            summary = data.get("summary", "")
            session_identifier = data.get("session_id")  # UUID hex if updating

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            if not conversation_history:
                return JsonResponse({"error": "Conversation history is required."}, status=400)

            llm_client = LLMClient()
            user_first_name = data.get("user_first_name")
            user_gender = data.get("user_gender")
            title, short_summary = _generate_title_and_summary(
                conversation_history, llm_client, user_first_name, user_gender
            )

            messages_payload = []
            for index, msg in enumerate(conversation_history):
                payload = {
                    "role": msg.get("role"),
                    "sender": msg.get("role"),
                    "content": msg.get("content"),
                    "content_type": msg.get("content_type") or "text",
                    "emotion_label": msg.get("emotion_label"),
                    "emotion_score": msg.get("emotion_score"),
                    "metadata": msg.get("metadata", {}),
                    "sequence": msg.get("sequence", index),
                }
                messages_payload.append(payload)

            if session_identifier:
                try:
                    session = _resolve_session_for_user(user_id, session_identifier)
                except ValueError:
                    return JsonResponse({"error": "Invalid session identifier."}, status=400)
                except Session.DoesNotExist:
                    return JsonResponse({"error": "Session not found."}, status=404)

                result = SessionService.update_session(
                    session=session,
                    messages=messages_payload,
                    short_summary=short_summary,
                    full_summary=summary,
                    ended_at=timezone.now(),
                )
            else:
                result = SessionService.create_session(
                    user_id=user_id,
                    title=title,
                    messages=messages_payload,
                    short_summary=short_summary,
                    full_summary=summary,
                    ended_at=timezone.now(),
                )

            session = result.session

            response_payload = {
                "session_id": session.session_uuid.hex,
                "title": session.title or "Therapy Session",
                "messages": conversation_history,
                "summary": session.full_summary or "",
                "short_summary": session.short_summary or session.full_summary or "",
                "resume_message": session.resume_message or "",
                "state": session.state,
                "is_starred": session.is_starred,
                "created_at": session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                "updated_at": session.updated_at.isoformat() if session.updated_at else session.ended_at.isoformat() if session.ended_at else session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
            }

            return JsonResponse({
                "session": response_payload,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET RECENT SESSIONS
# -------------------------
@csrf_exempt
def get_recent_sessions(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            limit = data.get("limit")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            voice_subquery = Exists(
                Message.objects.filter(
                    session_id=OuterRef("session_id"),
                    content_type=Message.ContentType.AUDIO,
                )
            )
            qs = Session.objects.filter(user_id=user_id).order_by(
                '-started_at', '-created_at', '-session_id'
            ).annotate(_has_voice=voice_subquery)
            sessions = list(qs[:limit] if limit else qs)

            sessions_list = [
                {
                    "session_id": session.session_uuid.hex,
                    "title": session.title or "Therapy Session",
                    "summary": session.full_summary or "",
                    "short_summary": session.short_summary or session.full_summary or "",
                    "created_at": session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                    "updated_at": session.updated_at.isoformat() if session.updated_at else session.ended_at.isoformat() if session.ended_at else session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                    "state": session.state,
                    "is_starred": session.is_starred,
                    "has_full_transcript": session.state == Session.SessionState.FULL,
                    "has_voice": session._has_voice,
                }
                for session in sessions
            ]

            total = Session.objects.filter(user_id=user_id).count()

            return JsonResponse({
                "sessions": sessions_list,
                "total": total,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# CONSOLIDATED DASHBOARD DATA
# -------------------------
@csrf_exempt
def dashboard_data(request):
    """Return all dashboard data in a single response to avoid multiple round-trips."""
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=405)
    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")
        therapist_city = data.get("therapist_city")
        therapist_limit = data.get("therapist_limit", 4)
        sessions_limit = data.get("sessions_limit", 5)

        if not user_id:
            return JsonResponse({"error": "User ID is required."}, status=400)

        try:
            user = User.objects.get(user_id=user_id)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)

        # --- Session count ---
        session_count = SessionService.get_session_count(user_id)

        # --- Recent sessions ---
        voice_subquery = Exists(
            Message.objects.filter(
                session_id=OuterRef("session_id"),
                content_type=Message.ContentType.AUDIO,
            )
        )
        sessions_qs = list(
            Session.objects.filter(user_id=user_id)
            .order_by('-started_at', '-created_at', '-session_id')
            .annotate(_has_voice=voice_subquery)[:sessions_limit]
        )
        sessions_list = [
            {
                "session_id": s.session_uuid.hex,
                "title": s.title or "Therapy Session",
                "summary": s.full_summary or "",
                "short_summary": s.short_summary or s.full_summary or "",
                "created_at": s.created_at.isoformat() if s.created_at else s.started_at.isoformat(),
                "updated_at": s.updated_at.isoformat() if s.updated_at else s.ended_at.isoformat() if s.ended_at else s.created_at.isoformat() if s.created_at else s.started_at.isoformat(),
                "state": s.state,
                "is_starred": s.is_starred,
                "has_full_transcript": s.state == Session.SessionState.FULL,
                "has_voice": s._has_voice,
            }
            for s in sessions_qs
        ]
        sessions_total = Session.objects.filter(user_id=user_id).count()

        # --- Diagnostic test status ---
        generic_screening_completed = user.generic_screening_completed
        primary_condition = user.primary_condition
        last_test_date = user.last_test_date
        test_taken_today = DiagnosticTestService.test_taken_today(last_test_date)

        available_test = None
        daily_test_available = False
        if not generic_screening_completed:
            if not test_taken_today:
                available_test = "generic-screening"
        else:
            if last_test_date is None or not test_taken_today:
                daily_test_available = True
                condition_to_test = {
                    "depression": "phq9", "anxiety": "gad7",
                    "stress": "pss10", "general-mood": "mood_test",
                }
                available_test = condition_to_test.get(primary_condition, "phq9")

        test_status = {
            "generic_screening_completed": generic_screening_completed,
            "primary_condition": primary_condition,
            "daily_test_available": daily_test_available,
            "last_test_date": last_test_date.isoformat() if last_test_date else None,
            "available_test": available_test,
        }

        # --- Test history ---
        results = Testresult.objects.filter(user=user).order_by("-taken_at")
        test_history = [
            {
                "result_id": r.result_id,
                "test_type": r.test_type,
                "test_name": DiagnosticTestService.get_test_name(r.test_type),
                "score": r.score,
                "severity_level": r.severity_level,
                "taken_at": r.taken_at.isoformat() if r.taken_at else None,
            }
            for r in results
        ]

        # --- Mood trend ---
        trend_data = []
        if primary_condition:
            condition_to_test = {
                "depression": "phq9", "anxiety": "gad7",
                "stress": "pss10", "general-mood": "mood_test",
            }
            trend_test_type = condition_to_test.get(primary_condition, "phq9")
            trend_results = Testresult.objects.filter(
                user=user, test_type=trend_test_type
            ).order_by("taken_at")
            for r in trend_results:
                trend = "stable"
                if len(trend_data) > 0:
                    prev_score = trend_data[-1]["score"]
                    if r.score < prev_score:
                        trend = "improved"
                    elif r.score > prev_score:
                        trend = "worsened"
                    if trend_test_type == "mood_test":
                        if r.score > prev_score:
                            trend = "improved"
                        elif r.score < prev_score:
                            trend = "worsened"
                trend_data.append({
                    "date": r.taken_at.isoformat(),
                    "score": r.score,
                    "severity": r.severity_level,
                    "trend": trend,
                })

        # --- Streak ---
        streak_results = Testresult.objects.filter(
            user=user
        ).exclude(test_type="generic-screening").order_by("-taken_at")

        current_streak = 0
        longest_streak = 0
        streak_last_test_date = None

        if streak_results.exists():
            last_result = streak_results.first()
            streak_last_test_date = last_result.taken_at.date()
            test_dates = {r.taken_at.date() for r in streak_results}

            if streak_last_test_date < date.today() - timedelta(days=1):
                current_streak = 0
            else:
                check_date = streak_last_test_date
                while check_date in test_dates:
                    current_streak += 1
                    check_date -= timedelta(days=1)

            sorted_dates = sorted(test_dates, reverse=True)
            if sorted_dates:
                temp_streak = 1
                longest_streak = 1
                for i in range(len(sorted_dates) - 1):
                    if sorted_dates[i] - sorted_dates[i + 1] == timedelta(days=1):
                        temp_streak += 1
                        longest_streak = max(longest_streak, temp_streak)
                    else:
                        temp_streak = 1

        # --- Therapists ---
        therapists_list = []
        therapists_total = 0
        try:
            qs = Therapistdirectory.objects.all().order_by("first_name", "last_name")
            if therapist_city:
                qs = qs.filter(city__iexact=therapist_city)
            therapists_total = qs.count()
            if therapist_limit and therapist_limit > 0:
                qs = qs[:therapist_limit]
            therapists_list = [_serialize_therapist(t) for t in qs]
        except Exception:
            pass  # therapists are non-critical

        return JsonResponse({
            "session_count": session_count,
            "sessions": {"sessions": sessions_list, "total": sessions_total},
            "test_status": test_status,
            "test_history": test_history,
            "mood_trend": {"trend_data": trend_data, "primary_condition": primary_condition},
            "streak": {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_test_date": streak_last_test_date.isoformat() if streak_last_test_date else None,
            },
            "therapists": {"therapists": therapists_list, "total": therapists_total},
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# GET SESSION BY ID
# -------------------------
@csrf_exempt
def get_session_by_id(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            session_identifier = data.get("session_id")

            if not user_id or not session_identifier:
                return JsonResponse({"error": "User ID and Session ID are required."}, status=400)

            try:
                session = _resolve_session_for_user(user_id, session_identifier)
            except ValueError:
                return JsonResponse({"error": "Invalid session identifier."}, status=400)
            except Session.DoesNotExist:
                return JsonResponse({"error": "Session not found."}, status=404)

            payload = {
                "session_id": session.session_uuid.hex,
                "title": session.title or "Therapy Session",
                "summary": session.full_summary or "",
                "short_summary": session.short_summary or session.full_summary or "",
                "resume_message": session.resume_message or "",
                "state": session.state,
                "is_starred": session.is_starred,
                "created_at": session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                "updated_at": session.updated_at.isoformat() if session.updated_at else session.ended_at.isoformat() if session.ended_at else session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                "messages": [],
                "resume_context": session.continuation_context or {},
                "has_full_transcript": session.state == Session.SessionState.FULL,
            }

            if session.state == Session.SessionState.FULL:
                messages = session.messages.order_by('sequence', 'message_id')
                payload["messages"] = [
                    {
                        "role": msg.metadata.get('role') or ('assistant' if msg.sender == Message.Sender.AI else 'user'),
                        "sender": msg.sender,
                        "content": msg.content,
                        "content_type": msg.content_type,
                        "emotion_label": msg.emotion_label,
                        "emotion_score": msg.emotion_score,
                        "sequence": msg.sequence,
                        "metadata": msg.metadata,
                        "created_at": msg.created_at.isoformat() if msg.created_at else None,
                    }
                    for msg in messages
                ]
            else:
                reminder = session.resume_message or session.short_summary or session.full_summary or "Welcome back! Let's continue whenever you're ready."
                payload["messages"] = [
                    {
                        "role": "assistant",
                        "sender": Message.Sender.AI,
                        "content": reminder,
                        "content_type": Message.ContentType.TEXT,
                        "emotion_label": None,
                        "emotion_score": None,
                        "sequence": None,
                        "metadata": {},
                        "created_at": timezone.now().isoformat(),
                    }
                ]

            return JsonResponse({
                "session": payload,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# TOGGLE SESSION STAR
# -------------------------
@csrf_exempt
def toggle_session_star(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            session_identifier = data.get("session_id")
            star = data.get("star")

            if not user_id or session_identifier is None or star is None:
                return JsonResponse({"error": "User ID, session ID, and star value are required."}, status=400)

            try:
                session = _resolve_session_for_user(user_id, session_identifier)
            except ValueError:
                return JsonResponse({"error": "Invalid session identifier."}, status=400)
            except Session.DoesNotExist:
                return JsonResponse({"error": "Session not found."}, status=404)

            try:
                updated_session = SessionService.set_starred(session, bool(star))
            except ValueError as exc:
                error_code = str(exc)
                message = "Unable to update star status."
                if error_code == "star_limit":
                    message = "You can star up to three sessions at a time. Unstar another session first."
                elif error_code == "archived_session":
                    message = "Archived sessions cannot be starred."
                return JsonResponse({"error": message}, status=400)

            payload = {
                "session_id": updated_session.session_uuid.hex,
                "title": updated_session.title or "Therapy Session",
                "summary": updated_session.full_summary or "",
                "short_summary": updated_session.short_summary or updated_session.full_summary or "",
                "resume_message": updated_session.resume_message or "",
                "state": updated_session.state,
                "is_starred": updated_session.is_starred,
                "has_full_transcript": updated_session.state == Session.SessionState.FULL,
                "created_at": updated_session.created_at.isoformat() if updated_session.created_at else updated_session.started_at.isoformat(),
                "updated_at": updated_session.updated_at.isoformat() if updated_session.updated_at else updated_session.ended_at.isoformat() if updated_session.ended_at else updated_session.created_at.isoformat() if updated_session.created_at else updated_session.started_at.isoformat(),
            }

            return JsonResponse({
                "session": payload,
                "user_id": user_id,
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# THERAPIST DIRECTORY (GET with optional filters)
# -------------------------
def _serialize_therapist(t):
    name = f"{t.first_name or ''} {t.last_name or ''}".strip() or "—"
    languages_list = None
    if t.languages:
        languages_list = [s.strip() for s in t.languages.split(",") if s.strip()]
    return {
        "id": str(t.therapist_id),
        "name": name,
        "credentials": t.credentials,
        "specialty": t.specialty,
        "city": t.city,
        "region": t.region,
        "website": t.website or t.profile_url,
        "profile_url": t.profile_url,
        "languages": languages_list,
        "address": t.address,
        "service_type": t.service_type,
    }


@csrf_exempt
def get_therapists(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        qs = Therapistdirectory.objects.all().order_by("first_name", "last_name")
        city = (request.GET.get("city") or "").strip()
        specialty = (request.GET.get("specialty") or "").strip()
        service_type = (request.GET.get("service_type") or "").strip().lower()
        try:
            limit = int(request.GET.get("limit", 0))
        except ValueError:
            limit = 0
        if city:
            qs = qs.filter(city__iexact=city)
        if specialty:
            qs = qs.filter(specialty__icontains=specialty)
        if service_type in ("in-person", "online"):
            qs = qs.filter(service_type__contains=[service_type])
        total = qs.count()
        if limit > 0:
            qs = qs[:limit]
        therapists = [_serialize_therapist(t) for t in qs]
        return JsonResponse({"therapists": therapists, "total": total}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def get_therapist_filters(request):
    """Return distinct cities for therapist directory dropdowns."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        cities = list(
            Therapistdirectory.objects.exclude(city__isnull=True)
            .exclude(city="")
            .values_list("city", flat=True)
            .distinct()
            .order_by("city")
        )
        return JsonResponse({"cities": cities}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# GET USER PROFILE
# -------------------------
@csrf_exempt
def get_user_profile(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            
            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)
            
            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)
            
            # Format language preference
            lang_pref = user.lang_pref or "english"
            if lang_pref.lower() == "english":
                lang_pref = "en"
            elif lang_pref.lower() == "urdu":
                lang_pref = "ur"
            
            return JsonResponse({
                "user_id": user.user_id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name or "",
                "dob": user.dob.isoformat() if user.dob else None,
                "gender": user.gender or "Other",
                "lang_pref": lang_pref,
                "city": user.city or "",
                "nearest_major_city": user.nearest_major_city or "",
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "dashboard_tour_seen": user.dashboard_tour_seen,
            }, status=200)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# UPDATE USER PROFILE
# -------------------------
@csrf_exempt
def update_user_profile(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            
            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)
            
            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)
            
            # Update fields if provided
            updated_fields = []
            
            if "first_name" in data:
                user.first_name = data.get("first_name")
                updated_fields.append("first_name")
            
            if "last_name" in data:
                user.last_name = data.get("last_name")
                updated_fields.append("last_name")
            
            if "email" in data:
                new_email = data.get("email").lower()
                # Check if email is already taken by another user
                if User.objects.filter(email__iexact=new_email).exclude(user_id=user_id).exists():
                    return JsonResponse({"error": "Email already in use."}, status=400)
                user.email = new_email
                updated_fields.append("email")
            
            if "dob" in data:
                dob_parsed = parse_date(data.get("dob"))
                if not dob_parsed:
                    return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)
                user.dob = dob_parsed
                updated_fields.append("dob")
            
            if "gender" in data:
                user.gender = data.get("gender")
                updated_fields.append("gender")
            
            if "lang_pref" in data:
                lang_pref = data.get("lang_pref")
                if lang_pref == "en":
                    lang_pref = "english"
                elif lang_pref == "ur":
                    lang_pref = "urdu"
                user.lang_pref = lang_pref
                updated_fields.append("lang_pref")

            if "city" in data:
                city_value = data.get("city")
                user.city = city_value.strip() if city_value else None
                updated_fields.append("city")

            if "nearest_major_city" in data:
                nearest_value = data.get("nearest_major_city")
                user.nearest_major_city = nearest_value.strip() if nearest_value else None
                updated_fields.append("nearest_major_city")
            
            if "password" in data and data.get("password"):
                # Update password if provided
                new_password = data.get("password")
                if len(new_password) < 8:
                    return JsonResponse({"error": "Password must be at least 8 characters."}, status=400)
                user.password = make_password(new_password)
                updated_fields.append("password")
            
            # Update timestamp
            user.updated_at = timezone.now()
            user.save(update_fields=updated_fields + ["updated_at"])
            
            # Format language preference for response
            lang_pref = user.lang_pref or "english"
            if lang_pref.lower() == "english":
                lang_pref = "en"
            elif lang_pref.lower() == "urdu":
                lang_pref = "ur"
            
            return JsonResponse({
                "message": "Profile updated successfully.",
                "user_id": user.user_id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name or "",
                "dob": user.dob.isoformat() if user.dob else None,
                "gender": user.gender or "Other",
                "lang_pref": lang_pref,
                "city": user.city or "",
                "nearest_major_city": user.nearest_major_city or "",
                "dashboard_tour_seen": user.dashboard_tour_seen,
            }, status=200)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# UPDATE DASHBOARD TOUR STATUS
# -------------------------
@csrf_exempt
def update_dashboard_tour(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            seen = data.get("seen")

            if user_id is None or seen is None:
                return JsonResponse({"error": "User ID and seen flag are required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            seen_bool = bool(seen)

            if user.dashboard_tour_seen != seen_bool:
                user.dashboard_tour_seen = seen_bool
                user.updated_at = timezone.now()
                user.save(update_fields=["dashboard_tour_seen", "updated_at"])

            return JsonResponse({
                "dashboard_tour_seen": user.dashboard_tour_seen,
                "user_id": user.user_id,
            }, status=200)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# STT TRANSCRIBE
# -------------------------
@csrf_exempt
def stt_transcribe(request):
    if request.method == "POST":
        try:
            if 'audio' not in request.FILES:
                return JsonResponse({"error": "Audio file is required."}, status=400)
            
            audio_file = request.FILES['audio']
            language = request.POST.get('language', 'en')
            is_urdu = language and str(language).lower() in ("urdu", "ur")
            
            max_size = 10 * 1024 * 1024  # 10MB
            if audio_file.size > max_size:
                return JsonResponse({"error": "Audio file too large. Maximum size is 10MB."}, status=400)
            
            allowed_extensions = ['.wav', '.webm', '.mp3', '.m4a', '.ogg']
            file_name = audio_file.name.lower()
            if not any(file_name.endswith(ext) for ext in allowed_extensions):
                return JsonResponse({
                    "error": f"Unsupported file format. Allowed formats: {', '.join(allowed_extensions)}"
                }, status=400)
            
            import sys
            import os
            import tempfile
            
            # English STT is kept exactly as-is; Urdu uses a separate finetuned service.
            stt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stt')
            if stt_dir not in sys.path and not is_urdu:
                sys.path.insert(0, stt_dir)
            
            import time as _time
            t0_stt = _time.perf_counter()
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.name)[1]) as temp_file:
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name

            try:
                if is_urdu:
                    stt_service = _get_urdu_stt_service()
                    transcript = stt_service.transcribe_file(
                        temp_file_path,
                        language="ur",
                    )
                    print(f"[stt-timing] urdu_stt (cached): {_time.perf_counter() - t0_stt:.3f}s  chars={len(transcript or '')}")
                else:
                    stt_service = _get_en_stt_service()
                    transcript = stt_service.transcribe_file(
                        temp_file_path,
                        language=language if language != 'auto' else None,
                    )
                    print(f"[stt-timing] en_stt (cached): {_time.perf_counter() - t0_stt:.3f}s  chars={len(transcript or '')}")
                
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                
                if not transcript or not transcript.strip():
                    return JsonResponse({
                        "error": "No speech detected in audio file.",
                        "transcript": ""
                    }, status=200)
                
                return JsonResponse({
                    "transcript": transcript.strip(),
                    "language": language,
                    "confidence": 0.95
                }, status=200)
                
            except Exception as e:
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                
                import traceback
                traceback.print_exc()
                return JsonResponse({
                    "error": f"Transcription failed: {str(e)}"
                }, status=500)
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


# Cached TINY STT model for live partial transcription (loaded once, reused)
# Must stay tiny: distil/large are too slow for live; responses would arrive after user stops.
_partial_stt_service = None
_partial_stt_lock = threading.Lock()

def _get_partial_stt_service():
    """Get or create STT service for live partial transcription. TINY only - fast enough for real-time."""
    global _partial_stt_service
    with _partial_stt_lock:
        if _partial_stt_service is None:
            import sys
            stt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stt')
            if stt_dir not in sys.path:
                sys.path.insert(0, stt_dir)
            from stt.stt_service import SpeechToTextService
            _partial_stt_service = SpeechToTextService(
                model_id="Systran/faster-whisper-tiny",
                device=None,
                compute_type=None,
                beam_size=1,
                temperature=0.0,
                vad_filter=True,
            )
        return _partial_stt_service


# Cached English STT (distil-large-v3) for the main /stt endpoint — loaded once, reused.
_en_stt_service = None
_en_stt_lock = threading.Lock()

def _get_en_stt_service():
    global _en_stt_service
    with _en_stt_lock:
        if _en_stt_service is None:
            import sys
            stt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stt')
            if stt_dir not in sys.path:
                sys.path.insert(0, stt_dir)
            from stt.stt_service import SpeechToTextService
            _en_stt_service = SpeechToTextService(
                model_id="Systran/faster-distil-whisper-large-v3",
                device=None,
                compute_type=None,
                beam_size=2,
                temperature=0.0,
                vad_filter=True,
            )
        return _en_stt_service


# Cached Speech Emotion Recognition (wav2vec2) — loaded once, reused.
_ser_detector = None
_ser_lock = threading.Lock()

def _get_ser_detector():
    global _ser_detector
    with _ser_lock:
        if _ser_detector is None:
            from chatbot.audio_emotion_detector import AudioEmotionDetector
            _ser_detector = AudioEmotionDetector()
        return _ser_detector


# Cached Urdu STT (finetuned Whisper) for the main /stt endpoint — loaded once, reused.
_urdu_stt_service = None
_urdu_stt_lock = threading.Lock()

def _get_urdu_stt_service():
    global _urdu_stt_service
    with _urdu_stt_lock:
        if _urdu_stt_service is None:
            from urdu_stt.stt_urdu_service import UrduSpeechToTextService, MODEL_ID
            _urdu_stt_service = UrduSpeechToTextService(
                model_id=MODEL_ID,
                device=None,
                compute_type=None,
                beam_size=2,
                best_of=4,
                temperature=0.0,
                vad_filter=True,
            )
        return _urdu_stt_service


# Real-time STT: transcribe partial audio chunks for live display (TINY model so results return in ~1s)
@csrf_exempt
def stt_transcribe_partial(request):
    """
    Live speech-to-text while user is speaking. Uses tiny Whisper so each chunk
    returns in 1–2 seconds; distil/large would be too slow for live display.
    """
    if request.method == "POST":
        try:
            if 'audio' not in request.FILES:
                return JsonResponse({"error": "Audio file is required."}, status=400)
            
            audio_file = request.FILES['audio']
            language = request.POST.get('language', 'en')
            
            max_size = 20 * 1024 * 1024  # 20MB for partial chunks
            if audio_file.size > max_size:
                return JsonResponse({"error": "Audio file too large."}, status=400)
            
            if audio_file.size < 1500:
                return JsonResponse({"transcript": "", "is_partial": True}, status=200)
            
            import tempfile
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            
            try:
                stt_service = _get_partial_stt_service()
                transcript = stt_service.transcribe_file(
                    temp_file_path,
                    language=language if language != 'auto' else None,
                )
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                return JsonResponse({
                    "transcript": transcript.strip() if transcript else "",
                    "is_partial": True,
                    "language": language
                }, status=200)
            except Exception as e:
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                return JsonResponse({"transcript": "", "is_partial": True, "error": str(e)}, status=200)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# TTS SYNTHESIZE
# -------------------------
@csrf_exempt
def tts_synthesize(request):
    if request.method == "POST":
        import time as _tts_time, sys as _tts_sys
        _tts_t0 = _tts_time.perf_counter()
        _tts_info = {"backend": "?", "text_len": 0, "lang": "?", "audio_bytes": 0, "ok": False}
        def _tts_emit_summary():
            total_s = _tts_time.perf_counter() - _tts_t0
            print("================ TTS PIPELINE SUMMARY ================", file=_tts_sys.stderr, flush=True)
            print(f"  backend             : {_tts_info['backend']}", file=_tts_sys.stderr, flush=True)
            print(f"  lang                : {_tts_info['lang']}", file=_tts_sys.stderr, flush=True)
            print(f"  text chars          : {_tts_info['text_len']}", file=_tts_sys.stderr, flush=True)
            print(f"  audio bytes         : {_tts_info['audio_bytes']}", file=_tts_sys.stderr, flush=True)
            print(f"  status              : {'ok' if _tts_info['ok'] else 'error'}", file=_tts_sys.stderr, flush=True)
            print(f"  TOTAL               : {total_s:7.3f}s", file=_tts_sys.stderr, flush=True)
            print("======================================================", file=_tts_sys.stderr, flush=True)
        try:
            import os
            data = json.loads(request.body)
            text = data.get("text")
            language = data.get("language", "en")
            tts_backend = _resolve_tts_backend(data, language=language)
            _tts_info["backend"] = tts_backend or "?"
            _tts_info["lang"] = language
            _tts_info["text_len"] = len(text or "")
            
            if not text:
                return JsonResponse({"error": "Text is required."}, status=400)
            
            # Limit text length to prevent abuse (max 5000 characters)
            if len(text) > 5000:
                return JsonResponse({"error": "Text too long. Maximum length is 5000 characters."}, status=400)
            
            # Validate language code
            supported_languages = ["en", "ur", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko"]
            if language not in supported_languages:
                language = "en"  # Default to English if invalid
            
            if tts_backend == "mms_urdu":
                # Explicit MMS-only override (e.g. for testing)
                try:
                    tts_service = _get_mms_urdu_tts_service()
                except RuntimeError as e:
                    return JsonResponse({"error": str(e)}, status=503)
                try:
                    audio_data = tts_service.synthesize_to_wav_bytes(text=text, language=language)
                    from django.http import HttpResponse
                    response = HttpResponse(audio_data, content_type="audio/wav")
                    response["Content-Disposition"] = 'inline; filename="tts_audio.wav"'
                    response["Content-Length"] = len(audio_data)
                    _tts_info["audio_bytes"] = len(audio_data); _tts_info["ok"] = True
                    return response
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    return JsonResponse({"error": f"TTS synthesis failed: {str(e)}"}, status=500)

            if tts_backend == "edge_tts":
                is_urdu = str(language).lower() in ("ur", "urdu")
                voice = (
                    os.environ.get("EDGE_TTS_VOICE_UR", "ur-PK-AsadNeural") if is_urdu
                    else os.environ.get("EDGE_TTS_VOICE", "en-US-AriaNeural")
                )
                try:
                    edge_service = _get_edge_tts_service()
                    audio_data = edge_service.synthesize_to_mp3_bytes(text=text, language=language, voice=voice)
                    from django.http import HttpResponse
                    response = HttpResponse(audio_data, content_type="audio/mpeg")
                    response["Content-Disposition"] = 'inline; filename="tts_audio.mp3"'
                    response["Content-Length"] = len(audio_data)
                    _tts_info["audio_bytes"] = len(audio_data); _tts_info["ok"] = True
                    return response
                except Exception as edge_err:
                    import traceback
                    traceback.print_exc()
                    if is_urdu:
                        print(f"[TTS] Edge TTS failed ({edge_err}), falling back to MMS (Urdu)")
                        try:
                            tts_service = _get_mms_urdu_tts_service()
                            audio_data = tts_service.synthesize_to_wav_bytes(text=text, language=language)
                            from django.http import HttpResponse
                            response = HttpResponse(audio_data, content_type="audio/wav")
                            response["Content-Disposition"] = 'inline; filename="tts_audio.wav"'
                            response["Content-Length"] = len(audio_data)
                            return response
                        except Exception as mms_err:
                            return JsonResponse({"error": f"TTS synthesis failed: {str(mms_err)}"}, status=500)
                    else:
                        print(f"[TTS] Edge TTS failed ({edge_err}), falling back to Qwen3 (English)")
                        tts_backend = "qwen3"

            if tts_backend == "qwen3":
                try:
                    tts_service = _get_qwen3_tts_service()
                except RuntimeError as e:
                    return JsonResponse({
                        "error": str(e) + " Install qwen-tts or set TTS_BACKEND=xtts to use Coqui XTTS."
                    }, status=503)
                try:
                    # In-memory WAV — avoids temp file read/write for API latency
                    if hasattr(tts_service, "synthesize_to_wav_bytes"):
                        audio_data = tts_service.synthesize_to_wav_bytes(text=text, language=language)
                    else:
                        import tempfile
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                            temp_file_path = temp_file.name
                        try:
                            tts_service.synthesize_to_file(
                                text=text, output_path=temp_file_path, language=language
                            )
                            with open(temp_file_path, "rb") as audio_file:
                                audio_data = audio_file.read()
                        finally:
                            try:
                                os.unlink(temp_file_path)
                            except Exception:
                                pass
                    from django.http import HttpResponse
                    response = HttpResponse(audio_data, content_type="audio/wav")
                    response["Content-Disposition"] = 'inline; filename="tts_audio.wav"'
                    response["Content-Length"] = len(audio_data)
                    _tts_info["audio_bytes"] = len(audio_data); _tts_info["ok"] = True
                    return response
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    return JsonResponse({"error": f"TTS synthesis failed: {str(e)}"}, status=500)

            import tempfile
            tts_service = _get_tts_service()

            try:
                # Create temporary file for audio output
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                    temp_file_path = temp_file.name
                
                tts_service.synthesize_to_file(
                    text=text,
                    output_path=temp_file_path,
                    language=language,
                )
                
                # Read the generated audio file
                with open(temp_file_path, 'rb') as audio_file:
                    audio_data = audio_file.read()
                
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                
                # Don't close TTS service - we're caching it for performance
                # tts_service.close()
                
                # Return audio file as binary response
                from django.http import HttpResponse
                response = HttpResponse(audio_data, content_type='audio/wav')
                response['Content-Disposition'] = 'inline; filename="tts_audio.wav"'
                response['Content-Length'] = len(audio_data)
                _tts_info["audio_bytes"] = len(audio_data); _tts_info["ok"] = True
                return response
                
            except Exception as e:
                # Clean up temporary file if it exists
                try:
                    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                except Exception:
                    pass
                
                # Don't close TTS service on error - we're caching it
                # The service will be reused for next request
                
                import traceback
                traceback.print_exc()
                return JsonResponse({
                    "error": f"TTS synthesis failed: {str(e)}"
                }, status=500)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
        finally:
            _tts_emit_summary()
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# DIAGNOSTIC TESTS
# -------------------------

@csrf_exempt
def diagnostic_test_status(request):
    """Get diagnostic test status for user."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            # Check if generic screening is completed
            generic_screening_completed = user.generic_screening_completed
            primary_condition = user.primary_condition
            last_test_date = user.last_test_date

            # Check if a test was already taken today
            test_taken_today = DiagnosticTestService.test_taken_today(last_test_date)

            # Check if daily test is available
            daily_test_available = False
            available_test = None

            if not generic_screening_completed:
                # User needs to take generic screening (only if not taken today)
                if not test_taken_today:
                    available_test = "generic-screening"
            else:
                # Generic screening completed - show daily test
                # If last_test_date is None, it means they just completed screening and can take daily test
                # If last_test_date is today, they already took daily test today
                if last_test_date is None or not test_taken_today:
                    daily_test_available = True
                    # Map primary condition to test type
                    condition_to_test = {
                        "depression": "phq9",
                        "anxiety": "gad7",
                        "stress": "pss10",
                        "general-mood": "mood_test"
                    }
                    available_test = condition_to_test.get(primary_condition, "phq9")

            return JsonResponse({
                "generic_screening_completed": generic_screening_completed,
                "primary_condition": primary_condition,
                "daily_test_available": daily_test_available,
                "last_test_date": last_test_date.isoformat() if last_test_date else None,
                "available_test": available_test
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_submit(request):
    """Submit diagnostic test results."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            test_type = data.get("test_type")
            answers = data.get("answers")

            if not user_id or not test_type or not answers:
                return JsonResponse({"error": "User ID, test type, and answers are required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            # Validate test type
            valid_test_types = ["generic-screening", "phq9", "gad7", "pss10", "mood_test", 
                              "depression", "anxiety", "stress", "general-mood"]
            if test_type not in valid_test_types:
                return JsonResponse({"error": "Invalid test type."}, status=400)
            
            # Normalize test type
            test_type_map = {
                "depression": "phq9",
                "anxiety": "gad7",
                "stress": "pss10",
                "general-mood": "mood_test"
            }
            normalized_test_type = test_type_map.get(test_type, test_type)
            
            # For generic screening, check if already completed (can only take once)
            if normalized_test_type == "generic-screening" and user.generic_screening_completed:
                return JsonResponse({
                    "error": "You have already completed the generic screening. Daily tests are now available."
                }, status=400)
            
            # For daily tests, check if user already took a test today (prevent multiple tests per day)
            if normalized_test_type != "generic-screening" and DiagnosticTestService.test_taken_today(user.last_test_date):
                return JsonResponse({
                    "error": "You have already completed a test today. Taking one assessment per day helps us monitor your mood patterns more effectively. Please come back tomorrow for your next assessment."
                }, status=400)

            # Convert answers to proper format
            answers_dict = {int(k): int(v) for k, v in answers.items()}

            # Calculate score
            score = DiagnosticTestService.calculate_score(answers_dict)

            # Calculate severity level
            severity_level = DiagnosticTestService.calculate_severity_level(normalized_test_type, score)

            # Handle generic screening specially
            domain_scores = None
            primary_condition = None

            if normalized_test_type == "generic-screening":
                # Calculate domain scores from answers
                # Questions 0-1: depression, 2-3: anxiety, 4-5: stress, 6-7: mood
                domain_scores = {
                    "depression": answers_dict.get(0, 0) + answers_dict.get(1, 0),
                    "anxiety": answers_dict.get(2, 0) + answers_dict.get(3, 0),
                    "stress": answers_dict.get(4, 0) + answers_dict.get(5, 0),
                    "mood": answers_dict.get(6, 0) + answers_dict.get(7, 0)
                }
                primary_condition = DiagnosticTestService.identify_primary_condition(domain_scores)
                
                # Log for debugging
                print(f"\n=== Generic Screening Results ===")
                print(f"Domain Scores: Depression={domain_scores['depression']}, Anxiety={domain_scores['anxiety']}, Stress={domain_scores['stress']}, Mood={domain_scores['mood']}")
                print(f"Primary Condition: {primary_condition} (highest score)")
                print(f"Total Score: {score}")
                print(f"Severity Level: {severity_level}")
                print("=" * 40)

            # Save test result
            test_result = Testresult.objects.create(
                user=user,
                test_type=normalized_test_type,
                score=score,
                severity_level=severity_level,
                user_responses=json.dumps(answers_dict),
                domain_scores=domain_scores,
                taken_at=timezone.now()
            )

            # Update user if generic screening
            if normalized_test_type == "generic-screening" and primary_condition:
                user.generic_screening_completed = True
                user.primary_condition = primary_condition
                # For generic screening, don't set last_test_date yet
                # This allows user to take daily test immediately after screening
            else:
                # For daily tests, update last_test_date to prevent multiple tests per day
                user.last_test_date = date.today()
            
            user.save()

            response_data = {
                "result_id": test_result.result_id,
                "score": score,
                "severity_level": severity_level,
            }
            
            # Add domain scores and primary condition for generic screening
            if normalized_test_type == "generic-screening" and domain_scores:
                response_data["domain_scores"] = domain_scores
                response_data["primary_condition"] = primary_condition
                # Also add explanation
                response_data["explanation"] = (
                    f"Domain scores: Depression={domain_scores.get('depression', 0)}, "
                    f"Anxiety={domain_scores.get('anxiety', 0)}, "
                    f"Stress={domain_scores.get('stress', 0)}, "
                    f"Mood={domain_scores.get('mood', 0)}. "
                    f"Primary condition identified: {primary_condition} (highest score)."
                )

            if primary_condition:
                response_data["primary_condition"] = primary_condition
            if domain_scores:
                response_data["domain_scores"] = domain_scores

            # Background precompute: welcome text + audio for this result so chat/voice-chat opens are instant.
            try:
                precompute_ctx = _build_assessment_test_context(test_result, lang_pref=user.lang_pref)
                _precompute_welcomes_for_test_result(
                    user_id=user.user_id,
                    user_first_name=user.first_name,
                    lang_pref=user.lang_pref,
                    test_result_id=test_result.result_id,
                    test_context=precompute_ctx,
                )
            except Exception as e:
                print(f"[welcome-precompute] failed to kick off: {e}")

            return JsonResponse(response_data, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_history(request):
    """Get diagnostic test history for user."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            # Get all test results for user
            results = Testresult.objects.filter(user=user).order_by("-taken_at")

            results_list = []
            for result in results:
                results_list.append({
                    "result_id": result.result_id,
                    "test_type": result.test_type,
                    "test_name": DiagnosticTestService.get_test_name(result.test_type),
                    "score": result.score,
                    "severity_level": result.severity_level,
                    "taken_at": result.taken_at.isoformat() if result.taken_at else None
                })

            return JsonResponse({
                "results": results_list
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_mood_trend(request):
    """Get mood trend data for user (day-wise scores for their primary condition)."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            # Get user's primary condition
            primary_condition = user.primary_condition
            if not primary_condition:
                return JsonResponse({
                    "trend_data": [],
                    "message": "No primary condition identified yet. Complete your screening first."
                }, status=200)

            # Map primary condition to test type
            condition_to_test = {
                "depression": "phq9",
                "anxiety": "gad7",
                "stress": "pss10",
                "general-mood": "mood_test"
            }
            test_type = condition_to_test.get(primary_condition, "phq9")

            # Get all daily test results (exclude generic screening) for this test type
            results = Testresult.objects.filter(
                user=user,
                test_type=test_type
            ).order_by("taken_at")

            # Build trend data (last 30 days or all available)
            trend_data = []
            for result in results:
                # Calculate if score improved or worsened (compared to previous)
                trend = "stable"
                if len(trend_data) > 0:
                    prev_score = trend_data[-1]["score"]
                    if result.score < prev_score:
                        trend = "improved"  # Lower score is better for most tests
                    elif result.score > prev_score:
                        trend = "worsened"
                    # For mood_test, higher score is better, so reverse logic
                    if test_type == "mood_test":
                        if result.score > prev_score:
                            trend = "improved"
                        elif result.score < prev_score:
                            trend = "worsened"

                trend_data.append({
                    "date": result.taken_at.isoformat(),
                    "score": result.score,
                    "severity": result.severity_level,
                    "trend": trend
                })

            return JsonResponse({
                "trend_data": trend_data,
                "primary_condition": primary_condition,
                "test_type": test_type
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_streak(request):
    """Calculate current streak based on consecutive days of taking assessments."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            # Get all test results (daily tests only, exclude generic screening)
            results = Testresult.objects.filter(
                user=user
            ).exclude(
                test_type="generic-screening"
            ).order_by("-taken_at")

            if not results.exists():
                return JsonResponse({
                    "current_streak": 0,
                    "longest_streak": 0,
                    "last_test_date": None
                }, status=200)

            # Calculate streak
            from datetime import timedelta
            current_streak = 0
            longest_streak = 0
            temp_streak = 0

            # Check if last test was today or yesterday (for current streak)
            last_result = results.first()
            last_test_date = last_result.taken_at.date()

            # Start from today and work backwards
            test_dates = {r.taken_at.date() for r in results}

            # Calculate current streak (consecutive days ending today or yesterday)
            check_date = date.today()
            # If last test was today, start from today
            # If last test was yesterday, start from yesterday
            if last_test_date < date.today() - timedelta(days=1):
                # Streak is broken if last test was more than 1 day ago
                current_streak = 0
            else:
                # Count backwards from last test date
                check_date = last_test_date
                while check_date in test_dates:
                    current_streak += 1
                    check_date -= timedelta(days=1)

            # Calculate longest streak
            sorted_dates = sorted(test_dates, reverse=True)
            if sorted_dates:
                temp_streak = 1
                longest_streak = 1
                for i in range(len(sorted_dates) - 1):
                    if sorted_dates[i] - sorted_dates[i + 1] == timedelta(days=1):
                        temp_streak += 1
                        longest_streak = max(longest_streak, temp_streak)
                    else:
                        temp_streak = 1

            return JsonResponse({
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_test_date": last_test_date.isoformat() if last_test_date else None
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)