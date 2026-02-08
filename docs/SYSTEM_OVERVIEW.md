# MindEase System Overview

High-level reference for the codebase so changes can be made safely. For setup after reinstall, see `SETUP_AFTER_REINSTALL.md`.

---

## 1. Architecture

| Layer | Tech | Purpose |
|-------|------|--------|
| **Frontend** | Next.js 16, React 18, TypeScript | App UI: dashboard, chat, voice chat, auth, diagnostic tests, sessions, profile |
| **Backend** | Django 5.1, DRF, JWT | REST API, auth, chat, sessions, STT/TTS, diagnostic tests |
| **Database** | PostgreSQL | Django tables (user, session, message, etc.) + pgvector for RAG (`input_chunks`, `output_chunks`) |
| **Chat pipeline** | chatbot package | Emotion (DeBERTa) → RAG (PostgreSQL) → LLM (Ollama) |
| **Voice** | STT (faster-whisper), TTS (Coqui XTTS), FFmpeg | Voice chat: record → WebM→WAV (FFmpeg) → transcribe → chat → synthesize |

- **API base:** `http://127.0.0.1:8000/api/` (frontend uses `http://localhost:8000/api` in `lib/api.ts`).
- **Auth:** Session-based registration/login; JWT used for API auth where applicable. User state in frontend: `context/AuthContext.tsx` (token + user in localStorage).

---

## 2. Backend structure

### 2.1 Django apps and URLs

- **`backend/backend/urls.py`**  
  - `/` → root JSON  
  - `/admin/` → Django admin  
  - `/api/` → `api.urls`

- **`backend/api/urls.py`** — main API surface:
  - **Auth:** `register/`, `login/`, `check-email/`, `send-otp/`, `verify-otp/`
  - **Chat:** `chat/`, `chat/welcome/`, `chat/summary/`
  - **Sessions:** `sessions/count/`, `sessions/save/`, `sessions/recent/`, `sessions/get/`, `sessions/star/`
  - **Profile:** `profile/get/`, `profile/update/`
  - **Onboarding:** `users/dashboard-tour/`
  - **Voice:** `stt/transcribe/`, `tts/synthesize/`
  - **Diagnostic tests:** `diagnostic-tests/status/`, `diagnostic-tests/submit/`, `diagnostic-tests/history/`, `diagnostic-tests/mood-trend/`, `diagnostic-tests/streak/`

### 2.2 Main models (`api/models.py`)

| Model | Role |
|-------|------|
| **User** | user_id, email, password, first_name, last_name, dob, gender, lang_pref, city, nearest_major_city, dashboard_tour_seen, primary_condition, generic_screening_completed, last_test_date |
| **Session** | session_id, user (FK), session_uuid, title, short_summary, full_summary, state (full / pending_archive / summary_only), is_starred, archived_at, continuation_context, started_at, ended_at, resume_message |
| **Message** | message_id, session (FK), user (FK), sender (user/ai), content_type (text/audio), sequence, content, emotion_label, emotion_score, metadata |
| **Summary** | summary_id, session (FK), type (full/short/archive), content |
| **Testresult** | result_id, test (FK), user (FK), test_type, score, severity_level, taken_at, user_responses, domain_scores |
| **EmailVerification** | user_email, otp_code, is_verified |
| **SessionArchiveJob** | job for deferred archive (summary-only rotation) |
| **Diagnostictest** | test definitions (test_code, test_name, questions) |
| **Admin**, **Therapistdirectory** | legacy/admin |

### 2.3 Chat flow (text and voice)

1. **Entry:**  
   - Text: `POST /api/chat/` (body: message, user_id, user_first_name, user_gender, conversation_history, test_context).  
   - Voice: frontend records → `POST /api/stt/transcribe/` → then same chat API with transcript as message.

2. **`views.chat_message`** (views.py ~354):  
   - Builds `MindEaseChat(user_first_name, test_context)`.  
   - Restores `conversation_history` into `chatbot.memory`.  
   - Calls `chatbot._process_message(message, test_context)`.

