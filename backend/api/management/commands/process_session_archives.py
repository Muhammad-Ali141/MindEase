from __future__ import annotations

import time
import json
import re

from django.core.management.base import BaseCommand


_ARCHIVE_PREFIX_RE = re.compile(
    r"^(therapist'?s?\s+note|clinical\s+note|session\s+(recap|summary|note)|summary|recap|note)\s*[:\-–—]\s*",
    re.IGNORECASE,
)


def _clean_archive_text(value: str) -> str:
    if not value:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in ('"', "'", "`"):
        text = text[1:-1].strip()
    for _ in range(3):
        new = _ARCHIVE_PREFIX_RE.sub("", text).strip()
        if new == text:
            break
        text = new
    text = re.sub(r"(?m)^\s*[-*_=~]{3,}\s*$", "", text)
    text = re.sub(r"[-–—]{3,}", "", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"(?m)^#{1,6}\s+", "", text)
    text = "\n".join(
        re.sub(r"[\s\-–—_*#]+$", "", line).rstrip()
        for line in text.split("\n")
    )
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text
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
        user_label = user.first_name or "the client"

        system_prompt = (
            "You are a warm, caring therapist writing a reflection for a person after "
            "their therapy session. Return strict JSON with keys `context_summary` and "
            "`resume_message`. No prose outside the JSON.\n\n"
            "Rules:\n"
            "1. `context_summary`: a warm, journal-style reflection addressed directly "
            "to the person as 'you'. Do NOT use their name, and never use the words "
            "'client' or 'patient'. Structure with these Markdown headings in order, "
            "1-3 sentences under each, plain prose only:\n"
            "   **What We Talked About**\n"
            "   **How You Were Feeling**\n"
            "   **What Came Up**\n"
            "   **What We Explored Together**\n"
            "   **How You Responded**\n"
            "   **Looking Ahead**\n"
            "   Omit a heading only if truly nothing to report. Around 140-260 words total.\n"
            "2. `resume_message`: 2-3 short sentences addressed directly to the person "
            "as 'you'. Warm and specific, under 80 words. Briefly recall what came up "
            "and invite them to continue whenever they're ready.\n"
            "3. Ground every statement in the transcript. No speculation, no invented "
            "diagnoses.\n"
            "4. No separator lines, no runs of dashes, no emojis, no wrap quotes, no "
            "'Note:' / 'Summary:' prefixes.\n"
            "5. Return JSON only."
        )

        user_prompt = (
            "The transcript follows verbatim. Use it as the sole source of facts. "
            "Address the reader as 'you'. Do not use their name anywhere in the output.\n\n"
            "Transcript:\n"
        )

        transcript = ""
        for turn in conversation:
            role = "You" if turn["role"] == "user" else "Therapist"
            transcript += f"{role}: {turn['content']}\n"

        prompt = user_prompt + transcript

        try:
            raw = llm_client.generate_response(
                user_message=prompt,
                emotions="",
                context="",
                conversation_history=[],
                system_prompt_override=system_prompt,
            ).strip()

            # Strip accidental code fences around JSON
            if raw.startswith("```"):
                raw = raw.strip("`")
                if raw.lower().startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            data = json.loads(raw)
            context_summary = _clean_archive_text(data.get("context_summary", ""))
            resume_message = _clean_archive_text(data.get("resume_message", ""))
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

