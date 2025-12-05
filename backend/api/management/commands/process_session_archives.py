from __future__ import annotations

import time
import json

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import Message, Session, SessionArchiveJob, Summary
from chatbot.llm_client import LLMClient


class Command(BaseCommand):
    help = "Processes pending session archive jobs (deferred transcript rotation)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=5,
            help="Number of jobs to process in a single run.",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=0,
            help="Seconds to sleep between completed jobs (for polling loops).",
        )

    def handle(self, *args, **options):
        batch_size: int = options["batch_size"]
        sleep_seconds: float = options["sleep"]

        processed = 0
        while processed < batch_size:
            job = (
                SessionArchiveJob.objects.select_related("session", "session__user")
                .filter(status=SessionArchiveJob.Status.PENDING)
                .order_by("scheduled_at")
                .first()
            )

            if not job:
                if processed == 0:
                    self.stdout.write(self.style.NOTICE("No pending archive jobs."))
                break

            processed += 1
            self._process_job(job, sleep_seconds=sleep_seconds)

    def _process_job(self, job: SessionArchiveJob, sleep_seconds: float = 0.0):
        job.status = SessionArchiveJob.Status.IN_PROGRESS
        job.attempts += 1
        job.last_error = ""
        job.save(update_fields=["status", "attempts", "last_error", "updated_at"])

        try:
            with transaction.atomic():
                session = job.session
                if session.state != Session.SessionState.PENDING_ARCHIVE:
                    job.status = SessionArchiveJob.Status.COMPLETED
                    job.save(update_fields=["status", "updated_at"])
                    return

                conversation = self._load_session_transcript(session)

                llm_client = LLMClient()
                archive_output = self._generate_archive_output(
                    llm_client=llm_client,
                    session=session,
                    conversation=conversation,
                )
                archive_summary = archive_output["context_summary"]
                resume_message = archive_output["resume_message"]

                Summary.objects.update_or_create(
                    session=session,
                    type=Summary.SummaryType.ARCHIVE,
                    defaults={
                        "content": archive_summary,
                        "updated_at": timezone.now(),
                    },
                )

                Message.objects.filter(session=session).delete()

                session.full_summary = archive_summary
                session.resume_message = resume_message
                session.state = Session.SessionState.SUMMARY_ONLY
                session.archived_at = timezone.now()
                session.updated_at = timezone.now()
                session.save(
                    update_fields=[
                        "full_summary",
                        "resume_message",
                        "state",
                        "archived_at",
                        "updated_at",
                    ]
                )

                job.status = SessionArchiveJob.Status.COMPLETED
                job.save(update_fields=["status", "updated_at"])

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Archived session {session.session_uuid} (job #{job.job_id})."
                    )
                )

        except Exception as exc:  # pylint: disable=broad-except
            job.status = SessionArchiveJob.Status.FAILED
            job.last_error = str(exc)
            job.updated_at = timezone.now()
            job.save(update_fields=["status", "last_error", "updated_at"])
            self.stderr.write(
                self.style.ERROR(
                    f"Failed to archive session {job.session_id}: {exc}"
                )
            )

        if sleep_seconds:
            time.sleep(sleep_seconds)

    def _load_session_transcript(self, session: Session):
        messages = (
            Message.objects.filter(session=session)
            .order_by("sequence", "message_id")
            .values("sender", "content")
        )
        conversation = []
        for msg in messages:
            role = "assistant" if msg["sender"] == Message.Sender.AI else "user"
            conversation.append({"role": role, "content": msg["content"]})
        return conversation

    def _generate_archive_output(
        self,
        *,
        llm_client: LLMClient,
        session: Session,
        conversation: list[dict[str, str]],
    ) -> dict[str, str]:
        if not conversation:
            message = session.short_summary or session.full_summary or "You wrapped up a brief check-in last time. Let’s continue whenever you’re ready."
            return {
                "context_summary": session.full_summary or session.short_summary or "No transcript available.",
                "resume_message": message,
            }

        user = session.user
        user_label = user.first_name or "the user"
        you_label = user.first_name or "you"

        system_prompt = (
            "You are summarising a therapy session that will be archived. Produce two outputs strictly "
            "as JSON with keys `context_summary` and `resume_message`.\n\n"
            "Rules:\n"
            "1. `context_summary`: 3-4 sentences maximum, factual, for internal LLM context. Summarise only what the client said "
            "and how the therapist responded. No speculation.\n"
            "2. `resume_message`: 2-3 sentences addressed directly to the client as 'you'. Open with a warm 'Welcome back' style line, "
            "briefly remind them what they shared and how you supported them, and invite them to continue. "
            "Keep it empathetic, specific, and under 80 words.\n"
            "3. Do not invent details. Only include material present in the transcript.\n"
            "4. Return JSON only, no extra commentary."
        )

        user_prompt = (
            f"Client name: {user_label}.\n"
            "Conversation transcript follows. Use it verbatim; do not add assumptions.\n\n"
            "Transcript:\n"
        )

        transcript = ""
        for turn in conversation:
            transcript += f"{turn['role'].title()}: {turn['content']}\n"

        prompt = user_prompt + transcript

        try:
            raw = llm_client.generate_response(
                user_message=prompt,
                emotions="",
                context="",
                conversation_history=[],
                system_prompt_override=system_prompt,
            ).strip()

            data = json.loads(raw)
            context_summary = data.get("context_summary", "").strip()
            resume_message = data.get("resume_message", "").strip()
            if not context_summary:
                context_summary = session.full_summary or session.short_summary or "No transcript available."
            if not resume_message:
                resume_message = (
                    f"Welcome back! Last time you talked about how you were feeling, "
                    f"and we explored ways to support you. Let me know how things feel today."
                )
            return {
                "context_summary": context_summary,
                "resume_message": resume_message,
            }
        except Exception:
            fallback_resume = (
                f"Welcome back! You last shared about how you were feeling and we focused on supportive next steps. "
                f"How are things feeling for you today?"
            )
            return {
                "context_summary": session.full_summary or session.short_summary or "Summary archive unavailable.",
                "resume_message": session.short_summary or fallback_resume,
            }