3. **`MindEaseChat._process_message`** (chatbot/chat.py):  
   - **Emotion:** `EmotionDetector` (DeBERTa in `deberta_best/`) → top-2 emotions, threshold 0.3.  
   - **RAG:** `RAGSystem` (PostgreSQL pgvector) → `retrieve_context(query, top_k=3, similarity_threshold=0.5)` from `input_chunks`/`output_chunks`, formatted for LLM.  
   - **LLM:** `LLMClient` (Ollama) → `generate_response(user_message, emotions, context, conversation_history, user_first_name, test_context)`.  
   - **Memory:** `memory.add_exchange(user_input, response)`.

4. **Response:**  
   - JSON: `response`, `emotions`, `user_id`, `conversation_history`.

- **Welcome:** `chat/welcome/` — can use test_context for personalized welcome via LLM.  
- **Summary:** `chat/summary/` — uses `ConversationMemory.get_conversation_summary()` + LLM; used when user ends a session.

### 2.4 Session persistence

- **SessionService** (`api/services/session_service.py`): create/update sessions, attach messages/summaries, enforce rotation (archive old sessions), load session with messages.
- **Save session:** `sessions/save/` — builds/updates Session + Message rows, generates title and short_summary via LLM, can enqueue archive job.
- **Session states:** FULL (full transcript), PENDING_ARCHIVE, SUMMARY_ONLY (archived; only summary kept).

### 2.5 Chatbot package (`backend/chatbot/`)

| Module | Role |
|--------|------|
| **chat.py** | `MindEaseChat`: wires EmotionDetector, RAGSystem, LLMClient, ConversationMemory; `_process_message()` is the main pipeline. |
| **emotion_detector.py** | DeBERTa fine-tuned model in `deberta_best/`; `detect_emotions()`, `format_emotions_for_llm()`. |
| **rag_system_postgres.py** | RAG over PostgreSQL+pgvector; `retrieve_context()`, `format_context_for_llm()`; uses `input_chunks` / `output_chunks` (built by `build_database.py` from MentalChat16K.csv). |
| **llm_client.py** | Ollama client; auto-selects llama3.1 model; `generate_response()` with system prompt, emotions, RAG context, history, test_context. |
| **conversation_memory.py** | In-memory deque (max 20 messages); `add_message`, `get_history`, `get_conversation_summary()` (LLM). |
| **config.py** | DB_CONFIG, DEBERTA_MODEL_PATH, DATASET_PATH, OLLAMA_MODEL; loads `backend/chatbot/.env`. |

### 2.6 STT and TTS

- **STT:** `api/views.stt_transcribe` → `stt.stt_service.SpeechToTextService` (faster-whisper, model e.g. Systran/faster-whisper-large-v3). Receives audio file; uses pydub (needs FFmpeg on PATH) for conversion; returns transcript.
- **TTS:** Cached singleton in views; `tts.tts_service.TTSService` (Coqui XTTS). `POST /api/tts/synthesize/` returns audio (e.g. WAV/base64).

### 2.7 Diagnostic tests

- **DiagnosticTestService** in `api/services/diagnostic_test_service.py`; status, submit, history, mood-trend, streak.
- Test definitions in `public/diagnosticTests/` (e.g. JSON); frontend loads and submits answers; backend stores Testresult and updates User (e.g. last_test_date, generic_screening_completed).

### 2.8 Config and env

- **Django DB:** `backend/backend/settings.py` reads `backend/.env` (via load_dotenv): DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DJANGO_DB_ENGINE.
- **Chatbot/RAG:** `backend/chatbot/.env` (from env.example): same DB_* plus OLLAMA_MODEL, optional DEBERTA_MODEL_PATH, DATASET_PATH.

---

## 3. Frontend structure

### 3.1 Routes (app/)

