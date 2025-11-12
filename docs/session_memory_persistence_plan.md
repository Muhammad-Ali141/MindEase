## Session Memory Persistence & Rotation Plan

### 1. Objectives

- Persist per-user session transcripts, summaries, and emotion metadata in PostgreSQL instead of in-memory structures.
- Keep existing UX/API behavior (dashboard stats, recent sessions list, “continue chat” flow, session summaries) unchanged for users.
- Introduce storage governance so only the three most recent chats **plus** up to three user-starred chats retain line-by-line transcripts; older non-starred chats are condensed into LLM-generated summaries.
- Persist the session counter shown on the dashboard so it survives restarts and multi-device usage.

---

### 2. Current State (as of commit `dbd90cb`)

- **Session counter**: `SESSION_COUNTS` dict in `backend/api/views.py`; incremented through `/api/sessions/increment/`, returns count through `/api/sessions/count/`.
- **Session storage**: `USER_SESSIONS` dict holds session details (uuid, title, short summary, full transcript, summary text). Saved via `/api/save-session/`, retrieved for dashboard and `/sessions` page via `/api/sessions/recent/` and `/api/sessions/get/`.
- **Models**: Django models `Session`, `Message`, `Summary`, `Testresult` exist but are unused by the endpoints above. They currently have limited fields (e.g. `Message` lacks role/emotion metadata).
- **Chat flow**: Frontend (Next.js) posts chat messages sequentially, uses summary endpoint to display a full session recap at end of chat, and rehydrates conversations with `/api/sessions/get/`.

---

### 3. Functional Requirements

1. **Persisted transcript**

   - Store each exchange line-by-line with speaker role, message text, detected emotion label & score, and created timestamp.
   - Retain assistant metadata (model name, duration) if available.

2. **Session metadata**

   - Title, created/updated timestamps, running summary (LLM short summary), full session summary, starred flag, transcript retention state (`full`, `archived`, `summary-only`), optional continuation pointer (e.g. which summary to preload when user resumes).

3. **Session counter**

   - Must survive server restarts and reflect total number of persisted sessions per user.

4. **Rotation Policy**

   - For each user keep:
     - Up to **three most recent sessions** with full transcripts.
     - Up to **three starred sessions** with full transcripts (user-managed).
   - When a new full transcript would exceed the threshold, convert the oldest **non-starred** transcript into a “summary-only” record by:
     1. Generating a condensed summary (via existing LLM summary endpoint or a new background job).
     2. Deleting its line-by-line messages from the message table.
     3. Flagging the session as archived but preserving short/long summary text and metadata.

5. **Resume chat flow**

   - When user opens a summary-only session, backend should feed the stored “archived summary” into the LLM as context and craft an opening reminder message (current frontend expects the full transcript; we need to adapt the payload to indicate `transcript_available=false` and provide fallback summary text plus system-context instructions).

6. **Starred sessions**
   - Allow user to star/unstar a session, capped at three starred sessions per user. Starred sessions are excluded from auto-archiving.

---

### 4. Proposed Database Design Adjustments

