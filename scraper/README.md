# TherapyRoute Scraper

Scrapes therapist listings from [TherapyRoute – Pakistan](https://www.therapyroute.com/therapists/pakistan) and writes a **JSON file**. The main Pakistan page only shows **city links** (Lahore, Islamabad, Karachi, etc.); therapist cards load on each **city page**. This script visits each city URL, scrolls and clicks "Load more" to reveal all cards, then collects therapist data. You can sort by location when displaying in MindEase.

## Setup

From the project root or from `scraper/`:

```bash
pip install -r scraper/requirements.txt
playwright install chromium
```

## Usage

**Output path is required.** Run from project root `MindEase/`:

```bash
# Scrape all cities (lahore, islamabad, karachi, rawalpindi, sargodha, faisalabad, bahawalpur)
python scraper/scrape_therapyroute.py -o scraper/output/therapists.json

# Only specific cities
python scraper/scrape_therapyroute.py -o scraper/output/therapists.json --city rawalpindi --city lahore

# Show browser (useful for debugging)
python scraper/scrape_therapyroute.py -o scraper/output/therapists.json --no-headless

# More scroll rounds per city / longer wait
python scraper/scrape_therapyroute.py -o scraper/output/therapists.json --max-scrolls 40 --scroll-delay 3000
```

## Output JSON

Each item in the array includes:

| Field | Description |
|-------|-------------|
| `first_name`, `last_name` | From card title |
| `credentials` | Role line (e.g. "Clinical Psychologist") |
| `specialty` | Specializations / areas (from card text) |
| `city` | City (e.g. Lahore, Islamabad) |
| `region` | "Pakistan" |
| `languages` | e.g. "English, Hindi/Urdu" |
| `website` | Profile URL on TherapyRoute |
| `profile_url` | Same as website |
| `external_id` | `therapyroute_<slug>` for deduplication |
| `service_type` | `["online", "in-person"]` when detected |
| `role` | Profession when detected |
| `address` | Location line when present |
| `phone_number`, `email` | Not on listing cards; leave null unless you add profile scraping |

The same JSON shape is compatible with a future import step into the MindEase database (e.g. `import_therapists` when the directory table supports these fields).

## Legal / ToS

Respect TherapyRoute’s terms of service and `robots.txt`. Run occasionally; use `--delay` to avoid overloading the site. You are responsible for compliance.
