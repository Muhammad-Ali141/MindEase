#!/usr/bin/env python3
"""
Scrape psychiatrist listings from Marham.pk and write JSON.

Visits each city's psychiatrist listing page, paginates through all pages
(?page=N), and parses doctor cards. Only includes doctors with >15 reviews.

The site is server-rendered, so cards are available in the initial HTML.

Requirements:
  pip install -r requirements.txt
  playwright install chromium

Usage:
  python scraper/scrape_marham.py -o scraper/output/marham_therapists.json
  python scraper/scrape_marham.py -o out.json --no-headless
  python scraper/scrape_marham.py -o out.json --min-reviews 20
"""

import argparse
import json
import re
import time
from pathlib import Path

SITE_BASE = "https://www.marham.pk"
BASE_PATH = "/doctors/{city}/psychiatrist"

CITIES = [
    "lahore", "karachi", "islamabad", "multan",
    "peshawar", "faisalabad", "sargodha", "quetta",
]

MIN_REVIEWS_DEFAULT = 15


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def split_name(full_name: str) -> tuple[str, str | None]:
    """Split 'Dr. Sameera Naveed' -> ('Sameera', 'Naveed'), dropping titles."""
    titles = {
        "dr", "dr.", "prof", "prof.", "asst", "asst.",
        "assoc", "associate", "mr", "mrs", "ms", "miss",
        "sir", "col", "col.", "brig", "brig.", "maj", "maj.",
        "lt", "lt.", "gen", "gen.",
    }
    parts = (full_name or "").strip().split()
    # Drop leading titles (may be multi-word like "Asst. Prof. Dr.")
    while parts and parts[0].lower().rstrip(".") in titles:
        parts.pop(0)
    if not parts:
        return full_name.strip() if full_name else "—", None
    if len(parts) == 1:
        return parts[0], None
    return parts[0], " ".join(parts[1:])


def parse_review_count(text: str) -> int:
    """Parse '1,028' or '75' into an integer."""
    cleaned = text.strip().replace(",", "")
    try:
        return int(cleaned)
    except ValueError:
        return 0


def extract_specialties(lines: list[str]) -> str | None:
    """
    Extract specialty tags from the card text.
    These appear after 'View Profile' line and before location/fee lines.
    """
    specialties = []
    capture = False
    skip_words = {
        "video consultation", "available today", "available tomorrow",
        "view profile", "video call", "rs.", "pay online",
    }

    for ln in lines:
        low = ln.lower().strip()

        if "view profile" in low:
            capture = True
            continue

        if capture:
            # Stop capturing at location/fee/availability lines
            if any(kw in low for kw in [
                "available", "rs.", "pay online", "consultation fee",
                "hospital", "clinic", "medical", "centre", "center",
            ]):
                break
            if low and low not in skip_words and len(ln) < 50:
                specialties.append(ln.strip())

    return ", ".join(specialties) if specialties else None


def extract_address(lines: list[str]) -> str | None:
    """Extract hospital/clinic address from card text."""
    for ln in lines:
        low = ln.lower()
        if any(kw in low for kw in [
            "hospital", "clinic", "centre", "center", "medical",
            "institute", "complex",
        ]):
            # Clean up the line
            addr = ln.strip()
            if addr and len(addr) > 5:
                return addr[:255]
    return None


# ---------------------------------------------------------------------------
# Card parser
# ---------------------------------------------------------------------------

