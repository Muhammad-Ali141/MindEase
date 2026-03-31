"""
Qwen-only Roman Urdu mental health chat pipeline.
No Qalb, no local LLM, no transliteration. User and assistant stay in Roman Urdu; single API (Alibaba qwen3.5-122b-a10b).
"""
from typing import Optional, List, Dict, Generator

from chatbot.urdu_qwen_chat import (
    build_system_prompt_with_context,
    qwen_chat,
    CRISIS_RESPONSE_ROMAN_URDU,
)

# Suicide/self-harm keywords (Roman Urdu + English)
URDU_CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "want to die", "self harm",
    "hurt myself", "cut myself", "take my life", "ending it", "not want to live",
    "khudkushi", "apna qatl", "mar jana", "jeena nahi", "khud ko nuqsan",
]


def _is_crisis_message(roman_text: str) -> bool:
    t = (roman_text or "").lower()
    return any(kw in t for kw in URDU_CRISIS_KEYWORDS)


def run_urdu_pipeline(
    roman_user_input: str,
    conversation_history_roman: Optional[List[Dict[str, str]]] = None,
    test_context: Optional[str] = None,
    user_first_name: Optional[str] = None,
) -> str:
    """
    Qwen-only pipeline: Roman Urdu in, Roman Urdu out. No RAG, no Qalb, no transliteration.
    Builds messages: [system (Roman Urdu), ...history..., user] -> qwen_chat -> assistant reply.
    """
    if _is_crisis_message(roman_user_input):
        return CRISIS_RESPONSE_ROMAN_URDU

    system_content = build_system_prompt_with_context(
        user_first_name=user_first_name,
        test_context=test_context,
    )
    messages = [{"role": "system", "content": system_content}]

    if conversation_history_roman:
        # Last 10 messages to stay within context
        for msg in conversation_history_roman[-10:]:
            role = msg.get("role", "user")
            content = (msg.get("content") or "").strip()
            if content and role in ("user", "assistant"):
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": roman_user_input.strip()})

    reply = qwen_chat(messages, max_tokens=512, temperature=0.7)
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
