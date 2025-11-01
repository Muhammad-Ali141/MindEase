"""
MindEase Chatbot - Main Entry Point
Complete chatbot pipeline with detailed debugging output

Pipeline Flow:
1. User Input → Emotion Detection
2. Emotion Detection → RAG Retrieval
3. RAG Retrieval → Context Formatting
4. User Input + Emotions + Context → LLM Response
5. Display Response to User
"""
import os
import sys
from typing import List, Dict

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


class MindEaseChatbot:
    """Main chatbot class with detailed debugging"""
    
    def __init__(self, verbose: bool = True):
        """
        Initialize chatbot with all components
        
        Args:
            verbose: If True, show detailed debugging output
        """
        self.verbose = verbose
        
        # Initialize conversation memory
        self.memory = ConversationMemory(
            max_history_length=20,  # 10 exchanges (user + assistant)
            enable_persistent_memory=False  # Set to True to enable disk persistence
        )
        
        print("=" * 80)
        print(" MindEase Therapy Chatbot - Initialization")
        print("=" * 80)
        
        # Step 1: Initialize Emotion Detector
        print("\n[STEP 1/3] Initializing Emotion Detector...")
        print("-" * 80)
        try:
            self.emotion_detector = EmotionDetector()
            print("[OK] Emotion detector loaded successfully")
            if self.verbose:
                print(f"      Model path: {self.emotion_detector.model_path}")
                print(f"      Device: {self.emotion_detector.device}")
        except Exception as e:
            print(f"[FAIL] Error loading emotion detector: {e}")
            raise
        
        # Step 2: Initialize RAG System
        print("\n[STEP 2/3] Initializing RAG System...")
        print("-" * 80)
        try:
            self.rag_system = RAGSystem(db_config=DB_CONFIG)
            print("[OK] RAG system loaded successfully")
            if self.verbose:
                print(f"      Database: {DB_CONFIG['database']}")
                print(f"      Embedding model: sentence-transformers/all-MiniLM-L6-v2")
        except Exception as e:
            print(f"[FAIL] Error loading RAG system: {e}")
            raise
        
        # Step 3: Initialize LLM Client
        print("\n[STEP 3/3] Initializing LLM Client...")
        print("-" * 80)
        try:
            self.llm_client = LLMClient()  # Will auto-detect available model
            if self.llm_client.model_name:
                print(f"[OK] LLM client initialized successfully")
                if self.verbose:
                    print(f"      Model: {self.llm_client.model_name}")
            else:
                print("[WARN] LLM client initialized but no model available")
                print("[INFO] You may need to:")
                print("      1. Start Ollama: ollama serve")
                print("      2. Download model: ollama pull llama3.1:8b-instruct")
                print("[INFO] Chatbot will work but LLM responses will be unavailable")
        except Exception as e:
            print(f"[WARN] LLM client may not be available: {e}")
            print("[INFO] You may need to start Ollama: ollama serve")
            print("[INFO] And download model: ollama pull llama3.1:8b-instruct")
            self.llm_client = None
        
        print("\n" + "=" * 80)
        print("✅ Chatbot Initialization Complete!")
        print("=" * 80)
        print("\nYou can now start chatting. Type 'quit' or 'exit' to end the session.")
        print("Commands: 'clear' to clear memory, 'debug' to toggle verbose mode")
        if self.verbose:
            print("\n[DEBUG MODE] Detailed workflow information will be shown for each message.")
            print("[MEMORY] Conversation memory is active - context will be maintained across messages.\n")
    
    def process_message(self, user_input: str) -> str:
        """
        Process user message through complete pipeline with detailed debugging
        
        Args:
            user_input: User's message
            
        Returns:
            Therapist response
        """
        # Get conversation history from memory
        conversation_history = self.memory.get_history_with_context()
        
        print("\n" + "=" * 80)
        print(" PROCESSING USER MESSAGE")
        print("=" * 80)
        print(f"\n📝 User Input: \"{user_input}\"")
        print("-" * 80)
        
        # STEP 1: Emotion Detection
        print("\n[PIPELINE STEP 1/4] Emotion Detection")
        print("-" * 80)
        try:
            emotions = self.emotion_detector.detect_emotions(
                user_input, 
                top_k=2, 
                threshold=0.3
            )
            
            if emotions:
                print(f"[OK] Detected {len(emotions)} emotion(s):")
                for emotion, probability in emotions:
                    print(f"      • {emotion}: {probability:.3f} ({probability*100:.1f}%)")
            else:
                print("[INFO] No emotions detected above threshold (0.3)")
                emotions = [("neutral", 1.0)]
            
            emotions_str = self.emotion_detector.format_emotions_for_llm(emotions)
            print(f"\n[DEBUG] Formatted emotions string:")
            print(f"      {emotions_str}")
            
        except Exception as e:
            print(f"[FAIL] Error in emotion detection: {e}")
            import traceback
            traceback.print_exc()
            emotions_str = "No emotions detected due to error."
            emotions = []
        
        # STEP 2: RAG Retrieval
        print("\n[PIPELINE STEP 2/4] RAG Context Retrieval")
        print("-" * 80)
        try:
            rag_contexts = self.rag_system.retrieve_context(
                query=user_input,
                top_k=3,
                similarity_threshold=0.5
            )
            
            if rag_contexts:
                print(f"[OK] Retrieved {len(rag_contexts)} relevant context(s):")
                for i, ctx in enumerate(rag_contexts, 1):
                    print(f"\n      Context {i}:")
                    print(f"         • Similarity Score: {ctx['similarity']:.3f}")
                    print(f"         • Question No: {ctx['question_no']}, Chunk: {ctx['chunk_index']}")
                    print(f"         • Input: {ctx['input_chunk'][:100]}...")
                    print(f"         • Output: {ctx['output_chunk'][:100]}...")
            else:
                print("[INFO] No contexts retrieved (similarity below threshold 0.5)")
                print("[INFO] LLM will generate response without RAG context")
            
            context_str = self.rag_system.format_context_for_llm(rag_contexts) if rag_contexts else ""
            
            if self.verbose and context_str:
                print(f"\n[DEBUG] Formatted context string (first 200 chars):")
                print(f"      {context_str[:200]}...")
            
        except Exception as e:
            print(f"[FAIL] Error in RAG retrieval: {e}")
            import traceback
            traceback.print_exc()
            context_str = ""
            rag_contexts = []
        
        # STEP 3: Format for LLM
        print("\n[PIPELINE STEP 3/4] Preparing LLM Input")
        print("-" * 80)
        print(f"[INFO] User message: {len(user_input)} characters")
        print(f"[INFO] Emotions: {len(emotions)} detected")
        print(f"[INFO] RAG contexts: {len(rag_contexts)} retrieved")
        
        if self.verbose:
            print("\n[DEBUG] LLM will receive:")
            if emotions_str:
                print(f"      1. Emotions: {emotions_str}")
            if context_str:
                print(f"      2. RAG Context: {len(context_str)} characters")
            print(f"      3. User Message: \"{user_input}\"")
        
        # STEP 4: Generate LLM Response
        print("\n[PIPELINE STEP 4/4] Generating LLM Response")
        print("-" * 80)
        
        if not self.llm_client or not self.llm_client.model_name:
            print("[ERROR] LLM client or model not available!")
            print("[INFO] Please ensure:")
            print("      1. Ollama is running: ollama serve")
            print("      2. Model is downloaded: ollama pull llama3.1:8b-instruct")
            return "I apologize, but the AI response system is currently unavailable. Please ensure Ollama is running and the model is downloaded."
        
        try:
            if self.verbose:
                print("[INFO] Calling LLM with:")
                print(f"      • Model: {self.llm_client.model_name}")
                print(f"      • Emotions: {'Yes' if emotions_str else 'No'}")
                if emotions_str:
                    print(f"        Emotions string: {emotions_str}")
                print(f"      • Context: {'Yes' if context_str else 'No'}")
                if context_str:
                    print(f"        Context length: {len(context_str)} characters")
                    print(f"        Context preview: {context_str[:200]}...")
                
                # Show conversation history details
                stats = self.memory.get_statistics()
                print(f"      • Conversation history: {stats['total_exchanges']} exchanges, {stats['total_messages']} messages")
                
                # Show memory/context being passed to LLM
                print(f"\n[MEMORY DEBUG] Conversation history being passed to LLM:")
                print(f"      • Total messages in history: {len(conversation_history)}")
                
                # Show recent conversation context
                user_msgs = [msg for msg in conversation_history if msg.get('role') == 'user']
                assistant_msgs = [msg for msg in conversation_history if msg.get('role') == 'assistant']
                
                print(f"      • User messages: {len(user_msgs)}")
                print(f"      • Assistant messages: {len(assistant_msgs)}")
                
                if len(user_msgs) > 0:
                    print(f"      • Last user message: \"{user_msgs[-1].get('content', '')[:80]}...\"")
                if len(assistant_msgs) > 0:
                    print(f"      • Last assistant message: \"{assistant_msgs[-1].get('content', '')[:80]}...\"")
                
                if self.memory.session_summary:
                    print(f"      • Session summary context: {self.memory.session_summary}")
                
                # Show full conversation history preview
                if conversation_history and len(conversation_history) > 1:
                    print(f"\n[CONVERSATION HISTORY PREVIEW]")
                    for i, msg in enumerate(conversation_history[-6:], 1):  # Show last 6 messages
                        role = msg.get('role', 'unknown')
                        content = msg.get('content', '')
                        if role == 'system':
                            print(f"      [{i}] System: {content[:60]}...")
                        elif role == 'user':
                            print(f"      [{i}] User: {content[:60]}...")
                        elif role == 'assistant':
                            print(f"      [{i}] Assistant: {content[:60]}...")
            
            print("[INFO] Generating response... (this may take a few seconds)")
            
            response = self.llm_client.generate_response(
                user_message=user_input,
                emotions=emotions_str,
                context=context_str,
                conversation_history=conversation_history
            )
            
            if response and len(response.strip()) > 0:
                print(f"[OK] Response generated successfully ({len(response)} characters)")
                
                if self.verbose:
                    print(f"\n[DEBUG] Response preview (first 150 chars):")
                    print(f"      {response[:150]}...")
                
                # Save to memory
                self.memory.add_exchange(user_input, response)
                
                return response
            else:
                print("[FAIL] LLM returned empty response")
                error_msg = "I apologize, but I'm having trouble generating a response. Please try again."
                # Still save to memory (even if empty response)
                self.memory.add_exchange(user_input, error_msg)
                return error_msg
                
        except Exception as e:
            print(f"[FAIL] Error generating LLM response: {e}")
            import traceback
            traceback.print_exc()
            
            error_msg = str(e)
            if "not found" in error_msg.lower():
                return "I apologize, but the AI model is not available. Please ensure Ollama is running and the model is downloaded:\n  ollama pull llama3.1:8b-instruct"
            elif "connection" in error_msg.lower():
                return "I apologize, but I cannot connect to the AI service. Please ensure Ollama is running:\n  ollama serve"
            else:
                return f"I apologize, but there was an error generating a response: {error_msg}"
    
    def run_interactive_chat(self):
        """Run interactive terminal chat session"""
        
        print("\n" + "=" * 80)
        print(" CHAT SESSION STARTED")
        print("=" * 80)
        print("\n💬 Start chatting! Type 'quit', 'exit', or 'bye' to end the session.")
        print("   Commands:")
        print("     • 'clear' - Clear conversation memory")
        print("     • 'debug' - Toggle verbose mode")
        print("     • 'memory' - Show conversation statistics\n")
        
        while True:
            try:
                # Get user input
                user_input = input("\n" + "👤 You: ").strip()
                
                # Handle empty input
                if not user_input:
                    continue
                
                # Handle exit commands
                    if user_input.lower() in ['quit', 'exit', 'bye', 'goodbye']:
                        # Generate context-aware goodbye message
                        if chatbot.llm_client and chatbot.llm_client.model_name:
                            try:
                                # Get conversation context for goodbye
                                history = chatbot.memory.get_history()
                                if history:
                                    goodbye_prompt = "Based on our conversation, please provide a warm, empathetic, and contextually appropriate goodbye message. Acknowledge what we discussed and offer encouragement. Keep it brief (2-3 sentences)."
                                    
                                    # Create a temporary message for goodbye
                                    temp_history = history + [
                                        {"role": "user", "content": goodbye_prompt}
                                    ]
                                    
                                    goodbye_msg = chatbot.llm_client.generate_response(
                                        user_message=goodbye_prompt,
                                        emotions="",
                                        context="",
                                        conversation_history=history  # Pass full history for context
                                    )
                                    
                                    print("\n" + "=" * 80)
                                    print(" 🤖 Therapist Farewell")
                                    print("=" * 80)
                                    print(f"\n{goodbye_msg}\n")
                                    print("=" * 80)
                                else:
                                    print("\n" + "=" * 80)
                                    print(" 💙 Thank you for using MindEase. Take care!")
                                    print("=" * 80)
                            except Exception as e:
                                print("\n" + "=" * 80)
                                print(" 💙 Thank you for using MindEase. Take care!")
                                print("=" * 80)
                        else:
                            print("\n" + "=" * 80)
                            print(" 💙 Thank you for using MindEase. Take care!")
                            print("=" * 80)
                        
                        # Show conversation summary
                        print("\n" + chatbot.memory.get_conversation_summary(llm_client=chatbot.llm_client))
                        break
                
                # Handle clear command
                if user_input.lower() == 'clear':
                    self.memory.clear()
                    continue
                
                # Handle memory stats command
                if user_input.lower() == 'memory':
                    stats = self.memory.get_statistics()
                    print("\n[MEMORY STATISTICS]")
                    print(f"   Total Exchanges: {stats['total_exchanges']}")
                    print(f"   Total Messages: {stats['total_messages']}")
                    print(f"   Session Summary: {stats['has_summary']}")
                    if self.memory.session_summary:
                        print(f"   Context: {self.memory.session_summary}")
                    print()
                    continue
                
                # Handle debug toggle
                if user_input.lower() == 'debug':
                    self.verbose = not self.verbose
                    print(f"[INFO] Verbose mode: {'ON' if self.verbose else 'OFF'}")
                    continue
                
                # Process message through pipeline (memory is handled internally)
                response = self.process_message(user_input)
                
                # Display response
                print("\n" + "=" * 80)
                print(" 🤖 Therapist Response")
                print("=" * 80)
                print(f"\n{response}\n")
                print("=" * 80)
                
                # Memory is already updated in process_message via add_exchange
                
            except KeyboardInterrupt:
                print("\n\n[INFO] Interrupted by user. Exiting...")
                # Show summary before exiting
                print("\n" + chatbot.memory.get_conversation_summary(llm_client=chatbot.llm_client))
                break
            except Exception as e:
                print(f"\n[ERROR] Unexpected error: {e}")
                import traceback
                traceback.print_exc()
                print("\n[INFO] Continuing... (type 'quit' to exit)")


def main():
    """Main entry point"""
    print("\n" + "=" * 80)
    print(" " * 20 + "MindEase Therapy Chatbot")
    print(" " * 15 + "Emotion-Aware RAG-Powered Conversational AI")
    print("=" * 80)
    
    try:
        # Initialize chatbot with verbose mode
        chatbot = MindEaseChatbot(verbose=True)
        
        # Run interactive chat
        chatbot.run_interactive_chat()
        
    except KeyboardInterrupt:
        print("\n\n[INFO] Interrupted during initialization. Exiting...")
    except Exception as e:
        print(f"\n[ERROR] Fatal error during initialization: {e}")
        import traceback
        traceback.print_exc()
        print("\n[INFO] Please check:")
        print("      1. PostgreSQL is running and accessible")
        print("      2. Database 'mentalhealthdb' exists and has data")
        print("      3. DeBERTa model is available in 'deberta_best/' directory")
        print("      4. All Python dependencies are installed")


if __name__ == "__main__":
    main()

