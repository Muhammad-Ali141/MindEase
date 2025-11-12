## Session Rotation Regression

### Observed Symptoms

- After finishing a chat, the dashboard counter and tiles stay empty.
- PostgreSQL shows the newly created `session` row briefly, then it is flipped to `pending_archive` and removed by the archive job (messages deleted, state set to `summary_only`).
- Reproduced by calling `SessionService.create_session` in the Django shell: every fresh session for a user immediately receives a `SessionArchiveJob`.

### Root Cause Analysis

- `SessionService.create_session` and `update_session` register `enforce_rotation_policy` on the outer transaction’s `on_commit` hook.
- `enforce_rotation_policy` currently iterates over **all** non-starred FULL sessions except the three most recent, but it never short‑circuits when there are ≤ 3 such sessions.
- For a brand-new user, `recent_non_starred_ids` comes back empty (because the queryset is evaluated before the insert is fully visible), so the freshly created session falls into the “candidates” set. `_mark_pending_archive` then:
  - flips `state` to `pending_archive`
  - schedules a `SessionArchiveJob`
  - the background command deletes the transcript and converts the session to `summary_only`
- Because the session goes “summary-only” before the API responds, the frontend never sees a persisted FULL session, so nothing renders.

### Remediation Plan

- **Guard the rotation trigger** – exit `enforce_rotation_policy` immediately when a user has <= 3 non-starred FULL sessions.
- **Delay rotation for new sessions** – ensure the session that just finished saving is part of the “keep” set by rechecking inside the same transaction (e.g. pass the new session id into the callback and explicitly exclude it).
- **Add safety logging/tests** – add debug logging and, ideally, a unit test that asserts a single saved session remains FULL and no archive job is queued.
- **Verify dashboard flow** – after applying the guard, run through the chat flow to confirm:
  - session row stays in `Session` with `state='full'`
  - messages persist
  - dashboard counter and tiles reflect the new session

Once these safeguards are in place we can re-enable deferred rotation with confidence.

## Additional Post-Fix Findings (2025-11-12)

### Data Modeling Concerns

- `message_id` and `session_id` auto-increment sequences currently start at values greater than 1 (e.g., 4 and 3 respectively). That’s expected behaviour for PostgreSQL when records existed before the latest inserts, but we can reseed the sequences if we want to present IDs from 1.
- `Message` rows link to the owning user indirectly via `session → user`. If partner teams want a direct `user_id` column for analytics/queries, we can denormalise that field.
- The `audio_file_path` column is still present to future-proof voice chat. If we decide not to support that path-based storage, we can drop it (and update the service/front-end payloads accordingly).
- Emotion metadata (`emotion_label`, `emotion_score`) isn’t being written during saves even though the schema supports it—need to trace the API payload and persistence to ensure those values flow through.

### Runtime Bugs

- Star toggles reject freshly finished sessions with “archived session” because the UI is sending the `session_uuid` where the backend endpoint currently expects the integer `session_id`.
- The same UUID vs integer mismatch breaks opening a session from the dashboard tiles (`Field 'session_id' expected a number but got ...`).
- Need to re-verify that new sessions remain in the FULL state long enough for star actions; if any rotation hook still fires too aggressively we’ll adjust guards again.

## Next Remediation Steps

1. **Audit current data inserts**
   - Inspect sequences for `session_session_id_seq` and `message_message_id_seq`; reseed if we want IDs to start at 1 after truncation.
   - Confirm existing records (if any) that caused the higher starting values.
2. **Align schema with usage**
   - Decide whether to keep or remove `audio_file_path`; if kept, document it as optional future use.
   - If direct `user_id` on `Message` is desired, add the column and backfill via migration.
   - Ensure `SessionService._replace_session_messages` receives and persists `emotion_label` and `emotion_score`; trace the pipeline from the frontend payload.
3. **Fix UUID/int mismatches**
   - Update API endpoints (and any ORM lookups) to consistently use `session_uuid` for external callers, while internal logic keeps `session_id`.
   - Adjust frontend API helpers so star toggles and tile navigation send the correct identifier expected by the backend.
4. **Re-test end-to-end**
   - Register/login, complete a chat, star from summary/tiles, reopen sessions, and confirm emotions persist.
   - Run `process_session_archives` to ensure rotation still behaves once multiple sessions exist.

These steps will stabilise persistence, align the schema with real usage, and unblock the remaining UI flows.

---

## Remediation Progress – 2025-11-12 (Evening)

