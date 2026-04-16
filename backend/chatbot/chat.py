"""
MindEase Chatbot - Clean Chat Interface
User-friendly terminal chat with clean formatting and therapist greeting
"""
import os
import sys
from typing import List, Dict
from datetime import datetime

# Add backend directory to Python path
current_file = os.path.abspath(__file__)
backend_dir = os.path.dirname(os.path.dirname(current_file))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from chatbot.emotion_detector import EmotionDetector
from chatbot.rag_system_postgres import RAGSystem
from chatbot.llm_client import LLMClient
from chatbot.conversation_memory import ConversationMemory
from chatbot.config import DB_CONFIG

# Urdu pipeline is Qwen-only (no cache needed)


def _is_urdu_lang(lang_pref: str) -> bool:
    """True if user prefers Urdu."""
    if not lang_pref:
        return False
    s = str(lang_pref).lower().strip()
    return s in ("urdu", "ur")


_CHATBOT_CACHE = {}
_CHATBOT_CACHE_LOCK = None

def get_cached_chatbot(user_first_name=None, test_context=None, lang_pref=None):
    """Return a shared MindEaseChat per lang_pref, resetting per-request state.
    Keeps DeBERTa / sentence-transformer / RAG connection warm across requests."""
    import threading
    global _CHATBOT_CACHE_LOCK
    if _CHATBOT_CACHE_LOCK is None:
        _CHATBOT_CACHE_LOCK = threading.Lock()
    key = "urdu" if _is_urdu_lang(lang_pref) else "english"
    with _CHATBOT_CACHE_LOCK:
        bot = _CHATBOT_CACHE.get(key)
        if bot is None:
            bot = MindEaseChat(user_first_name=user_first_name, test_context=test_context, lang_pref=lang_pref)
            _CHATBOT_CACHE[key] = bot
    bot.user_first_name = user_first_name
    bot.test_context = test_context
    bot.lang_pref = lang_pref or "english"
    bot.memory = ConversationMemory(max_history_length=20)
    bot.last_emotions = None
    return bot


