# MindEase Setup After Windows Reinstall

This guide gets the full system running from scratch. **Order matters:** do Phase 1 (database) first, then Phase 2 (libraries and app).

---

## Phase 1: Database (PostgreSQL, pgAdmin, pgvector)

### 1.1 Install PostgreSQL

- **Download:** https://www.postgresql.org/download/windows/
- Use the **EnterpriseDB installer** (e.g. PostgreSQL 16 or 17).
- During setup:
  - Set a **password for the `postgres` user** (remember it for `.env`).
  - Default port **5432** is fine.
  - Install **Stack Builder** only if you need extra tools (optional).
- Confirm installation:
  ```powershell
  & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "SELECT version();"
  ```
  (Adjust `17` to your version if different.)

### 1.2 Install pgAdmin (optional but useful)

- **Download:** https://www.pgadmin.org/download/pgadmin-4-windows/
- Install and open. Set a master password when prompted.
- Add a server: **Host:** `localhost`, **Port:** `5432`, **Username:** `postgres`, **Password:** (your postgres password).

### 1.3 Install pgvector extension

PostgreSQL does not include pgvector by default; you must add it.

**Option A – Pre-built (Windows, recommended):**

1. **Download:** https://github.com/pgvector/pgvector/releases  
   Get the ZIP for your PostgreSQL version (e.g. `pgvector-v0.7.0-pg16-windows-x64.zip`).
2. Find your PostgreSQL install (e.g. `C:\Program Files\PostgreSQL\17`).
3. From the ZIP:
   - Copy **`.dll`** files into `PostgreSQL\17\lib`.
   - Copy **`.sql`** and **`.control`** into `PostgreSQL\17\share\extension`.
4. Restart PostgreSQL service (Services → PostgreSQL 17 → Restart) if it was running.

**Option B – Build from source:**  
See https://github.com/pgvector/pgvector#installation (requires Visual Studio build tools).

### 1.4 Create database and enable pgvector

In **psql** or **pgAdmin Query Tool** (connected as `postgres`):

```sql
CREATE DATABASE mentalhealthdb;
\c mentalhealthdb
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

Or from PowerShell (adjust path/version):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE mentalhealthdb;"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d mentalhealthdb -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 1.5 Run RAG schema (input_chunks / output_chunks)

From the **MindEase project root**:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d mentalhealthdb -f backend\chatbot\postgresql_schema.sql
```

(Change `17` to your PostgreSQL version.) This creates the RAG tables and indexes.

### 1.6 Apply Django migrations (app tables)

After your **Python venv is active** and **backend dependencies are installed** (see Phase 2), run:

```powershell
cd backend
python manage.py migrate
cd ..
```

This creates Django tables (users, sessions, messages, etc.) in `mentalhealthdb`. So: **do Phase 2 first**, then come back and run this step.

---

## Phase 2: Libraries and environment

### 2.1 Python version

- Use **Python 3.10 or 3.11** (required for TTS; 3.12+ is not supported by Coqui TTS).
- Check: `python --version` or `py -3.11 --version`.

### 2.2 Virtual environment (venv)

If you already have a venv (e.g. at project root or in `backend`), use it. Otherwise create one at **project root**:

