import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables if .env files are present
for candidate in [
    BASE_DIR / '.env',
    BASE_DIR.parent / '.env',
    BASE_DIR / 'backend' / '.env',
]:
    if candidate.exists():
        load_dotenv(candidate, override=False)

SECRET_KEY = 'django-insecure-replace-this-with-your-own-secret-key'
DEBUG = True  # ✅ Keep True for development

ALLOWED_HOSTS = ['*']  # ✅ Allow all during development

# -------------------------------------------------------------------
# Application definition
# -------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt', 
    'corsheaders',  
    'api.apps.ApiConfig',  # your backend app (AppConfig enables Qwen3 TTS warmup on server start)
]

# ⚠️ Do NOT define AUTH_USER_MODEL since you’re using the default User table

# -------------------------------------------------------------------
# Middleware
# -------------------------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
CORS_ALLOW_ALL_ORIGINS = True
# Expose custom response headers to the frontend (e.g. voice welcome cached text)
CORS_EXPOSE_HEADERS = ["X-Welcome-Message"]

# -------------------------------------------------------------------
# URL Configuration
# -------------------------------------------------------------------
ROOT_URLCONF = 'backend.urls'

# -------------------------------------------------------------------
# Templates
# -------------------------------------------------------------------
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],  # Add template paths here if needed
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# -------------------------------------------------------------------
# WSGI
# -------------------------------------------------------------------
WSGI_APPLICATION = 'backend.wsgi.application'

# -------------------------------------------------------------------
# Database
# -------------------------------------------------------------------
_db_host = os.getenv('DB_HOST', 'localhost')
_db_options = {}
if _db_host not in ('localhost', '127.0.0.1'):
    # Supabase and other hosted Postgres require SSL
    _db_options['sslmode'] = os.getenv('DB_SSLMODE', 'require')

DATABASES = {
    'default': {
        'ENGINE': os.getenv('DJANGO_DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME': os.getenv('DB_NAME', 'mentalhealthdb'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'pakistan'),
        'HOST': _db_host,
        'PORT': os.getenv('DB_PORT', '5432'),
        **({'OPTIONS': _db_options} if _db_options else {}),
    }
}

# -------------------------------------------------------------------
# Password validation
# -------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# -------------------------------------------------------------------
# Language & Time
# -------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# -------------------------------------------------------------------
# Static Files
# -------------------------------------------------------------------
STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# -------------------------------------------------------------------
# REST Framework
# -------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}

# -------------------------------------------------------------------
# Email / OTP via n8n webhook (sends to real Gmail)
# -------------------------------------------------------------------
# n8n workflow webhook URL; expects POST JSON: {"email": "...", "otp": "123456"}
N8N_SEND_OTP_WEBHOOK_URL = os.getenv(
    'N8N_SEND_OTP_WEBHOOK_URL',
    'http://localhost:5678/webhook-test/send-otp-mindease'
)
