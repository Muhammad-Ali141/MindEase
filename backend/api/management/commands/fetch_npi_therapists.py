"""
Fetch mental health providers from the US NPI Registry (official, free API)
and upsert into Therapistdirectory. Use for US-based therapist data.

Usage:
  python manage.py fetch_npi_therapists --state CA
  python manage.py fetch_npi_therapists --state CA,NY,TX --taxonomy Psychologist
  python manage.py fetch_npi_therapists --state CA --limit 100

NPI API: https://npiregistry.cms.hhs.gov/api-page
No API key required. Max 200 results per request; use --limit to cap total.
"""
import logging
import time
from django.core.management.base import BaseCommand
from django.db import transaction

logger = logging.getLogger(__name__)

try:
    import requests
except ImportError:
    requests = None


NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api/"


def fetch_npi_page(version="2.1", limit=200, skip=0, **params):
    """Fetch one page of results from NPI Registry API."""
    if not requests:
        raise RuntimeError("Install requests: pip install requests")
    url = NPI_API_BASE
    payload = {"version": version, "limit": limit, "skip": skip, **params}
    resp = requests.get(url, params=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def parse_npi_result(r):
    """Extract therapist fields from one NPI result (individual provider)."""
    from api.models import Therapistdirectory

    npi = str(r.get("number") or "")
    basic = r.get("basic_attributes") or {}
    first_name = (basic.get("first_name") or "").strip() or None
    last_name = (basic.get("last_name") or "").strip() or None
    if not first_name and not last_name:
        return None

    addresses = r.get("addresses") or []
    city = state = phone = None
    for addr in addresses:
        if addr.get("address_purpose") == "LOCATION" or not city:
            city = (addr.get("city") or "").strip() or city
            state = (addr.get("state") or "").strip() or state
            phone = (addr.get("telephone_number") or "").strip() or phone
        if city and phone:
            break
    if not city and addresses:
        a = addresses[0]
        city = (a.get("city") or "").strip()
        state = (a.get("state") or "").strip()
        phone = (a.get("telephone_number") or "").strip()

    taxonomies = r.get("taxonomies") or []
    specialty = None
    for t in taxonomies:
        if t.get("primary"):
            specialty = (t.get("desc") or "").strip() or specialty
            break
    if not specialty and taxonomies:
        specialty = (taxonomies[0].get("desc") or "").strip()

    return {
        "external_id": f"npi_{npi}" if npi else None,
        "first_name": first_name or "—",
        "last_name": last_name,
        "city": city,
        "region": state,
        "phone_number": phone,
        "credentials": None,
        "specialty": specialty,
        "email": None,
        "website": None,
        "languages": None,
        "address": None,
    }


class Command(BaseCommand):
    help = "Fetch therapists from NPI Registry (US) and upsert into Therapistdirectory."

    def add_arguments(self, parser):
        parser.add_argument(
            "--state",
            type=str,
            default="CA",
            help="State code(s), comma-separated (e.g. CA,NY,TX). Default: CA",
        )
        parser.add_argument(
            "--taxonomy",
            type=str,
            default="Psychologist",
            help="Taxonomy description (e.g. Psychologist, Psychiatrist, Clinical Psychologist). Default: Psychologist",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=200,
            help="Max total records to fetch per state (API returns up to 200 per request). Default: 200",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print what would be done, do not write to DB.",
        )

    def handle(self, *args, **options):
        if not requests:
            self.stderr.write(self.style.ERROR("requests is required. pip install requests"))
            return

        states = [s.strip().upper() for s in options["state"].split(",") if s.strip()]
        taxonomy = (options["taxonomy"] or "Psychologist").strip()
        limit_per_state = max(1, min(1200, options["limit"]))
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write("DRY RUN: no changes will be written.")

        total_created = 0
        total_updated = 0

        for state in states:
            self.stdout.write(f"Fetching {taxonomy} in state {state}...")
            skip = 0
            page_limit = min(200, limit_per_state)

            while skip < limit_per_state:
                try:
                    data = fetch_npi_page(
                        version="2.1",
                        enumeration_type="NPI-1",
                        taxonomy_description=taxonomy,
                        state=state,
                        limit=page_limit,
                        skip=skip,
                    )
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"NPI API error: {e}"))
                    break

                items = data.get("results") or []
                if not items:
                    break

                for r in items:
                    parsed = parse_npi_result(r)
                    if not parsed:
                        continue
                    external_id = parsed.pop("external_id")
                    if not external_id:
                        continue

                    if dry_run:
                        self.stdout.write(f"  Would upsert: {parsed.get('first_name')} {parsed.get('last_name')} ({external_id})")
                        total_created += 1
                        continue

                    with transaction.atomic():
                        obj, created = Therapistdirectory.objects.update_or_create(
                            external_id=external_id,
                            defaults={
                                **parsed,
                                "source": Therapistdirectory.Source.NPI,
                            },
                        )
                        if created:
                            total_created += 1
                        else:
                            total_updated += 1

                if len(items) < page_limit:
                    break
                skip += len(items)
                time.sleep(0.3)

        self.stdout.write(
            self.style.SUCCESS(f"Done. Created: {total_created}, Updated: {total_updated}")
        )
