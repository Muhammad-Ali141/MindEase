# Therapist Directory – Real Data

The dashboard **Find a Professional Therapist** section reads from the database. To show real therapists you need to populate the `therapistdirectory` table using one of the methods below.

## 1. US data: NPI Registry (official, free)

The US [NPI Registry](https://npiregistry.cms.hhs.gov/api-page) exposes a free, read-only API. No API key is required.

**Run from the backend directory** (with your Django venv active):

```bash
# Fetch Psychologists in California (default taxonomy: Psychologist)
python manage.py fetch_npi_therapists --state CA

# Multiple states
python manage.py fetch_npi_therapists --state CA,NY,TX

# Psychiatrists instead
python manage.py fetch_npi_therapists --state CA --taxonomy Psychiatrist

# Limit total records (API returns up to 200 per request, max 1200 with paging)
python manage.py fetch_npi_therapists --state CA --limit 100

# Preview without writing to DB
python manage.py fetch_npi_therapists --state CA --dry-run
```

This creates/updates rows in `therapistdirectory` with `source=npi` and `external_id=npi_<NPI number>` so the same provider is not duplicated.

## 2. Any region: Import from JSON (scraped or manual)

For Pakistan or other regions without a single public API, you can:

1. **Scrape or curate** a list of therapists and save it as a JSON file.
2. **Import** that file into the directory.

**JSON format** (array of objects):

```json
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
```

Optional: `"external_id": "unique_id"` for deduplication (e.g. from the source site).

**Run:**

```bash
python manage.py import_therapists path/to/therapists.json
python manage.py import_therapists path/to/therapists.json --dry-run
```

### TherapyRoute Pakistan scraper (included)

A script is provided to scrape [TherapyRoute – Find Therapists in Pakistan](https://www.therapyroute.com/therapists/pakistan) and output JSON for import. TherapyRoute lists therapists by **city** (Lahore, Islamabad, Karachi, Rawalpindi, Sargodha, Faisalabad, Bahawalpur) and supports filters by profession, specialty, and service type (in-person / online). The scraper collects listing data; you can later add similar filters (city, profession, specialty) to the MindEase directory UI.

**Requirements:** Playwright (for JS-rendered content).

```bash
cd backend
pip install playwright
playwright install chromium
```

**Run the scraper:**

```bash
# From backend/ directory
python scripts/scrape_therapyroute.py -o therapyroute_therapists.json

# One city only, limit pages
python scripts/scrape_therapyroute.py -o out.json --city lahore --city karachi --max-pages 2

# Show browser window (useful if selectors need debugging)
python scripts/scrape_therapyroute.py -o out.json --no-headless
```

Then import into the database:

```bash
python manage.py import_therapists therapyroute_therapists.json
```

**Legal / ToS:** Respect TherapyRoute’s terms of service and robots.txt. Run occasionally; do not overload the site. You are responsible for compliance.

### Other Pakistan sources (manual or custom scrape)

- [Pakistan Mental Health Coalition (PMHC) directory](https://pakmh.com/service-providers/)
- [Counseling.pk](https://counseling.pk/therapists/)
- [Psychology Matters Asia – Pakistan](https://www.psychologymattersasia.org/find_therapist/Pakistan/)

You can write a one-off script, export to the same JSON format, then run `import_therapists`. Ensure you comply with each site’s terms of service and rate limits.

## 3. API used by the frontend

- **Endpoint:** `POST /api/therapists/`
- **Body:** `{ "user_id": "<id>", "city": "optional", "nearest_major_city": "optional" }`
- If `city` / `nearest_major_city` are omitted, the backend uses the user’s profile (city, nearest_major_city).
- Response: `{ "therapists": [ { "id", "name", "credentials", "specialty", "city", "region", "phone", "email", "website", "languages" }, ... ] }`
- Results are **sorted** so therapists in the user’s city appear first, then nearest major city, then others.

**Adding filters on our website:** TherapyRoute offers filters by **city**, **profession**, **specialty**, and **service** (in-person / online). To offer the same on MindEase: add optional query params to `GET /api/therapists/` (e.g. `?city=Lahore&specialty=CBT`) and filter in the view; then add dropdowns or chips in the dashboard `TherapistDirectory` component (city, profession, specialty) that call the API with those params. The `therapistdirectory` table already has `city`, `region`, and `specialty`; you can add a `profession` or `service_type` column if needed.

## 4. Apply the migration

Before using the directory or running the commands, apply the extended therapist directory migration:

```bash
cd backend
python manage.py migrate api
```

Then run one or more of the data ingestion steps above.
