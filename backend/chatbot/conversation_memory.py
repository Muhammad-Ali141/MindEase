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
    
    def get_conversation_summary(self, llm_client=None) -> str:
        """
        Generate an LLM-powered summary of the entire conversation in paragraph form
        
        Args:
            llm_client: LLMClient instance to generate summary. If None, returns basic summary.
        
        Returns:
            Formatted string with LLM-generated summary paragraph
        """
        if not self.conversation_history:
            return "No conversation history available."
        
        # If LLM client is available, generate AI summary
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
                conversation_text = ""
                for msg in history:
                    role = msg.get('role', '')
                    content = msg.get('content', '')
                    if role == 'user':
                        conversation_text += f"User: {content}\n\n"
                    elif role == 'assistant':
                        conversation_text += f"Therapist: {content}\n\n"
                
                # Create summary prompt
                summary_prompt = f"""Please provide a brief, empathetic summary of this therapy session conversation in paragraph form (2-3 paragraphs).

First paragraph should summarize what the user shared - their situation, feelings, and key concerns.
Second paragraph should describe how the therapist responded and provided support.
Optional third paragraph: Brief reflection on the session.

Write in a warm, understanding tone. Be specific about what was discussed. Write in flowing paragraph form, not as a list or bullet points.

Conversation:
{conversation_text}

Session Summary:"""
                
                # Use a special system prompt for summary generation
                summary_system_prompt = """You are summarizing a therapy session conversation. Write a warm, empathetic summary in paragraph form (2-3 paragraphs). 

Focus on:
1. What the user shared - their situation, feelings, and key concerns
2. How the therapist responded and provided support
3. Brief reflection on the session (optional third paragraph)

Write naturally in flowing paragraph form, not as a list or bullet points. Be specific about what was discussed."""
                
                # Generate summary using LLM with custom system prompt
                try:
                    summary = llm_client.generate_response(
                        user_message=summary_prompt,
                        emotions="",
                        context="",
                        conversation_history=[],  # Empty history, everything is in the prompt
                        system_prompt_override=summary_system_prompt
                    )
                except Exception as e:
                    raise e
                
                # Format the summary nicely
                formatted_summary = self._format_summary(summary)
                return formatted_summary
                
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
        
        summary_lines = []
        summary_lines.append("\n" + "=" * 80)
        summary_lines.append(" CONVERSATION SUMMARY")
        summary_lines.append("=" * 80)
        summary_lines.append("")
        summary_lines.append("This session included your conversation with the therapist.")
        summary_lines.append("All messages have been saved in the conversation history.")
        summary_lines.append("")
        summary_lines.append("=" * 80)
        
        return "\n".join(summary_lines)
    
    def _format_summary(self, summary: str) -> str:
        """Format the LLM-generated summary nicely"""
        summary_lines = []
        summary_lines.append("\n" + "=" * 80)
        summary_lines.append(" SESSION SUMMARY")
        summary_lines.append("=" * 80)
        summary_lines.append("")
        
        # Wrap and format the summary
        wrapped_lines = self._wrap_text(summary.strip(), width=76)
        for line in wrapped_lines:
            summary_lines.append(f"   {line}")
        
        summary_lines.append("")
        summary_lines.append("=" * 80)
        
        return "\n".join(summary_lines)
    
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

