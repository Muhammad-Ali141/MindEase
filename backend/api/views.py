from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
from django.utils.dateparse import parse_date
from .models import User
import json


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

            # Check if email already exists
            if User.objects.filter(email=email).exists():
                return JsonResponse({"error": "Email already registered."}, status=400)

            # Parse and validate DOB
            dob_parsed = parse_date(dob)
            if not dob_parsed:
                return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

            # Create user record
            user = User.objects.create(
                first_name=first_name,
                last_name=last_name,
                email=email,
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

            try:
                user = User.objects.get(email=email)
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