| Path | Page | Purpose |
|------|------|--------|
| `/` | page.tsx | Landing |
| `/login`, `/register` | (auth)/login, (auth)/register | Auth |
| `/dashboard` | dashboard/page.tsx | Main dashboard after login |
| `/chat` | chat/page.tsx | Text chat |
| `/voice-chat` | voice-chat/page.tsx | Voice chat (record → STT → chat → TTS) |
| `/sessions` | sessions/page.tsx | Session list, resume, star |
| `/profile` | profile/page.tsx | User profile |
| `/diagnostic-test` | diagnostic-test/page.tsx | Test list |
| `/diagnostic-test/[testType]` | diagnostic-test/[testType]/page.tsx | Take test, see results |

### 3.2 API usage

- **`lib/api.ts`** — all backend calls (register, login, OTP, chat, sessions, profile, dashboard-tour, STT, TTS, diagnostic tests). Uses `http://localhost:8000/api/...`; auth token sent where required.
- **Auth:** `context/AuthContext.tsx` — token and user in state + localStorage; `setAuth`, `logout`; used by guards and layout.

### 3.3 Key UI

- **Dashboard:** quick stats, recent sessions, quick check-in (text/voice), diagnostic tests, onboarding tour.
- **Chat / Voice chat:** conversation_history in state; welcome from `chat/welcome/`; messages via `chat/`; on end session, `chat/summary/` then `sessions/save/`.
- **Sessions:** list from `sessions/recent/`, resume loads session and messages, star via `sessions/star/`.

---

## 4. Data flow summary

- **Registration:** register → send-otp → verify-otp → register again with verified email.
- **Login:** login → JWT + user stored in frontend; used for authenticated API calls.
- **Text chat:** chat/welcome → then for each message: chat/ with message + history + test_context → backend runs emotion + RAG + LLM → response + updated history.
- **Voice chat:** record → STT (WebM→WAV via FFmpeg, then faster-whisper) → same chat/ with transcript → optional TTS for reply.
- **End session:** chat/summary → sessions/save (title + short_summary + messages); backend may enqueue archive job.
- **RAG:** Populated by `backend/chatbot/build_database.py` from `dataset/MentalChat16K.csv`; if DB empty, RAGSystem builds it on first use (or run build_database once). Embeddings in PostgreSQL `input_chunks`/`output_chunks`.

---

## 5. Where to change what

| Goal | Where to look |
|------|----------------|
| Add/change API endpoint | `backend/api/urls.py`, `backend/api/views.py` |
| Change chat pipeline (prompts, RAG, emotion) | `backend/chatbot/chat.py`, `llm_client.py`, `rag_system_postgres.py`, `emotion_detector.py` |
| Change session/summary logic | `backend/api/views.py` (save_session, chat_summary), `api/services/session_service.py`, `chatbot/conversation_memory.py` |
| Change DB schema | `backend/api/models.py`, then `python manage.py makemigrations` + `migrate` |
| Change frontend API calls | `lib/api.ts` |
| Change auth / user state | `context/AuthContext.tsx`, login/register pages |
| Change STT/TTS behavior | `backend/stt/stt_service.py`, `backend/tts/tts_service.py`, and views that call them |
| Change diagnostic tests | `backend/api/views.py` (diagnostic-tests/*), `api/services/diagnostic_test_service.py`, `public/diagnosticTests/`, diagnostic-test pages |
| Env / config | `backend/.env`, `backend/chatbot/.env`, `backend/backend/settings.py`, `backend/chatbot/config.py` |

---

## 6. External dependencies

- **PostgreSQL + pgvector:** Django DB and RAG tables.
- **Ollama:** LLM (e.g. llama3.1:8b-instruct); manage.py can start `ollama serve` if needed.
- **FFmpeg:** On PATH for pydub (STT audio conversion).
- **Optional:** DeBERTa weights in `deberta_best/`; MentalChat16K.csv in `dataset/` for RAG build; env vars for paths if not default.

This document is the single place to understand the system before making changes.
