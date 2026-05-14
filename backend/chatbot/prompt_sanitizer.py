"""
Prompt injection sanitizer for user chat input.

Strips role markers, control tokens, and obvious jailbreak triggers before
the message reaches the LLM. Also caps length to bound LLM token cost.

Keep this conservative: we strip syntax (role headers, control tokens) but
NOT plain English instructions ("ignore previous"). Those are still passed
to the LLM, which is anchored by its system prompt. Heavy NLP filtering
would create false positives on legitimate therapy talk.
"""
import re

MAX_USER_MESSAGE_CHARS = 2000

_ROLE_HEADER_RE = re.compile(
    r"(?im)^\s*(?:system|assistant|developer|tool)\s*[:\-]\s*"
)

_CHATML_TOKENS_RE = re.compile(
    r"<\|(?:im_start|im_end|endoftext|system|assistant|user|developer)\|>",
    re.IGNORECASE,
)

_LLAMA_TOKENS_RE = re.compile(
    r"\[/?(?:INST|SYS|S)\]",
    re.IGNORECASE,
)

_CLAUDE_HUMAN_TOKENS_RE = re.compile(
    r"\b(?:\\n)?\\?n?(?:Human|Assistant):\s*",
)

_INSTRUCTION_HEADER_RE = re.compile(
    r"(?im)^\s*(?:###\s*(?:instruction|system|prompt)|---\s*system\s*---)\s*$"
)


def sanitize_user_message(text: str) -> str:
    """Strip prompt-injection syntax and cap length. Returns cleaned text."""
    if not text:
        return ""

    cleaned = str(text)

    if len(cleaned) > MAX_USER_MESSAGE_CHARS:
        cleaned = cleaned[:MAX_USER_MESSAGE_CHARS]

    cleaned = _CHATML_TOKENS_RE.sub("", cleaned)
    cleaned = _LLAMA_TOKENS_RE.sub("", cleaned)
    cleaned = _CLAUDE_HUMAN_TOKENS_RE.sub("", cleaned)
    cleaned = _INSTRUCTION_HEADER_RE.sub("", cleaned)
    cleaned = _ROLE_HEADER_RE.sub("", cleaned)

    cleaned = re.sub(r"\n{4,}", "\n\n\n", cleaned)

    return cleaned.strip()


__all__ = ["sanitize_user_message", "MAX_USER_MESSAGE_CHARS"]
