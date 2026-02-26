# Scripts

## scrape_therapyroute.py

Scrapes therapist listings from [TherapyRoute Pakistan](https://www.therapyroute.com/therapists/pakistan) and writes JSON for import into the MindEase therapist directory.

**Setup:**

```bash
pip install playwright
playwright install chromium
```

**Run (from `backend/`):**

```bash
python scripts/scrape_therapyroute.py -o therapyroute_therapists.json
```

Then import:

```bash
python manage.py import_therapists therapyroute_therapists.json
```

See [docs/THERAPIST_DIRECTORY.md](../../docs/THERAPIST_DIRECTORY.md) for full options and legal notes.
