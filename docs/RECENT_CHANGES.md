# Recent Changes — MindEase

Summary of changes made on top of commit `5f9dd80` ("Urdu pipeline, Qwen3 TTS/FA2 hardening, i18n UI, env files untracked"). These are still uncommitted at the time of writing.

---

## 1. Frontend

### New: consolidated dashboard data fetch
- `context/DashboardDataContext.tsx` — wraps the dashboard with a single provider that hits `GET /api/dashboard/data/` (session count, recent sessions, test status, test history, mood trend, streak, therapists) in one round-trip.
- Module-level 60s cache survives SPA navigation. On refetch the provider also seeds `testHistoryCache` and `testStatusCache` so the chat and diagnostic-test pages skip duplicate requests.

### New: shared module-level cache
- `lib/cache.ts` — tiny TTL caches keyed by `userId` for sessions, test history, and test status. Used by chat sidebar, sessions page, share-test modal, and the diagnostic test page.

### New: branded loading screen
- `components/page-loading.tsx` — logo pulse + progress bar using brand tokens.
- `app/loading.tsx` plus per-route loaders under `app/(auth)/auth/`, `app/chat/`, `app/dashboard/`, `app/diagnostic-test/`, `app/diagnostic-test/[testType]/`, `app/profile/`, `app/sessions/`, `app/voice-chat/`.
- `app/icon.svg` and `public/logo.svg` added.

### New: automatic `<html lang>` sync
- `components/lang-sync.tsx` — client component mounted in the root layout that mirrors the user's preferred language onto `document.documentElement`.

### Full Urdu RTL layout
- `app/globals.css` remaps brand font variables under `html[lang="ur"]` so every component that reads `--font-dm-sans` / `--font-inter` / `--font-cormorant` gets Arabic-script faces (Noto Sans Arabic, Amiri) without per-component edits.
- `direction: rtl` is applied to `body`, with `data-ltr` / input-type escape hatches for emails, numbers, code, and times.
- Also added `scroll-behavior: smooth`, canvas GPU-layer hints for the beams background, and `contain: layout style` on page roots for paint isolation.
- `app/layout.tsx` registers Noto Sans Arabic and Amiri, and mounts `<LangSync />`.

### PDF session export
- `lib/export-sessions.ts` rewritten to render a multi-page PDF via `jspdf` (reflection, transcript, disclaimer), with Roman Urdu label set for Urdu sessions.
- `app/sessions/page.tsx` adds multi-select mode (toolbar with Select / Select All / Cancel), transcript opt-in modal, and the new PDF export entry points.
- `lib/i18n.ts` adds translation keys: `exportSelected`, `selectSessions`, `transcriptModal*`, etc.

### `lib/api.ts` cleanup
- Consolidated on a single `API_BASE` (`http://localhost:8000/api`); removed unused `BASE_URL` and the dead `apiGetMe` / `apiUpdateMe` mock pair.
- `apiChatMessage` now truncates `conversation_history` to the last 10 messages before sending (the backend deque only keeps 20 anyway).

### Build / dev config
- `next.config.mjs`: `images.unoptimized` turned off; added `experimental.optimizePackageImports` for `lucide-react`, `framer-motion`, `@clerk/nextjs`, Radix accordion/dialog/dropdown-menu/select/tabs/tooltip, and `recharts`.
- `package.json`: `dev` script uses `next dev --turbo`; added `jspdf` (runtime), moved `puppeteer` to devDependencies.

### UI polish
- Header, sidebar, quick-stats, chat interface, chat sidebar, therapist directory, share-test-modal, diagnostic-tests, dashboard-tour, session-history, beams-background, etc. all received spacing / typography / RTL fixes. Details are in the diff — no behavioral changes worth calling out individually.

---

## 2. Backend

### New aggregated dashboard endpoint
- `backend/api/urls.py` → `path("dashboard/data/", views.dashboard_data)`.
- Backs the new `DashboardDataContext`. All six widgets resolve from a single DB round-trip.

### Summary text sanitizer
- `backend/api/views.py` `_sanitize_summary()` — strips wrapping quotes, label prefixes ("Session Summary:", "Clinical Note:"), separator lines (`----`), markdown bold/italic, hash headings, and collapses blank runs. Used before returning any LLM-generated summary or title.

### Welcome text cache
- `welcome_text/` mirror of `welcome_audio/` stores the generated welcome text alongside a sidecar `.json` keyed by `test_context_key`. Cuts the number of LLM calls on voice-chat cold start.

### Cached chatbot per language
- `backend/chatbot/chat.py` adds `get_cached_chatbot(user_first_name, test_context, lang_pref)` — keeps DeBERTa / sentence-transformer / RAG connection warm across requests and resets only `memory`, `user_first_name`, `test_context`, `lang_pref`, and `last_emotions` per call.

