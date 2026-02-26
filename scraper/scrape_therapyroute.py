#!/usr/bin/env python3
"""
Scrape therapist listings from TherapyRoute (Pakistan) and write JSON.

The main page shows 12 therapist cards per page with pagination (?page=N).
Profile links use /therapist/<slug> (singular). This script paginates
through all pages and parses each card's structured text.

Requirements:
  pip install -r requirements.txt
  playwright install chromium

Usage:
  python scraper/scrape_therapyroute.py -o scraper/output/therapists.json
  python scraper/scrape_therapyroute.py -o out.json --no-headless
  python scraper/scrape_therapyroute.py -o out.json --max-pages 30
"""

import argparse
import json
import time
from pathlib import Path
from urllib.parse import urlparse

BASE_URL = "https://www.therapyroute.com/therapists/pakistan"
SITE_BASE = "https://www.therapyroute.com"

KNOWN_CITIES = {
    "karachi", "lahore", "islamabad", "rawalpindi",
    "faisalabad", "sargodha", "bahawalpur", "multan",
    "peshawar", "quetta", "hyderabad", "sialkot",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def split_name(full_name: str) -> tuple[str, str | None]:
    """Split 'Ms Maham Abid' -> ('Maham', 'Abid'), dropping honorifics."""
    honorifics = {"mr", "mrs", "ms", "miss", "dr", "prof", "sir"}
    parts = (full_name or "").strip().split()
    while parts and parts[0].lower().rstrip(".") in honorifics:
        parts.pop(0)
    if not parts:
        return full_name.strip() if full_name else "—", None
    if len(parts) == 1:
        return parts[0], None
    return parts[0], " ".join(parts[1:])


def extract_city(text: str) -> str | None:
    """Find a known Pakistani city name in text."""
    low = text.lower()
    for city in KNOWN_CITIES:
        if city in low:
            return city.capitalize()
    return None


def parse_service_type(text: str) -> list[str]:
    """Extract online/in-person from text."""
    low = text.lower()
    out = []
    if "online" in low:
        out.append("online")
    if "in-person" in low or "in person" in low:
        out.append("in-person")
    return out


def slug_from_href(href: str) -> str | None:
    """
    Extract therapist slug from /therapist/<slug> URL.
    e.g. '/therapist/fizza-anis-karachi-pakistan' -> 'fizza-anis-karachi-pakistan'
    """
    path = urlparse(href).path.strip("/")
    parts = [p for p in path.split("/") if p]
    # /therapist/<slug>  (singular 'therapist', 2 segments)
    if len(parts) == 2 and parts[0] == "therapist":
        return parts[1]
    return None


# ---------------------------------------------------------------------------
# Card parser — extracts structured data from a single therapist card
# ---------------------------------------------------------------------------

def parse_card(card_element, page) -> dict | None:
    """
    Parse a single therapist card element.
    Card structure (from debug):
      - Name (e.g. "Fizza Anis")
      - Role (e.g. "Associate Counseling Psychologist")
      - Location (e.g. "Karachi, Karachi")
      - Services list (e.g. "ACT (Acceptance & Commitment Therapy), Conflict Management +8")
      - Languages (e.g. "English, Hindi/Urdu")
      - Specialties (e.g. "Abuse, Anxiety +7")
      - Service type (e.g. "Online & In-person")
    Also has a "Profile" link -> /therapist/<slug>
    """
    try:
        card_text = (card_element.inner_text() or "").strip()
        if not card_text or len(card_text) < 10:
            return None

        # Find the profile link within or near this card
        profile_link = card_element.locator('a[href^="/therapist/"]').first
        href = ""
        slug = None
        try:
            href = profile_link.get_attribute("href") or ""
            slug = slug_from_href(href)
        except Exception:
            pass

        if not slug:
            # Try finding the link in the parent container
            try:
                parent = card_element.locator("xpath=..").first
                profile_link = parent.locator('a[href^="/therapist/"]').first
                href = profile_link.get_attribute("href") or ""
                slug = slug_from_href(href)
            except Exception:
                pass

        if not slug:
            return None

        profile_url = f"{SITE_BASE}{href}" if href and not href.startswith("http") else href

        lines = [ln.strip() for ln in card_text.split("\n") if ln.strip()]
        if not lines:
            return None

        # Filter out button text and very short noise
        lines = [ln for ln in lines if ln.lower() not in (
            "profile", "message now", "view profile", "contact",
            "book", "book now", "send message",
        )]

        first_name, last_name = split_name(lines[0]) if lines else ("—", None)

        entry = {
            "first_name": first_name or "—",
            "last_name": last_name,
            "credentials": None,
            "specialty": None,
            "city": None,
            "region": "Pakistan",
            "phone_number": None,
            "email": None,
            "website": profile_url,
            "languages": None,
            "address": None,
            "external_id": f"therapyroute_{slug}",
            "profile_url": profile_url,
            "service_type": [],
        }

        for ln in lines[1:]:
            low = ln.lower()

            # Skip noise
            if low in ("profile", "message now", "view profile"):
                continue

            # Role / credentials line
            if not entry["credentials"] and any(kw in low for kw in [
                "psychologist", "counselor", "therapist", "psychiatrist",
                "counsellor", "psychotherapist", "social worker",
            ]):
                entry["credentials"] = ln[:200]
                continue

            # Location line (contains a city name + comma pattern like "Karachi, Karachi")
            if not entry["city"] and extract_city(ln):
                entry["city"] = extract_city(ln)
                entry["address"] = ln[:255]
                continue

            # Languages line
            if not entry["languages"] and any(lang in low for lang in [
                "english", "urdu", "hindi", "punjabi", "sindhi",
                "pashto", "balochi", "arabic",
            ]):
                entry["languages"] = ln[:255]
                continue

            # Service type line (Online, In-person, etc.)
            svc = parse_service_type(ln)
            if svc:
                entry["service_type"] = list(set(entry["service_type"]) | set(svc))
                continue

            # Specialty / areas of focus (things with +N pattern or therapy keywords)
            if any(kw in low for kw in [
                "therapy", "cbt", "trauma", "anxiety", "depression",
                "assessment", "adhd", "stress", "grief", "relationship",
                "eating", "ocd", "ptsd", "bipolar", "phobia", "abuse",
                "anger", "counseling", "conflict", "self-esteem",
            ]) or "+\u200b" in ln or "+" in ln:
                if entry["specialty"]:
                    entry["specialty"] = (entry["specialty"] + "; " + ln)[:300]
                else:
                    entry["specialty"] = ln[:300]
                continue

        # Try to extract city from slug if not found in text
        if not entry["city"]:
            entry["city"] = extract_city(slug) or None

        return entry

    except Exception:
        return None


# ---------------------------------------------------------------------------
# Main scraper
# ---------------------------------------------------------------------------

def run_scraper(
    output_path: Path,
    headless: bool = True,
    max_pages: int = 25,
    page_delay_seconds: float = 2.0,
) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit(
            "Playwright not installed. Run:\n"
            "  pip install -r scraper/requirements.txt\n"
            "  playwright install chromium"
        )

    all_therapists: list[dict] = []
    seen_slugs: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()
        page.set_default_timeout(30000)

        # First, load page 1 to detect total number of pages
        print(f"Loading: {BASE_URL}")
        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(5000)

        # Detect max page from pagination links
        detected_max = 1
        pagination_links = page.locator('a[href*="therapists/pakistan?page="]').all()
        for plink in pagination_links:
            try:
                phref = plink.get_attribute("href") or ""
                # Extract page number from ?page=N
                if "page=" in phref:
                    num = int(phref.split("page=")[1].split("#")[0].split("&")[0])
                    if num > detected_max:
                        detected_max = num
            except (ValueError, IndexError):
                continue

        total_pages = min(detected_max, max_pages)
        print(f"Detected {detected_max} pages. Will scrape {total_pages} pages.\n")

        # Scrape each page
        for page_num in range(1, total_pages + 1):
            url = f"{BASE_URL}?page={page_num}#therapist-results"
            print(f"--- Page {page_num}/{total_pages} ---")

            if page_num > 1:
                try:
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_timeout(4000)
                except Exception as e:
                    print(f"  Failed to load page {page_num}: {e}")
                    continue

            # Scroll down to ensure all cards are rendered
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1500)

            # Find therapist cards by their class
            cards = page.locator("[class*='bg-card']").all()
            print(f"  Found {len(cards)} cards")

            page_count = 0
            for card in cards:
                entry = parse_card(card, page)
                if not entry:
                    continue
                eid = entry["external_id"]
                if eid in seen_slugs:
                    continue
                seen_slugs.add(eid)
                all_therapists.append(entry)
                page_count += 1
                print(f"  + {entry['first_name']} {entry['last_name'] or ''} ({entry['city'] or '?'})")

            if page_count == 0 and len(cards) == 0:
                print("  No cards found. Stopping pagination.")
                break

            print(f"  Scraped {page_count} new therapists (total: {len(all_therapists)})")

            # Politeness delay between pages
            if page_num < total_pages:
                time.sleep(page_delay_seconds)

        browser.close()

    # Write output
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_therapists, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nDone! Wrote {len(all_therapists)} therapists to {output_path}")


def main():
    ap = argparse.ArgumentParser(
        description="Scrape TherapyRoute Pakistan therapists."
    )
    ap.add_argument(
        "-o", "--output", required=True,
        help="Output JSON file path",
    )
    ap.add_argument(
        "--no-headless", action="store_true",
        help="Show browser window (useful for debugging)",
    )
    ap.add_argument(
        "--max-pages", type=int, default=25,
        help="Max pages to scrape (default 25)",
    )
    ap.add_argument(
        "--page-delay", type=float, default=2.0,
        help="Seconds to wait between pages (default 2.0)",
    )
    args = ap.parse_args()

    run_scraper(
        output_path=Path(args.output),
        headless=not args.no_headless,
        max_pages=args.max_pages,
        page_delay_seconds=args.page_delay,
    )


if __name__ == "__main__":
    main()