- **Identifier cleanup**: `_resolve_session_for_user` now powers `save_session`, `get_session_by_id`, and `toggle_session_star`, favouring `session_uuid` while gracefully handling integer fallbacks and surfacing 400s for invalid IDs.
- **Message schema update**: Added denormalised `user` FK to `message`, dropped `audio_file_path`, and shipped migration `api/0008_message_user_cleanup`, which also reseeds `session` and `message` sequences to `MAX(id)+1`.
- **Session uniqueness**: Added constraint `unique_session_uuid_per_user` via `api/0009_session_uuid_per_user`, keeping the surrogate `session_id` PK but documenting the `(user, session_uuid)` pairing.
- **Emotion persistence**: Chat UI tags outgoing user messages with DeBERTa’s primary emotion so `_replace_session_messages` stores `emotion_label`/`emotion_score`. Retrieved transcripts now include the metadata.
- **Deferred rotation worker**: `_mark_pending_archive` now kicks off `process_session_archives` in a background thread immediately after commit so pending jobs are processed without manual CLI intervention.
- **Archived-session experience**: Archive jobs now persist both an internal `context_summary` and a user-facing `resume_message`, giving the LLM context while greeting returning users with a warm recap.
- **Rotation guard reconfirmed**: Creating sessions through `SessionService.create_session` keeps them `state='full'` and enqueues no archive jobs until a user exceeds three non-starred FULL transcripts.
- **Manual verification**: Django shell smoke tests confirm new schema writes (`Message.user_id` populated, sequences reseeded).

### Still Pending

- Full UI regression: run through chat → summary → star → dashboard → tile reopen after rebuilding the frontend bundle.
- Docs/partner guide updates: capture schema/API changes (UUID usage, removed audio column, new migrations) in `session_memory_implementation_log.md` and partner migration notes.
- Emotion audit: optional follow-up to determine whether assistant turns require sentiment tagging or if user-only coverage is sufficient.

---

## Additional Findings (User Feedback – 2025-11-12)

### Message Table Concerns

- Auto-increment `message_id` currently starts at `4`; the sequence likely advanced during earlier migrations/tests but should be reseeded for a clean baseline.
- Table lacks a direct `user_id` column, making analytics/debugging harder; adding a denormalised `user_id` (with FK constraint) would help.
- `audio_file_path` column is still present even though audio transcripts are not persisted; consider dropping it until audio chat ships.
- Emotion metadata (`emotion_label`, `emotion_score`) is not being persisted even though DeBERTa produces values; need to trace the payload from the chat flow into `SessionService._replace_session_messages`.

### Session Table Concerns

- Auto-increment `session_id` starts at `3`, which matches prior inserts; reseeding the sequence will reset future IDs if we want them to start at `1`.
- Current schema uses a surrogate `session_id` PK plus a unique `session_uuid`; if a composite key of `(user_id, session_id)` is desired, we can enforce uniqueness with a constraint rather than changing the PK.

### Star & Retrieval Failures

- Star actions (summary screen, dashboard tiles, session list) return “Cannot star this session – Archived…” because the view is failing before reaching `SessionService.set_starred`, leaving the state as `summary_only`.
- Clicking a recent session tile raises “Field `session_id` expected a number but got `<uuid>`” since the API endpoint still expects the integer PK while the client sends `session_uuid`.

## Plan to Address Feedback

1. **Normalize Identifiers**

   - Update backend service/queries to accept `session_uuid` for all external APIs (star toggles, session fetch).
   - Adjust frontend calls to match the updated contracts.
   - Add defensive checks so attempts to star a summary-only session return a clear error before the ORM lookup.

2. **Reseed Sequences & Clarify PK Strategy**

   - Reseed `session_session_id_seq` and `message_message_id_seq` to `1` (or document expected offsets if legacy rows remain).
   - Add a `UniqueConstraint` on `(user_id, session_uuid)` for clarity while keeping the surrogate `session_id` PK (preferred by Django/ORM).

3. **Enhance Message Schema**

   - Add `user` ForeignKey column for denormalised access (`on_delete=CASCADE`).
   - Drop `audio_file_path` in both model and migrations (can be reintroduced when audio storage requirements are defined).
   - Ensure `_replace_session_messages` is passed the emotion fields and persists them; update the API payload to include values from the existing DeBERTa output.

4. **Re-test User Flow**

   - End-to-end test: start chat → finish → star on summary → navigate via tile → reopen session.
   - Verify persisted messages include emotion metadata and sequence numbers.
   - Confirm deferred rotation still works after accumulating more than three non-starred sessions.

5. **Document Updates**
   - Record schema changes and API contract adjustments in partner docs (`session_memory_implementation_log.md`, migration instructions).
   - Add troubleshooting notes about sequence reseeding and UUID usage.