### Urdu emotion detection
- **New file:** `backend/chatbot/urdu_emotion_detector.py` — wraps `Khubaib01/roman-urdu-emotion-xlmr-v2` (XLM-R, 7 labels).
- `backend/api/apps.py` warms this model in a background thread on server startup so the first Urdu message has zero load cost.
- `backend/chatbot/chat.py` now runs emotion detection locally before calling the Urdu LLM and injects the detected emotion list into the system prompt; per-request timings are logged to stderr with the `[urdu-chat-timing]` tag.
- `urdu_chat_pipeline.run_urdu_pipeline` accepts `detected_emotions=...`.

### Misc
- `backend/api/management/commands/process_session_archives.py` updated to use the sanitizer.
- `backend/chatbot/conversation_memory.py`, `llm_client.py`, `rag_system_postgres.py`, `urdu_qwen_chat.py` — incremental hardening and logging; no public API change.

---

## 3. Setup notes for someone else pulling this branch

### Install deltas
- **Frontend:** run `pnpm install` (or `npm install`) — picks up `jspdf`; `puppeteer` moves to devDependencies.
- **Backend:** no new pinned packages in `requirements.txt`. First Urdu chat message will download `Khubaib01/roman-urdu-emotion-xlmr-v2` (~1.1 GB) from Hugging Face — make sure the HF cache is writable and internet is available the first time. The server warms it on boot.

### Environment variables

These are needed but are **not tracked in git**. Create the two files below before running.

**`.env.local` (repo root, for Next.js):**
```env
# Clerk (Google sign-in)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**`backend/.env` (Django + chatbot):**
```env
# Database — PostgreSQL with pgvector extension
DJANGO_DB_ENGINE=django.db.backends.postgresql
DB_NAME=mentalhealthdb
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432
# DB_SSLMODE=require          # only when pointing at Supabase / managed PG

# LLM — at least one of these must be set
OPENROUTER_API_KEY=sk-or-...
# OPENROUTER_API_KEY_2=sk-or-...        # optional failover key
# OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct
# OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
# OPENROUTER_SITE_URL=http://localhost:3000
# OPENROUTER_SITE_NAME=MindEase

# Urdu Qwen chat fallback (Alibaba DashScope, OpenAI-compatible)
# ALIBABA_API_KEY=sk-...

# Gmail SMTP for OTP email (see backend/backend/.env.example)
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=<gmail-app-password>   # NOT your account password

# Optional: n8n OTP webhook (overrides direct SMTP if set)
# N8N_SEND_OTP_WEBHOOK_URL=http://localhost:5678/webhook-test/send-otp-mindease

# Optional: TTS tuning (see docs/URDU_CHAT_PIPELINE.md for the full set)
# TTS_BACKEND=xtts                       # default is qwen3
# MINDEASE_QWEN3_DTYPE=bf16              # or fp16; default auto
# MINDEASE_QWEN3_DISABLE_FLASH=1         # if flash-attn-2 crashes on your CUDA build
# MINDEASE_QWEN3_REQUIRE_FLASH=1         # fail fast if FA2 can't be used
# MINDEASE_QWEN3_WARMUP=0                # skip boot-time Qwen3 warmup
# MINDEASE_QWEN3_TTS_MIN_SPLIT_CHARS=880
# MINDEASE_QWEN3_TTS_CHUNK_CHARS=720

# Optional: device overrides
# MINDEASE_STT_DEVICE=cuda | cpu
# MINDEASE_TTS_DEVICE=cuda | cpu
# URDU_STT_DEVICE=cuda | cpu

# Optional: Ollama local LLM (legacy fallback — not used by default)
# OLLAMA_MODEL=llama3.1:8b-instruct
```

### Database
- PostgreSQL 14+ with the `pgvector` extension is required (RAG retrieval). Run `CREATE EXTENSION IF NOT EXISTS vector;` in the target database.
- `fyp.sql` at the repo root contains the schema + seed data.

### One-time local setup checklist
1. `python -m venv venv && pip install -r backend/requirements.txt` (with the PyTorch CUDA wheel installed first per the comment at the top of that file).
2. Copy `.env.local.example` → `.env.local` and fill in the Clerk keys.
3. Copy `backend/.env.example` → `backend/.env` and set `DB_PASSWORD`, `OPENROUTER_API_KEY`, Gmail credentials.
4. `cd backend && python manage.py migrate`.
5. Start both servers: `pnpm dev` (frontend :3000) and `cd backend && python manage.py runserver` (backend :8000).

The first launch will download the Roman Urdu emotion model and warm Qwen3 TTS — expect an extra ~30–60 s on the first `runserver` boot.
