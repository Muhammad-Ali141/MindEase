"""
Merge TherapyRoute and Marham therapist JSONs into one file with no duplicates.
Strips phone_number and email from all entries.
"""
import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
THERAPYROUTE_JSON = OUTPUT_DIR / "therapists.json"
MARHAM_JSON = OUTPUT_DIR / "marham_therapists.json"
COMBINED_JSON = OUTPUT_DIR / "combined_therapists.json"

FIELDS_TO_REMOVE = {"phone_number", "email"}


def norm(t):
    """Normalized (first_name, last_name, city) for dedup."""
    fn = (t.get("first_name") or "").strip().lower()
    ln = (t.get("last_name") or "").strip().lower()
    city = (t.get("city") or "").strip().lower()
    return (fn, ln, city)


def clean_entry(entry):
    """Return a copy without phone_number and email."""
    return {k: v for k, v in entry.items() if k not in FIELDS_TO_REMOVE}


def main():
    with open(THERAPYROUTE_JSON, "r", encoding="utf-8") as f:
        tr = json.load(f)
    with open(MARHAM_JSON, "r", encoding="utf-8") as f:
        mar = json.load(f)

    seen = {}
    merged = []

    for entry in tr + mar:
        key = norm(entry)
        if key in seen:
            continue
        seen[key] = True
        merged.append(clean_entry(entry))

    with open(COMBINED_JSON, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"TherapyRoute: {len(tr)}, Marham: {len(mar)}")
    print(f"Combined (no dups, no phone/email): {len(merged)}")
    print(f"Written to: {COMBINED_JSON}")


if __name__ == "__main__":
    main()
