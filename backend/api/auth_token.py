"""
Authorization-token middleware for chat / voice / session endpoints.

Login + register + OAuth-login issue a random token (`secrets.token_urlsafe`)
and store it on the User row. Subsequent privileged requests must send
`Authorization: Bearer <token>` so the server can map the call to a user
without trusting `user_id` from the request body.

The decorator:
- Reads the header
- Looks up the user
- If `user_id` is also present in the JSON body, verifies the token's user
  matches it (prevents a logged-in user from acting on another user's id)
- Stores `request.auth_user` for the view to consume if desired
"""
import json
import secrets
from functools import wraps

from django.http import JsonResponse


AUTH_TOKEN_BYTES = 48


def generate_auth_token() -> str:
    return secrets.token_urlsafe(AUTH_TOKEN_BYTES)


def _extract_token(request) -> str:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header:
        return ""
    parts = header.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return ""


def _extract_request_user_id(request) -> str:
    # GET / query string
    uid = request.GET.get("user_id")
    if uid:
        return str(uid)
    # POST multipart / form
    try:
        uid = request.POST.get("user_id")
        if uid:
            return str(uid)
    except Exception:
        pass
    # JSON body
    try:
        body = request.body
        if not body:
            return ""
        data = json.loads(body)
        uid = data.get("user_id")
        return str(uid) if uid is not None else ""
    except Exception:
        return ""


def require_auth_token(view_func):
    """Reject requests without a valid Authorization: Bearer token."""

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if request.method == "OPTIONS":
            return view_func(request, *args, **kwargs)

        token = _extract_token(request)
        if not token:
            return JsonResponse(
                {"error": "Authentication required.", "code": "missing_token"},
                status=401,
            )

        from api.models import User
        try:
            user = User.objects.get(auth_token=token, auth_token__isnull=False)
        except User.DoesNotExist:
            return JsonResponse(
                {"error": "Invalid or expired token.", "code": "invalid_token"},
                status=401,
            )

        body_uid = _extract_request_user_id(request)
        if body_uid and str(user.user_id) != body_uid:
            return JsonResponse(
                {"error": "Token does not match user_id.", "code": "user_mismatch"},
                status=403,
            )

        request.auth_user = user
        return view_func(request, *args, **kwargs)

    return wrapper


__all__ = ["require_auth_token", "generate_auth_token", "AUTH_TOKEN_BYTES"]
