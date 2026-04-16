"""
Conversation Memory Management for MindEase Chatbot
Tracks conversation history and manages context for LLM
"""
from typing import List, Dict, Optional
from collections import deque
import json
import os


class ConversationMemory:
    """Manages conversation history with intelligent memory management"""
    
    def __init__(self, max_history_length: int = 20, enable_persistent_memory: bool = False):
        """
        Initialize conversation memory
        
        Args:
            max_history_length: Maximum number of messages to keep in memory (default: 20 = 10 exchanges)
            enable_persistent_memory: If True, save/load conversation history from disk
        """
        self.max_history_length = max_history_length
        self.enable_persistent_memory = enable_persistent_memory
        self.conversation_history = deque(maxlen=max_history_length)
        self.session_summary = None  # Brief summary of conversation context
        self.user_id = None
        
    def set_user_id(self, user_id: str):
        """Set user ID for session (useful for persistent memory)"""
        self.user_id = user_id
    
    def add_message(self, role: str, content: str):
        """
        Add a message to conversation history
        
        Args:
            role: 'user' or 'assistant'
            content: Message content
        """
        if role not in ['user', 'assistant', 'system']:
            raise ValueError(f"Invalid role: {role}. Must be 'user', 'assistant', or 'system'")
        
        message = {
            "role": role,
            "content": content
        }
        
        self.conversation_history.append(message)
        
        # Update session summary periodically
        if len(self.conversation_history) % 6 == 0:  # Every 3 exchanges
            self._update_session_summary()
    
    def load_history(self, messages: list):
        """Bulk-load prior messages without firing the periodic session summary.

        Use this when replaying conversation history from the client payload at
        the start of a request, so that ``_update_session_summary`` is not
        triggered unnecessarily for already-seen messages.

        Args:
            messages: List of dicts with at least ``role`` and ``content`` keys.
        """
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content")
            if role and content:
                self.conversation_history.append({"role": role, "content": content})

    def add_exchange(self, user_message: str, assistant_response: str):
        """
        Add a complete exchange (user message + assistant response)
        
        Args:
            user_message: User's message
            assistant_response: Assistant's response
        """
        self.add_message("user", user_message)
        self.add_message("assistant", assistant_response)
    
    def get_history(self, max_messages: Optional[int] = None) -> List[Dict[str, str]]:
        """
        Get conversation history
        
        Args:
            max_messages: Maximum number of messages to return (default: all)
            
        Returns:
            List of message dictionaries
        """
        history = list(self.conversation_history)
        
        if max_messages and max_messages < len(history):
            # Return most recent messages
            history = history[-max_messages:]
        
        return history
    
    def get_history_with_context(self) -> List[Dict[str, str]]:
        """
        Get conversation history with session summary as context
        
        Returns:
            List of message dictionaries with system context if available
        """
        messages = []
        
        # Add session summary as context if available
        if self.session_summary:
            context_message = {
                "role": "system",
                "content": f"Session Context: {self.session_summary}"
            }
            messages.append(context_message)
        
        # Add conversation history
        messages.extend(self.get_history())
        
        return messages
    
    def _update_session_summary(self):
        """Update session summary from recent conversation"""
        if len(self.conversation_history) < 2:
            return
        
        # Simple summary: extract key topics from user messages
        user_messages = [
            msg['content'] for msg in self.conversation_history 
            if msg['role'] == 'user'
        ]
        
        if user_messages:
            # Create a simple summary from recent user messages
            recent_messages = user_messages[-5:]  # Last 5 user messages
            topics = []
            
            # Extract key topics (simple keyword extraction)
            therapy_keywords = [
                'anxiety', 'depression', 'stress', 'sad', 'worried', 'anxious',
                'relationship', 'family', 'work', 'sleep', 'feel', 'emotion',
                'therapy', 'counseling', 'help', 'support', 'struggle'
            ]
            
            for msg in recent_messages:
                msg_lower = msg.lower()
                for keyword in therapy_keywords:
                    if keyword in msg_lower and keyword not in topics:
                        topics.append(keyword)
            
            if topics:
                self.session_summary = f"The user has discussed: {', '.join(topics[:5])}"
            else:
                self.session_summary = "User is seeking mental health support."
    
    def clear(self):
        """Clear conversation history"""
        self.conversation_history.clear()
        self.session_summary = None
        print("[INFO] Conversation history cleared.")
    
    def get_summary(self) -> Optional[str]:
        """Get current session summary"""
        return self.session_summary
    
    def save_to_file(self, filepath: str):
        """Save conversation history to file"""
        if not self.enable_persistent_memory:
            return
        
        data = {
            'history': list(self.conversation_history),
            'summary': self.session_summary,
            'user_id': self.user_id
        }
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[WARN] Could not save conversation memory: {e}")
    
    def load_from_file(self, filepath: str):
        """Load conversation history from file"""
        if not os.path.exists(filepath):
            return False
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.conversation_history = deque(data.get('history', []), maxlen=self.max_history_length)
            self.session_summary = data.get('summary')
            self.user_id = data.get('user_id')
            
            return True
        except Exception as e:
            print(f"[WARN] Could not load conversation memory: {e}")
            return False
    
    def get_statistics(self) -> Dict:
        """Get conversation statistics"""
        user_messages = [msg for msg in self.conversation_history if msg['role'] == 'user']
        assistant_messages = [msg for msg in self.conversation_history if msg['role'] == 'assistant']
        
        return {
            'total_exchanges': len(user_messages),
            'total_messages': len(self.conversation_history),
            'user_messages': len(user_messages),
            'assistant_messages': len(assistant_messages),
            'has_summary': self.session_summary is not None
        }
    
    def get_conversation_summary(
        self,
        llm_client=None,
        user_first_name: str = None,
        user_gender: str = None,
        lang_pref: str = None,
    ) -> str:
        """
        Generate an LLM-powered summary of the entire conversation in paragraph form
        
        Args:
            llm_client: LLMClient instance to generate summary. If None, returns basic summary.
        
        Returns:
            Formatted string with LLM-generated summary paragraph
        """
        if not self.conversation_history:
            is_ur = lang_pref and str(lang_pref).lower().strip() in ("ur", "urdu")
            return (
                "Koi guftagu mojood nahi."
                if is_ur
                else "No conversation history available."
            )

        is_urdu = lang_pref and str(lang_pref).lower().strip() in ("ur", "urdu")

        # Roman Urdu summary via Qwen (Urdu profile)
        if is_urdu:
            try:
                from chatbot.urdu_qwen_chat import summarize_session_roman_urdu

                history = [
                    msg for msg in self.conversation_history
                    if msg.get("role") in ("user", "assistant")
                ]
                if not history:
                    return "Koi guftagu khulasi ke liye nahi."
                user_label = user_first_name if user_first_name else "User"
                conversation_text = ""
                for msg in history:
                    role = msg.get("role", "")
                    content = msg.get("content", "")
                    if role == "user":
                        conversation_text += f"{user_label}: {content}\n\n"
                    elif role == "assistant":
                        conversation_text += f"Therapist: {content}\n\n"
                summary = summarize_session_roman_urdu(conversation_text, user_first_name)
                out = self._normalise_summary_text(summary)
                if out.strip():
                    return out
                return self._get_basic_summary_roman_urdu()
            except Exception as e:
                print(f"[WARN] Roman Urdu summary failed: {e}")
                if not (llm_client and hasattr(llm_client, "generate_response")):
                    return self._get_basic_summary_roman_urdu()

        # If LLM client is available, generate AI summary (English)
        if llm_client and hasattr(llm_client, 'generate_response'):
            try:
                # Get conversation history (excluding system messages for summary)
                history = [
                    msg for msg in self.conversation_history 
                    if msg.get('role') in ['user', 'assistant']
                ]
                
                if not history:
                    return "No conversation to summarize."
                
                # Build conversation history text for summary
                user_label = user_first_name if user_first_name else "User"
                conversation_text = ""
                for msg in history:
                    role = msg.get('role', '')
                    content = msg.get('content', '')
                    if role == 'user':
                        conversation_text += f"{user_label}: {content}\n\n"
                    elif role == 'assistant':
                        conversation_text += f"Therapist: {content}\n\n"
                
                # Build a therapist-style clinical note about the client.
                # Third person, structured, grounded only in the transcript.
                user_count = sum(1 for m in history if m.get("role") == "user")
                is_brief = user_count < 3

                if is_brief:
                    summary_prompt = (
                        "Write a short, warm reflection (2 to 4 sentences, plain prose, no "
                        "headings) summarising this brief therapy exchange for the person "
                        "who had the session.\n\n"
                        "Rules:\n"
                        "- Address the person directly as 'you'. Do not use their name.\n"
                        "- Reflect what came up, how they were feeling, and any gentle "
                        "support offered.\n"
                        "- Only use information present in the transcript. No speculation.\n"
                        "- No bullets, no dashes, no separator lines, no markdown.\n"
                        "- Tone: warm, validating, non-clinical.\n\n"
                        f"Transcript:\n{conversation_text}\n\nReflection:"
                    )
                else:
                    summary_prompt = (
                        "Write a warm, journal-style reflection of this therapy session, "
                        "addressed to the person who had the session. Structure it under the "
                        "exact Markdown headings listed, in order. Plain prose under each. "
                        "Omit a heading only if truly nothing to report for it.\n\n"
                        "Required headings:\n"
                        "**What We Talked About**\n"
                        "**How You Were Feeling**\n"
                        "**What Came Up**\n"
                        "**What We Explored Together**\n"
                        "**How You Responded**\n"
                        "**Looking Ahead**\n\n"
                        "Rules:\n"
                        "- Address the reader as 'you' throughout. Do not use their first "
                        "name. Warm, validating, gentle — like a caring therapist writing a "
                        "note back to the person, not a clinical chart.\n"
                        "- Describe what you shared, how you felt, the themes that came up, "
                        "what was explored together, any ideas or coping strategies offered, "
                        "and how you responded to them.\n"
                        "- Only use information present in the transcript. Do not invent "
                        "details, diagnoses, or past sessions.\n"
                        "- Under each heading, write 1 to 3 tight sentences. No bullet lists.\n"
                        "- No horizontal rules, no '---', no em-dash trails, no emojis, no "
                        "quotes around the whole note. Do not prefix with 'Summary:' or "
                        "'Reflection:'.\n"
                        "- Aim for roughly 140 to 260 words total.\n\n"
                        f"Transcript:\n{conversation_text}\n\nReflection:"
                    )

                summary_system_prompt = (
                    "You are a warm, caring therapist writing a short reflection back to the "
                    "person after their session. Use second person ('you'), gentle and "
                    "validating — never clinical or distant, never using the word 'client' "
                    "or 'patient'. Ground every statement in the transcript. Never use "
                    "separator lines or runs of dashes. Never wrap output in quotes. Never "
                    "prefix with labels like 'Note:' or 'Summary:'. Output only the "
                    "reflection itself."
                )

                try:
                    summary = llm_client.generate_response(
                        user_message=summary_prompt,
                        emotions="",
                        context="",
                        conversation_history=[],  # Empty history, everything is in the prompt
                        system_prompt_override=summary_system_prompt,
                    )
                except Exception as e:
                    raise e

                return self._normalise_summary_text(summary)
                
            except Exception as e:
                # Fall back to basic summary if LLM fails
                print(f"[WARN] Could not generate LLM summary: {e}")
                return self._get_basic_summary()
        else:
            # Fall back to basic summary if no LLM client
            return self._get_basic_summary()
    
    def _get_basic_summary(self) -> str:
        """Generate a basic summary without LLM"""
        if not self.conversation_history:
            return "No conversation history available."
        
        return (
            "We had a very brief check-in, and there were no detailed messages to summarise. "
            "Feel free to continue whenever you’re ready."
        )

    def _get_basic_summary_roman_urdu(self) -> str:
        return (
            "Guftagu bohot mukhtasar thi. Jab chahen dobara baat kar sakte hain."
        )
    
    def _format_summary(self, summary: str) -> str:
        """Format the LLM-generated summary nicely"""
        return self._normalise_summary_text(summary)
    
    def _wrap_text(self, text: str, width: int = 76) -> list:
        """Helper method to wrap text"""
        words = text.split()
        lines = []
        current_line = []
        current_length = 0
        
        for word in words:
            word_length = len(word)
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

    def _normalise_summary_text(self, value: str) -> str:
        import re as _re
        if not value:
            return ""
        text = str(value).replace("\r\n", "\n").replace("\r", "\n").strip()
        # Strip wrap quotes
        if len(text) >= 2 and text[0] == text[-1] and text[0] in ('"', "'", "`"):
            text = text[1:-1].strip()
        # Strip leading label prefixes a few times
        prefix_re = _re.compile(
            r"^(therapist'?s?\s+note|session\s+(recap|summary|note)|clinical\s+note|summary|recap|note)\s*[:\-–—]\s*",
            _re.IGNORECASE,
        )
        for _ in range(3):
            new = prefix_re.sub("", text).strip()
            if new == text:
                break
            text = new
        # Drop separator-only lines
        text = _re.sub(r"(?m)^\s*[-*_=~]{3,}\s*$", "", text)
        # Remove inline 3+ dash runs
        text = _re.sub(r"[-–—]{3,}", "", text)
        # Strip markdown bold/italic markers (frontend renders as plain text)
        text = _re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=_re.DOTALL)
        text = _re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"\1", text, flags=_re.DOTALL)
        text = _re.sub(r"(?m)^#{1,6}\s+", "", text)
        # Trim trailing dash/symbol noise on each line
        lines = [
            _re.sub(r"[\s\-–—_*#]+$", "", line).rstrip()
            for line in text.split("\n")
        ]
        text = "\n".join(lines)
        # Collapse excess blank lines
        text = _re.sub(r"\n{3,}", "\n\n", text).strip()
        return "\n\n".join(
            paragraph.strip()
            for paragraph in text.split("\n\n")
            if paragraph.strip()
        )


if __name__ == "__main__":
    # Test conversation memory
    memory = ConversationMemory(max_history_length=20)
    
    memory.add_exchange(
        "I'm feeling anxious about my exam",
        "I understand that exam anxiety can be very challenging. Let's explore some strategies..."
    )
    
    memory.add_exchange(
        "I can't sleep because I'm worried",
        "Sleep difficulties often accompany anxiety. Here are some techniques..."
    )
    
    print("Conversation History:")
    for msg in memory.get_history():
        print(f"  {msg['role']}: {msg['content'][:50]}...")
    
    print(f"\nSession Summary: {memory.get_summary()}")
    print(f"Statistics: {memory.get_statistics()}")