def parse_doctor_card(card_element, city: str, min_reviews: int) -> dict | None:
    """Parse a single doctor card from the Marham listing page."""
    try:
        card_text = (card_element.inner_text() or "").strip()
        if not card_text or "Reviews" not in card_text:
            return None

        lines = [ln.strip() for ln in card_text.split("\n") if ln.strip()]

        # --- Name ---
        try:
            name_el = card_element.locator("h3").first
            full_name = (name_el.inner_text() or "").strip()
        except Exception:
            full_name = lines[0] if lines else ""

        if not full_name:
            return None

        # --- Profile URL ---
        profile_url = ""
        slug = ""
        try:
            link = card_element.locator("a.dr_profile_opened_from_listing").first
            profile_url = (link.get_attribute("href") or "").strip()
            if profile_url and not profile_url.startswith("http"):
                profile_url = SITE_BASE + profile_url
            # Extract slug from URL
            slug = profile_url.rstrip("/").split("/")[-1]
        except Exception:
            pass

        if not slug:
            return None

        # --- Review count ---
        review_count = 0
        try:
            review_el = card_element.locator("p.text-golden").first
            review_text = (review_el.inner_text() or "").strip()
            review_count = parse_review_count(review_text)
        except Exception:
            # Fallback: find number after "Reviews" in text
            for i, ln in enumerate(lines):
                if ln.strip() == "Reviews" and i + 1 < len(lines):
                    review_count = parse_review_count(lines[i + 1])
                    break

        if review_count < min_reviews:
            return None

        # --- Credentials (MBBS, FCPS, etc.) ---
        credentials = None
        try:
            cred_el = card_element.locator("p.text-sm").nth(1)
            cred_text = (cred_el.inner_text() or "").strip()
            if cred_text and any(kw in cred_text.upper() for kw in [
                "MBBS", "FCPS", "MCPS", "MD", "DPM", "PHD", "MRCP",
                "FRCP", "DIPLOMA", "MS", "BS", "MPHIL",
            ]):
                credentials = cred_text[:200]
        except Exception:
            pass

        # --- Specialty tags ---
        specialty = extract_specialties(lines)

        # --- Service type ---
        service_type = []
        low_text = card_text.lower()
        if "video consultation" in low_text or "video call" in low_text:
            service_type.append("online")
        # All marham doctors have in-person by default (they're listed in a city)
        service_type.append("in-person")

        # --- Address ---
        address = extract_address(lines)

        # --- Build entry ---
        first_name, last_name = split_name(full_name)

        return {
            "first_name": first_name or "—",
            "last_name": last_name,
            "credentials": credentials,
            "specialty": specialty,
            "city": city.capitalize(),
            "region": "Pakistan",
            "phone_number": None,
            "email": None,
            "website": profile_url,
            "languages": "English, Urdu",
            "address": address,
            "external_id": f"marham_{slug}",
            "profile_url": profile_url,
            "service_type": service_type,
        }

    except Exception:
        return None


# ---------------------------------------------------------------------------
# Main scraper
# ---------------------------------------------------------------------------

def run_scraper(
    output_path: Path,
    headless: bool = True,
    min_reviews: int = MIN_REVIEWS_DEFAULT,
    max_pages_per_city: int = 15,
    page_delay: float = 2.0,
) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit(
            "Playwright not installed. Run:\n"
            "  pip install -r scraper/requirements.txt\n"
            "  playwright install chromium"
        )

    all_doctors: list[dict] = []
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

        for city in CITIES:
            print(f"\n{'='*50}")
            print(f"  {city.upper()}")
            print(f"{'='*50}")

            empty_pages = 0

            for page_num in range(1, max_pages_per_city + 1):
                url = f"{SITE_BASE}{BASE_PATH.format(city=city)}?page={page_num}"
                print(f"\n  Page {page_num}: {url}")

                try:
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_timeout(3000)
                except Exception as e:
                    print(f"    Failed to load: {e}")
                    break

                # Scroll to load any lazy content
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

                cards = page.locator("div.shadow-card").all()
                doctor_count = 0
                page_new = 0

                for card in cards:
                    entry = parse_doctor_card(card, city, min_reviews)
                    if not entry:
                        continue

                    doctor_count += 1
                    eid = entry["external_id"]
                    if eid in seen_slugs:
                        continue
                    seen_slugs.add(eid)
                    all_doctors.append(entry)
                    page_new += 1
                    print(f"    + {entry['first_name']} {entry['last_name'] or ''} "
                          f"({entry['city']})")

                print(f"    Found {doctor_count} doctors with >{min_reviews} reviews, "
                      f"{page_new} new (total: {len(all_doctors)})")

                # Stop if no new unique doctors (Marham repeats top 5 on every page)
                if page_new == 0:
                    empty_pages += 1
                    if empty_pages >= 2:
                        print(f"    No new doctors for {empty_pages} pages. Moving to next city.")
                        break
                else:
                    empty_pages = 0

                # Politeness delay
                time.sleep(page_delay)

        browser.close()

    # Write output
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_doctors, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nDone! Wrote {len(all_doctors)} doctors to {output_path}")


def main():
    ap = argparse.ArgumentParser(
        description="Scrape Marham.pk psychiatrist listings."
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
        "--min-reviews", type=int, default=MIN_REVIEWS_DEFAULT,
        help=f"Minimum review count to include (default {MIN_REVIEWS_DEFAULT})",
    )
    ap.add_argument(
        "--max-pages", type=int, default=15,
        help="Max pages per city (default 15)",
    )
    ap.add_argument(
        "--page-delay", type=float, default=2.0,
        help="Seconds between page loads (default 2.0)",
    )
    args = ap.parse_args()

    run_scraper(
        output_path=Path(args.output),
        headless=not args.no_headless,
        min_reviews=args.min_reviews,
        max_pages_per_city=args.max_pages,
        page_delay=args.page_delay,
    )


if __name__ == "__main__":
    main()
