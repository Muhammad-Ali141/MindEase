from __future__ import annotations

from dataclasses import dataclass
from threading import Thread
from typing import Any, Dict, Iterable, List, Optional, Sequence, TypedDict

from django.core.management import call_command
from django.db import close_old_connections, transaction
from django.db.models import Q
from django.utils import timezone

from api.models import Message, Session, SessionArchiveJob, Summary


class SessionMessagePayload(TypedDict, total=False):
    role: str
    sender: str
    content: str
    content_type: str
    sequence: int
    emotion_label: Optional[str]
    emotion_score: Optional[float]
    metadata: Dict[str, Any]


@dataclass
class SessionSaveResult:
    session: Session
    created: bool


class SessionService:
    """Utility functions for managing chat sessions and transcripts."""

    @staticmethod
    def get_session_count(user_id: int) -> int:
        """Return total sessions for a user (full, pending, or archived)."""
        return Session.objects.filter(user_id=user_id).count()

    @staticmethod
    def get_recent_sessions(user_id: int, limit: Optional[int] = None) -> Iterable[Session]:
        qs = Session.objects.filter(user_id=user_id).order_by('-started_at', '-created_at', '-session_id')
        return qs[:limit] if limit else qs

    @staticmethod
    def get_session_with_messages(session_id: int) -> Session:
        return (
            Session.objects.select_related('user')
            .prefetch_related('messages', 'summaries')
            .get(session_id=session_id)
        )

    @staticmethod
    @transaction.atomic
    def create_session(
        *,
        user_id: int,
        title: str = '',
        messages: Sequence[SessionMessagePayload],
        short_summary: str = '',
        full_summary: str = '',
        continuation_context: Optional[Dict[str, Any]] = None,
        is_starred: bool = False,
        started_at: Optional[Any] = None,
        ended_at: Optional[Any] = None,
    ) -> SessionSaveResult:
        session = Session.objects.create(
            user_id=user_id,
            title=title or 'Therapy Session',
            short_summary=short_summary or '',
            full_summary=full_summary or '',
            resume_message='',
            continuation_context=continuation_context or {},
            is_starred=is_starred,
            started_at=started_at or timezone.now(),
            ended_at=ended_at,
            state=Session.SessionState.FULL,
        )

        SessionService._replace_session_messages(session, messages)
        SessionService._update_summary_records(session, short_summary, full_summary)

        transaction.on_commit(
            lambda session_id=session.session_id: SessionService.enforce_rotation_policy(
                user_id,
                preserve_session_ids=[session_id],
            )
        )
        return SessionSaveResult(session=session, created=True)

    @staticmethod
    @transaction.atomic
    def update_session(
        *,
        session: Session,
        messages: Sequence[SessionMessagePayload],
        short_summary: Optional[str] = None,
        full_summary: Optional[str] = None,
        ended_at: Optional[Any] = None,
        continuation_context: Optional[Dict[str, Any]] = None,
    ) -> SessionSaveResult:
        updated_fields: List[str] = []

        if short_summary is not None:
            session.short_summary = short_summary
            updated_fields.append('short_summary')
        if full_summary is not None:
            session.full_summary = full_summary
            updated_fields.append('full_summary')
        if continuation_context is not None:
            session.continuation_context = continuation_context
            updated_fields.append('continuation_context')
        if ended_at is not None:
            session.ended_at = ended_at
            updated_fields.append('ended_at')

        session.state = Session.SessionState.FULL
        session.resume_message = ''
        updated_fields.append('state')
        updated_fields.append('resume_message')
        updated_fields.append('updated_at')
        session.updated_at = timezone.now()
        session.save(update_fields=updated_fields)

        SessionService._replace_session_messages(session, messages)
        SessionService._update_summary_records(session, short_summary, full_summary)

        transaction.on_commit(
            lambda session_id=session.session_id, user_id=session.user_id: SessionService.enforce_rotation_policy(
                user_id,
                preserve_session_ids=[session_id],
            )
        )
        return SessionSaveResult(session=session, created=False)

    @staticmethod
    @transaction.atomic
    def set_starred(session: Session, is_starred: bool) -> Session:
        if is_starred:
            if session.state != Session.SessionState.FULL:
                raise ValueError("archived_session")

            existing = Session.objects.filter(
                user_id=session.user_id,
                is_starred=True,
            ).exclude(pk=session.pk).count()

            if existing >= 3:
                raise ValueError("star_limit")

        session.is_starred = is_starred
        session.updated_at = timezone.now()
        session.save(update_fields=['is_starred', 'updated_at'])

        if not is_starred:
            transaction.on_commit(
                lambda session_id=session.session_id, user_id=session.user_id: SessionService.enforce_rotation_policy(
                    user_id,
                    preserve_session_ids=[session_id],
                )
            )

        return session

    # ------------------------------------------------------------------
    # Rotation helpers
    # ------------------------------------------------------------------
    @staticmethod
    def enforce_rotation_policy(
        user_id: int,
        preserve_session_ids: Optional[Iterable[int]] = None,
    ) -> None:
        """Ensure only three non-starred full sessions are kept per user."""
        preserve_ids = set(preserve_session_ids or [])

        full_sessions = Session.objects.filter(
            user_id=user_id,
            state=Session.SessionState.FULL,
            is_starred=False,
        ).order_by('-started_at', '-created_at', '-session_id')

        total_full = full_sessions.count()
        if total_full <= 3:
            return

        keep_ids = set(
            full_sessions.exclude(session_id__in=preserve_ids)
            .values_list('session_id', flat=True)[:3]
        )
        keep_ids.update(preserve_ids)

        candidates = full_sessions.exclude(session_id__in=keep_ids)
        for session in candidates:
            SessionService._mark_pending_archive(session)

    @staticmethod
    def _mark_pending_archive(session: Session) -> None:
        if session.state != Session.SessionState.FULL:
            return

        Session.objects.filter(pk=session.pk).update(
            state=Session.SessionState.PENDING_ARCHIVE,
            updated_at=timezone.now(),
        )

        job, created = SessionArchiveJob.objects.get_or_create(
            session=session,
            defaults={
                'status': SessionArchiveJob.Status.PENDING,
                'scheduled_at': timezone.now(),
            },
        )

        if not created and job.status != SessionArchiveJob.Status.PENDING:
            job.status = SessionArchiveJob.Status.PENDING
            job.attempts = 0
            job.last_error = ''
            job.scheduled_at = timezone.now()
            job.save(update_fields=['status', 'attempts', 'last_error', 'scheduled_at', 'updated_at'])

        transaction.on_commit(SessionService._kickoff_archive_processing)

    # ------------------------------------------------------------------
    # Internal utilities
    # ------------------------------------------------------------------
    @staticmethod
    def _replace_session_messages(session: Session, messages: Sequence[SessionMessagePayload]) -> None:
        Message.objects.filter(session=session).delete()

        if not messages:
            return

        message_objects: List[Message] = []
        for index, payload in enumerate(messages):
            sender = SessionService._normalize_sender(payload.get('sender') or payload.get('role'))
            content_type = payload.get('content_type') or Message.ContentType.TEXT
            metadata = dict(payload.get('metadata', {}))
            if payload.get('role'):
                metadata.setdefault('role', payload['role'])
            message_objects.append(
                Message(
                    session=session,
                    user=session.user,
                    sender=sender,
                    content_type=content_type,
                    sequence=payload.get('sequence', index),
                    content=payload.get('content'),
                    emotion_label=payload.get('emotion_label'),
                    emotion_score=payload.get('emotion_score'),
                    metadata=metadata,
                )
            )

        Message.objects.bulk_create(message_objects, batch_size=500)

    @staticmethod
    def _update_summary_records(
        session: Session,
        short_summary: Optional[str],
        full_summary: Optional[str],
    ) -> None:
        if short_summary is not None:
            Summary.objects.update_or_create(
                session=session,
                type=Summary.SummaryType.SHORT,
                defaults={'content': short_summary, 'updated_at': timezone.now()},
            )
        if full_summary is not None:
            Summary.objects.update_or_create(
                session=session,
                type=Summary.SummaryType.FULL,
                defaults={'content': full_summary, 'updated_at': timezone.now()},
            )

    @staticmethod
    def _normalize_sender(value: Optional[str]) -> str:
        value = (value or '').lower()
        if value in {'assistant', 'ai', 'bot'}:
            return Message.Sender.AI
        return Message.Sender.USER

    @staticmethod
    def _kickoff_archive_processing() -> None:
        def worker():
            close_old_connections()
            try:
                call_command('process_session_archives', batch_size=5)
            finally:
                close_old_connections()

        Thread(target=worker, daemon=True).start()


__all__ = ['SessionService', 'SessionMessagePayload', 'SessionSaveResult']
