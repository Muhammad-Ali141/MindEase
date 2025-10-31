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
                "lang_pref": user.lang_pref  # ✅ consistent field name
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)
