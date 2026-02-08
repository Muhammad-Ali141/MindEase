#!/usr/bin/env python3
"""
Scrape therapist listings from TherapyRoute (Pakistan) and output JSON
for import via: python manage.py import_therapists <output.json>

Requirements:
  pip install playwright
  playwright install chromium

Usage (from backend/):
  python scripts/scrape_therapyroute.py -o therapyroute_therapists.json
  python scripts/scrape_therapyroute.py -o out.json --city lahore --max-pages 2

Important: Respect TherapyRoute's terms of service and robots.txt.
Run occasionally; do not hammer the site. You are responsible for compliance.
"""

import argparse
import json
import re
import time
from pathlib import Path

# Cities from TherapyRoute Pakistan listing
DEFAULT_CITIES = [
    "pakistan",  # all Pakistan first
    "lahore",
    "islamabad",
    "karachi",
    "rawalpindi",
    "sargodha",
    "faisalabad",
    "bahawalpur",
]

BASE_URL = "https://www.therapyroute.com/therapists/pakistan"


def normalize(s: str | None) -> str | None:
    if s is None:
        return None
    t = s.strip()
    return t if t else None


def split_name(full_name: str) -> tuple[str, str]:
    """Split 'Fizza Anis' -> ('Fizza', 'Anis'); 'Dr. Ali' -> ('Dr.', 'Ali')."""
    full_name = (full_name or "").strip()
    if not full_name:
        return "—", ""
    parts = full_name.split()
    if len(parts) <= 1:
        return full_name, ""
    return parts[0], " ".join(parts[1:])


def run_scraper(
    output_path: Path,
    cities: list[str],
    max_pages_per_city: int = 3,
    headless: bool = True,
) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit(
            "Playwright not installed. Run: pip install playwright && playwright install chromium"
        )

    all_therapists: list[dict] = []
    seen_ids: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0"
        )
        page = context.new_page()
        page.set_default_timeout(20000)

        for city in cities:
            base = f"{BASE_URL}/{city}" if city != "pakistan" else BASE_URL
            for page_num in range(1, max_pages_per_city + 1):
                url = f"{base}?page={page_num}" if page_num > 1 else base
                print(f"Fetching: {url}")
                try:
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_timeout(3000)  # let JS render list
                except Exception as e:
                    print(f"  Skip ({e})")
                    continue

                # Collect all links that look like therapist profile pages (not just city/country).
                # TherapyRoute URLs: .../pakistan, .../pakistan/lahore, .../pakistan/lahore/therapist-slug
                links = page.locator('a[href*="/therapists/pakistan/"]').all()
                for link in links:
                    try:
                        href = (link.get_attribute("href") or "").split("?")[0].rstrip("/")
                        if not href:
                            continue
                        parts = href.replace("https://www.therapyroute.com", "").strip("/").split("/")
                        # .../pakistan or .../pakistan/lahore -> skip (listing pages)
                        if len(parts) <= 2:
                            continue
                        slug = parts[-1]
                        if slug.lower() in {
                            "pakistan", "lahore", "islamabad", "karachi", "rawalpindi",
                            "sargodha", "faisalabad", "bahawalpur", "therapist-results",
                        }:
                            continue
                        if slug in seen_ids:
                            continue
                        seen_ids.add(slug)
                        card_text = normalize(link.inner_text())
                        if not card_text or len(card_text) < 10:
                            continue
                        first_line = card_text.split("\n")[0].strip()
                        first, last = split_name(first_line)
                        profile_url = href if href.startswith("http") else "https://www.therapyroute.com" + (href if href.startswith("/") else "/" + href)
                        entry = {
                            "first_name": first,
                            "last_name": last or None,
                            "credentials": None,
                            "specialty": None,
                            "city": city if city != "pakistan" else None,
                            "region": "Pakistan",
                            "phone_number": None,
                            "email": None,
                            "website": profile_url,
                            "languages": None,
                            "address": None,
                            "external_id": f"therapyroute_{slug}",
                        }
                        lines = [ln.strip() for ln in card_text.split("\n") if ln.strip()]
                        for i, ln in enumerate(lines):
                            if i == 0:
                                continue
                            ln_lower = ln.lower()
                            if "psychologist" in ln_lower or "counselor" in ln_lower or "therapist" in ln_lower or "psychiatrist" in ln_lower:
                                entry["credentials"] = (entry["credentials"] or "") + ("; " if entry["credentials"] else "") + ln[:150]
                            elif any(c in ln_lower for c in ["karachi", "lahore", "islamabad", "rawalpindi", "faisalabad", "sargodha", "bahawalpur"]):
                                if not entry["city"]:
                                    for c in ["karachi", "lahore", "islamabad", "rawalpindi", "faisalabad", "sargodha", "bahawalpur"]:
                                        if c in ln_lower:
                                            entry["city"] = c.capitalize()
                                            break
                            elif "english" in ln_lower or "urdu" in ln_lower or "hindi" in ln_lower or "punjabi" in ln_lower:
                                entry["languages"] = ln[:200]
                            elif "online" in ln_lower or "in-person" in ln_lower or "in person" in ln_lower:
                                if entry["specialty"]:
                                    entry["specialty"] = entry["specialty"] + "; " + ln[:100]
                                else:
                                    entry["specialty"] = ln[:100]
                            elif len(ln) > 25 and (not entry["specialty"] or "therapy" in ln_lower or "cbt" in ln_lower or "act" in ln_lower):
                                entry["specialty"] = (entry["specialty"] or "") + ("; " if entry["specialty"] else "") + ln[:150]
                        if entry["credentials"] and len(entry["credentials"]) > 200:
                            entry["credentials"] = entry["credentials"][:200]
                        if entry["specialty"] and len(entry["specialty"]) > 200:
                            entry["specialty"] = entry["specialty"][:200]
                        all_therapists.append(entry)
                        print(f"  + {entry['first_name']} {entry['last_name']} ({entry.get('city') or '?'})")
                    except Exception:
                        continue
                time.sleep(1)

        browser.close()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(all_therapists, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(all_therapists)} therapists to {output_path}")


def main():
    ap = argparse.ArgumentParser(description="Scrape TherapyRoute Pakistan therapist list to JSON.")
    ap.add_argument("-o", "--output", required=True, help="Output JSON file path")
    ap.add_argument("--city", action="append", help="City to scrape (repeat for multiple); default: all")
    ap.add_argument("--max-pages", type=int, default=3, help="Max pagination pages per city (default 3)")
    ap.add_argument("--no-headless", action="store_true", help="Show browser window")
    args = ap.parse_args()
    cities = args.city if args.city else DEFAULT_CITIES
    run_scraper(
        output_path=Path(args.output),
        cities=cities,
        max_pages_per_city=args.max_pages,
        headless=not args.no_headless,
    )


if __name__ == "__main__":
    main()
