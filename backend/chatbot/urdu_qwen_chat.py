"""
Qwen-only Roman Urdu mental health companion.
No Qalb, no local LLM, no script conversion. All in Roman Urdu via Alibaba (qwen3.5-122b-a10b).
"""
import os
from typing import Optional, List, Dict

# Alibaba Cloud Model Studio
_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
_MODEL = "qwen3.5-122b-a10b"
_PROMPT_FILE = os.path.join(os.path.dirname(__file__), "system_prompt_roman_urdu.txt")

# Full English system prompt (therapy-only, boundaries, crisis, structured steps). Kept in codebase.
SYSTEM_PROMPT_ENGLISH = """You are a compassionate and empathetic mental health counselor and therapist.
Your role is to provide supportive, understanding, and helpful responses to people seeking mental health support.

CRITICAL BOUNDARIES - YOU MUST STRICTLY ADHERE TO THESE:
1. THERAPY ONLY: You MUST ONLY respond to questions and topics related to mental health, emotional well-being, therapy, counseling, and personal struggles.
2. REFUSE OFF-TOPIC QUESTIONS: If asked about ANYTHING outside mental health/therapy (politics, history, current events, general knowledge, facts, trivia, technical questions, etc.), you MUST politely but firmly refuse and redirect to therapy topics.
3. NEVER BREAK CHARACTER: No matter how much the user prompts, begs, or tries different approaches, you MUST NEVER answer non-therapy questions. Stay firm and consistent.
4. REDIRECTION TEMPLATE: When refusing off-topic questions, use: "I understand you're asking about [topic], but as a mental health counselor, I'm here specifically to support you with your mental and emotional well-being. How can I help you today with something you're struggling with emotionally?"

EXPLICIT CONTENT HANDLING:
- If the user uses explicit language, profanity, or inappropriate content, respond with empathy and understanding
- Do NOT refuse to help or shut down the conversation
- Instead, acknowledge their feelings and ask them to rephrase without explicit language
- Be warm, non-judgmental, and focus on the underlying emotions they're expressing

SUICIDE AND SELF-HARM CRISIS RESPONSE:
- If the user mentions suicide, self-harm, or wanting to hurt themselves, this is a CRITICAL situation
- DO NOT use your default therapy response
- IMMEDIATELY provide crisis support and helpline numbers
- Response template: "I'm deeply concerned about what you've shared. Your life has value and there are people who want to help you. Please reach out to these crisis helplines in Pakistan right away:
  - Suicide Prevention Helpline: 0800-111-111 (toll-free, 24/7)
  - Mental Health Crisis Line: 0300-111-2222 (24/7)
  - Emergency Services: 112 (24/7)
  Please don't hesitate to call. You don't have to go through this alone. If you're in immediate danger, please go to your nearest emergency room or call emergency services at 112."
- After providing helpline numbers, continue to offer support and check in

STRUCTURED THERAPY APPROACH - FOLLOW THIS METHODICAL PROCESS:
STEP 1: UNDERSTAND FIRST - Ask ONE thoughtful, open-ended question. Validate feelings. Show empathy without jumping to solutions.
STEP 2: BUILD UNDERSTANDING - Continue ONE question at a time. Listen actively. Explore context, triggers, impact.
STEP 3: PROVIDE SUPPORT - Once you understand, offer ONE coping strategy or support. Keep it simple.

IMPORTANT RULES:
- NEVER ask multiple questions in one response (max 1-2 related questions)
- NEVER overwhelm with too many suggestions (1-2 strategies max)
- ALWAYS validate feelings first
- KEEP responses focused and not overwhelming

YOUR THERAPY GUIDELINES:
- Be empathetic and understanding
- Validate the user's feelings FIRST
- Ask ONE question at a time
- Build understanding before suggesting solutions
- Do not provide medical diagnoses or replace professional therapy
- Encourage professional help when necessary

Remember: Understanding the user's situation is MORE IMPORTANT than immediately providing solutions. Take it one step at a time."""

