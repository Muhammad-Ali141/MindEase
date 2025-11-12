## Migrating MindEase From MySQL to PostgreSQL (Partner Guide)

Follow these steps to convert your local setup so that Django and the chatbot both use PostgreSQL instead of MySQL. The instructions assume you already cloned the latest repo (with the new Postgres-ready code) and you will run everything inside the existing virtual environment `venv`.

---

### 1. Prep Work

1. **Activate venv**
   ```powershell
   cd B:\Uni\FYP\Implementation\MindEase\MindEase
   .\venv\Scripts\Activate.ps1
   ```
2. **Install/confirm dependencies**

   ```powershell
   pip install -r backend\requirements.txt
   ```

   (Notice `mysqlclient` is no longer required; `psycopg2-binary` is the DB driver.)

3. **Install PostgreSQL 18+ with pgvector extension**

   - Use the official installer (https://www.postgresql.org/download/).
   - During install, enable the **pgvector** extension if prompted (or add it manually later).

4. **Ensure the RAG prerequisites still exist**
   - `dataset/MentalChat16K.csv`
   - `deberta_best/model.safetensors`
   - Ollama model `llama3.1:8b` (run `ollama list` to confirm).

---

### 2. Configure Environment Variables (.env Recommended)

Create `backend/.env` (or update it) with the new database credentials:

```env
DJANGO_DB_ENGINE=django.db.backends.postgresql
DB_NAME=mentalhealthdb
DB_USER=postgres
DB_PASSWORD=<your-postgres-password>
DB_HOST=localhost
DB_PORT=5432
```

Because `backend/backend/settings.py` now loads these via `dotenv`, Django will automatically use PostgreSQL after you save this file.

> Alternatively, you can export the same variables in the shell before running Django, but the shared approach is to keep them in `backend/.env`.

---

### 3. Create / Prepare the PostgreSQL Database

1. Launch `psql`:
   ```powershell
   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres
   ```
2. Inside `psql`, create the DB and enable pgvector if not already present:
   ```sql
   CREATE DATABASE mentalhealthdb;
   \c mentalhealthdb
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

---

### 4. Apply Django Migrations

From the repo root (venv still active):

```powershell
cd backend
python manage.py migrate
cd ..
```

This creates all application tables (`user`, `session`, `message`, etc.) plus pgvector tables for RAG.

---

### 5. Import Data From the Old MySQL Dump (Optional but Recommended)

If you already have MySQL TSV exports (check `backups/`), use the helper script:

1. Place the TSV exports in `backups/`.
2. Run the importer via Django shell:
   ```powershell
   cd backend
   python manage.py shell -c "import sys; sys.path.append(r'B:\\Uni\\FYP\\Implementation\\MindEase\\MindEase'); import backups.import_mysql_users as script; script.run()"
   cd ..
   ```
   This copies `user` and `emailverification` records into PostgreSQL and resets sequences.
3. Verify counts:
   ```powershell
   cd backend
   python manage.py shell -c "from api.models import User, EmailVerification; print('User:', User.objects.count()); print('EmailVerification:', EmailVerification.objects.count())"
   cd ..
   ```

---

### 6. Verify RAG Database Still Works

Ensure the vector tables are present:

```powershell
$env:PYTHONPATH = 'B:\Uni\FYP\Implementation\MindEase\MindEase\backend'
python backend\chatbot\tests\test_phase1.py
```

All tests should pass.

---

### 7. Start Django Backend & Confirm OTP Logging

1. Start the dev server:
   ```powershell
   cd backend
   python manage.py runserver
   ```
   (Ollama will auto-start if not already running.)
2. In another shell, confirm the `/api/send-otp/` endpoint works and logs to the console:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/send-otp/ \
     -Body (@{ email = 'test@example.com' } | ConvertTo-Json) \
     -ContentType 'application/json'
   ```
   You should see the response `{"message": "OTP sent..."}` in the caller shell and the email content (OTP digits) printed in the window where `runserver` is running (because `EMAIL_BACKEND` is set to `django.core.mail.backends.console.EmailBackend`).

---

### 8. Run Frontend & Finish

1. In another terminal:
   ```powershell
   cd B:\Uni\FYP\Implementation\MindEase\MindEase
   npm install
   npm run dev
   ```
2. Open http://localhost:3000 and verify the registration flow now hits the local backend and logs the OTP as expected.

---

### 9. Keep Backups Local

Thanks to `.gitignore`, the `backups/` directory is ignored. Keep your dumps/TSVs there for safekeeping; no need to commit them.

---

### 10. Session Persistence & Maintenance

- Chat transcripts now persist to PostgreSQL (`session`, `message`, `summary`, `session_archive_job`). After pulling, always run `python manage.py migrate` so migrations `0007_session_schema_overhaul.py`, `0008_message_user_cleanup.py`, `0009_session_uuid_per_user.py`, and `0010_session_resume_message.py` apply.
- When adding new tables or columns, run `python manage.py makemigrations` / `migrate` to update the PostgreSQL schema.
- Regular backups:
  ```powershell
  "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -U postgres -d mentalhealthdb -Fc -f backups\postgres_mindease_<date>.dump
  ```

#### Session Persistence Quick Check (after the first run)

1. **Apply migrations** – `python manage.py migrate` (already covered above).
2. **Smoke-test the chat flow** – start a brief session, end it, and confirm:
   - the dashboard counter increments;
   - the new session tile shows a short summary;
   - `session` and `message` tables reflect the transcript in PostgreSQL.
3. **Exercise rotation (optional but recommended)** – create four non-starred chats and ensure the oldest one flips to `summary_only` with a “Welcome back” reminder. To process pending archive jobs immediately, run:
   ```powershell
   cd backend
   python manage.py process_session_archives --batch-size 10
   cd ..
   ```
   The background worker now triggers automatically after each save, but this command is handy if you want to bootstrap an existing database.
4. **Frontend resume behaviour** – reopen a `summary_only` session and verify the chat opens with the saved reminder instead of the full transcript.

Following this guide ensures everyone runs solely on PostgreSQL with the same settings, imports legacy data, and confirms the OTP emails are still visible in the console during development. When you’re done, stop the dev server with `CTRL+C` just like before.

---

### Appendix: Code Changes Since Latest Repo Fetch (Nov 11 2025)

- **Database schema**
  - Added `city` and free-text `nearest_major_city` fields to the `user` table with auto-managed timestamps (`api/migrations/0005_user_location_fields.py`, `0006_expand_major_city_field.py`).
  - Overhauled chat persistence schema (`api/migrations/0007_session_schema_overhaul.py`, `0008_message_user_cleanup.py`, `0009_session_uuid_per_user.py`) to store transcripts, summaries, and deferred rotation jobs in PostgreSQL.
  - Updated `api/models.py` and `api/views.py` so registration/profile APIs require and persist the new location fields.
- **Backend behavior**
  - Registration/login/profile endpoints now return the user’s location data and keep `updated_at` in sync on profile edits.
  - Chat APIs save messages (with emotion metadata), summaries, and session metadata directly to PostgreSQL. Deferred rotation jobs can be processed via `python manage.py process_session_archives`.
- **Frontend updates**
  - Registration and profile forms capture `City` plus `Nearest Major City` via text input with suggestions (no hardcoded dropdown).
  - Auth context includes the new fields so subsequent API calls have the correct user metadata.
  - Chat/session UIs consume the new UUID-based session IDs, star toggles, and summary-only indicators.
- **Migrations to run**
  - After pulling, activate `venv`, then execute:
    ```powershell
    cd backend
    python manage.py migrate
    cd ..
    ```
- **Testing performed**
  - Ran `python manage.py migrate` locally to apply the new migrations.
  - Verified registration/profile flows accept custom nearest-major-city input.
  - Exercised chat workflows end-to-end (message persistence, summaries, star toggles).
