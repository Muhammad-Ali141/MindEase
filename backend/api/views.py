import json
import random
import threading
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.http import JsonResponse, StreamingHttpResponse, FileResponse, Http404
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from datetime import date
import os

from api.models import EmailVerification, Message, Session, User, Testresult, Therapistdirectory
from api.services.session_service import SessionService
from api.services.diagnostic_test_service import DiagnosticTestService
from chatbot.conversation_memory import ConversationMemory
from chatbot.llm_client import LLMClient

# Legacy in-memory caches removed; persistence handled by SessionService.

# TTS Service cache (singleton pattern for performance)
_tts_service_cache = None
_tts_service_lock = None

def _get_tts_service():
    """Get or create TTS service instance (cached for performance)."""
    global _tts_service_cache, _tts_service_lock
    
    if _tts_service_cache is None:
        import sys
        import os
        import threading
        
        if _tts_service_lock is None:
            _tts_service_lock = threading.Lock()
        
        with _tts_service_lock:
            # Double-check pattern
            if _tts_service_cache is None:
                tts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tts')
                if tts_dir not in sys.path:
                    sys.path.insert(0, tts_dir)
                
                from tts.tts_service import TTSService
                
                _tts_service_cache = TTSService(
                    model_name="tts_models/multilingual/multi-dataset/xtts_v2",
                    device=None,
                    gpu=None,
                )
    
    return _tts_service_cache


# Qwen3-TTS adapter cache (for pipeline experiment when tts_backend=qwen3)
_qwen3_tts_cache = None
_qwen3_tts_lock = None


def _get_qwen3_tts_service():
    """Get or create Qwen3-TTS adapter (cached). Used when tts_backend=qwen3."""
    global _qwen3_tts_cache, _qwen3_tts_lock
    if _qwen3_tts_cache is None:
        if _qwen3_tts_lock is None:
            _qwen3_tts_lock = threading.Lock()
        with _qwen3_tts_lock:
            if _qwen3_tts_cache is None:
                import sys
                tts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tts')
                if tts_dir not in sys.path:
                    sys.path.insert(0, tts_dir)
                from tts.qwen3_tts_adapter import Qwen3TTSAdapter
                _qwen3_tts_cache = Qwen3TTSAdapter(model_size="0.6B")
    return _qwen3_tts_cache


def _sanitize_test_context_key(key):
    """Safe filename fragment from test context key (e.g. result_id)."""
    if key is None:
        return None
    import re
    return re.sub(r"[^a-zA-Z0-9_-]", "_", str(key)).strip("_") or None