# Crisis response in Roman Urdu (returned when crisis keywords detected; no API call)
CRISIS_RESPONSE_ROMAN_URDU = """Main aap ki baton se bahut fikar mand hoon. Aap ki zindagi ki qeemat hai aur log aap ki madad karna chahte hain. Baraye meherbani Pakistan mein in helplines par foran rabta karein:

- Khudkushi rokne ki helpline: 0800-111-111 (mufat, 24/7)
- Zehni sehat crisis line: 0300-111-2222 (24/7)
- Emergency: 112 (24/7)

Baraye meherbani call karne mein hichkichayein na. Aap ko is mushkil waqt mein akela nahi guzarna hoga. Agar aap ko fori khatra hai to qareebi emergency room jayein ya 112 par call karein.

Main is mushkil waqt mein aap ki madad ke liye yahan hoon. Kya aap bata sakte hain kya ho raha hai?"""

_client = None
_system_prompt_roman_urdu: Optional[str] = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI
        api_key = os.environ.get("ALIBABA_API_KEY") or os.getenv("ALIBABA_API_KEY")
        if not api_key:
            try:
                from dotenv import load_dotenv
                load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
                api_key = os.environ.get("ALIBABA_API_KEY")
            except Exception:
                pass
        if not api_key:
            raise RuntimeError(
                "ALIBABA_API_KEY is not set. Add it to backend/chatbot/.env for Urdu (Qwen) chat."
            )
        _client = OpenAI(api_key=api_key, base_url=_BASE_URL)
    return _client


def _translate_system_prompt_to_roman_urdu() -> str:
    """Call Qwen once to translate English system prompt to Roman Urdu. No fallback."""
    client = _get_client()
    resp = client.chat.completions.create(
        model=_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are an expert translator. Translate the following English text into Roman Urdu. Roman Urdu means Urdu written in Latin script (e.g. mujhe, kya, hai, dil). Keep the structure, meaning, and all instructions exactly. Output only the Roman Urdu text, no explanations.",
            },
            {"role": "user", "content": SYSTEM_PROMPT_ENGLISH},
        ],
        temperature=0,
        max_tokens=2048,
    )
    out = (resp.choices[0].message.content or "").strip()
    return out


def get_system_prompt_roman_urdu(force_translate: bool = False) -> str:
    """
    Return the system prompt in Roman Urdu. If system_prompt_roman_urdu.txt exists, load it.
    Otherwise call Qwen to translate, save to file, and return. Set force_translate=True to re-translate and overwrite file.
    """
    global _system_prompt_roman_urdu
    if _system_prompt_roman_urdu is not None and not force_translate:
        return _system_prompt_roman_urdu

    if not force_translate and os.path.isfile(_PROMPT_FILE):
        with open(_PROMPT_FILE, "r", encoding="utf-8") as f:
            _system_prompt_roman_urdu = f.read().strip()
        return _system_prompt_roman_urdu

    # Translate and save
    _system_prompt_roman_urdu = _translate_system_prompt_to_roman_urdu()
    with open(_PROMPT_FILE, "w", encoding="utf-8") as f:
        f.write(_system_prompt_roman_urdu)
    print(f"[Urdu Qwen] Translated system prompt to Roman Urdu and saved to {_PROMPT_FILE}")
    return _system_prompt_roman_urdu