```powershell
cd B:\Uni\FYP\Implementation\MindEase\MindEase
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Or with a specific Python:

```powershell
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
```

Confirm: `(venv)` appears in the prompt and `where python` points inside `venv`.

### 2.3 Backend Python dependencies

From project root with venv active:

```powershell
pip install -r backend\requirements.txt
```

This installs Django, psycopg2-binary, djangorestframework, JWT, CORS, transformers, sentence-transformers, torch, TTS, faster-whisper, and the rest. First run can take several minutes (PyTorch/TTS).

### 2.4 Environment files (.env)

**A. Chatbot / RAG (required)**  
Copy and edit:

```powershell
copy backend\chatbot\env.example backend\chatbot\.env
notepad backend\chatbot\.env
```

Set at least:

- `DB_PASSWORD=` **your postgres password**
- `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=mentalhealthdb`, `DB_USER=postgres`

**B. Django (recommended)**  
So Django uses the same DB without hardcoding password in `settings.py`, create:

```powershell
# Create backend\.env with:
notepad backend\.env
```

Put in:

```env
DJANGO_DB_ENGINE=django.db.backends.postgresql
DB_NAME=mentalhealthdb
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DB_HOST=localhost
DB_PORT=5432
```

Django’s `settings.py` already loads `backend/.env` via `load_dotenv`. Use the same password as in `backend/chatbot/.env`.

### 2.5 Frontend (Node) dependencies

From project root (venv not required for this):

```powershell
npm install
```

Use `pnpm install` if the project uses pnpm (you have `pnpm-lock.yaml`).

---

## Phase 3: Finish database (migrations)

With venv active and backend deps installed:

```powershell
cd backend
python manage.py migrate
cd ..
```

All app tables should now exist in `mentalhealthdb`.

### Optional: Verify pgvector

From project root, venv active:

```powershell
cd backend
python -m chatbot.install_pgvector
cd ..
```

You should see a message that the pgvector extension is installed.

---

## Phase 4: Optional but needed for full features

### 4.1 Ollama (LLM for chat)

- **Download:** https://ollama.ai/download  
- Install and start (or let Django start it). Then:
  ```powershell
  ollama pull llama3.1:8b-instruct
  ```

### 4.2 FFmpeg (voice chat: WebM → WAV)

- **Windows:** `winget install ffmpeg`  
- Or: https://ffmpeg.org/download.html (add `bin` to PATH).  
- Verify: `ffmpeg -version`

### 4.3 Large assets (not in git)

- **DeBERTa model:** `deberta_best/model.safetensors` (emotion detection).  
- **Dataset:** `dataset/MentalChat16K.csv` (RAG).  
- Place them in the paths expected by `backend/chatbot/config.py` (project root `deberta_best/` and `dataset/` by default).  
- Then build RAG embeddings once:
  ```powershell
  cd backend\chatbot
  python build_database.py
  cd ..\..
  ```

---

## Run the system

1. **Backend (Django):**
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1   # if venv is in backend
   # or from root: .\venv\Scripts\Activate.ps1 then cd backend
   python manage.py runserver
   ```
   Serves at `http://127.0.0.1:8000/`.

2. **Frontend (Next.js):**  
   New terminal from project root:
   ```powershell
   npm run dev
   ```
   App at `http://localhost:3000/`.

---

## Quick checklist (after reinstall)

- [ ] PostgreSQL installed and service running  
- [ ] pgAdmin installed (optional)  
- [ ] pgvector extension installed (DLLs + extension files)  
- [ ] Database `mentalhealthdb` created  
- [ ] `CREATE EXTENSION vector` run in `mentalhealthdb`  
- [ ] RAG schema applied: `psql ... -f backend\chatbot\postgresql_schema.sql`  
- [ ] Python 3.10 or 3.11  
- [ ] Venv created and activated  
- [ ] `pip install -r backend\requirements.txt`  
- [ ] `backend\chatbot\.env` created (DB password set)  
- [ ] `backend\.env` created for Django (same DB password)  
- [ ] `python manage.py migrate` run from `backend`  
- [ ] `npm install` (or `pnpm install`) at project root  
- [ ] (Optional) Ollama + `ollama pull llama3.1:8b-instruct`  
- [ ] (Optional) FFmpeg in PATH  
- [ ] (Optional) DeBERTa model + dataset + `build_database.py`  
- [ ] Backend: `python manage.py runserver`  
- [ ] Frontend: `npm run dev`

---

## Venv locations in this project

- Docs and scripts often assume a **project-root** venv: `MindEase\venv` → activate with `.\venv\Scripts\Activate.ps1`.  
- Some backend docs use a venv inside `backend`: `backend\venv`.  
- TTS has its own optional venv: `backend\tts\venv_tts` (see `backend/tts/README_VENV.md`).  

Use **one** main venv for Django + chatbot (root or `backend`); ensure you activate it before `pip install` and `manage.py` commands.