class MindEaseChat:
    """Clean chat interface for MindEase therapy chatbot"""
    
    def __init__(self, user_first_name: str = None, test_context: str = None, lang_pref: str = None):
        """
        Initialize chatbot with all components (silent initialization)
        
        Args:
            user_first_name: User's first name for personalized responses
            test_context: Optional test context to be used throughout the conversation
            lang_pref: User language preference - "english"/"en" or "urdu"/"ur". Default English.
        """
        self.user_first_name = user_first_name
        self.test_context = test_context  # Store test context for the entire conversation
        self.lang_pref = lang_pref or "english"
        self._initialize_components()
        self.memory = ConversationMemory(max_history_length=20)
        
    def _initialize_components(self):
        """Initialize all components silently; on failure set component to None so chat can still run.
        Urdu pipeline uses Qwen exclusively — skip EmotionDetector, RAG, and OpenRouter LLM."""
        if _is_urdu_lang(self.lang_pref):
            self.emotion_detector = None
            self.rag_system = None
            self.llm_client = None
            return

        import io
        import contextlib
        f = io.StringIO()
        with contextlib.redirect_stdout(f):
            try:
                self.emotion_detector = EmotionDetector()
            except Exception as e:
                print(f"Warning: Emotion detector failed to load ({e}). Continuing without emotion detection.")
                self.emotion_detector = None
            try:
                self.rag_system = RAGSystem(db_config=DB_CONFIG)
            except Exception as e:
                print(f"Warning: RAG system failed to load ({e}). Continuing without RAG.")
                self.rag_system = None
            try:
                self.llm_client = LLMClient()
            except Exception as e:
                print(f"Error: LLM client failed to load ({e}). Chat will not work.")
                self.llm_client = None
        if self.llm_client is None:
            raise RuntimeError("LLM client is required but failed to initialize.")

    def _ensure_urdu_system_prompt(self):
        """Load Roman Urdu system prompt from file (or translate once and save). No Qalb/translator."""
        from chatbot.urdu_qwen_chat import get_system_prompt_roman_urdu
        get_system_prompt_roman_urdu()

    def _print_separator(self, char="─", length=75):
        """Print a separator line"""
        print(char * length)
    
    def _print_message(self, role: str, content: str):
        """Print a formatted message"""
        if role == "therapist":
            print(f"{'🧑‍⚕️ Therapist':<20} │ {content}")
        elif role == "user":
            print(f"{'👤 You':<20} │ {content}")
    
    def _print_welcome(self):
        """Print welcome message from therapist"""
        if self.user_first_name:
            welcome_msg = f"Welcome to MindEase, {self.user_first_name}. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"
        else:
            welcome_msg = "Welcome to MindEase. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"
        
        self._display_response(welcome_msg)
    
    def _process_message(self, user_input: str, test_context: str = None, emotions_override: List[tuple] = None) -> str:
        """Process user message through pipeline (silent).
        emotions_override: optional list of (emotion, score) from e.g. audio SER; when set, skip text-based emotion detection."""
        try:
            effective_test_context = self.test_context if self.test_context else test_context

            # Urdu text chat: Qwen-only Roman Urdu (no Qalb, no transliteration)
            if _is_urdu_lang(self.lang_pref):
                self._ensure_urdu_system_prompt()
                import concurrent.futures as _cf
                import time as _time
                import sys as _sys

                def _ulog(msg):
                    print(msg, file=_sys.stderr, flush=True)

                from chatbot.urdu_chat_pipeline import run_urdu_pipeline
                from chatbot.urdu_emotion_detector import detect_emotions_urdu, format_emotions_for_llm as _fmt_emo

                history = self.memory.get_history_with_context()
                while history and history[-1].get("role") == "user":
                    history.pop()

                t0 = _time.perf_counter()

                # 1) Emotion detection first (local XLM-R, ~200ms once warm)
                t_emo_start = _time.perf_counter()
                if emotions_override is not None and len(emotions_override) > 0:
                    emotions = emotions_override
                else:
                    emotions = detect_emotions_urdu(text=user_input, top_k=2, threshold=0.3)
                emo_s = _time.perf_counter() - t_emo_start

                # 2) LLM call with emotion injected into system prompt
                t_llm_start = _time.perf_counter()
                response = run_urdu_pipeline(
                    roman_user_input=user_input,
                    conversation_history_roman=history,
                    test_context=effective_test_context,
                    user_first_name=self.user_first_name,
                    detected_emotions=emotions,
                )
                llm_s = _time.perf_counter() - t_llm_start

                total_s = _time.perf_counter() - t0
                _ulog("[urdu-chat-timing] ─────────────────────────────")
                _ulog(f"[urdu-chat-timing]  emotion_inference : {emo_s:.3f}s")
                _ulog(f"[urdu-chat-timing]  llm_call          : {llm_s:.3f}s")
                _ulog(f"[urdu-chat-timing]  total             : {total_s:.3f}s")
                _ulog(f"[urdu-chat-timing]  {_fmt_emo(emotions)}")
                _ulog("[urdu-chat-timing] ─────────────────────────────")

                self.last_emotions = emotions
                self.memory.add_exchange(user_input, response)
                return response

            # English pipeline — run emotion + RAG in parallel, time each step
            import concurrent.futures as _cf
            import time as _time
            import sys as _sys

            def _log(msg):
                print(msg, file=_sys.stderr, flush=True)

            t0 = _time.perf_counter()

            def _emotions_task():
                if emotions_override is not None and len(emotions_override) > 0:
                    return emotions_override
                if self.emotion_detector is not None:
                    return self.emotion_detector.detect_emotions(user_input, top_k=2, threshold=0.3)
                return None

            # Skip RAG for very short messages / greetings (low signal, high cost)
            _words = user_input.strip().split()
            _greeting_re = ("hi", "hello", "hey", "yo", "sup", "hola", "salaam", "assalam")
            _skip_rag = (
                len(_words) < 4
                or user_input.strip().lower().startswith(_greeting_re)
            )

            def _rag_task():
                if _skip_rag or self.rag_system is None:
                    return None
                # top_k=2 keeps context tight; drop threshold a bit since we take fewer
                return self.rag_system.retrieve_context(query=user_input, top_k=1, similarity_threshold=0.65)

            with _cf.ThreadPoolExecutor(max_workers=2) as _ex:
                t_em_start = _time.perf_counter()
                _fut_emo = _ex.submit(_emotions_task)
                _fut_rag = _ex.submit(_rag_task)
                emotions = _fut_emo.result()
                t_em_done = _time.perf_counter()
                contexts = _fut_rag.result()
                t_rag_done = _time.perf_counter()
            _log(f"[chat-timing] emotion_detection: {(t_em_done - t_em_start):.3f}s")
            _log(f"[chat-timing] rag_retrieval:    {(t_rag_done - t_em_start):.3f}s (parallel with emotion){' [SKIPPED]' if _skip_rag else ''}")

            if emotions:
                emotions_str = (self.emotion_detector.format_emotions_for_llm(emotions)
                                if self.emotion_detector
                                else "Detected emotions: " + ", ".join(f"{e} ({p:.2f})" for e, p in emotions))
            else:
                emotions_str = ""
            context_str = self.rag_system.format_context_for_llm(contexts) if (contexts and self.rag_system) else ""
            import sys as __sys
            print("[RAG context] ==================== START ====================", file=__sys.stderr, flush=True)
            print(context_str if context_str else "(no RAG context retrieved)", file=__sys.stderr, flush=True)
            print(f"[RAG context] length: {len(context_str)} chars", file=__sys.stderr, flush=True)
            print("[RAG context] ===================== END =====================", file=__sys.stderr, flush=True)

            # Stash for caller so view doesn't re-run detection
            self.last_emotions = emotions

            # Step 3: Generate LLM Response
            conversation_history = self.memory.get_history_with_context()
            if effective_test_context:
                context_str = f"{effective_test_context}\n\n{context_str}" if context_str else effective_test_context

            t_llm_start = _time.perf_counter()
            response = self.llm_client.generate_response(
                user_message=user_input,
                emotions=emotions_str,
                context=context_str,
                conversation_history=conversation_history,
                user_first_name=self.user_first_name,
                test_context=effective_test_context
            )
            t_llm_done = _time.perf_counter()
            _log(f"[chat-timing] llm_call:         {(t_llm_done - t_llm_start):.3f}s")
            _log(f"[chat-timing] TOTAL:            {(t_llm_done - t0):.3f}s")

            # Update memory
            self.memory.add_exchange(user_input, response)

            return response

        except Exception as e:
            import traceback, sys as _sys
            print(f"[chat ERROR] _process_message raised: {type(e).__name__}: {e}",
                  file=_sys.stderr, flush=True)
            traceback.print_exc(file=_sys.stderr)
            return f"I apologize, but I'm having trouble processing that right now. Could you try rephrasing your message?"

    def _process_message_stream(self, user_input: str, test_context: str = None, emotions_override: List[tuple] = None):
        """
        Process user message through pipeline and stream LLM response chunks.
        emotions_override: optional list of (emotion, score) from e.g. audio SER; when set, skip text-based emotion detection.
        """
        try:
            effective_test_context = self.test_context if self.test_context else test_context

            # Urdu: Qwen-only Roman Urdu (yields full response as single chunk)
            if _is_urdu_lang(self.lang_pref):
                self._ensure_urdu_system_prompt()
                import concurrent.futures as _cf
                from chatbot.urdu_chat_pipeline import run_urdu_pipeline
                from chatbot.urdu_emotion_detector import detect_emotions_urdu

                history = self.memory.get_history_with_context()
                while history and history[-1].get("role") == "user":
                    history.pop()

                def _emo_task():
                    if emotions_override is not None and len(emotions_override) > 0:
                        return emotions_override
                    return detect_emotions_urdu(text=user_input, top_k=2, threshold=0.3)

                with _cf.ThreadPoolExecutor(max_workers=2) as ex:
                    fut_emo = ex.submit(_emo_task)
                    fut_chat = ex.submit(
                        run_urdu_pipeline,
                        roman_user_input=user_input,
                        conversation_history_roman=history,
                        test_context=effective_test_context,
                        user_first_name=self.user_first_name,
                    )
                    self.last_emotions = fut_emo.result()
                    response = fut_chat.result()

                yield response
                return

            # English pipeline — run emotion detection + RAG retrieval in parallel
            import concurrent.futures as _cf
            import time as _time
            import sys as _sys

            def _slog(msg):
                print(msg, file=_sys.stderr, flush=True)

            t0s = _time.perf_counter()

            def _emotions_task():
                if emotions_override is not None and len(emotions_override) > 0:
                    return emotions_override
                if self.emotion_detector is not None:
                    return self.emotion_detector.detect_emotions(user_input, top_k=2, threshold=0.3)
                return None

            def _rag_task():
                if self.rag_system is not None:
                    return self.rag_system.retrieve_context(query=user_input, top_k=1, similarity_threshold=0.65)
                return None

            with _cf.ThreadPoolExecutor(max_workers=2) as _ex:
                _fut_emo = _ex.submit(_emotions_task)
                _fut_rag = _ex.submit(_rag_task)
                emotions = _fut_emo.result()
                t_em_done = _time.perf_counter()
                contexts = _fut_rag.result()
                t_rag_done = _time.perf_counter()
            _slog(f"[chat-timing stream] emotion_detection: {(t_em_done - t0s):.3f}s")
            _slog(f"[chat-timing stream] rag_retrieval:    {(t_rag_done - t0s):.3f}s (parallel)")

            if emotions:
                emotions_str = (self.emotion_detector.format_emotions_for_llm(emotions)
                                if self.emotion_detector
                                else "Detected emotions: " + ", ".join(f"{e} ({p:.2f})" for e, p in emotions))
            else:
                emotions_str = ""
            context_str = self.rag_system.format_context_for_llm(contexts) if (contexts and self.rag_system) else ""
            import sys as __sys
            print("[RAG context] ==================== START ====================", file=__sys.stderr, flush=True)
            print(context_str if context_str else "(no RAG context retrieved)", file=__sys.stderr, flush=True)
            print(f"[RAG context] length: {len(context_str)} chars", file=__sys.stderr, flush=True)
            print("[RAG context] ===================== END =====================", file=__sys.stderr, flush=True)
            self.last_emotions = emotions
            conversation_history = self.memory.get_history_with_context()
            if effective_test_context:
                context_str = f"{effective_test_context}\n\n{context_str}" if context_str else effective_test_context
            t_llm_start = _time.perf_counter()
            t_first_chunk = None
            for chunk in self.llm_client.generate_response_stream(
                user_message=user_input,
                emotions=emotions_str,
                context=context_str,
                conversation_history=conversation_history,
                user_first_name=self.user_first_name,
                test_context=effective_test_context,
            ):
                if t_first_chunk is None:
                    t_first_chunk = _time.perf_counter()
                    _slog(f"[chat-timing stream] llm_ttft:         {(t_first_chunk - t_llm_start):.3f}s (time to first token)")
                yield chunk
            t_llm_done = _time.perf_counter()
            _slog(f"[chat-timing stream] llm_total:        {(t_llm_done - t_llm_start):.3f}s")
            _slog(f"[chat-timing stream] TOTAL:            {(t_llm_done - t0s):.3f}s")
        except Exception as e:
            yield f"I apologize, but I'm having trouble processing that right now. Could you try rephrasing your message?"

    def _get_user_input(self) -> str:
        """Get user input with formatted prompt"""
        user_input = input(f"{'👤 You':<20} │ ").strip()
        return user_input
    
    def _display_response(self, response: str):
        """Display therapist response with clean formatting"""
        # Split response into paragraphs
        paragraphs = [p.strip() for p in response.split('\n\n') if p.strip()]
        
        # Print first paragraph with therapist label
        if paragraphs:
            first_para = paragraphs[0]
            # Wrap long lines
            wrapped_lines = self._wrap_text(first_para, width=55)
            
            # First line with therapist label
            print(f"{'🧑‍⚕️ Therapist':<20} │ {wrapped_lines[0]}")
            
            # Remaining lines of first paragraph (indented)
            for line in wrapped_lines[1:]:
                print(f"{'':<20} │ {line}")
            
            # Additional paragraphs (indented, no label)
            for para in paragraphs[1:]:
                print(f"{'':<20} │")  # Blank line between paragraphs
                wrapped_lines = self._wrap_text(para, width=55)
                for line in wrapped_lines:
                    print(f"{'':<20} │ {line}")
    
    def _wrap_text(self, text: str, width: int = 55) -> list:
        """Wrap text to specified width, respecting word boundaries"""
        words = text.split()
        lines = []
        current_line = []
        current_length = 0
        
        for word in words:
            word_length = len(word)
            # Check if adding this word would exceed width
            if current_length + word_length + (1 if current_line else 0) > width:
                if current_line:
                    lines.append(' '.join(current_line))
                    current_line = []
                    current_length = 0
            current_line.append(word)
            current_length += word_length + (1 if len(current_line) > 1 else 0)
        
        if current_line:
            lines.append(' '.join(current_line))
        
        return lines
    
    def _print_help(self):
        """Print help message"""
        help_text = """Available Commands:
  • 'quit', 'exit', 'bye' - End the conversation
  • 'clear' - Clear conversation history
  • 'help' - Show this help message

I'm here to listen and support you. Feel free to share what's on your mind."""
        
        self._display_response(help_text)
    
    def run(self):
        """Run the clean chat interface"""
        # Clear screen for clean start
        os.system('cls' if os.name == 'nt' else 'clear')
        
        # Print header
        print("\n" + "═" * 75)
        print(" " * 22 + "MindEase Therapy Chatbot")
        print("═" * 75)
        print()
        
        # Print welcome message from therapist (this appears first)
        self._print_separator("─", 75)
        self._print_welcome()
        self._print_separator("─", 75)
        
        # Main chat loop
        while True:
            try:
                # Get user input
                print()
                user_input = self._get_user_input()
                
                # Handle empty input
                if not user_input:
                    continue
                
                # Handle commands
                user_input_lower = user_input.lower().strip()
                
                if user_input_lower in ['quit', 'exit', 'bye', 'goodbye']:
                    # Generate context-aware goodbye message
                    print()
                    self._print_separator("─", 75)
                    
                    if self.llm_client and self.llm_client.model_name:
                        try:
                            # Get conversation history for context-aware goodbye
                            history = self.memory.get_history()
                            if history:
                                # Generate context-aware farewell
                                goodbye_prompt = "Based on our conversation, please provide a warm, empathetic, and contextually appropriate goodbye message. Acknowledge what we discussed and offer encouragement. Keep it brief (2-3 sentences). Be specific about what we talked about if relevant."
                                
                                farewell = self.llm_client.generate_response(
                                    user_message=goodbye_prompt,
                                    emotions="",
                                    context="",
                                    conversation_history=history  # Pass history for context
                                )
                            else:
                                farewell = "Thank you for sharing with me today. Take care of yourself, and remember that it's okay to reach out whenever you need support. 💙"
                        except Exception as e:
                            # Fall back to default farewell
                            farewell = "Thank you for sharing with me today. Take care of yourself, and remember that it's okay to reach out whenever you need support. 💙"
                    else:
                        farewell = "Thank you for sharing with me today. Take care of yourself, and remember that it's okay to reach out whenever you need support. 💙"
                    
                    self._display_response(farewell)
                    self._print_separator("─", 75)
                    print("\n" + "═" * 75)
                    
                    # Show conversation summary (LLM-generated)
                    print(self.memory.get_conversation_summary(llm_client=self.llm_client, user_first_name=self.user_first_name))
                    break
                
                if user_input_lower == 'clear':
                    self.memory.clear()
                    print(f"{'':<20} │ [Conversation history cleared]")
                    continue
                
                if user_input_lower == 'help':
                    print()
                    self._print_help()
                    print()
                    continue
                
                # Process message
                response = self._process_message(user_input)
                
                # Display response
                print()
                self._display_response(response)
                print()
                self._print_separator("─", 75)
                
            except KeyboardInterrupt:
                print("\n\n" + "─" * 75)
                print(f"{'':<20} │ Session interrupted. Take care! 💙")
                print("─" * 75)
                
                # Show conversation summary (LLM-generated)
                print(self.memory.get_conversation_summary(llm_client=self.llm_client))
                break
            except Exception as e:
                print(f"\n{'':<20} │ [Error: {str(e)}]")
                print(f"{'':<20} │ Please try again or type 'help' for assistance.\n")


def main():
    """Main entry point"""
    try:
        chat = MindEaseChat()
        chat.run()
    except KeyboardInterrupt:
        print("\n\nGoodbye! Take care. 💙\n")
        sys.exit(0)
    except Exception as e:
        print(f"\nFatal error: {e}")
        print("Please check your setup and try again.")
        sys.exit(1)


if __name__ == "__main__":
    main()

