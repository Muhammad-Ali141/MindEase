# Setup Guide for Partners (Cursor-Friendly)

You (or Cursor) can copy/paste these steps exactly. Every command block is ready to run, and the only file you should personalise is `backend/chatbot/.env`.

---

## 1. Verify prerequisites

Make sure these tools are available:

- Git
- Node.js 18+ (ships with npm)
- Python 3.10+
- pip
- PostgreSQL 14+ with the `pgvector` extension
- MySQL 8+
- Ollama CLI / desktop app

Quick confirmations:

```bash
node -v
python --version
psql --version
ollama --version
```

---

## 2. Sync the repository

```bash
git clone https://github.com/Hasnain2430/MindEase.git
cd MindEase
git fetch origin
git checkout main
git pull origin main
```

Stay on `main` unless we coordinate a feature branch.

---

## 3. Install frontend dependencies

```bash
cd MindEase
npm install
```

The frontend already points to `http://127.0.0.1:8000/api`, so no `.env.local` is needed yet.

---

## 4. Set up the backend virtual environment

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
pip install python-dotenv    # only if it is missing
```

The Django app consumes the chatbot package and the shared MySQL schema.

---

## 5. Create and customise `.env`

### 5.1 Copy the template (Cursor-ready commands)

```bash
cd backend/chatbot
copy env.example .env        # Windows
```

```bash
cd backend/chatbot
cp env.example .env          # macOS / Linux
```

### 5.2 Update values (hand this patch to Cursor and replace the placeholder)

```text
<apply_patch>
*** Begin Patch
*** Update File: backend/chatbot/.env
@@
-DB_PASSWORD=your_password_here
+DB_PASSWORD=REPLACE_WITH_POSTGRES_PASSWORD
@@
-# DEBERTA_MODEL_PATH=/path/to/deberta_best
-# DATASET_PATH=/path/to/dataset/MentalChat16K.csv
+# DEBERTA_MODEL_PATH=/absolute/path/to/deberta_best
+# DATASET_PATH=/absolute/path/to/dataset/MentalChat16K.csv
*** End Patch
```

Before running the patch:

- Swap `REPLACE_WITH_POSTGRES_PASSWORD` for your local PostgreSQL password.
- Uncomment and edit the optional path variables only if your assets live outside the repo (use absolute paths).
- Keep `OLLAMA_MODEL` unchanged unless you have a differently named local model.

No other repository files should be edited.

---

## 6. Prepare databases and embeddings

1. **PostgreSQL setup**
   ```sql
   CREATE DATABASE mentalhealthdb;
   \c mentalhealthdb
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. **Copy large assets (not tracked in git)**
   - `deberta_best/model.safetensors`
   - `dataset/MentalChat16K.csv`
3. **Build the vector store** (only if you do not already have embeddings locally)
   ```bash
   cd backend/chatbot
   python build_database.py
   ```
   This loads the dataset, chunks text, and stores embeddings in PostgreSQL.

---

## 7. Pull the Ollama model

```bash
ollama pull llama3.1:8b-instruct
# optional alternatives:
# ollama pull llama3.1:8b
# ollama pull llama3.1:8b-instruct-q4_K_M
```

`python manage.py runserver` now auto-starts `ollama serve`, so no separate command is needed.

---

## 8. Apply Django Migrations

After setting up PostgreSQL, you need to apply Django migrations to create all application tables:

```bash
cd backend
python manage.py migrate
cd ..
```

This will create all necessary tables including:
- User authentication tables
- Session and message storage tables
- Dashboard tour tracking (for first-time user onboarding)

---

## 9. Verify Setup

Run the Phase 1 test to verify database setup:

```bash
cd backend/chatbot
python tests/test_phase1.py
```

If all tests pass, you're ready!

---

## 10. Run backend and frontend

Open two terminals in the project root.

**Backend**
```bash
cd backend
venv\Scripts\activate        # or source venv/bin/activate
python manage.py runserver
```
- Serves Django at `http://127.0.0.1:8000/`.
- Automatically checks and launches `ollama serve` if it is not already running.

**Frontend**
```bash
cd MindEase
npm run dev
```
- Next.js runs at `http://localhost:3000/`.
- Routes guarded by Auth require you to log in first.

### First-Time User Experience

When a new user registers and logs in for the first time, they will see an interactive onboarding tutorial that guides them through the dashboard features. The tutorial can be replayed anytime by clicking the "Tutorial" button (sparkles icon) in the header.

---

## 11. Verify everything works

1. Visit `http://localhost:3000/` and toggle dark/light mode.
2. Log in and confirm the dashboard shows “Sessions Completed” and “Recent Sessions”.
3. Start `Quick Check-in → Text Chat`, send at least one message, end the chat, and ensure:
   - The summary uses the user’s first name and correct pronouns.
   - Session count increments only on new sessions.
   - Recent sessions list an LLM-generated title.
4. Open `View All Sessions`, resume an older session, and end it to see an updated summary.

---

## 12. Troubleshooting tips

- **PostgreSQL errors**: verify credentials in `.env`, ensure `pgvector` exists, and confirm the embeddings tables were created.
- **MySQL access issues**: adjust credentials in `backend/backend/settings.py` only if your local schema differs.
- **Missing Ollama model**: run `ollama list` and re-pull if necessary.
- **Slow first LLM reply**: make sure the model is downloaded; the server now auto-starts Ollama but still loads the model on demand.
- **Frontend 401/403 responses**: confirm you are logged in—JWT auth protects chat routes.

---

## 13. Project structure (high level)

```
MindEase/
├── app/                     # Next.js routes (dashboard, chat, sessions, profile, auth)
├── components/              # UI building blocks (theme toggle, chat UI, stats, etc.)
├── context/                 # React contexts (Auth)
├── lib/api.ts               # Frontend API client talking to Django
├── backend/
│   ├── api/                 # Django views + serializers
│   ├── chatbot/             # Emotion detector, RAG, LLM client, memory
│   ├── backend/             # Django project settings/urls
│   └── manage.py            # Auto-starts Ollama when runserver executes
├── dataset/                 # Bring your own MentalChat16K.csv
├── deberta_best/            # Bring your own model.safetensors
└── SETUP_FOR_PARTNER.md     # This guide
```

---

## 14. Quick checklist

- [ ] Cloned repository
- [ ] `git pull origin main`
- [ ] `npm install`
- [ ] Python virtualenv created & activated
- [ ] `pip install -r backend/requirements.txt`
- [ ] `.env` created in `backend/chatbot` with database password
- [ ] PostgreSQL installed and running
- [ ] Database created (`mentalhealthdb`)
- [ ] pgvector extension installed
- [ ] DeBERTa model files downloaded/copied
- [ ] MentalChat16K dataset downloaded
- [ ] Database built (`build_database.py` run successfully)
- [ ] Django migrations applied (`python manage.py migrate`)
- [ ] `ollama pull llama3.1:8b-instruct`
- [ ] Tests passing (`test_phase1.py`)
- [ ] Django backend running (`python manage.py runserver`)
- [ ] Next.js frontend running (`npm run dev`)

Once everything above is checked, you should be able to run the project exactly like the owner—only the environment values differ per machine. Happy building!

