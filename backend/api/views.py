import json
import random
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt

from api.models import EmailVerification, Message, Session, User
from api.services.session_service import SessionService
from chatbot.conversation_memory import ConversationMemory
from chatbot.llm_client import LLMClient

# Legacy in-memory caches removed; persistence handled by SessionService.


def _resolve_session_for_user(user_id, identifier):
    """
    Resolve a session for the given user. Accepts either UUID strings or integer IDs.
    Raises ValueError for invalid identifiers and Session.DoesNotExist when not found.
    """
    if identifier is None:
        raise ValueError("invalid_session_identifier")

    session_qs = Session.objects.filter(user_id=user_id)

    try:
        session_uuid = uuid.UUID(str(identifier))
    except (ValueError, TypeError):
        try:
            session_id_int = int(identifier)
        except (ValueError, TypeError):
            raise ValueError("invalid_session_identifier") from None
        return session_qs.get(session_id=session_id_int)

    return session_qs.get(session_uuid=session_uuid)


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
            city = data.get("city")
            nearest_major_city = data.get("nearest_major_city")
            if lang_pref == "en":
                lang_pref = "english"
            elif lang_pref == "ur":
                lang_pref = "urdu"

            # Check for missing fields
            if not all([first_name, last_name, email, password, dob, gender, lang_pref, city, nearest_major_city]):
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

            nearest_major_city_clean = nearest_major_city.strip() if nearest_major_city else ""
            if not nearest_major_city_clean:
                return JsonResponse({"error": "Nearest major city is required."}, status=400)

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
                city=city.strip() if city else None,
                nearest_major_city=nearest_major_city_clean,
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
                "lang_pref": user.lang_pref,  # ✅ consistent field name
                "city": user.city or "",
                "nearest_major_city": user.nearest_major_city or "",
                "dashboard_tour_seen": user.dashboard_tour_seen,
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

            session_count = SessionService.get_session_count(user_id)

            return JsonResponse({
                "session_count": session_count,
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
            session_identifier = data.get("session_id")  # UUID hex if updating

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            if not conversation_history:
                return JsonResponse({"error": "Conversation history is required."}, status=400)

            llm_client = LLMClient()
            user_first_name = data.get("user_first_name")
            user_gender = data.get("user_gender")
            title = _generate_session_title(conversation_history, llm_client, user_first_name)
            short_summary = _generate_short_summary(conversation_history, llm_client, user_first_name, user_gender)

            messages_payload = []
            for index, msg in enumerate(conversation_history):
                payload = {
                    "role": msg.get("role"),
                    "sender": msg.get("role"),
                    "content": msg.get("content"),
                    "content_type": msg.get("content_type") or "text",
                    "emotion_label": msg.get("emotion_label"),
                    "emotion_score": msg.get("emotion_score"),
                    "metadata": msg.get("metadata", {}),
                    "sequence": msg.get("sequence", index),
                }
                messages_payload.append(payload)

            if session_identifier:
                try:
                    session = _resolve_session_for_user(user_id, session_identifier)
                except ValueError:
                    return JsonResponse({"error": "Invalid session identifier."}, status=400)
                except Session.DoesNotExist:
                    return JsonResponse({"error": "Session not found."}, status=404)

                result = SessionService.update_session(
                    session=session,
                    messages=messages_payload,
                    short_summary=short_summary,
                    full_summary=summary,
                    ended_at=timezone.now(),
                )
            else:
                result = SessionService.create_session(
                    user_id=user_id,
                    title=title,
                    messages=messages_payload,
                    short_summary=short_summary,
                    full_summary=summary,
                    ended_at=timezone.now(),
                )

            session = result.session

            response_payload = {
                "session_id": session.session_uuid.hex,
                "title": session.title or "Therapy Session",
                "messages": conversation_history,
                "summary": session.full_summary or "",
                "short_summary": session.short_summary or session.full_summary or "",
                "resume_message": session.resume_message or "",
                "state": session.state,
                "is_starred": session.is_starred,
                "created_at": session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                "updated_at": session.updated_at.isoformat() if session.updated_at else session.ended_at.isoformat() if session.ended_at else session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
            }

            return JsonResponse({
                "session": response_payload,
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
            limit = data.get("limit")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            sessions = SessionService.get_recent_sessions(user_id, limit)

            sessions_list = [
                {
                    "session_id": session.session_uuid.hex,
                    "title": session.title or "Therapy Session",
                    "summary": session.full_summary or "",
                    "short_summary": session.short_summary or session.full_summary or "",
                    "created_at": session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                    "updated_at": session.updated_at.isoformat() if session.updated_at else session.ended_at.isoformat() if session.ended_at else session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                    "state": session.state,
                    "is_starred": session.is_starred,
                    "has_full_transcript": session.state == Session.SessionState.FULL,
                }
                for session in sessions
            ]

            total = Session.objects.filter(user_id=user_id).count()

            return JsonResponse({
                "sessions": sessions_list,
                "total": total,
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
            session_identifier = data.get("session_id")

            if not user_id or not session_identifier:
                return JsonResponse({"error": "User ID and Session ID are required."}, status=400)

            try:
                session = _resolve_session_for_user(user_id, session_identifier)
            except ValueError:
                return JsonResponse({"error": "Invalid session identifier."}, status=400)
            except Session.DoesNotExist:
                return JsonResponse({"error": "Session not found."}, status=404)

            payload = {
                "session_id": session.session_uuid.hex,
                "title": session.title or "Therapy Session",
                "summary": session.full_summary or "",
                "short_summary": session.short_summary or session.full_summary or "",
                "resume_message": session.resume_message or "",
                "state": session.state,
                "is_starred": session.is_starred,
                "created_at": session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                "updated_at": session.updated_at.isoformat() if session.updated_at else session.ended_at.isoformat() if session.ended_at else session.created_at.isoformat() if session.created_at else session.started_at.isoformat(),
                "messages": [],
                "resume_context": session.continuation_context or {},
                "has_full_transcript": session.state == Session.SessionState.FULL,
            }

            if session.state == Session.SessionState.FULL:
                messages = session.messages.order_by('sequence', 'message_id')
                payload["messages"] = [
                    {
                        "role": msg.metadata.get('role') or ('assistant' if msg.sender == Message.Sender.AI else 'user'),
                        "sender": msg.sender,
                        "content": msg.content,
                        "content_type": msg.content_type,
                        "emotion_label": msg.emotion_label,
                        "emotion_score": msg.emotion_score,
                        "sequence": msg.sequence,
                        "metadata": msg.metadata,
                        "created_at": msg.created_at.isoformat() if msg.created_at else None,
                    }
                    for msg in messages
                ]
            else:
                reminder = session.resume_message or session.short_summary or session.full_summary or "Welcome back! Let's continue whenever you're ready."
                payload["messages"] = [
                    {
                        "role": "assistant",
                        "sender": Message.Sender.AI,
                        "content": reminder,
                        "content_type": Message.ContentType.TEXT,
                        "emotion_label": None,
                        "emotion_score": None,
                        "sequence": None,
                        "metadata": {},
                        "created_at": timezone.now().isoformat(),
                    }
                ]

            return JsonResponse({
                "session": payload,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# TOGGLE SESSION STAR
# -------------------------
@csrf_exempt
def toggle_session_star(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            session_identifier = data.get("session_id")
            star = data.get("star")

            if not user_id or session_identifier is None or star is None:
                return JsonResponse({"error": "User ID, session ID, and star value are required."}, status=400)

            try:
                session = _resolve_session_for_user(user_id, session_identifier)
            except ValueError:
                return JsonResponse({"error": "Invalid session identifier."}, status=400)
            except Session.DoesNotExist:
                return JsonResponse({"error": "Session not found."}, status=404)

            try:
                updated_session = SessionService.set_starred(session, bool(star))
            except ValueError as exc:
                error_code = str(exc)
                message = "Unable to update star status."
                if error_code == "star_limit":
                    message = "You can star up to three sessions at a time. Unstar another session first."
                elif error_code == "archived_session":
                    message = "Archived sessions cannot be starred."
                return JsonResponse({"error": message}, status=400)

            payload = {
                "session_id": updated_session.session_uuid.hex,
                "title": updated_session.title or "Therapy Session",
                "summary": updated_session.full_summary or "",
                "short_summary": updated_session.short_summary or updated_session.full_summary or "",
                "resume_message": updated_session.resume_message or "",
                "state": updated_session.state,
                "is_starred": updated_session.is_starred,
                "has_full_transcript": updated_session.state == Session.SessionState.FULL,
                "created_at": updated_session.created_at.isoformat() if updated_session.created_at else updated_session.started_at.isoformat(),
                "updated_at": updated_session.updated_at.isoformat() if updated_session.updated_at else updated_session.ended_at.isoformat() if updated_session.ended_at else updated_session.created_at.isoformat() if updated_session.created_at else updated_session.started_at.isoformat(),
            }

            return JsonResponse({
                "session": payload,
                "user_id": user_id,
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
                "city": user.city or "",
                "nearest_major_city": user.nearest_major_city or "",
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "dashboard_tour_seen": user.dashboard_tour_seen,
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

            if "city" in data:
                city_value = data.get("city")
                user.city = city_value.strip() if city_value else None
                updated_fields.append("city")

            if "nearest_major_city" in data:
                nearest_value = data.get("nearest_major_city")
                user.nearest_major_city = nearest_value.strip() if nearest_value else None
                updated_fields.append("nearest_major_city")
            
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
                "city": user.city or "",
                "nearest_major_city": user.nearest_major_city or "",
                "dashboard_tour_seen": user.dashboard_tour_seen,
            }, status=200)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# UPDATE DASHBOARD TOUR STATUS
# -------------------------
@csrf_exempt
def update_dashboard_tour(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            seen = data.get("seen")

            if user_id is None or seen is None:
                return JsonResponse({"error": "User ID and seen flag are required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            seen_bool = bool(seen)

            if user.dashboard_tour_seen != seen_bool:
                user.dashboard_tour_seen = seen_bool
                user.updated_at = timezone.now()
                user.save(update_fields=["dashboard_tour_seen", "updated_at"])

            return JsonResponse({
                "dashboard_tour_seen": user.dashboard_tour_seen,
                "user_id": user.user_id,
            }, status=200)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)
