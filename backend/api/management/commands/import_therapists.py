"""
Import therapists from a JSON file (e.g. from a scraper or manual export)
into Therapistdirectory. Use for non-US data (e.g. Pakistan) or any
scraped/curated list.

JSON format (array of objects):
  [
    {
      "first_name": "Sarah",
      "last_name": "Ahmed",
      "credentials": "PhD, Clinical Psychologist",
      "specialty": "Anxiety, Depression, CBT",
      "city": "Lahore",
      "region": "Punjab",
      "phone_number": "+92 42 123 4567",
      "email": "sarah@example.com",
      "website": "https://...",
      "languages": "Urdu, English",
      "address": "Optional full address"
    }
  ]
  Optional: "external_id" for deduplication (e.g. "import_1" or source ID).

Usage:
  python manage.py import_therapists path/to/therapists.json
  python manage.py import_therapists path/to/therapists.json --dry-run
"""
import json
import logging
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Therapistdirectory

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Import therapists from a JSON file into Therapistdirectory."

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            type=str,
            help="Path to JSON file (array of therapist objects).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print what would be done, do not write to DB.",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            self.stderr.write(self.style.ERROR(f"File not found: {path}"))
            return

        try:
            raw = path.read_text(encoding="utf-8")
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            self.stderr.write(self.style.ERROR(f"Invalid JSON: {e}"))
            return
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Read error: {e}"))
            return

        if not isinstance(data, list):
            self.stderr.write(self.style.ERROR("JSON root must be an array of therapist objects."))
            return

        allowed = {
            "first_name", "last_name", "credentials", "specialty", "city", "region",
            "phone_number", "email", "website", "profile_url", "languages", "address",
            "external_id", "service_type",
        }
        created = 0
        updated = 0
        dry_run = options["dry_run"]

        for i, item in enumerate(data):
            if not isinstance(item, dict):
                continue
            row = {k: v for k, v in item.items() if k in allowed}
            first = (row.get("first_name") or "").strip()
            last = (row.get("last_name") or "").strip()
            if not first and not last:
                self.stdout.write(self.style.WARNING(f"Row {i}: missing first_name/last_name, skip."))
                continue

            if not first:
                first = "—"
            external_id = (row.get("external_id") or "").strip() or None
            if not external_id:
                external_id = f"import_{path.stem}_{i}"

            website = (row.get("website") or "").strip() or None
            profile_url = (row.get("profile_url") or "").strip() or None
            service_type = row.get("service_type")
            if service_type is not None and not isinstance(service_type, list):
                service_type = None
            payload = {
                "first_name": first,
                "last_name": last or None,
                "credentials": (row.get("credentials") or "").strip() or None,
                "specialty": (row.get("specialty") or "").strip() or None,
                "city": (row.get("city") or "").strip() or None,
                "region": (row.get("region") or "").strip() or None,
                "phone_number": (row.get("phone_number") or "").strip() or None,
                "email": (row.get("email") or "").strip() or None,
                "website": website,
                "profile_url": profile_url,
                "languages": (row.get("languages") or "").strip() or None,
                "address": (row.get("address") or "").strip() or None,
                "service_type": service_type,
                "source": Therapistdirectory.Source.IMPORT,
            }

            if dry_run:
                self.stdout.write(f"  Would import: {payload['first_name']} {payload['last_name']} ({external_id})")
                created += 1
                continue

            with transaction.atomic():
                obj, was_created = Therapistdirectory.objects.update_or_create(
                    external_id=external_id,
                    defaults=payload,
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Done. Created: {created}, Updated: {updated}")
        )