| Table                             | Action           | Notes                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session` (existing)              | Expand columns   | Add fields: `title`, `short_summary`, `full_summary`, `resume_message`, `state` (`full`, `summary_only`), `is_starred`, `archived_at`, `continuation_hint`, `session_uuid` (public identifier), `ended_at`. Remove/repurpose unused `session_type` if necessary.                                                    |
| `message` (existing)              | Redesign columns | Add `sequence` (int order), `role` (user/assistant/system), `content_type`, ~~`audio_file_path`~~ _(removed in favour of future redesign)_, `emotion_label`, `emotion_score`, `metadata` (JSON for model info), rename `message_text`→`content`. Keep `session` FK; introduce denormalised `user` FK for analytics. |
| `summary` (existing)              | Repurpose        | Use to store generated summaries by type: `type` (`full`, `short`, `archive`), `content`, `created_at`. Alternatively, fold into `session` table with JSON column; choose approach during implementation.                                                                                                           |
| `user`                            | Add counters     | Add `total_sessions` cached count (optional; can be derived). Alternatively, derive count with `SELECT COUNT(*)` and drop `/sessions/increment/`.                                                                                                                                                                   |
| New `session_snapshot` (optional) | Archive audit    | If we need to track rotation events or store raw JSON snapshots pre-archival.                                                                                                                                                                                                                                       |

**Migrations:**

1. Alter `session` + `message` schema (data migration to align existing rows).
2. Introduce constraints/indexes: `(user_id, is_starred)` partial index, `session_uuid` unique, `message.sequence` unique per session.
3. Optional: add GIN index on summaries for search (future).

---

### 5. Backend Changes

1. **Persistence services**

   - Create repository/service layer to abstract session CRUD, transcripts, rotation, starring.
   - Replace `USER_SESSIONS` / `SESSION_COUNTS` with DB-backed operations inside existing endpoints (`save_session`, `get_recent_sessions`, `get_session_by_id`, `get_session_count`, `increment_session_count`).

2. **Rotation workflow**

   - On `save_session` for new sessions:
     1. Insert `session` row (`state='full'`, `is_starred` default false).
     2. Bulk insert messages with sequence + emotion data.
     3. Insert/Update `summary` rows (short + full).
     4. Recalculate session counter using `COUNT(*)`.
     5. Invoke rotation helper to enforce limits for the user.
   - Rotation helper: find oldest non-starred session beyond the “3 newest full transcripts” threshold, convert to `summary_only`, delete messages, store “archived summary” (LLM call if not already available), set `archived_at`.

3. **Star/unstar endpoints**

   - New POST `/api/sessions/star/` toggles `is_starred` (validate user ownership, enforce ≤3 starred).
   - Adjust rotation helper to respect stars.

4. **Session retrieval**

   - `/api/sessions/recent/`: read from DB, return list with `state` + `has_full_transcript` flag.
   - `/api/sessions/get/`: if `state='full'`, return message list; else return `summary_only` payload (e.g. `{"session":{"session_id":...,"state":"summary_only","summary":...,"messages":[],"resume_context":...}}`).

5. **Session counter**

   - Option A: derive from `Session` count each call.
   - Option B: maintain `total_sessions` column updated by triggers/service.
   - Deprecate `/api/sessions/increment/` (or keep for backward compatibility but have it call the new service to return `COUNT(*)`).

6. **Emotion storage**
   - Ensure emotion detector returns label+score when chat messages are processed; persist upon message insert.

---

### 6. Frontend Adjustments

1. Update API types (`Session`, `SessionPreview`) to include `state`, `is_starred`, `has_full_transcript`.
2. Handle summary-only sessions in `/sessions` and `/chat` pages: if no transcript, show summary preview and instruct Chat interface to seed conversation with summary context.
3. Add starring UI (limit 3). Provide inline warnings when max reached.
4. Replace session counter fetch with new response (if backend returns computed count).

---

### 7. Migration Strategy

1. Deploy schema migrations (possibly in multiple steps to avoid locking).
2. Build management command to import existing in-memory session dumps if any (optional).
3. Update backend endpoints sequentially (feature flag optional).
4. Update frontend once backend contract finalized.
5. Verify rotation + starring edge cases using unit tests/integration tests:
   - New session without prior data.
   - Session update/resume.
   - Rotation when >3 non-starred sessions exist.
   - Star/unstar interactions near limit.
   - Summary-only resume flow.

---

### 8. Testing Plan

- **Unit tests**: new service layer (session creation, rotation logic, starring constraints).
- **Integration tests**: API endpoints for session CRUD, retrieval, counter, starring, resume workflow.
- **Manual QA**:
  - Start multiple sessions, ensure counts increase and transcripts appear.
  - Trigger rotation by creating >3 sessions, confirm oldest converts to summary-only.
  - Star sessions and verify they are retained, rotation skips them.
  - Resume archived session and confirm conversation starts with summary context.

---

### 9. Decisions & Clarifications

1. **Emotion data** _(confirmed)_

   - We already capture emotion labels/scores when processing chat messages. The persistence layer will reuse those results instead of running detection again.

2. **Rotation strategy** _(confirmed: deferred/background)_

   - Save the new session immediately, then queue archival of the oldest non-starred transcript. A lightweight async worker (e.g. RQ, Celery, or scheduled management command) will:
     1. Generate the archival summary with the LLM,
     2. Delete the transcript messages,
     3. Mark the session as `summary_only`.
   - Until the worker completes, the session will be flagged (e.g. `state='pending_archive'`) so the frontend knows a rotation job is in progress.
   - Benefits: fast “End Chat” UX, ability to spread archival jobs during quieter periods.

3. **Starring UX** _(confirmed)_

   - Star/unstar controls will appear in all three places: dashboard session tiles, `/sessions` list page, and the post-chat summary screen.
   - If a session is too old (already archived into summary-only), the UI will explain why it can’t be starred.
   - Max of three starred sessions per user enforced by backend; UI will show guidance when the cap is reached.

4. **Session counter** _(confirmed)_

   - Replace the in-memory counter with a database-derived count (`COUNT(*) FROM session WHERE state='full' OR state='summary_only'`).
   - Deprecate the standalone increment endpoint; frontend will request the count and backend will compute it on the fly.

5. **Historical data** _(confirmed)_
   - No legacy transcripts need to be imported. The new persistence starts with fresh sessions after deployment.

With these decisions locked in, the next step is to implement the schema changes, service layer, and frontend updates according to the plan.

---

### 10. Execution Order

1. **Schema & Models Update** – adjust Django models/migrations for sessions, messages, and supporting fields.
2. **Persistence Service Layer** – implement database-backed save/fetch helpers plus rotation helpers (marking sessions for deferred archival).
3. **API Endpoint Refactor** – update session-related endpoints and introduce starring support while keeping frontend contracts stable.
4. **Background Rotation Worker** – add async job/command to process pending archives (generate summaries, prune transcripts).
5. **Frontend Adjustments** – wire new API fields into the UI, add star controls, and handle summary-only resume flow.
6. **Testing & Validation** – run migrations, automated tests, and manual QA; document verification.
