---
name: mindease-project-context
description: Provides project context for MindEase, a bilingual mental health platform with AI-powered therapy chat (text and voice), diagnostic tests, and therapist directory. Use when making changes to the MindEase codebase, understanding architecture, or adding features.
---

# MindEase Project Context

## Overview

MindEase is a **bilingual (English/Urdu) mental health and wellness platform** with:
- AI therapy chatbot (text and voice)
- Emotion detection (DeBERTa), RAG (PostgreSQL + pgvector), LLM (Ollama / Llama 3.1 8B)
- Diagnostic tests (PHQ-9, GAD-7, etc.)
- Therapist directory
- Session history and persistence

## Architecture

| Layer | Tech | Purpose |
|-------|------|---------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind, Radix UI, Clerk | Dashboard, chat, voice chat, auth, diagnostic tests, sessions, profile |
| **Backend** | Django 5.x, REST API | Auth, chat, sessions, STT/TTS, diagnostic tests |
| **Database** | PostgreSQL + pgvector | User, session, message, RAG chunks |
| **Chat pipeline** | `backend/chatbot` | Emotion → RAG → LLM |
| **Voice** | faster-whisper (STT), Coqui XTTS (TTS), FFmpeg | Voice chat pipeline |

- **API base:** `http://localhost:8000/api/` (used in `lib/api.ts`)
- **Auth:** Custom session/JWT via `context/AuthContext.tsx`; token + user in localStorage

## Project Structure

```
MindEase/
├── app/                    # Next.js App Router
│   ├── (auth)/             # login, register, auth callback
│   ├── chat/               # Text chat page
│   ├── voice-chat/         # Voice chat page
│   ├── dashboard/          # Main dashboard, therapists
│   ├── sessions/           # Session list, resume, star
│   ├── profile/            # User profile
│   └── diagnostic-test/    # Test list + [testType] pages
├── lib/
│   └── api.ts              # All backend API calls (register, login, chat, sessions, STT, TTS, diagnostic tests)
├── components/             # Shared UI (shadcn/ui style)
├── context/
│   └── AuthContext.tsx     # Auth state, token, user
├── public/diagnosticTests/ # Test definitions (JSON)
├── backend/
│   ├── manage.py           # Django; auto-starts Ollama if needed
│   ├── api/
│   │   ├── urls.py         # API routes
│   │   ├── views.py        # All API handlers
│   │   ├── models.py       # User, Session, Message, Summary, Testresult, Therapistdirectory, etc.
│   │   └── services/       # session_service, diagnostic_test_service
│   ├── chatbot/            # Core AI pipeline
│   │   ├── chat.py         # MindEaseChat, _process_message()
│   │   ├── emotion_detector.py  # DeBERTa
│   │   ├── rag_system_postgres.py
│   │   ├── llm_client.py   # Ollama
│   │   └── conversation_memory.py
│   ├── stt/                # faster-whisper
│   ├── tts/                # Coqui XTTS
│   └── backend/settings.py # Django settings, loads backend/.env
├── deberta_best/           # DeBERTa model weights (excluded from git)
├── dataset/                # MentalChat16K.csv (excluded from git)
└── docs/                   # README, setup, migration plans
```

## Key API Endpoints

- **Auth:** `register/`, `login/`, `check-email/`, `send-otp/`, `verify-otp/`
- **Chat:** `chat/`, `chat/stream/`, `chat/welcome/`, `chat/summary/`
- **Sessions:** `sessions/count/`, `sessions/save/`, `sessions/recent/`, `sessions/get/`, `sessions/star/`
- **Profile:** `profile/get/`, `profile/update/`
- **Voice:** `stt/transcribe/`, `stt/transcribe-partial/`, `tts/synthesize/`, `voice/process/`, `voice/welcome-audio/`
- **Diagnostic:** `diagnostic-tests/status/`, `diagnostic-tests/submit/`, `diagnostic-tests/history/`, `diagnostic-tests/mood-trend/`, `diagnostic-tests/streak/`
- **Therapists:** `therapists/`, `therapists/filters/`

## Chat Pipeline Flow

1. User sends message → `POST /api/chat/` (or voice: STT → chat)
2. `views.chat_message` → `MindEaseChat._process_message()`
3. Emotion: DeBERTa (`emotion_detector.py`) → top 2 emotions
4. RAG: PostgreSQL pgvector → top 3 similar contexts from MentalChat16K
5. LLM: Ollama Llama 3.1 8B → therapist-style response
6. Memory: `ConversationMemory` (last 20 messages)

## Session Model

- **Session**: user, session_uuid, title, short_summary, full_summary, state (full / pending_archive / summary_only), is_starred, messages
- **Message**: session, sender (user/ai), content_type (text/audio), content, emotion_label, emotion_score
- **SessionService** handles create, update, archive rotation, load with messages

## Env & Config

- **Backend:** `backend/.env` — DB_*, DJANGO_DB_ENGINE; loaded by `backend/backend/settings.py`
- **Chatbot:** `backend/chatbot/.env` — same DB_* plus OLLAMA_MODEL; loaded by `backend/chatbot/config.py`
- **Frontend:** `.env.local` — Clerk keys, optional NEXT_PUBLIC_* for API base

## Where to Change What

| Goal | Location |
|------|----------|
| Add/change API endpoint | `backend/api/urls.py`, `backend/api/views.py` |
| Change chat pipeline (prompts, RAG, emotion) | `backend/chatbot/chat.py`, `llm_client.py`, `rag_system_postgres.py`, `emotion_detector.py` |
| Change session/summary logic | `backend/api/views.py`, `api/services/session_service.py`, `chatbot/conversation_memory.py` |
| Change DB schema | `backend/api/models.py` → `makemigrations` + `migrate` |
| Change frontend API calls | `lib/api.ts` |
| Change auth/user state | `context/AuthContext.tsx`, login/register pages |
| Change STT/TTS | `backend/stt/stt_service.py`, `backend/tts/tts_service.py`, views |
| Change diagnostic tests | `backend/api/views.py`, `api/services/diagnostic_test_service.py`, `public/diagnosticTests/` |

## Conventions

- Use `lib/api.ts` for all backend calls; API base is `http://localhost:8000/api`
- Auth token sent in `Authorization` header where required
- Session data: `conversation_history` in frontend state; persisted via `sessions/save/` with LLM-generated title/summary
- RAG: built by `backend/chatbot/build_database.py` from `MentalChat16K.csv`; tables `input_chunks`, `output_chunks`

## Running the App

- **Frontend:** `npm run dev` (Next.js on port 3000)
- **Backend:** `python backend/manage.py runserver` (Django on port 8000)
- **Ollama:** Must run for chat; manage.py can auto-start it
- **PostgreSQL:** Required; pgvector for RAG
- **FFmpeg:** On PATH for STT audio conversion
