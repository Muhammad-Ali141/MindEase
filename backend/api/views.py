from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import User, EmailVerification
import json
import random
from datetime import timedelta

# In-memory session tracking (temporary until DB implementation)
# Dictionary: {user_id: session_count}
SESSION_COUNTS = {}

# In-memory session storage (temporary until DB implementation)
# Dictionary: {user_id: [session1, session2, ...]}
# Each session: {
#   "session_id": str,
#   "title": str,
#   "messages": [ChatMessage],
#   "summary": str,
#   "created_at": str,
#   "updated_at": str
# }
USER_SESSIONS = {}


# -------------------------
# REGISTER USER
# -------------------------
@csrf_exempt
def register(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            # Extract fields from request
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            email = data.get("email")
            password = data.get("password")
            dob = data.get("dob")
            gender = data.get("gender")
            lang_pref = data.get("lang_pref")
            if lang_pref == "en":
                lang_pref = "english"
            elif lang_pref == "ur":
                lang_pref = "urdu"

            # Check for missing fields
            if not all([first_name, last_name, email, password, dob, gender, lang_pref]):
                return JsonResponse({"error": "All fields are required."}, status=400)

            # Normalize email to lowercase for case-insensitive comparison
            email_normalized = email.lower()

            # Check if email already exists (case-insensitive)
            if User.objects.filter(email__iexact=email_normalized).exists():
                return JsonResponse({"error": "User with this email already exists."}, status=400)

            # Check if email is verified
            try:
                verification = EmailVerification.objects.get(user_email=email_normalized, is_verified=True)
            except EmailVerification.DoesNotExist:
                return JsonResponse({"error": "Please verify your email first."}, status=400)

            # Parse and validate DOB
            dob_parsed = parse_date(dob)
            if not dob_parsed:
                return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

            # Create user record
            user = User.objects.create(
                first_name=first_name,
                last_name=last_name,
                email=email_normalized,
                password=make_password(password),
                dob=dob_parsed,
                gender=gender,
                lang_pref=lang_pref,  # ✅ correct field name
            )

            return JsonResponse({
                "message": "User registered successfully!",
                "user_id": user.user_id,
                "email": user.email
            }, status=201)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# SEND OTP
# -------------------------
@csrf_exempt
def send_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")

            if not email:
                return JsonResponse({"error": "Email is required."}, status=400)

            # Normalize email to lowercase
            email_normalized = email.lower()

            # Check if user already exists
            if User.objects.filter(email__iexact=email_normalized).exists():
                return JsonResponse({"error": "User with this email already exists."}, status=400)

            # Generate 6-digit OTP
            otp_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])

            # Delete any existing OTPs for this email
            EmailVerification.objects.filter(user_email=email_normalized, is_verified=False).delete()

            # Create new OTP record
            EmailVerification.objects.create(
                user_email=email_normalized,
                otp_code=otp_code,
                is_verified=False
            )

            # Send email with OTP
            try:
                send_mail(
                    subject='MindEase - Email Verification OTP',
                    message=f'''
Hello!

Thank you for signing up for MindEase.

Your verification code is: {otp_code}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

Stay well,
MindEase Team
                    ''',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email_normalized],
                    fail_silently=False,
                )
            except Exception as email_error:
                # If email fails, still return success for development (comment out in production)
                print(f"Email sending failed: {email_error}")
                # Uncomment below line in production
                # return JsonResponse({"error": "Failed to send email. Please try again."}, status=500)

            return JsonResponse({
                "message": "OTP sent successfully to your email.",
                "email": email_normalized
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# VERIFY OTP
# -------------------------
@csrf_exempt
def verify_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            otp = data.get("otp")

            if not email or not otp:
                return JsonResponse({"error": "Email and OTP are required."}, status=400)

            # Normalize email to lowercase
            email_normalized = email.lower()

            # Find the OTP record
            try:
                verification = EmailVerification.objects.get(
                    user_email=email_normalized,
                    otp_code=otp,
                    is_verified=False
                )
            except EmailVerification.DoesNotExist:
                return JsonResponse({"error": "Invalid OTP code."}, status=400)

            # Check if OTP is expired (5 minutes)
            time_diff = timezone.now() - verification.created_at
            if time_diff > timedelta(minutes=5):
                return JsonResponse({"error": "OTP has expired. Please request a new one."}, status=400)

            # Mark as verified
            verification.is_verified = True
            verification.save()

            return JsonResponse({
                "message": "Email verified successfully!",
                "email": email_normalized
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# CHECK EMAIL EXISTS
# -------------------------
@csrf_exempt
def check_email(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")

            if not email:
                return JsonResponse({"error": "Email is required."}, status=400)

            # Normalize email to lowercase for case-insensitive comparison
            email_normalized = email.lower()

            # Check if email already exists
            email_exists = User.objects.filter(email__iexact=email_normalized).exists()

            return JsonResponse({
                "exists": email_exists,
                "email": email_normalized
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# LOGIN USER
# -------------------------
@csrf_exempt
def login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")

            if not email or not password:
                return JsonResponse({"error": "Email and password are required."}, status=400)

            # Normalize email to lowercase for case-insensitive comparison
            email_normalized = email.lower()

            try:
                user = User.objects.get(email=email_normalized)
            except User.DoesNotExist:
                return JsonResponse({"error": "Invalid email or password."}, status=401)

            if not check_password(password, user.password):
                return JsonResponse({"error": "Invalid email or password."}, status=401)

            return JsonResponse({
                "message": "Login successful.",
                "user_id": user.user_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "gender": user.gender or "Other",
                "lang_pref": user.lang_pref  # ✅ consistent field name
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# CHAT MESSAGE
# -------------------------
@csrf_exempt
def chat_message(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            message = data.get("message")
            user_id = data.get("user_id")
            user_first_name = data.get("user_first_name")
            user_gender = data.get("user_gender")
            conversation_history = data.get("conversation_history", [])

            if not message:
                return JsonResponse({"error": "Message is required."}, status=400)

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Import chatbot (lazy import to avoid circular dependencies)
            import sys
            import os
            chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chatbot')
            if chatbot_dir not in sys.path:
                sys.path.insert(0, chatbot_dir)
            
            from chatbot.chat import MindEaseChat
            
            # Initialize chatbot with user's first name
            # Note: user_gender is not needed for chatbot initialization, only for summaries
            chatbot = MindEaseChat(user_first_name=user_first_name)
            
            # Populate conversation history from frontend
            for msg in conversation_history:
                role = msg.get("role")
                content = msg.get("content")
                if role and content:
                    chatbot.memory.add_message(role, content)
            
            # Process message through chatbot pipeline
            response = chatbot._process_message(message)
            
            # Get updated conversation history (filter out system messages)
            updated_history = [
                msg for msg in chatbot.memory.get_history()
                if msg.get('role') in ['user', 'assistant']
            ]
            
            # Get detected emotions (optional, for debugging)
            emotions = chatbot.emotion_detector.detect_emotions(
                message,
                top_k=2,
                threshold=0.3
            )
            
            # Format emotions for response
            emotions_list = []
            if emotions:
                for emotion, score in emotions:
                    emotions_list.append({
                        "emotion": emotion,
                        "score": float(score)
                    })
            
            return JsonResponse({
                "response": response,
                "emotions": emotions_list,
                "user_id": user_id,
                "conversation_history": updated_history
            }, status=200)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET WELCOME MESSAGE
# -------------------------
@csrf_exempt
def chat_welcome(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_first_name = data.get("user_first_name")
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Generate welcome message
            if user_first_name:
                welcome_msg = f"Welcome to MindEase, {user_first_name}. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"
            else:
                welcome_msg = "Welcome to MindEase. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"

            return JsonResponse({
                "welcome_message": welcome_msg,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET CHAT SUMMARY
# -------------------------
@csrf_exempt
def chat_summary(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            user_first_name = data.get("user_first_name")
            user_gender = data.get("user_gender")
            conversation_history = data.get("conversation_history", [])
            
            # Check if there's actual conversation (more than just welcome message)
            # Filter out welcome messages and check if there are user messages
            user_messages = [
                msg for msg in conversation_history 
                if msg.get("role") == "user"
            ]
            
            if len(user_messages) == 0:
                return JsonResponse({
                    "summary": "No conversation to summarize. The session ended without any messages from the user.",
                    "user_id": user_id
                }, status=200)

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Import chatbot
            import sys
            import os
            chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chatbot')
            if chatbot_dir not in sys.path:
                sys.path.insert(0, chatbot_dir)
            
            from chatbot.conversation_memory import ConversationMemory
            from chatbot.llm_client import LLMClient
            
            # Create memory instance and populate with history
            memory = ConversationMemory(max_history_length=20)
            for msg in conversation_history:
                role = msg.get("role")
                content = msg.get("content")
                if role and content:
                    memory.add_message(role, content)
            
            # Initialize LLM client for summary
            llm_client = LLMClient()
            
            # Generate summary
            summary = memory.get_conversation_summary(
                llm_client=llm_client,
                user_first_name=user_first_name,
                user_gender=user_gender
            )
            
            return JsonResponse({
                "summary": summary,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET SESSION COUNT
# -------------------------
@csrf_exempt
def get_session_count(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Get session count for user (default to 0 if not found)
            session_count = SESSION_COUNTS.get(str(user_id), 0)

            return JsonResponse({
                "session_count": session_count,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# INCREMENT SESSION COUNT
# -------------------------
@csrf_exempt
def increment_session_count(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Increment session count for user
            user_id_str = str(user_id)
            if user_id_str not in SESSION_COUNTS:
                SESSION_COUNTS[user_id_str] = 0
            
            SESSION_COUNTS[user_id_str] += 1

            return JsonResponse({
                "session_count": SESSION_COUNTS[user_id_str],
                "user_id": user_id
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GENERATE SESSION TITLE
# -------------------------
def _generate_session_title(conversation_history, llm_client, user_first_name=None):
    """Generate a concise title for a session based on conversation content"""
    try:
        # Get user messages to understand what the session was about
        user_messages = [
            msg.get("content", "") 
            for msg in conversation_history 
            if msg.get("role") == "user"
        ]
        
        if not user_messages:
            return "New Chat"
        
        # Create prompt for title generation
        conversation_preview = "\n".join(user_messages[:3])  # First 3 user messages
        
        title_prompt = f"""Based on this conversation, generate a concise, descriptive title (maximum 6-8 words) that captures what this therapy session was about.

Conversation preview:
{conversation_preview}

Generate ONLY a short title (no quotes, no explanation, just the title). Examples:
- "Anxiety about upcoming exams"
- "Relationship stress and communication"
- "Work-life balance struggles"
- "Feeling overwhelmed with daily tasks"

Title:"""
        
        title = llm_client.generate_response(
            user_message=title_prompt,
            emotions="",
            context="",
            conversation_history=[],
            system_prompt_override="You are a helpful assistant that generates concise, descriptive titles for therapy sessions. Generate only the title, nothing else."
        ).strip()
        
        # Clean up title (remove quotes, extra spaces)
        title = title.strip('"\'')
        if len(title) > 60:
            title = title[:57] + "..."
        
        return title if title else "Therapy Session"
        
    except Exception as e:
        print(f"Error generating session title: {e}")
        return "Therapy Session"


# -------------------------
# GENERATE SHORT SUMMARY
# -------------------------
def _generate_short_summary(conversation_history, llm_client, user_first_name=None, user_gender=None):
    """Generate a concise 2-3 line summary for session list display"""
    try:
        # Get user messages to understand what was discussed
        user_messages = [
            msg.get("content", "") 
            for msg in conversation_history 
            if msg.get("role") == "user"
        ]
        
        if not user_messages:
            return "No conversation content available."
        
        # Get first few user messages as context
        conversation_preview = "\n".join(user_messages[:5])  # First 5 user messages
        
        # Determine pronouns based on gender
        pronouns = {"he": "he", "him": "him", "his": "his"}
        if user_gender:
            gender_lower = user_gender.lower()
            if gender_lower == "female":
                pronouns = {"he": "she", "him": "her", "his": "her"}
            elif gender_lower == "male":
                pronouns = {"he": "he", "him": "him", "his": "his"}
            else:
                pronouns = {"he": "they", "him": "them", "his": "their"}
        
        user_label = user_first_name if user_first_name else "the user"
        
        short_summary_prompt = f"""Based on this therapy conversation, write a brief 2-3 line summary (maximum 3 sentences) that describes what {user_label} discussed in this session.

IMPORTANT:
- Write in 2-3 sentences only
- Focus on what {user_label} shared (their feelings, concerns, or situation)
- Be specific and factual - only mention what was actually discussed
- Use {pronouns['he']}/{pronouns['him']}/{pronouns['his']} pronouns for {user_label}
- Do NOT include therapist responses or suggestions
- Keep it concise and informative

Conversation preview:
{conversation_preview}

Brief Summary (2-3 lines):"""
        
        short_summary = llm_client.generate_response(
            user_message=short_summary_prompt,
            emotions="",
            context="",
            conversation_history=[],
            system_prompt_override=f"You are summarizing a therapy session. Write a brief 2-3 line summary focusing on what {user_label} discussed. Use {pronouns['he']}/{pronouns['him']}/{pronouns['his']} pronouns. Be factual and concise."
        ).strip()
        
        # Clean up summary (remove quotes, extra spaces)
        short_summary = short_summary.strip('"\'')
        
        # Ensure it's not too long (max 200 characters for 2-3 lines)
        if len(short_summary) > 200:
            # Try to truncate at sentence boundary
            sentences = short_summary.split('. ')
            result = ""
            for sentence in sentences:
                if len(result + sentence + '. ') <= 200:
                    result += sentence + '. '
                else:
                    break
            short_summary = result.strip()
            if not short_summary.endswith('.'):
                short_summary += '.'
        
        return short_summary if short_summary else "Session discussion summary."
        
    except Exception as e:
        print(f"Error generating short summary: {e}")
        return "Session discussion summary."


# -------------------------
# SAVE SESSION
# -------------------------
@csrf_exempt
def save_session(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            conversation_history = data.get("conversation_history", [])
            summary = data.get("summary", "")
            session_id = data.get("session_id")  # If provided, update existing session
            
            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)
            
            if not conversation_history:
                return JsonResponse({"error": "Conversation history is required."}, status=400)
            
            user_id_str = str(user_id)
            
            # Initialize user sessions if not exists
            if user_id_str not in USER_SESSIONS:
                USER_SESSIONS[user_id_str] = []
            
            # Generate title and short summary using LLM
            from chatbot.llm_client import LLMClient
            llm_client = LLMClient()
            user_first_name = data.get("user_first_name")
            user_gender = data.get("user_gender")
            title = _generate_session_title(conversation_history, llm_client, user_first_name)
            short_summary = _generate_short_summary(conversation_history, llm_client, user_first_name, user_gender)
            
            from datetime import datetime
            now = datetime.now().isoformat()
            
            if session_id:
                # Update existing session
                sessions = USER_SESSIONS[user_id_str]
                session_index = next(
                    (i for i, s in enumerate(sessions) if s.get("session_id") == session_id),
                    None
                )
                
                if session_index is not None:
                    # Regenerate short summary for updated session
                    short_summary = _generate_short_summary(conversation_history, llm_client, user_first_name, user_gender)
                    # Update existing session
                    USER_SESSIONS[user_id_str][session_index].update({
                        "messages": conversation_history,
                        "summary": summary,
                        "short_summary": short_summary,
                        "updated_at": now
                    })
                    session = USER_SESSIONS[user_id_str][session_index]
                else:
                    return JsonResponse({"error": "Session not found."}, status=404)
            else:
                # Create new session
                import uuid
                new_session_id = str(uuid.uuid4())
                session = {
                    "session_id": new_session_id,
                    "title": title,
                    "messages": conversation_history,
                    "summary": summary,
                    "short_summary": short_summary,
                    "created_at": now,
                    "updated_at": now
                }
                # Add to beginning of list (most recent first)
                USER_SESSIONS[user_id_str].insert(0, session)
            
            return JsonResponse({
                "session": session,
                "user_id": user_id
            }, status=200)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET RECENT SESSIONS
# -------------------------
@csrf_exempt
def get_recent_sessions(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            limit = data.get("limit", 3)  # Default to 3
            
            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)
            
            user_id_str = str(user_id)
            sessions = USER_SESSIONS.get(user_id_str, [])
            
            # Return limited sessions (most recent first)
            # If limit is 0 or not provided, return all sessions
            if limit and limit > 0:
                recent_sessions = sessions[:limit]
            else:
                recent_sessions = sessions
            
            # Return only essential info (not full messages)
            sessions_list = [
                {
                    "session_id": s.get("session_id"),
                    "title": s.get("title"),
                    "summary": s.get("summary", ""),
                    "short_summary": s.get("short_summary", s.get("summary", "")),  # Fallback to full summary if short_summary doesn't exist
                    "created_at": s.get("created_at"),
                    "updated_at": s.get("updated_at")
                }
                for s in recent_sessions
            ]
            
            return JsonResponse({
                "sessions": sessions_list,
                "total": len(sessions),
                "user_id": user_id
            }, status=200)
            
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET SESSION BY ID
# -------------------------
@csrf_exempt
def get_session_by_id(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            session_id = data.get("session_id")
            
            if not user_id or not session_id:
                return JsonResponse({"error": "User ID and Session ID are required."}, status=400)
            
            user_id_str = str(user_id)
            sessions = USER_SESSIONS.get(user_id_str, [])
            
            session = next(
                (s for s in sessions if s.get("session_id") == session_id),
                None
            )
            
            if not session:
                return JsonResponse({"error": "Session not found."}, status=404)
            
            return JsonResponse({
                "session": session,
                "user_id": user_id
            }, status=200)
            
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# GET USER PROFILE
# -------------------------
@csrf_exempt
def get_user_profile(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            
            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)
            
            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)
            
            # Format language preference
            lang_pref = user.lang_pref or "english"
            if lang_pref.lower() == "english":
                lang_pref = "en"
            elif lang_pref.lower() == "urdu":
                lang_pref = "ur"
            
            return JsonResponse({
                "user_id": user.user_id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name or "",
                "dob": user.dob.isoformat() if user.dob else None,
                "gender": user.gender or "Other",
                "lang_pref": lang_pref,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }, status=200)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# UPDATE USER PROFILE
# -------------------------
@csrf_exempt
def update_user_profile(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            
            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)
            
            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)
            
            # Update fields if provided
            updated_fields = []
            
            if "first_name" in data:
                user.first_name = data.get("first_name")
                updated_fields.append("first_name")
            
            if "last_name" in data:
                user.last_name = data.get("last_name")
                updated_fields.append("last_name")
            
            if "email" in data:
                new_email = data.get("email").lower()
                # Check if email is already taken by another user
                if User.objects.filter(email__iexact=new_email).exclude(user_id=user_id).exists():
                    return JsonResponse({"error": "Email already in use."}, status=400)
                user.email = new_email
                updated_fields.append("email")
            
            if "dob" in data:
                dob_parsed = parse_date(data.get("dob"))
                if not dob_parsed:
                    return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)
                user.dob = dob_parsed
                updated_fields.append("dob")
            
            if "gender" in data:
                user.gender = data.get("gender")
                updated_fields.append("gender")
            
            if "lang_pref" in data:
                lang_pref = data.get("lang_pref")
                if lang_pref == "en":
                    lang_pref = "english"
                elif lang_pref == "ur":
                    lang_pref = "urdu"
                user.lang_pref = lang_pref
                updated_fields.append("lang_pref")
            
            if "password" in data and data.get("password"):
                # Update password if provided
                new_password = data.get("password")
                if len(new_password) < 8:
                    return JsonResponse({"error": "Password must be at least 8 characters."}, status=400)
                user.password = make_password(new_password)
                updated_fields.append("password")
            
            # Update timestamp
            user.updated_at = timezone.now()
            user.save(update_fields=updated_fields + ["updated_at"])
            
            # Format language preference for response
            lang_pref = user.lang_pref or "english"
            if lang_pref.lower() == "english":
                lang_pref = "en"
            elif lang_pref.lower() == "urdu":
                lang_pref = "ur"
            
            return JsonResponse({
                "message": "Profile updated successfully.",
                "user_id": user.user_id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name or "",
                "dob": user.dob.isoformat() if user.dob else None,
                "gender": user.gender or "Other",
                "lang_pref": lang_pref,
            }, status=200)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)
