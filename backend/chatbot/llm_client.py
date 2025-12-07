"""
LLM Client for Ollama Integration
Uses Llama 3.1 8B Instruct via Ollama API
"""
import ollama
from typing import Optional, List, Dict

class LLMClient:
    """Client for interacting with Ollama LLM"""
    
    def __init__(self, model_name: str = None):
        """
        Initialize LLM client
        
        Args:
            model_name: Name of Ollama model to use. If None, will auto-detect available llama3.1 model.
        """
        self.model_name = model_name
        self._find_and_set_model()
    
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
        
        # Generate response
        if not self.model_name:
            return "Error: No LLM model available. Please ensure Ollama is running and a model is downloaded.\n  ollama pull llama3.1:8b-instruct"
        
        try:
            response = ollama.chat(
                model=self.model_name,
                messages=messages,
                options={
                    "temperature": 0.7,  # Balanced creativity
                    "top_p": 0.9,
                    "top_k": 40,
                }
            )
            
            if 'message' in response and 'content' in response['message']:
                return response['message']['content']
            else:
                return f"Unexpected response format: {response}"
        
        except Exception as e:
            error_msg = str(e)
            
            # Check for specific error types
            if "not found" in error_msg.lower() or "404" in error_msg:
                available_models = []
                try:
                    models_response = ollama.list()
                    # ListResponse object has 'models' attribute
                    if hasattr(models_response, 'models'):
                        model_list = models_response.models
                    elif isinstance(models_response, dict) and 'models' in models_response:
                        model_list = models_response['models']
                    elif isinstance(models_response, list):
                        model_list = models_response
                    else:
                        model_list = []
                    
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
                        
                        if name:
                            available_models.append(name)
                except:
                    pass
                
                msg = f"Error: Model '{self.model_name}' not found.\n"
                if available_models:
                    msg += f"Available models: {', '.join(available_models)}\n"
                    msg += f"Please download the model: ollama pull {self.model_name}\n"
                    msg += f"Or use an available model by updating LLMClient."
                else:
                    msg += "Please ensure Ollama is running: ollama serve\n"
                    msg += f"Then download the model: ollama pull {self.model_name}"
                return msg
            elif "connection" in error_msg.lower() or "refused" in error_msg.lower():
                return f"Error: Cannot connect to Ollama service.\nPlease ensure Ollama is running: ollama serve"
            else:
                return f"Error generating response: {error_msg}\n\nPlease ensure Ollama is running: ollama serve"


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