def _get_welcome_audio_path(user_id, include_context=False, test_context_key=None):
    """Path to cached welcome audio. With context: keyed by test_context_key so each test result has its own cache."""
    base = getattr(settings, "MEDIA_ROOT", None) or os.path.join(settings.BASE_DIR, "media")
    welcome_dir = os.path.join(base, "welcome_audio")
    os.makedirs(welcome_dir, exist_ok=True)
    if include_context and test_context_key:
        safe_key = _sanitize_test_context_key(test_context_key)
        suffix = f"_with_context_{safe_key}.wav" if safe_key else "_with_context.wav"
    else:
        suffix = "_with_context.wav" if include_context else ".wav"
    return os.path.join(welcome_dir, f"{user_id}{suffix}")


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
                lang_pref=lang_pref,
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
                "primary_condition": user.primary_condition,
                "generic_screening_completed": user.generic_screening_completed,
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
            test_context = data.get("test_context")  # Optional test context
            emotions_from_client = data.get("emotions")  # Optional: from voice SER

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
            
            # Initialize chatbot with user's first name and test context
            chatbot = MindEaseChat(user_first_name=user_first_name, test_context=test_context)
            
            # Populate conversation history from frontend
            for msg in conversation_history:
                role = msg.get("role")
                content = msg.get("content")
                if role and content:
                    chatbot.memory.add_message(role, content)
            
            emotions_override = None
            if emotions_from_client and isinstance(emotions_from_client, list):
                emotions_override = [(e.get("emotion"), float(e.get("score", 0))) for e in emotions_from_client if e.get("emotion")]
                if emotions_override:
                    print("[Voice chat] Using emotions from audio (SER):", emotions_override)
            
            response = chatbot._process_message(message, test_context=test_context, emotions_override=emotions_override)
            
            updated_history = [
                msg for msg in chatbot.memory.get_history()
                if msg.get('role') in ['user', 'assistant']
            ]
            
            if emotions_override:
                emotions = emotions_override
            else:
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
# CHAT MESSAGE (STREAMING)
# -------------------------
@csrf_exempt
def chat_message_stream(request):
    """Stream LLM response as SSE; client can TTS per sentence and play while stream continues."""
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=405)
    try:
        data = json.loads(request.body)
        message = data.get("message")
        user_id = data.get("user_id")
        user_first_name = data.get("user_first_name")
        user_gender = data.get("user_gender")
        conversation_history = data.get("conversation_history", [])
        test_context = data.get("test_context")
        emotions_from_client = data.get("emotions")  # Optional: from audio SER (voice chat)
        if not message:
            return JsonResponse({"error": "Message is required."}, status=400)
        if not user_id:
            return JsonResponse({"error": "User ID is required."}, status=400)
        import sys
        chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chatbot')
        if chatbot_dir not in sys.path:
            sys.path.insert(0, chatbot_dir)
        from chatbot.chat import MindEaseChat
        chatbot = MindEaseChat(user_first_name=user_first_name, test_context=test_context)
        for msg in conversation_history:
            role, content = msg.get("role"), msg.get("content")
            if role and content:
                chatbot.memory.add_message(role, content)
        emotions_override = None
        if emotions_from_client and isinstance(emotions_from_client, list):
            emotions_override = [(e.get("emotion"), float(e.get("score", 0))) for e in emotions_from_client if e.get("emotion")]
            if emotions_override:
                print("[Voice chat stream] Using emotions from audio (SER):", emotions_override)
        full_response = []

        def event_stream():
            for chunk in chatbot._process_message_stream(message, test_context=test_context, emotions_override=emotions_override):
                full_response.append(chunk)
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
            full_text = "".join(full_response)
            chatbot.memory.add_exchange(message, full_text)
            if emotions_override:
                emotions_list = [{"emotion": e, "score": s} for e, s in emotions_override]
            else:
                emotions = chatbot.emotion_detector.detect_emotions(message, top_k=2, threshold=0.3)
                emotions_list = [{"emotion": e, "score": float(s)} for e, s in (emotions or [])]
            yield f"data: {json.dumps({'done': True, 'full_response': full_text, 'emotions': emotions_list})}\n\n"

        return StreamingHttpResponse(
            event_stream(),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# VOICE PROCESS (STT + SER) - get transcript and emotions-from-audio for voice chat
# -------------------------
@csrf_exempt
def voice_process(request):
    """
    Accept audio file; run STT and Speech Emotion Recognition (SER) in parallel.
    Returns { transcript, emotions } so the frontend can use transcript + emotions-from-voice
    when calling the chat stream (emotion from how they said it, not from text).
    """
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=405)
    try:
        if "audio" not in request.FILES:
            return JsonResponse({"error": "Audio file is required."}, status=400)
        audio_file = request.FILES["audio"]
        language = request.POST.get("language", "en")
        import tempfile
        import sys
        import concurrent.futures
        chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chatbot")
        stt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "stt")
        if chatbot_dir not in sys.path:
            sys.path.insert(0, chatbot_dir)
        if stt_dir not in sys.path:
            sys.path.insert(0, stt_dir)
        suffix = os.path.splitext(getattr(audio_file, "name", ""))[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in audio_file.chunks():
                tmp.write(chunk)
            audio_path = tmp.name
        try:
            def run_stt():
                from stt.stt_service import SpeechToTextService
                # Distil-large-v3: ~6x faster than large-v3, within ~1% WER (best speed+accuracy)
                svc = SpeechToTextService(
                    model_id="Systran/faster-distil-whisper-large-v3",
                    device=None,
                    compute_type=None,
                    beam_size=2,
                    temperature=0.0,
                    vad_filter=True,
                )
                return svc.transcribe_file(audio_path, language=language if language != "auto" else None)

            def run_ser():
                try:
                    from chatbot.audio_emotion_detector import AudioEmotionDetector
                    det = AudioEmotionDetector()
                    return det.detect_emotions_from_audio(audio_path, top_k=2, threshold=0.2)
                except Exception as ser_err:
                    import logging
                    logging.getLogger(__name__).warning("SER failed: %s", ser_err)
                    return []

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
                fut_stt = ex.submit(run_stt)
                fut_ser = ex.submit(run_ser)
                transcript = (fut_stt.result() or "").strip()
                try:
                    ser_emotions = fut_ser.result() or []
                except Exception:
                    ser_emotions = []
            emotions_list = [{"emotion": e, "score": float(s)} for e, s in ser_emotions]
            print("[Voice] SER emotions from audio:", emotions_list)
            return JsonResponse({"transcript": transcript, "emotions": emotions_list}, status=200)
        finally:
            try:
                os.unlink(audio_path)
            except Exception:
                pass
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def voice_welcome_audio(request):
    """GET: return cached welcome audio. Query: user_id, include_context, test_context_key (required when include_context true).
     Returns X-Welcome-Message header (base64) when we have stored text so client can show matching text.
     POST: generate TTS, save to cache (and sidecar .json with welcome_message), return audio blob.
     Body: user_id, welcome_message, lang_pref, include_test_context, test_context_key (required when include_test_context true)."""
    from io import BytesIO
    import base64
    if request.method == "GET":
        user_id = request.GET.get("user_id")
        if not user_id:
            return JsonResponse({"error": "user_id required."}, status=400)
        include_context = request.GET.get("include_context", "false").lower() in ("true", "1", "yes")
        test_context_key = request.GET.get("test_context_key") or None
        if include_context and not test_context_key:
            return JsonResponse({"error": "test_context_key required when include_context is true."}, status=400)
        path = _get_welcome_audio_path(user_id, include_context=include_context, test_context_key=test_context_key)
        if not os.path.isfile(path):
            raise Http404("Welcome audio not found")
        with open(path, "rb") as f:
            data = f.read()
        response = FileResponse(BytesIO(data), content_type="audio/wav", as_attachment=False)
        # Attach stored welcome text so client can show text that matches this audio
        sidecar = path.replace(".wav", ".json")
        if os.path.isfile(sidecar):
            try:
                with open(sidecar, "r", encoding="utf-8") as sf:
                    meta = json.load(sf)
                    msg = meta.get("welcome_message")
                    if msg:
                        response["X-Welcome-Message"] = base64.b64encode(msg.encode("utf-8")).decode("ascii")
            except Exception:
                pass
        return response
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            welcome_message = data.get("welcome_message")
            lang_pref = data.get("lang_pref")
            include_test_context = data.get("include_test_context", False)
            test_context_key = data.get("test_context_key") or None
            if not user_id or not welcome_message:
                return JsonResponse({"error": "user_id and welcome_message required."}, status=400)
            if include_test_context and not test_context_key:
                return JsonResponse({"error": "test_context_key required when include_test_context is true."}, status=400)
            language = "ur" if (lang_pref and str(lang_pref).lower() in ("urdu", "ur")) else "en"
            path = _get_welcome_audio_path(user_id, include_context=bool(include_test_context), test_context_key=test_context_key)
            tts_backend_env = (os.environ.get("TTS_BACKEND") or "").strip().lower()
            if tts_backend_env == "qwen3":
                tts_service = _get_qwen3_tts_service()
            else:
                tts_service = _get_tts_service()
            tts_service.synthesize_to_file(text=welcome_message, output_path=path, language=language)
            # Store welcome message so GET can return matching text
            sidecar = path.replace(".wav", ".json")
            with open(sidecar, "w", encoding="utf-8") as sf:
                json.dump({"welcome_message": welcome_message}, sf, ensure_ascii=False)
            with open(path, "rb") as f:
                audio_data = f.read()
            return FileResponse(BytesIO(audio_data), content_type="audio/wav", as_attachment=False)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Method not allowed."}, status=405)


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
            test_context = data.get("test_context")

            if not user_id:
                return JsonResponse({"error": "User ID is required."}, status=400)

            # Generate welcome message with test context if provided
            if test_context:
                # Use LLM to generate personalized welcome message with test context
                import sys
                import os
                chatbot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chatbot')
                if chatbot_dir not in sys.path:
                    sys.path.insert(0, chatbot_dir)
                
                from chatbot.llm_client import LLMClient
                
                llm_client = LLMClient()
                
                system_prompt = f"""You are a compassionate mental health therapist. The user has shared their assessment results with you. 

Test Context:
{test_context}

Write a direct, warm welcome message (NOT a description of what to write, but the actual message itself) that:
1. Greets the user warmly using their name: {user_first_name or 'there'}
2. Briefly acknowledges you've reviewed their assessment results
3. Shows understanding of their current condition
4. Invites them to share what's on their mind

IMPORTANT: Write the actual welcome message directly. Do NOT include phrases like "Here is", "Here's a", "I'll write", or any meta-commentary. Just write the message as if you're speaking directly to the user.

Keep it concise (2-3 sentences) and natural. Start directly with the greeting."""
                
                welcome_msg = llm_client.generate_response(
                    user_message="Hello, I'm ready to chat.",
                    system_prompt_override=system_prompt,
                    user_first_name=user_first_name
                )
                
                # Clean up any meta-commentary that might have slipped through
                welcome_msg = welcome_msg.strip()
                # Remove common meta-phrases
                meta_phrases = [
                    "Here is a warm message for the user:",
                    "Here's a warm message for the user:",
                    "Here is a warm message:",
                    "Here's a warm message:",
                    "Here is warm message for user:",
                    "Here's warm message for user:",
                    "Here is warm message:",
                    "Here's warm message:",
                    "Here is the welcome message:",
                    "Here's the welcome message:",
                ]
                for phrase in meta_phrases:
                    if welcome_msg.lower().startswith(phrase.lower()):
                        welcome_msg = welcome_msg[len(phrase):].strip()
                        # Remove quotes if present
                        if welcome_msg.startswith('"') and welcome_msg.endswith('"'):
                            welcome_msg = welcome_msg[1:-1].strip()
                        if welcome_msg.startswith("'") and welcome_msg.endswith("'"):
                            welcome_msg = welcome_msg[1:-1].strip()
                        break
            else:
                # Standard welcome message
                if user_first_name:
                    welcome_msg = f"Welcome to MindEase, {user_first_name}. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"
                else:
                    welcome_msg = "Welcome to MindEase. I'm here to support you with your mental and emotional well-being.\n\nHow are you feeling today? What's on your mind?"

            return JsonResponse({
                "welcome_message": welcome_msg,
                "user_id": user_id
            }, status=200)

        except Exception as e:
            import traceback
            traceback.print_exc()
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

            sessions = list(SessionService.get_recent_sessions(user_id, limit))
            session_ids = [s.session_id for s in sessions]
            voice_session_ids = set(
                Message.objects.filter(
                    session_id__in=session_ids,
                    content_type=Message.ContentType.AUDIO,
                ).values_list("session_id", flat=True)
            )

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
                    "has_voice": session.session_id in voice_session_ids,
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
# THERAPIST DIRECTORY (GET with optional filters)
# -------------------------
def _serialize_therapist(t):
    name = f"{t.first_name or ''} {t.last_name or ''}".strip() or "—"
    languages_list = None
    if t.languages:
        languages_list = [s.strip() for s in t.languages.split(",") if s.strip()]
    return {
        "id": str(t.therapist_id),
        "name": name,
        "credentials": t.credentials,
        "specialty": t.specialty,
        "city": t.city,
        "region": t.region,
        "website": t.website or t.profile_url,
        "profile_url": t.profile_url,
        "languages": languages_list,
        "address": t.address,
        "service_type": t.service_type,
    }


@csrf_exempt
def get_therapists(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        qs = Therapistdirectory.objects.all().order_by("first_name", "last_name")
        city = (request.GET.get("city") or "").strip()
        specialty = (request.GET.get("specialty") or "").strip()
        service_type = (request.GET.get("service_type") or "").strip().lower()
        try:
            limit = int(request.GET.get("limit", 0))
        except ValueError:
            limit = 0
        if city:
            qs = qs.filter(city__iexact=city)
        if specialty:
            qs = qs.filter(specialty__icontains=specialty)
        if service_type in ("in-person", "online"):
            qs = qs.filter(service_type__contains=[service_type])
        total = qs.count()
        if limit > 0:
            qs = qs[:limit]
        therapists = [_serialize_therapist(t) for t in qs]
        return JsonResponse({"therapists": therapists, "total": total}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def get_therapist_filters(request):
    """Return distinct cities for therapist directory dropdowns."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        cities = list(
            Therapistdirectory.objects.exclude(city__isnull=True)
            .exclude(city="")
            .values_list("city", flat=True)
            .distinct()
            .order_by("city")
        )
        return JsonResponse({"cities": cities}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


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


# -------------------------
# STT TRANSCRIBE
# -------------------------
@csrf_exempt
def stt_transcribe(request):
    if request.method == "POST":
        try:
            if 'audio' not in request.FILES:
                return JsonResponse({"error": "Audio file is required."}, status=400)
            
            audio_file = request.FILES['audio']
            language = request.POST.get('language', 'en')
            
            max_size = 10 * 1024 * 1024  # 10MB
            if audio_file.size > max_size:
                return JsonResponse({"error": "Audio file too large. Maximum size is 10MB."}, status=400)
            
            allowed_extensions = ['.wav', '.webm', '.mp3', '.m4a', '.ogg']
            file_name = audio_file.name.lower()
            if not any(file_name.endswith(ext) for ext in allowed_extensions):
                return JsonResponse({
                    "error": f"Unsupported file format. Allowed formats: {', '.join(allowed_extensions)}"
                }, status=400)
            
            import sys
            import os
            import tempfile
            
            stt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stt')
            if stt_dir not in sys.path:
                sys.path.insert(0, stt_dir)
            
            from stt.stt_service import SpeechToTextService
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.name)[1]) as temp_file:
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            
            try:
                # Distil-large-v3: ~6x faster than large-v3, within ~1% WER
                stt_service = SpeechToTextService(
                    model_id="Systran/faster-distil-whisper-large-v3",
                    device=None,
                    compute_type=None,
                    beam_size=2,
                    temperature=0.0,
                    vad_filter=True,
                )
                
                transcript = stt_service.transcribe_file(
                    temp_file_path,
                    language=language if language != 'auto' else None,
                )
                
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                
                if not transcript or not transcript.strip():
                    return JsonResponse({
                        "error": "No speech detected in audio file.",
                        "transcript": ""
                    }, status=200)
                
                return JsonResponse({
                    "transcript": transcript.strip(),
                    "language": language,
                    "confidence": 0.95
                }, status=200)
                
            except Exception as e:
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                
                import traceback
                traceback.print_exc()
                return JsonResponse({
                    "error": f"Transcription failed: {str(e)}"
                }, status=500)
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


# Cached TINY STT model for live partial transcription (loaded once, reused)
# Must stay tiny: distil/large are too slow for live; responses would arrive after user stops.
_partial_stt_service = None
_partial_stt_lock = threading.Lock()

def _get_partial_stt_service():
    """Get or create STT service for live partial transcription. TINY only - fast enough for real-time."""
    global _partial_stt_service
    with _partial_stt_lock:
        if _partial_stt_service is None:
            import sys
            stt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stt')
            if stt_dir not in sys.path:
                sys.path.insert(0, stt_dir)
            from stt.stt_service import SpeechToTextService
            _partial_stt_service = SpeechToTextService(
                model_id="Systran/faster-whisper-tiny",
                device=None,
                compute_type=None,
                beam_size=1,
                temperature=0.0,
                vad_filter=True,
            )
        return _partial_stt_service


# Real-time STT: transcribe partial audio chunks for live display (TINY model so results return in ~1s)
@csrf_exempt
def stt_transcribe_partial(request):
    """
    Live speech-to-text while user is speaking. Uses tiny Whisper so each chunk
    returns in 1–2 seconds; distil/large would be too slow for live display.
    """
    if request.method == "POST":
        try:
            if 'audio' not in request.FILES:
                return JsonResponse({"error": "Audio file is required."}, status=400)
            
            audio_file = request.FILES['audio']
            language = request.POST.get('language', 'en')
            
            max_size = 20 * 1024 * 1024  # 20MB for partial chunks
            if audio_file.size > max_size:
                return JsonResponse({"error": "Audio file too large."}, status=400)
            
            if audio_file.size < 1500:
                return JsonResponse({"transcript": "", "is_partial": True}, status=200)
            
            import tempfile
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            
            try:
                stt_service = _get_partial_stt_service()
                transcript = stt_service.transcribe_file(
                    temp_file_path,
                    language=language if language != 'auto' else None,
                )
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                return JsonResponse({
                    "transcript": transcript.strip() if transcript else "",
                    "is_partial": True,
                    "language": language
                }, status=200)
            except Exception as e:
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                return JsonResponse({"transcript": "", "is_partial": True, "error": str(e)}, status=200)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# TTS SYNTHESIZE
# -------------------------
@csrf_exempt
def tts_synthesize(request):
    if request.method == "POST":
        try:
            import os
            data = json.loads(request.body)
            text = data.get("text")
            language = data.get("language", "en")
            # Env TTS_BACKEND=qwen3 forces Qwen3 only (XTTS disabled); otherwise use request or default xtts
            tts_backend_env = (os.environ.get("TTS_BACKEND") or "").strip().lower()
            tts_backend = tts_backend_env if tts_backend_env in ("xtts", "qwen3") else (data.get("tts_backend") or "xtts").strip().lower()
            
            if not text:
                return JsonResponse({"error": "Text is required."}, status=400)
            
            # Limit text length to prevent abuse (max 5000 characters)
            if len(text) > 5000:
                return JsonResponse({"error": "Text too long. Maximum length is 5000 characters."}, status=400)
            
            # Validate language code
            supported_languages = ["en", "ur", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko"]
            if language not in supported_languages:
                language = "en"  # Default to English if invalid
            
            import tempfile
            
            # Use XTTS (default) or Qwen3-TTS; env TTS_BACKEND=qwen3 disables XTTS and uses only Qwen3
            if tts_backend == "qwen3":
                try:
                    tts_service = _get_qwen3_tts_service()
                except RuntimeError as e:
                    return JsonResponse({
                        "error": str(e) + " Then retry, or use default TTS (omit tts_backend)."
                    }, status=503)
            else:
                tts_service = _get_tts_service()
            
            try:
                # Create temporary file for audio output
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                    temp_file_path = temp_file.name
                
                # Synthesize text to speech
                tts_service.synthesize_to_file(
                    text=text,
                    output_path=temp_file_path,
                    language=language,
                )
                
                # Read the generated audio file
                with open(temp_file_path, 'rb') as audio_file:
                    audio_data = audio_file.read()
                
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
                
                # Don't close TTS service - we're caching it for performance
                # tts_service.close()
                
                # Return audio file as binary response
                from django.http import HttpResponse
                response = HttpResponse(audio_data, content_type='audio/wav')
                response['Content-Disposition'] = 'inline; filename="tts_audio.wav"'
                response['Content-Length'] = len(audio_data)
                return response
                
            except Exception as e:
                # Clean up temporary file if it exists
                try:
                    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                except Exception:
                    pass
                
                # Don't close TTS service on error - we're caching it
                # The service will be reused for next request
                
                import traceback
                traceback.print_exc()
                return JsonResponse({
                    "error": f"TTS synthesis failed: {str(e)}"
                }, status=500)
                
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


# -------------------------
# DIAGNOSTIC TESTS
# -------------------------

@csrf_exempt
def diagnostic_test_status(request):
    """Get diagnostic test status for user."""
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

            # Check if generic screening is completed
            generic_screening_completed = user.generic_screening_completed
            primary_condition = user.primary_condition
            last_test_date = user.last_test_date

            # Check if a test was already taken today
            test_taken_today = DiagnosticTestService.test_taken_today(last_test_date)

            # Check if daily test is available
            daily_test_available = False
            available_test = None

            if not generic_screening_completed:
                # User needs to take generic screening (only if not taken today)
                if not test_taken_today:
                    available_test = "generic-screening"
            else:
                # Generic screening completed - show daily test
                # If last_test_date is None, it means they just completed screening and can take daily test
                # If last_test_date is today, they already took daily test today
                if last_test_date is None or not test_taken_today:
                    daily_test_available = True
                    # Map primary condition to test type
                    condition_to_test = {
                        "depression": "phq9",
                        "anxiety": "gad7",
                        "stress": "pss10",
                        "general-mood": "mood_test"
                    }
                    available_test = condition_to_test.get(primary_condition, "phq9")

            return JsonResponse({
                "generic_screening_completed": generic_screening_completed,
                "primary_condition": primary_condition,
                "daily_test_available": daily_test_available,
                "last_test_date": last_test_date.isoformat() if last_test_date else None,
                "available_test": available_test
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_submit(request):
    """Submit diagnostic test results."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            test_type = data.get("test_type")
            answers = data.get("answers")

            if not user_id or not test_type or not answers:
                return JsonResponse({"error": "User ID, test type, and answers are required."}, status=400)

            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found."}, status=404)

            # Validate test type
            valid_test_types = ["generic-screening", "phq9", "gad7", "pss10", "mood_test", 
                              "depression", "anxiety", "stress", "general-mood"]
            if test_type not in valid_test_types:
                return JsonResponse({"error": "Invalid test type."}, status=400)
            
            # Normalize test type
            test_type_map = {
                "depression": "phq9",
                "anxiety": "gad7",
                "stress": "pss10",
                "general-mood": "mood_test"
            }
            normalized_test_type = test_type_map.get(test_type, test_type)
            
            # For generic screening, check if already completed (can only take once)
            if normalized_test_type == "generic-screening" and user.generic_screening_completed:
                return JsonResponse({
                    "error": "You have already completed the generic screening. Daily tests are now available."
                }, status=400)
            
            # For daily tests, check if user already took a test today (prevent multiple tests per day)
            if normalized_test_type != "generic-screening" and DiagnosticTestService.test_taken_today(user.last_test_date):
                return JsonResponse({
                    "error": "You have already completed a test today. Taking one assessment per day helps us monitor your mood patterns more effectively. Please come back tomorrow for your next assessment."
                }, status=400)

            # Convert answers to proper format
            answers_dict = {int(k): int(v) for k, v in answers.items()}

            # Calculate score
            score = DiagnosticTestService.calculate_score(answers_dict)

            # Calculate severity level
            severity_level = DiagnosticTestService.calculate_severity_level(normalized_test_type, score)

            # Handle generic screening specially
            domain_scores = None
            primary_condition = None

            if normalized_test_type == "generic-screening":
                # Calculate domain scores from answers
                # Questions 0-1: depression, 2-3: anxiety, 4-5: stress, 6-7: mood
                domain_scores = {
                    "depression": answers_dict.get(0, 0) + answers_dict.get(1, 0),
                    "anxiety": answers_dict.get(2, 0) + answers_dict.get(3, 0),
                    "stress": answers_dict.get(4, 0) + answers_dict.get(5, 0),
                    "mood": answers_dict.get(6, 0) + answers_dict.get(7, 0)
                }
                primary_condition = DiagnosticTestService.identify_primary_condition(domain_scores)
                
                # Log for debugging
                print(f"\n=== Generic Screening Results ===")
                print(f"Domain Scores: Depression={domain_scores['depression']}, Anxiety={domain_scores['anxiety']}, Stress={domain_scores['stress']}, Mood={domain_scores['mood']}")
                print(f"Primary Condition: {primary_condition} (highest score)")
                print(f"Total Score: {score}")
                print(f"Severity Level: {severity_level}")
                print("=" * 40)

            # Save test result
            test_result = Testresult.objects.create(
                user=user,
                test_type=normalized_test_type,
                score=score,
                severity_level=severity_level,
                user_responses=json.dumps(answers_dict),
                domain_scores=domain_scores,
                taken_at=timezone.now()
            )

            # Update user if generic screening
            if normalized_test_type == "generic-screening" and primary_condition:
                user.generic_screening_completed = True
                user.primary_condition = primary_condition
                # For generic screening, don't set last_test_date yet
                # This allows user to take daily test immediately after screening
            else:
                # For daily tests, update last_test_date to prevent multiple tests per day
                user.last_test_date = date.today()
            
            user.save()

            response_data = {
                "result_id": test_result.result_id,
                "score": score,
                "severity_level": severity_level,
            }
            
            # Add domain scores and primary condition for generic screening
            if normalized_test_type == "generic-screening" and domain_scores:
                response_data["domain_scores"] = domain_scores
                response_data["primary_condition"] = primary_condition
                # Also add explanation
                response_data["explanation"] = (
                    f"Domain scores: Depression={domain_scores.get('depression', 0)}, "
                    f"Anxiety={domain_scores.get('anxiety', 0)}, "
                    f"Stress={domain_scores.get('stress', 0)}, "
                    f"Mood={domain_scores.get('mood', 0)}. "
                    f"Primary condition identified: {primary_condition} (highest score)."
                )

            if primary_condition:
                response_data["primary_condition"] = primary_condition
            if domain_scores:
                response_data["domain_scores"] = domain_scores

            return JsonResponse(response_data, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_history(request):
    """Get diagnostic test history for user."""
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

            # Get all test results for user
            results = Testresult.objects.filter(user=user).order_by("-taken_at")

            results_list = []
            for result in results:
                results_list.append({
                    "result_id": result.result_id,
                    "test_type": result.test_type,
                    "test_name": DiagnosticTestService.get_test_name(result.test_type),
                    "score": result.score,
                    "severity_level": result.severity_level,
                    "taken_at": result.taken_at.isoformat() if result.taken_at else None
                })

            return JsonResponse({
                "results": results_list
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_mood_trend(request):
    """Get mood trend data for user (day-wise scores for their primary condition)."""
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

            # Get user's primary condition
            primary_condition = user.primary_condition
            if not primary_condition:
                return JsonResponse({
                    "trend_data": [],
                    "message": "No primary condition identified yet. Complete your screening first."
                }, status=200)

            # Map primary condition to test type
            condition_to_test = {
                "depression": "phq9",
                "anxiety": "gad7",
                "stress": "pss10",
                "general-mood": "mood_test"
            }
            test_type = condition_to_test.get(primary_condition, "phq9")

            # Get all daily test results (exclude generic screening) for this test type
            results = Testresult.objects.filter(
                user=user,
                test_type=test_type
            ).order_by("taken_at")

            # Build trend data (last 30 days or all available)
            trend_data = []
            for result in results:
                # Calculate if score improved or worsened (compared to previous)
                trend = "stable"
                if len(trend_data) > 0:
                    prev_score = trend_data[-1]["score"]
                    if result.score < prev_score:
                        trend = "improved"  # Lower score is better for most tests
                    elif result.score > prev_score:
                        trend = "worsened"
                    # For mood_test, higher score is better, so reverse logic
                    if test_type == "mood_test":
                        if result.score > prev_score:
                            trend = "improved"
                        elif result.score < prev_score:
                            trend = "worsened"

                trend_data.append({
                    "date": result.taken_at.isoformat(),
                    "score": result.score,
                    "severity": result.severity_level,
                    "trend": trend
                })

            return JsonResponse({
                "trend_data": trend_data,
                "primary_condition": primary_condition,
                "test_type": test_type
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def diagnostic_test_streak(request):
    """Calculate current streak based on consecutive days of taking assessments."""
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

            # Get all test results (daily tests only, exclude generic screening)
            results = Testresult.objects.filter(
                user=user
            ).exclude(
                test_type="generic-screening"
            ).order_by("-taken_at")

            if not results.exists():
                return JsonResponse({
                    "current_streak": 0,
                    "longest_streak": 0,
                    "last_test_date": None
                }, status=200)

            # Calculate streak
            from datetime import timedelta
            current_streak = 0
            longest_streak = 0
            temp_streak = 0

            # Check if last test was today or yesterday (for current streak)
            last_result = results.first()
            last_test_date = last_result.taken_at.date()

            # Start from today and work backwards
            test_dates = {r.taken_at.date() for r in results}

            # Calculate current streak (consecutive days ending today or yesterday)
            check_date = date.today()
            # If last test was today, start from today
            # If last test was yesterday, start from yesterday
            if last_test_date < date.today() - timedelta(days=1):
                # Streak is broken if last test was more than 1 day ago
                current_streak = 0
            else:
                # Count backwards from last test date
                check_date = last_test_date
                while check_date in test_dates:
                    current_streak += 1
                    check_date -= timedelta(days=1)

            # Calculate longest streak
            sorted_dates = sorted(test_dates, reverse=True)
            if sorted_dates:
                temp_streak = 1
                longest_streak = 1
                for i in range(len(sorted_dates) - 1):
                    if sorted_dates[i] - sorted_dates[i + 1] == timedelta(days=1):
                        temp_streak += 1
                        longest_streak = max(longest_streak, temp_streak)
                    else:
                        temp_streak = 1

            return JsonResponse({
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_test_date": last_test_date.isoformat() if last_test_date else None
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method."}, status=405)