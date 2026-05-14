"""
Simple in-memory sliding-window rate limiter for chat/voice endpoints.

Keyed by user_id (from POST body) and client IP. Drops the request with HTTP 429
when either bucket is full. Memory-only — per-process state; fine for a single
gunicorn/runserver worker. If you scale to multiple workers, swap the deques
for a Redis-backed bucket.

Defaults (per minute):
- USER_LIMIT: 60 messages per user_id
- IP_LIMIT: 120 messages per IP (allows a few users behind same NAT)
"""
import json
import time
from collections import defaultdict, deque
from functools import wraps
from threading import Lock

from django.http import JsonResponse


USER_LIMIT = 60
IP_LIMIT = 120
WINDOW_SECONDS = 60

_user_log: dict = defaultdict(deque)
_ip_log: dict = defaultdict(deque)
_lock = Lock()


def _client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def _extract_user_id(request) -> str:
    try:
        body = request.body
        if not body:
            return ""
        data = json.loads(body)
        uid = data.get("user_id")
        return str(uid) if uid is not None else ""
    except Exception:
        return ""


def _prune(log: deque, cutoff: float) -> None:
    while log and log[0] < cutoff:
        log.popleft()


def _check_and_record(key_log: dict, key: str, limit: int, now: float) -> bool:
    """Return True if the request is allowed (and record it); False if over limit."""
    if not key:
        return True
    cutoff = now - WINDOW_SECONDS
    log = key_log[key]
    _prune(log, cutoff)
    if len(log) >= limit:
        return False
    log.append(now)
    return True


def rate_limit_chat(view_func):
    """Decorator: enforce per-user and per-IP limits on a chat/voice endpoint."""

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if request.method != "POST":
            return view_func(request, *args, **kwargs)

        now = time.time()
        ip = _client_ip(request)
        user_id = _extract_user_id(request)

        with _lock:
            ip_ok = _check_and_record(_ip_log, ip, IP_LIMIT, now)
            if not ip_ok:
                return JsonResponse(
                    {"error": "Too many requests from your network. Please wait a moment."},
                    status=429,
                )
            user_ok = _check_and_record(_user_log, user_id, USER_LIMIT, now)
            if not user_ok:
                return JsonResponse(
                    {"error": "You are sending messages too quickly. Please slow down."},
                    status=429,
                )

        return view_func(request, *args, **kwargs)

    return wrapper


__all__ = ["rate_limit_chat", "USER_LIMIT", "IP_LIMIT", "WINDOW_SECONDS"]