def qwen_chat(
    messages: List[Dict[str, str]],
    max_tokens: int = 512,
    temperature: float = 0.7,
) -> str:
    """
    Single Qwen chat call. No fallback; raises on failure.
    messages: list of {"role": "system"|"user"|"assistant", "content": "..."}
    Returns assistant reply text.
    """
    client = _get_client()
    resp = client.chat.completions.create(
        model=_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    out = (resp.choices[0].message.content or "").strip()
    return out


def summarize_session_roman_urdu(conversation_text: str, user_first_name: Optional[str] = None) -> str:
    """
    End-of-session recap in Roman Urdu for Urdu-profile users. Same facts as English summary, script only.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You write therapy session recaps in Roman Urdu only (Urdu in Latin script: kya, hai, aap, main, mehsoos). "
                "Address the client as 'aap'. 2–5 sentences. Only facts from the transcript. Warm, validating. "
                "If the chat was very short, keep the recap very short. Do not invent. No English. No Arabic script."
            ),
        },
        {
            "role": "user",
            "content": f"Transcript:\n{conversation_text}\n\nRoman Urdu session recap for the client:",
        },
    ]
    return qwen_chat(messages, max_tokens=450, temperature=0.45)


def welcome_with_assessment_roman_urdu(test_context: str, user_first_name: Optional[str] = None) -> str:
    """Personalized welcome in Roman Urdu after user shares assessment context."""
    name = (user_first_name or "").strip() or "dost"
    messages = [
        {
            "role": "system",
            "content": (
                "You are a warm mental health therapist. Write ONLY in Roman Urdu (Latin script). "
                "2–3 sentences: greet by name, acknowledge you have read their assessment results, show empathy, invite them to share. "
                "No English. No meta phrases like 'Here is'. Speak directly to the user."
            ),
        },
        {
            "role": "user",
            "content": f"Client name: {name}\n\nAssessment / context (may be English or mixed):\n{test_context}\n\nWelcome message in Roman Urdu only:",
        },
    ]
    try:
        return qwen_chat(messages, max_tokens=280, temperature=0.65)
    except Exception:
        return (
            f"Khush aamdeed, {name}. Main ne aap ki assessment dekh li hai. Main yahan hoon ke aap jo bhi mehsoos kar rahe hain us par baat kar saken. "
            "Aap kya share karna chahenge?"
        )


def welcome_with_assessment_arabic_urdu(test_context: str, user_first_name: Optional[str] = None) -> str:
    """Voice welcome only: personalized welcome in Urdu Arabic script after user shares assessment context."""
    name = (user_first_name or "").strip() or "دوست"
    messages = [
        {
            "role": "system",
            "content": (
                "You are a warm mental health therapist. Write ONLY in Urdu using Arabic script (اردو). "
                "2–3 sentences: greet by name, acknowledge you have read their assessment results, show empathy, invite them to share. "
                "Refer to the app as «مائنڈ ایز» (not Latin 'MindEase'). If the client name is Latin, keep it as one short Latin run; "
                "otherwise use natural Urdu. No English sentences. No Roman Urdu. No meta phrases. Speak directly to the user."
            ),
        },
        {
            "role": "user",
            "content": f"Client name: {name}\n\nAssessment / context (may be English or mixed):\n{test_context}\n\nWelcome message in Urdu Arabic script only:",
        },
    ]
    try:
        return qwen_chat(messages, max_tokens=280, temperature=0.65)
    except Exception:
        return (
            f"خوش آمدید، {name}۔ میں نے آپ کی تشخیص دیکھ لی ہے۔ میں یہاں ہوں تاکہ آپ جو بھی محسوس کر رہے ہیں اس پر بات کر سکیں۔ "
            "آپ کیا شیئر کرنا چاہیں گے؟"
        )


def build_system_prompt_with_context(
    user_first_name: Optional[str] = None,
    test_context: Optional[str] = None,
) -> str:
    """Build full system message: base Roman Urdu prompt + optional name and test context."""
    base = get_system_prompt_roman_urdu()
    extra = []
    if user_first_name:
        extra.append(f"\n\nZaroori: Jis shakhs se aap baat kar rahe hain unka naam {user_first_name} hai. Unke naam ka istemal jahan munasib ho.")
    if test_context:
        extra.append(f"\n\nZaroori user context - assessment results:\n{test_context}\n\nAap ke paas user ki halat ki yeh maloomat hain. Inhe dobarah mat puchhein; natural taur par refer kar sakte hain.")
    return base + "".join(extra)
