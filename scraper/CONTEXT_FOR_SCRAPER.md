# Context: TherapyRoute Scraper for MindEase

Use this as a prompt/context when asking an AI (e.g. Claude) to implement or fix the scraper.

---

## Overall purpose

We have a **MindEase** mental health app with a **therapist directory** on the dashboard. Right now the directory shows **dummy data** (hardcoded Pakistani therapists). We want to replace that with **real therapist data** so users can find licensed professionals in their region and filter by online/in-person.

We are **not** calling TherapyRoute’s API (they may not have a public one). Instead we:

1. **Scrape** therapist listings from the website [TherapyRoute – Pakistan](https://www.therapyroute.com/therapists/pakistan).
2. **Save** the scraped data as a **JSON file** (one array of therapist objects).
3. **Later** (separate step) we will import that JSON into our database and show it in the app, with filtering by user location (e.g. city/nearest major city) and by “online” option.

So the **immediate goal** is: **scrape TherapyRoute → produce one JSON file**. No backend or DB in this step; just scraping and JSON.

---

## How TherapyRoute’s Pakistan section works

- **Main page:** `https://www.therapyroute.com/therapists/pakistan`  
  This page only shows **links to cities** (Lahore, Islamabad, Karachi, Rawalpindi, Sargodha, Faisalabad, Bahawalpur). There are **no therapist cards** on this page.

- **City pages:** e.g. `https://www.therapyroute.com/therapists/pakistan/rawalpindi`  
  Here the **therapist cards** appear. The list may be long; more cards often load by **scrolling** or by clicking a **“Load more” / “Show more”** button. So we must:
  - Open each **city page** (not just the main Pakistan page).
  - **Scroll to the bottom** and/or **click “Load more”** repeatedly until no new cards appear.
  - Then collect data from each **therapist card** on that page.

- **URL structure:**
  - City/listing links: `.../therapists/pakistan/rawalpindi` or `.../rawalpindi#therapist-results` (path has **3** segments: therapists, pakistan, city).
  - Therapist profile links: `.../therapists/pakistan/rawalpindi/maham-abid` (path has **4** segments: therapists, pakistan, city, **therapist-slug**).  
  We only want to treat **4-segment** links as therapist profiles; 3-segment (and hash-only) links are city/listing pages and must be skipped.

- The site is **JavaScript-rendered** (likely React/Next.js). A simple HTTP GET returns mostly the shell; the actual list of therapists is built in the browser. So we need **Playwright** (or similar) to load the page, wait for content, scroll, and then query the DOM.

---

## What we need per therapist (data to scrape)

From each therapist **card** on a city page we want to capture at least:

| Field | Description | Example |
|-------|-------------|--------|
| Name | Full name (we can split into first_name / last_name) | "Ms Maham Abid" |
| Role / credentials | Profession line under the name | "Clinical Psychologist" |
| Location / address | City and/or area (e.g. "Bahria town phase 7, Rawalpindi") | For filtering by user’s city later |
| Languages | Languages spoken | "English, Hindi/Urdu" |
| Service type | Online and/or in-person | "Online & In-person" → store as e.g. `["online", "in-person"]` |
| Specialties | Areas of focus (e.g. trauma, CBT, anxiety) | From bullet lines or bio snippet on the card |
| Profile URL | Link to the therapist’s full profile on TherapyRoute | For “View profile” / external_id |

We do **not** need to scrape individual profile pages for this step; the **card** on the listing page is enough. Optional later: scrape profile page for phone/email if visible.

---

## Output: JSON format

We write a **single JSON file**: an **array of objects**, one per therapist. Each object should have at least:

- `first_name`, `last_name` (or a single `name` if we only have that)
- `credentials` or `role` (e.g. "Clinical Psychologist")
- `specialty` (string, or array of strings if we have multiple)
- `city` (e.g. "Rawalpindi") — we know this from which city page we’re on
- `region` (e.g. "Pakistan")
- `address` (optional, full or partial address from card)
- `languages` (string or array, e.g. "English, Urdu")
- `service_type` (array, e.g. `["online", "in-person"]`)
- `website` or `profile_url` (URL to therapist’s page on TherapyRoute)
- `external_id` (unique id for deduplication, e.g. `"therapyroute_<slug>"` where slug is from the URL)
- `phone_number`, `email` (if we ever get them from the card; otherwise null)

This shape is chosen so we can **later** import the same JSON into our MindEase database (e.g. into a `therapistdirectory` table) without changing the scraper output format.

---

## Technical approach (what the script should do)

1. **Tool:** Python + **Playwright** (browser automation). Install: `pip install playwright`, then `playwright install chromium`.

2. **Location of code:** All scraping logic lives in a folder **`scraper/`** at the **root** of the MindEase project (not inside backend). Main script: `scraper/scrape_therapyroute.py`. Output: write to a path the user passes (e.g. `scraper/output/therapists.json`).

3. **Flow:**
   - Define the list of **city slugs**: lahore, islamabad, karachi, rawalpindi, sargodha, faisalabad, bahawalpur.
   - For **each city**:
     - Open `https://www.therapyroute.com/therapists/pakistan/<city>`.
     - Wait for the page to load (e.g. 4–5 seconds or until a relevant selector appears).
     - **Scroll to bottom** and, if present, **click “Load more” / “Show more”** repeatedly until the number of therapist cards/links stops increasing (or until a max scroll count).
     - Find all links that point to a therapist profile: e.g. `<a href="...">` where `href` contains `/therapists/pakistan/` and the path has **exactly 4 segments** and the **last segment (slug)** is not a city name (rawalpindi, lahore, etc.). Strip query and hash from URLs before checking (so `.../rawalpindi#therapist-results` is not treated as a therapist).
     - For each such link, get the **card text** (e.g. `link.inner_text()` or the card container’s text). Parse it to fill: name, role, location/address, languages, online/in-person, specialties. Set `city` from the current city page. Build one object per therapist and append to a list (deduplicate by slug or profile URL so the same therapist isn’t added twice).
   - After all cities, **write** the list to the output JSON file (pretty-printed, UTF-8).

4. **CLI:** The script should accept at least:
   - `-o / --output` (required): path to output JSON file.
   - Optional: `--city` (repeatable) to restrict to specific cities; `--no-headless` to show the browser; `--max-scrolls` and a delay between scrolls/load-more for politeness.

5. **Politeness:** Use a short delay between scrolls and between city pages. Respect robots.txt and the site’s terms of service; we’re only collecting listing data for our own directory.

---

## Summary in one sentence

We want a **Playwright-based Python script** in **`scraper/scrape_therapyroute.py`** that visits **each TherapyRoute Pakistan city page**, scrolls and clicks “Load more” until all therapist cards are visible, collects **only 4-segment profile links** (not city links), parses each card’s text into structured fields, deduplicates by slug, and **writes one JSON array** of therapist objects to the path given by `-o`, so we can later import that JSON into MindEase and show real therapists in the directory with location and online/in-person filtering.
