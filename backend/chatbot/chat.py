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


class MindEaseChat:
    """Clean chat interface for MindEase therapy chatbot"""
    
    def __init__(self, user_first_name: str = None):
        """
        Initialize chatbot with all components (silent initialization)
        
        Args:
            user_first_name: User's first name for personalized responses
        """
        self.user_first_name = user_first_name
        self._initialize_components()
        self.memory = ConversationMemory(max_history_length=20)
        
    def _initialize_components(self):
        """Initialize all components silently"""
        try:
            # Initialize components (suppress output)
            import io
            import contextlib
            
            # Redirect stdout temporarily
            f = io.StringIO()
            with contextlib.redirect_stdout(f):
                self.emotion_detector = EmotionDetector()
                self.rag_system = RAGSystem(db_config=DB_CONFIG)
                self.llm_client = LLMClient()
        except Exception as e:
            print(f"Error initializing chatbot: {e}")
            sys.exit(1)
    
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
    
    def _process_message(self, user_input: str) -> str:
        """Process user message through pipeline (silent)"""
        try:
            # Step 1: Emotion Detection
            emotions = self.emotion_detector.detect_emotions(
                user_input, 
                top_k=2, 
                threshold=0.3
            )
            emotions_str = self.emotion_detector.format_emotions_for_llm(emotions) if emotions else ""
            
            # Step 2: RAG Retrieval
            contexts = self.rag_system.retrieve_context(
                query=user_input,
                top_k=3,
                similarity_threshold=0.5
            )
            context_str = self.rag_system.format_context_for_llm(contexts) if contexts else ""
            
            # Step 3: Generate LLM Response
            conversation_history = self.memory.get_history_with_context()
            
            response = self.llm_client.generate_response(
                user_message=user_input,
                emotions=emotions_str,
                context=context_str,
                conversation_history=conversation_history,
                user_first_name=self.user_first_name
            )
            
            # Update memory
            self.memory.add_exchange(user_input, response)
            
            return response
            
        except Exception as e:
            return f"I apologize, but I'm having trouble processing that right now. Could you try rephrasing your message?"
    
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

