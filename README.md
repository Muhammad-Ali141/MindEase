# MindEase

Bilingual (English + Urdu) mental health platform. Final Year Project.

AI therapy chat (text + voice), clinical diagnostic tests (PHQ-9 / GAD-7 style), therapist directory, session memory, mood tracking, emotion-aware responses, and a lip-synced avatar mode.

---

## Features

- **Bilingual chat** — English LLM pipeline + Urdu (Qwen3) pipeline with Roman Urdu system prompt.
- **Voice chat** — Streaming STT → LLM → TTS. English via Edge / ElevenLabs TTS; Urdu via fine-tuned Whisper STT + ElevenLabs Urdu voice.
- **Avatar mode** — D-ID / Wav2Lip lip-synced avatar driven by TTS audio.
- **Emotion detection** — DeBERTa text emotion model + audio emotion features; Urdu emotion detection.
- **Clinical assessments** — PHQ-9 style diagnostic tests with PDF export.
- **RAG over therapy corpus** — PostgreSQL + pgvector retrieval for grounded responses.
- **Session memory** — Per-user conversation memory, history, and dashboard.
- **Therapist directory** — Scraped therapist data, filtering, profiles.
- **Auth** — Clerk (Google OAuth) on the frontend + custom Django JWT/auth tokens, with OTP and rate limiting.
- **Safety** — Crisis-keyword detection and prompt sanitization on the chatbot path.

## Architecture

```
┌──────────────────────┐        ┌───────────────────────────────────┐
│ Next.js 14 (App      │  HTTP  │ Django REST API                   │
│ Router) — frontend   │ ─────► │ (auth, chat, voice, sessions,     │
│ Tailwind v4, Clerk   │        │  therapists, tests, STT, TTS)     │
└──────────┬───────────┘        └───────┬───────────────────────────┘
           │                            │
           │                            ├─► PostgreSQL + pgvector (RAG)
           │                            ├─► SQLite (app data)
           │                            ├─► Whisper / fine-tuned Urdu STT
           │                            ├─► Qwen3 TTS / ElevenLabs / Edge TTS
           │                            ├─► DeBERTa emotion model
           │                            └─► LLM client (Groq / local)
           │
           └─► D-ID / Wav2Lip avatar (lip-sync)
```

### Layout

- `app/` — Next.js routes (`page.tsx` landing, `(auth)/auth`, `chat`, `voice-chat`, `dashboard`, `sessions`, `profile`, `diagnostic-test/[testType]`).
- `components/` — Shared UI; Radix primitives under `components/ui/`.
- `lib/api.ts` — Frontend API client, points at `http://127.0.0.1:8000/api`.
- `lib/i18n.ts` — Translation strings.
- `backend/api/` — Django REST app (views, models, services, urls).
  - `auth_token.py`, `rate_limit.py` — Auth tokens + per-route rate limiting.
- `backend/chatbot/` — LLM client, RAG (`rag_system_postgres.py`), memory, Urdu pipeline (`urdu_qwen_chat.py`, `urdu_chat_pipeline.py`), `crisis_detection.py`, `prompt_sanitizer.py`.
- `backend/stt/`, `backend/urdu_stt/` — English + Urdu speech-to-text.
- `backend/tts/` — TTS adapters (Qwen3, ElevenLabs).
- `finetuned_urdu_whisper/`, `deberta_best/` — Local model artifacts.
- `scraper/` — Therapist directory scraper.
- `dataset/`, `experiments/`, `n8n/`, `docs/`, `refrences/` — Supporting material.

## Tech Stack

**Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS v4, Radix UI, framer-motion, Clerk, next-themes.

**Backend:** Django + Django REST framework, SQLite (app), PostgreSQL + pgvector (RAG).

**AI / Speech:** Whisper (fine-tuned Urdu variant), Qwen3 TTS, ElevenLabs TTS, Edge TTS, DeBERTa emotion classifier, Groq-hosted LLMs via `llm_client.py`.

## Getting Started

### Prerequisites

- Node.js 18+ and `pnpm` (or `npm`)
- Python 3.10+
- PostgreSQL with the `pgvector` extension (for RAG)
- A GPU is recommended for local Urdu STT / Qwen3 TTS, but the pipeline falls back to API-based providers (ElevenLabs, Edge TTS, Groq).

### 1. Frontend

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Set `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

### 2. Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver       # http://127.0.0.1:8000
```

Backend `.env` (in `backend/`):

```
DJANGO_SECRET_KEY=...
GROQ_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID_URDU=...
DID_API_KEY=...                  # optional, for avatar
PGVECTOR_URL=postgresql://user:pass@localhost:5432/mindease
```

### 3. Wav2Lip avatar service (terminal 3)

The avatar lip-sync runs as a separate FastAPI service on port `8002`.

```bash
cd backend
venv\Scripts\activate            # Windows
# source venv/bin/activate       # macOS / Linux

python wav2lip_service.py        # http://127.0.0.1:8002
```

Requires `backend/wav2lip/checkpoints/wav2lip_gan.pth` and `public/avatar.jpg`. CUDA GPU recommended (falls back to CPU, much slower).

### Running everything — three terminals

Open three terminals. In each, activate the venv first if it's a Python terminal.

| Terminal | Folder    | Command                                              | Port |
| -------- | --------- | ---------------------------------------------------- | ---- |
| 1 — Frontend | repo root | `npm run dev` (or `npm run build && npm run start`) | 3000 |
| 2 — Backend  | `backend/` | `venv\Scripts\activate` then `python manage.py runserver` | 8000 |
| 3 — Wav2Lip  | `backend/` | `venv\Scripts\activate` then `python wav2lip_service.py` | 8002 |

Then open `http://localhost:3000`.

### 4. Models / Data (optional, for full local pipeline)

- Place fine-tuned Urdu Whisper weights in `finetuned_urdu_whisper/`.
- Place DeBERTa emotion weights in `deberta_best/`.
- Load the therapy corpus into PostgreSQL via the scripts in `backend/chatbot/`.
- Therapist directory: `python scraper/<scraper_script>.py` to refresh.

## Key Endpoints

See `backend/api/urls.py` for the full list. Highlights:

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/verify-otp`
- `POST /api/chat/`, `POST /api/chat/stream/`
- `POST /api/voice/transcribe`, `POST /api/voice/tts`
- `GET  /api/sessions/`, `GET /api/sessions/<id>/`
- `GET  /api/therapists/`
- `POST /api/diagnostic-test/<testType>/submit`

## Conventions

- Animations: `framer-motion` only. Animate `transform` / `opacity`. **Never** `transition-all`.
- Theming: CSS variables — `--primary` (clay `#a67c52`), `--sage` (`#5D8A6B`), etc. Dark mode via `.dark` on `<html>` + `next-themes`.
- Bilingual: `dir="rtl"` for Urdu routes / strings.
- Do **not** use default Tailwind blue/indigo as the brand color.

## Project Status

Final Year Project — actively developed. Not production-ready; not a substitute for clinical care. If you or someone you know is in crisis, contact local emergency services or a qualified mental-health professional.

## License

Academic / FYP use. All rights reserved by the authors unless stated otherwise.
