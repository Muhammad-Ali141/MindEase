"""
LLM Client
- Primary backend: OpenRouter (OpenAI-compatible), when OPENROUTER_API_KEY is set.
- Fallback backend: Ollama (local Llama 3.1 8B Instruct).
The system prompt and message construction are identical across backends so the
assistant's behavior is unchanged.
"""
import os
import sys
import time
import ollama
from typing import Optional, List, Dict, Generator


def _log(msg: str):
    """Print to stderr so the log isn't swallowed by stdout-capturing init blocks."""
    print(msg, file=sys.stderr, flush=True)

try:
    from openai import OpenAI as _OpenAI  # OpenAI-compatible client; OpenRouter accepts it
except Exception:
    _OpenAI = None

# ---- OpenRouter configuration (env-driven, read lazily so dotenv can load first) ----
def _openrouter_keys():
    """Return list of API keys: OPENROUTER_API_KEY, OPENROUTER_API_KEY_2, etc."""
    keys = []
    primary = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if primary:
        keys.append(primary)
    backup = (os.getenv("OPENROUTER_API_KEY_2") or "").strip()
    if backup:
        keys.append(backup)
    return keys

def _openrouter_env():
    keys = _openrouter_keys()
    return {
        "api_keys": keys,
        "api_key": keys[0] if keys else "",
        "base_url": (os.getenv("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1").strip(),
        "model": (os.getenv("OPENROUTER_MODEL") or "meta-llama/llama-3.3-70b-instruct").strip(),
        "site_url": (os.getenv("OPENROUTER_SITE_URL") or "http://localhost:3000").strip(),
        "site_name": (os.getenv("OPENROUTER_SITE_NAME") or "MindEase").strip(),
    }

# Message shown when Ollama GPU runner crashes (mid-conversation); emphasize CPU fix for recurring issues
OLLAMA_GPU_ERROR_MSG = (
    "Ollama's GPU runner stopped (this can happen mid-conversation with GPU memory or driver issues).\n\n"
    "Quick fix: Restart Ollama (close any 'ollama serve' window, then run: ollama serve).\n\n"
    "If it keeps happening: Run Ollama on CPU for stability (slower but reliable):\n"
    "  • Windows (PowerShell): $env:OLLAMA_NUM_GPU=0; ollama serve\n"
    "  • Windows (CMD): set OLLAMA_NUM_GPU=0 && ollama serve\n"
    "  • Mac/Linux: OLLAMA_NUM_GPU=0 ollama serve\n\n"
    "Also try: update GPU drivers, close other apps using the GPU, or use a smaller model (e.g. ollama pull llama3.2:3b)."
)

def _is_ollama_gpu_error(error_msg: str) -> bool:
    """True if the exception looks like Ollama GPU runner crash (CUDA, 500, process terminated)."""
    msg = (error_msg or "").lower()
    return "cuda" in msg or "status code: 500" in msg or "process has terminated" in msg


class LLMClient:
    """Client for interacting with Ollama LLM"""
    
    def __init__(self, model_name: str = None):
        """
        Initialize LLM client.

        - If OPENROUTER_API_KEY is set, use OpenRouter (OpenAI-compatible) as the backend.
          model_name, if provided, overrides the env default; otherwise OPENROUTER_MODEL is used.
        - Otherwise, fall back to local Ollama (auto-detect llama3.1 model).
        """
        self.backend = "ollama"
        self._openrouter_clients = []  # list of (OpenAI client, key_index) for cascading fallback
        self._openrouter_cfg = _openrouter_env()
        api_keys = self._openrouter_cfg["api_keys"]
        _log(f"[LLM init] OPENROUTER keys: {len(api_keys)}, openai-sdk available: {_OpenAI is not None}")
        if api_keys and _OpenAI is not None:
            for idx, key in enumerate(api_keys):
                try:
                    client = _OpenAI(
                        base_url=self._openrouter_cfg["base_url"],
                        api_key=key,
                    )
                    self._openrouter_clients.append((client, idx + 1))
                except Exception as e:
                    _log(f"[WARN] OpenRouter key #{idx+1} init failed: {e}")
        if self._openrouter_clients:
            self.backend = "openrouter"
            self.model_name = model_name or self._openrouter_cfg["model"]
            # Also prepare Ollama as silent fallback
            self._ollama_model = None
            try:
                self._find_and_set_ollama_model()
            except Exception:
                pass
            _log(f"[OK] LLM backend: OpenRouter (model: {self.model_name}, {len(self._openrouter_clients)} key(s), ollama fallback: {self._ollama_model or 'unavailable'})")
            return

        self.model_name = model_name
        self._ollama_model = None
        self._find_and_set_model()

    def _find_and_set_ollama_model(self):
        """Detect best Ollama model and store in self._ollama_model (for fallback use)."""
        name = self._detect_ollama_model()
        if name:
            self._ollama_model = name

    def _detect_ollama_model(self) -> str | None:
        """Return the best available Ollama model name, or None."""
        try:
            models_response = ollama.list()
            if hasattr(models_response, 'models'):
                model_list = models_response.models
            elif isinstance(models_response, dict) and 'models' in models_response:
                model_list = models_response['models']
            elif isinstance(models_response, list):
                model_list = models_response
            else:
                model_list = []
            model_names = []
            for model in model_list:
                name = None
                if hasattr(model, 'model'):
                    name = model.model
                elif isinstance(model, dict):
                    name = model.get('model') or model.get('name')
                elif isinstance(model, str):
                    name = model
                if name and name not in model_names:
                    model_names.append(name)
            for preferred in ["llama3.1:8b-instruct", "llama3.1:8b", "llama3.1:8b-instruct-q4_K_M", "llama3.1:8b-instruct-q4"]:
                if preferred in model_names:
                    return preferred
            llama_models = [m for m in model_names if 'llama3.1' in m.lower() and '8b' in m.lower()]
            if llama_models:
                return llama_models[0]
            llama3_models = [m for m in model_names if 'llama3' in m.lower()]
            if llama3_models:
                return llama3_models[0]
        except Exception:
            pass
        return None

    def _find_and_set_model(self):
        """Find and set available model, auto-detect if model_name is None"""
        try:
            # Try to list models
            models_response = ollama.list()
            
            # Handle different response formats
            # ListResponse object has 'models' attribute
            if hasattr(models_response, 'models'):
                model_list = models_response.models
            elif isinstance(models_response, dict):
                if 'models' in models_response:
                    model_list = models_response['models']
                else:
                    model_list = []
            elif isinstance(models_response, list):
                model_list = models_response
            else:
                model_list = []
            
            # Extract model names - handle different formats
            model_names = []
            for model in model_list:
                name = None
                
                # Handle Model object (has 'model' attribute)
                if hasattr(model, 'model'):
                    name = model.model
                # Handle dict with 'model' or 'name' key
                elif isinstance(model, dict):
                    name = model.get('model') or model.get('name')
                # Handle string
                elif isinstance(model, str):
                    name = model
                
                if name and name not in model_names:
                    model_names.append(name)
            
            # If model_name is provided, check if it exists
            if self.model_name:
                if self.model_name in model_names:
                    print(f"[OK] Using specified model: {self.model_name}")
                    return
                else:
                    print(f"[WARN] Specified model '{self.model_name}' not found!")
                    print(f"      Available models: {model_names}")
            
            # Auto-detect: Look for llama3.1 models
            preferred_models = [
                "llama3.1:8b-instruct",
                "llama3.1:8b",
                "llama3.1:8b-instruct-q4_K_M",
                "llama3.1:8b-instruct-q4",
            ]
            
            # Try preferred models first
            for preferred in preferred_models:
                if preferred in model_names:
                    self.model_name = preferred
                    print(f"[OK] Auto-selected model: {self.model_name}")
                    return
            
            # Look for any llama3.1 model
            llama_models = [m for m in model_names if 'llama3.1' in m.lower() and '8b' in m.lower()]
            if llama_models:
                self.model_name = llama_models[0]
                print(f"[OK] Auto-selected available llama3.1 model: {self.model_name}")
                return
            
            # Look for any llama3 model
            llama3_models = [m for m in model_names if 'llama3' in m.lower()]
            if llama3_models:
                self.model_name = llama3_models[0]
                print(f"[OK] Auto-selected available llama3 model: {self.model_name}")
                return
            
            # No suitable model found
            print(f"\n[WARN] No suitable Llama model found!")
            print(f"      Available models: {model_names}")
            print(f"\n      Please download a model using one of:")
            print(f"        ollama pull llama3.1:8b-instruct")
            print(f"        ollama pull llama3.1:8b")
            print(f"        ollama pull llama3.1:8b-instruct-q4_K_M")
            self.model_name = None
            
        except Exception as e:
            print(f"[WARN] Could not verify Ollama models: {e}")
            print(f"      Make sure Ollama is running: ollama serve")
            print(f"      Trying to use default model name...")
            # Set default as fallback
            if not self.model_name:
                self.model_name = "llama3.1:8b-instruct"
    
    def generate_response(
        self,
        user_message: str,
        emotions: str = "",
        context: str = "",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        system_prompt_override: Optional[str] = None,
        user_first_name: Optional[str] = None,
        test_context: Optional[str] = None
    ) -> str:
        """
        Generate therapist response using LLM
        
        Args:
            user_message: Current user message
            emotions: Detected emotions string (formatted)
            context: RAG context string (formatted)
            conversation_history: Previous messages as [{"role": "user/assistant", "content": "..."}]
            system_prompt_override: Optional custom system prompt (for summaries, etc.)
            
        Returns:
            Generated response text
        """
        # Check for suicide/self-harm keywords before processing
        suicide_keywords = ['suicide', 'kill myself', 'end my life', 'want to die', 'self harm', 'hurt myself', 'cut myself', 'take my life', 'ending it', 'not want to live']
        user_message_lower = user_message.lower()
        
        if any(keyword in user_message_lower for keyword in suicide_keywords):
            # Return crisis response immediately
            crisis_response = """I'm deeply concerned about what you've shared. Your life has value and there are people who want to help you. Please reach out to these crisis helplines in Pakistan right away:

- Suicide Prevention Helpline: 0800-111-111 (toll-free, 24/7)
- Mental Health Crisis Line: 0300-111-2222 (24/7)
- Emergency Services: 112 (24/7)

Please don't hesitate to call. You don't have to go through this alone. If you're in immediate danger, please go to your nearest emergency room or call emergency services at 112.

I'm here to support you through this difficult time. Would you like to talk about what's been going on?"""
            return crisis_response
        # Build system prompt with strict therapy-only enforcement and structured approach
        if system_prompt_override:
            system_prompt = system_prompt_override
        else:
            # Add user's name to system prompt if available
            user_name_context = ""
            if user_first_name:
                user_name_context = f"\n\nIMPORTANT: The person you're talking to is named {user_first_name}. Use their name naturally in your responses when appropriate (e.g., \"I understand, {user_first_name}\" or \"How are you feeling today, {user_first_name}?\"). Be warm and personal, but don't overuse their name."
            
            # Add test context to system prompt if provided
            test_context_section = ""
            if test_context:
                test_context_section = f"\n\nIMPORTANT USER CONTEXT - ASSESSMENT RESULTS:\n{test_context}\n\nYou already have this information about the user's condition. Use it to understand their situation without asking them to repeat it. You can reference their assessment results naturally in your responses, but don't make it the only focus. The user may want to discuss other things as well."
            
            system_prompt = """You are a compassionate and empathetic mental health counselor and therapist. 
Your role is to provide supportive, understanding, and helpful responses to people seeking mental health support.""" + user_name_context + test_context_section + """

CRITICAL BOUNDARIES - YOU MUST STRICTLY ADHERE TO THESE:
1. THERAPY ONLY: You MUST ONLY respond to questions and topics related to mental health, emotional well-being, therapy, counseling, and personal struggles.
2. REFUSE OFF-TOPIC QUESTIONS: If asked about ANYTHING outside mental health/therapy (politics, history, current events, general knowledge, facts, trivia, technical questions, etc.), you MUST politely but firmly refuse and redirect to therapy topics.
3. NEVER BREAK CHARACTER: No matter how much the user prompts, begs, or tries different approaches, you MUST NEVER answer non-therapy questions. Stay firm and consistent.
4. REDIRECTION TEMPLATE: When refusing off-topic questions, use: "I understand you're asking about [topic], but as a mental health counselor, I'm here specifically to support you with your mental and emotional well-being. How can I help you today with something you're struggling with emotionally?"

EXPLICIT CONTENT HANDLING:
- If the user uses explicit language, profanity, or inappropriate content, respond with empathy and understanding
- Do NOT refuse to help or shut down the conversation
- Instead, acknowledge their feelings and ask them to rephrase without explicit language
- Example: "I understand you're feeling very frustrated and upset. I'm here to help you work through these difficult feelings. Could you help me understand what's going on by describing it in a way that doesn't include explicit language? I want to make sure I can support you effectively."
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
- Encourage them to reach out to trusted friends, family, or mental health professionals

STRUCTURED THERAPY APPROACH - FOLLOW THIS METHODICAL PROCESS:
Your responses should follow a clear, structured approach - ONE STEP AT A TIME, but be SMART about when to transition:

STEP 1: UNDERSTAND FIRST (Primary Focus)
- If the user just shared something new, focus on UNDERSTANDING their situation
- Ask ONE thoughtful, open-ended question to learn more about their specific situation
- Validate their feelings: "I hear you're feeling [emotion]. That must be really difficult."
- Show empathy without immediately jumping to solutions
- DO NOT ask multiple questions at once - pick the most important aspect to explore
- Example: "I understand you're feeling anxious. Can you tell me more about what's specifically making you feel anxious right now?"

STEP 2: BUILD UNDERSTANDING (Before Suggesting)
- Continue asking ONE question at a time to understand the full picture
- Listen actively: reflect back what they've shared
- Explore the context: "What happened that led to these feelings?"
- Understand triggers: "When did you first notice these feelings?"
- Understand impact: "How is this affecting your daily life?"

STEP 3: PROVIDE SUPPORT (Only After Understanding)
- Once you have a good understanding of their situation, then offer ONE coping strategy or support
- Keep suggestions simple and focused
- Offer evidence-based techniques: breathing exercises, grounding techniques, etc.
- Encourage self-care: "It might help to try [one specific technique]"
- Be gentle: "Would you like to explore [one strategy] together?"

SMART TRANSITION RULES - KNOW WHEN TO MOVE FORWARD:
- After 2-3 exchanges where you've asked questions and the user has provided context, you should have enough understanding to provide support
- If the user has shared: (1) what they're feeling, (2) what's causing it or when it happens, and (3) how it's affecting them - you have enough information to move to Step 3
- Don't keep asking questions indefinitely - once you understand the core issue, provide helpful support
- If the user seems frustrated or asks for help directly, transition to providing support even if you could ask more questions
- Balance understanding with being helpful - don't over-question when the user needs support

IMPORTANT RULES:
- NEVER ask multiple questions in one response (max 1-2 related questions)
- NEVER overwhelm with too many suggestions at once (1-2 strategies max)
- NEVER skip understanding to jump to solutions
- ALWAYS validate feelings first
- ALWAYS ask ONE question at a time to build understanding
- KEEP responses focused and not overwhelming
- Be patient - understanding takes time, but also be efficient - don't over-question

CONVERSATION FLOW:
Early in conversation (1-2 exchanges): Focus on UNDERSTANDING (Step 1) - ask questions, validate feelings
Mid conversation (3-4 exchanges): Continue UNDERSTANDING (Step 2) - explore context, triggers, impact, BUT start transitioning to support if you have enough context
When you have context (after 2-3 exchanges with good information): Provide SUPPORT (Step 3) - suggest ONE coping strategy at a time

YOUR THERAPY GUIDELINES:
- Be empathetic and understanding
- Validate the user's feelings FIRST
- Ask ONE question at a time - don't overwhelm
- Build understanding before suggesting solutions
- Provide ONE coping strategy at a time, not multiple
- Maintain a warm, professional, and non-judgmental tone
- Focus on active listening and reflection
- Do not provide medical diagnoses or replace professional therapy
- Encourage professional help when necessary

When emotions are detected, acknowledge and validate them.
When relevant context from similar situations is provided, use it as a reference but tailor your response to the specific user.

Remember: Understanding the user's situation is MORE IMPORTANT than immediately providing solutions. Take it one step at a time."""
        
        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history
        if conversation_history:
            messages.extend(conversation_history)
        
        # Build current user message with context
        current_message = user_message
        
        if emotions:
            current_message = f"{emotions}\n\nUser: {user_message}"
        
        if context:
            current_message = f"{context}\n\n{current_message}"
        
        messages.append({"role": "user", "content": current_message})
        print("[LLM input] user_message:", user_message[:200] + ("..." if len(user_message) > 200 else ""))
        print("[LLM input] emotions:", emotions[:300] if emotions else "(none)")
        print("[LLM input] context length:", len(context or ""), "chars")
        print("[LLM input] current_message (last user content) length:", len(current_message), "chars")
        # Generate response
        _log(f"[LLM backend] {self.backend} (model: {self.model_name})")
        if self.backend == "openrouter" and self._openrouter_clients:
            last_err = None
            for client, key_idx in self._openrouter_clients:
                try:
                    _log(f"[LLM] trying OpenRouter key #{key_idx}")
                    completion = client.chat.completions.create(
                        extra_headers={
                            "HTTP-Referer": self._openrouter_cfg["site_url"],
                            "X-OpenRouter-Title": self._openrouter_cfg["site_name"],
                        },
                        model=self.model_name,
                        messages=messages,
                        temperature=0.7,
                        top_p=0.9,
                    )
                    return completion.choices[0].message.content or ""
                except Exception as e:
                    last_err = e
                    _log(f"[WARN] OpenRouter key #{key_idx} failed: {e}")
            # All keys exhausted — fall through to Ollama
            _log(f"[WARN] All OpenRouter keys exhausted, falling back to Ollama")

        # Ollama fallback — determine which model name to use
        ollama_model = getattr(self, '_ollama_model', None) or self.model_name
        if not ollama_model:
            ollama_model = self._detect_ollama_model() or "llama3.1:8b-instruct"
        _log(f"[LLM] Ollama fallback (model: {ollama_model})")
        for attempt in range(2):
            try:
                response = ollama.chat(
                    model=ollama_model,
                    messages=messages,
                    options={
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "top_k": 40,
                    }
                )
                if 'message' in response and 'content' in response['message']:
                    return response['message']['content']
                return response.get('message', {}).get('content', '')
            except Exception as e:
                if _is_ollama_gpu_error(str(e)) and attempt == 0:
                    time.sleep(2.5)
                    continue
                _log(f"[ERR] Ollama attempt {attempt+1} failed: {e}")
                break
        # Should never reach here, but return a gentle message just in case
        return "I'm here for you. Could you say that again? I want to make sure I understand."

    def generate_response_stream(
        self,
        user_message: str,
        emotions: str = "",
        context: str = "",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        system_prompt_override: Optional[str] = None,
        user_first_name: Optional[str] = None,
        test_context: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """
        Generate therapist response using LLM, streaming text chunks.
        Same args as generate_response; yields content deltas.
        """
        # Crisis response: return full text in one chunk (no stream)
        suicide_keywords = ['suicide', 'kill myself', 'end my life', 'want to die', 'self harm', 'hurt myself', 'cut myself', 'take my life', 'ending it', 'not want to live']
        if any(k in user_message.lower() for k in suicide_keywords):
            crisis = """I'm deeply concerned about what you've shared. Your life has value and there are people who want to help you. Please reach out to these crisis helplines in Pakistan right away:

- Suicide Prevention Helpline: 0800-111-111 (toll-free, 24/7)
- Mental Health Crisis Line: 0300-111-2222 (24/7)
- Emergency Services: 112 (24/7)

Please don't hesitate to call. You don't have to go through this alone. If you're in immediate danger, please go to your nearest emergency room or call emergency services at 112.

I'm here to support you through this difficult time. Would you like to talk about what's been going on?"""
            yield crisis
            return
        # Build messages (same as generate_response)
        if system_prompt_override:
            system_prompt = system_prompt_override
        else:
            user_name_context = ""
            if user_first_name:
                user_name_context = f"\n\nIMPORTANT: The person you're talking to is named {user_first_name}. Use their name naturally in your responses when appropriate."
            test_context_section = ""
            if test_context:
                test_context_section = f"\n\nIMPORTANT USER CONTEXT - ASSESSMENT RESULTS:\n{test_context}\n\nUse it to understand their situation without asking them to repeat it."
            system_prompt = """You are a compassionate and empathetic mental health counselor and therapist.
Your role is to provide supportive, understanding, and helpful responses.""" + user_name_context + test_context_section + """

CRITICAL BOUNDARIES: Only respond to mental health/therapy topics. Refuse off-topic questions politely.
Keep responses focused. Ask ONE question at a time. Validate feelings first. One coping strategy at a time."""
        messages = [{"role": "system", "content": system_prompt}]
        if conversation_history:
            messages.extend(conversation_history)
        current_message = user_message
        if emotions:
            current_message = f"{emotions}\n\nUser: {user_message}"
        if context:
            current_message = f"{context}\n\n{current_message}"
        messages.append({"role": "user", "content": current_message})
        print("[LLM input stream] user_message:", user_message[:200] + ("..." if len(user_message) > 200 else ""))
        print("[LLM input stream] emotions:", (emotions[:300] + "..." if emotions and len(emotions) > 300 else (emotions or "(none)")))
        print("[LLM input stream] context length:", len(context or ""), "chars")
        print("[LLM input stream] current_message length:", len(current_message), "chars")
        _log(f"[LLM backend stream] {self.backend} (model: {self.model_name})")
        if self.backend == "openrouter" and self._openrouter_clients:
            for client, key_idx in self._openrouter_clients:
                try:
                    _log(f"[LLM stream] trying OpenRouter key #{key_idx}")
                    stream = client.chat.completions.create(
                        extra_headers={
                            "HTTP-Referer": self._openrouter_cfg["site_url"],
                            "X-OpenRouter-Title": self._openrouter_cfg["site_name"],
                        },
                        model=self.model_name,
                        messages=messages,
                        temperature=0.7,
                        top_p=0.9,
                        stream=True,
                    )
                    for chunk in stream:
                        try:
                            delta = chunk.choices[0].delta.content if chunk.choices else None
                        except Exception:
                            delta = None
                        if delta:
                            yield delta
                    return
                except Exception as e:
                    _log(f"[WARN] OpenRouter key #{key_idx} stream failed: {e}")
            _log(f"[WARN] All OpenRouter keys exhausted (stream), falling back to Ollama")

        # Ollama fallback (stream)
        ollama_model = getattr(self, '_ollama_model', None) or self.model_name
        if not ollama_model:
            ollama_model = self._detect_ollama_model() or "llama3.1:8b-instruct"
        _log(f"[LLM stream] Ollama fallback (model: {ollama_model})")
        for attempt in range(2):
            try:
                stream = ollama.chat(
                    model=ollama_model,
                    messages=messages,
                    stream=True,
                    options={"temperature": 0.7, "top_p": 0.9, "top_k": 40},
                )
                for chunk in stream:
                    if isinstance(chunk, dict) and 'message' in chunk and 'content' in chunk['message']:
                        yield chunk['message']['content']
                    elif hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                        yield chunk.message.content or ""
                return
            except Exception as e:
                if _is_ollama_gpu_error(str(e)) and attempt == 0:
                    time.sleep(2.5)
                    continue
                _log(f"[ERR] Ollama stream attempt {attempt+1} failed: {e}")
                break
        yield "I'm here for you. Could you say that again? I want to make sure I understand."


if __name__ == "__main__":
    # Test LLM client
    print("Testing LLM Client...")
    client = LLMClient()
    
    test_message = "I'm feeling really anxious about my job interview tomorrow"
    emotions = "Detected emotions: anxiety (0.85), nervousness (0.72)"
    
    print(f"User: {test_message}")
    print(f"Emotions: {emotions}\n")
    
    response = client.generate_response(test_message, emotions=emotions)
    print(f"Therapist: {response}")
