"""
Crisis (suicide / self-harm) keyword detection for chat input.
Used by English LLM path (llm_client.py) and Roman Urdu pipeline (urdu_chat_pipeline.py).

Word-boundary regex reduces false positives ("kill the bug" no longer trips).
Covers English, Roman Urdu, and Urdu (Arabic) script.
"""
import re

_EN_PATTERNS = [
    r"\bsuicide\b",
    r"\bsuicidal\b",
    r"\bkill\s+myself\b",
    r"\bend\s+my\s+life\b",
    r"\bend\s+it\s+all\b",
    r"\bwant\s+to\s+die\b",
    r"\bwanna\s+die\b",
    r"\bwish\s+i\s+(?:was|were)\s+dead\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bself[\s\-]?harm\b",
    r"\bhurt\s+myself\b",
    r"\bcut\s+myself\b",
    r"\btake\s+my\s+(?:own\s+)?life\b",
    r"\bending\s+it\b",
    r"\bnot\s+want\s+to\s+live\b",
    r"\bdon'?t\s+want\s+to\s+live\b",
    r"\bunalive\b",
    r"\bkms\b",
    r"\bkys\b",
    r"\boff\s+myself\b",
    r"\bjump\s+off\b",
    r"\bhang\s+myself\b",
    r"\boverdose\s+on\b",
]

_ROMAN_URDU_PATTERNS = [
    r"\bkhud\s*kushi\b",
    r"\bkhudkushi\b",
    r"\bkhud\s*kashi\b",
    r"\bapna\s+qatl\b",
    r"\bmar\s+jana\b",
    r"\bmar\s+jaun\b",
    r"\bmar\s+jaunga\b",
    r"\bmar\s+jaungi\b",
    r"\bmar\s+jaye\b",
    r"\bmarna\s+chahta\b",
    r"\bmarna\s+chahti\b",
    r"\bsab\s+khatam\s+karna\b",
    r"\bsab\s+khatam\s+kar\b",
    r"\bzindagi\s+ka\s+koi\s+matlab\s+nahi\b",
    r"\bjeena\s+nahi\b",
    r"\bjeene\s+ka\s+dil\s+nahi\b",
    r"\bkhud\s+ko\s+nuqsan\b",
    r"\bkhud\s+ko\s+chot\b",
    r"\bzindagi\s+khatam\b",
    r"\bmain\s+marna\s+chahta\b",
    r"\bmain\s+marna\s+chahti\b",
]

_URDU_SCRIPT_TOKENS = [
    "خودکشی",
    "خود کشی",
    "خود کُشی",
    "اپنا قتل",
    "مرنا چاہتا",
    "مرنا چاہتی",
    "جینا نہیں",
    "خود کو نقصان",
    "خود کو چوٹ",
    "زندگی ختم",
    "اپنی جان",
    "مر جانا",
    "مر جاؤں",
]

_REGEX = re.compile("|".join(_EN_PATTERNS + _ROMAN_URDU_PATTERNS), re.IGNORECASE)


def is_crisis_message(text: str) -> bool:
    """Return True if input contains suicide/self-harm signals."""
    if not text:
        return False
    if _REGEX.search(text):
        return True
    for token in _URDU_SCRIPT_TOKENS:
        if token in text:
            return True
    return False


__all__ = ["is_crisis_message"]
