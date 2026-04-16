"""
Qwen-only Roman Urdu mental health chat pipeline.
No Qalb, no local LLM, no transliteration. User and assistant stay in Roman Urdu; single API (Alibaba qwen3.5-122b-a10b).
"""
import sys
import time as _time
from typing import Optional, List, Dict, Generator

from chatbot.urdu_qwen_chat import (
    build_system_prompt_with_context,
    qwen_chat,
    CRISIS_RESPONSE_ROMAN_URDU,
)

def _log(msg: str):
    import sys
    print(msg, file=sys.stderr, flush=True)

# Suicide/self-harm keywords (Roman Urdu + English)
URDU_CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "want to die", "self harm",
    "hurt myself", "cut myself", "take my life", "ending it", "not want to live",
    "khudkushi", "apna qatl", "mar jana", "jeena nahi", "khud ko nuqsan",
]


def _is_crisis_message(roman_text: str) -> bool:
    t = (roman_text or "").lower()
    return any(kw in t for kw in URDU_CRISIS_KEYWORDS)


def _is_arabic_script(text: str) -> bool:
    """True if the text contains Arabic-script characters (i.e. came from Urdu STT / voice chat)."""
    return any('\u0600' <= c <= '\u06FF' for c in (text or ""))


def run_urdu_pipeline(
    roman_user_input: str,
    conversation_history_roman: Optional[List[Dict[str, str]]] = None,
    test_context: Optional[str] = None,
    user_first_name: Optional[str] = None,
    detected_emotions: Optional[List] = None,

) -> str:
    """
    Qwen-only pipeline: Roman Urdu in, Roman Urdu out. No RAG, no Qalb, no transliteration.
    Builds messages: [system (Roman Urdu), ...history..., user] -> qwen_chat -> assistant reply.
    """
    t0 = _time.perf_counter()

    if _is_crisis_message(roman_user_input):
        _log(f"[urdu-chat-timing] crisis keyword detected, returning static response")
        return CRISIS_RESPONSE_ROMAN_URDU

    t_sys_start = _time.perf_counter()
    system_content = build_system_prompt_with_context(
        user_first_name=user_first_name,
        test_context=test_context,
    )
    # Voice chat: STT produces Arabic-script Urdu. Lock the reply to Arabic script
    # so TTS always receives proper Urdu and never accidental Roman/English.
    if _is_arabic_script(roman_user_input):
        system_content += (
            "\n\nCRITICAL INSTRUCTION: The user is speaking in Urdu (Arabic script). "
            "You MUST reply ONLY in Urdu written in Arabic script (اردو). "
            "Do NOT use Roman Urdu, English, or any Latin characters in your response."
        )
    t_sys_done = _time.perf_counter()
    _log(f"[urdu-chat-timing] system_prompt_build: {(t_sys_done - t_sys_start):.3f}s")

    if detected_emotions:
        emo_str = ", ".join(f"{e} ({p:.2f})" for e, p in detected_emotions)
        system_content += (
            f"\n\nUser ke message mein detect hone wale emotions: {emo_str}. "
            "Apne jawab mein in jazbat ko hamdardi ke saath acknowledge karen "
            "lekin seedha emotion ka naam mat lein — natural anداز mein reflect karen."
        )

    messages = [{"role": "system", "content": system_content}]

    if conversation_history_roman:
        for msg in conversation_history_roman[-10:]:
            role = msg.get("role", "user")
            content = (msg.get("content") or "").strip()
            if content and role in ("user", "assistant"):
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": roman_user_input.strip()})
    _log(f"[urdu-chat-timing] message_count: {len(messages)} (system + {len(messages)-2} history + user)")

    t_llm_start = _time.perf_counter()
    reply = qwen_chat(messages, max_tokens=900, temperature=0.7, enable_thinking=False)
    t_llm_done = _time.perf_counter()
    _log(f"[urdu-chat-timing] qwen_llm_call:      {(t_llm_done - t_llm_start):.3f}s")
    _log(f"[urdu-chat-timing] TOTAL:              {(t_llm_done - t0):.3f}s")
    return reply


def run_urdu_pipeline_stream(
    roman_user_input: str,
    conversation_history_roman: Optional[List[Dict[str, str]]] = None,
    test_context: Optional[str] = None,
    user_first_name: Optional[str] = None,

) -> Generator[str, None, None]:
    """Yields full Roman Urdu response as one chunk (Qwen does not stream in this pipeline)."""
    full = run_urdu_pipeline(
        roman_user_input=roman_user_input,
        conversation_history_roman=conversation_history_roman,
        test_context=test_context,
        user_first_name=user_first_name,
    )
    yield full
