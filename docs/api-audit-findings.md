# API Audit Findings

## Audit Scope

This audit reviewed all API call paths across the MindEase frontend (Next.js pages, components, contexts, lib/api.ts, lib/cache.ts, lib/export-sessions.ts), the Django backend (api/views.py, api/urls.py, api/services/), and the AI pipeline (chatbot/chat.py, chatbot/conversation_memory.py, chatbot/llm_client.py). Every page route (`dashboard`, `chat`, `voice-chat`, `sessions`, `diagnostic-test/[testType]`, `profile`, `auth`) and every shared component that makes or triggers API calls was read end-to-end.

## System Understanding

**Frontend request flow:**
- Auth is managed via `AuthContext` (localStorage-backed JWT/user_id). Clerk middleware only runs on `/auth` and `/dashboard` routes for OAuth handshake.
- The dashboard uses a single consolidated endpoint (`/api/dashboard/data/`) via `DashboardDataContext`, which fetches session count, recent sessions, test status, test history, mood trend, streak, and therapists in one round-trip. A 60s module-level cache (`_cache`) prevents redundant fetches on SPA navigation.
- Chat and voice-chat pages independently fetch welcome messages, session data, test history (via ShareTestModal), and session lists (via ChatSidebar). They fire background save (summary + save) on session switch or end.
- The sessions page fetches all sessions via `apiGetRecentSessions(userId, 0)` and uses `lib/cache.ts` for stale-while-revalidate.
- Export functions call `apiGetSessionById` per session to get full transcripts.

**Backend request flow:**
- Each chat message request re-instantiates `ConversationMemory` and replays the full conversation history from the client payload.
- The chatbot singleton (`get_cached_chatbot`) is cached per language to keep DeBERTa/RAG/LLM warm, but memory is reset every request.
- `save_session` generates both a title and short_summary via two separate LLM calls on every save.
- Welcome messages use a single-flight file cache for text + audio. After diagnostic test submission, a background thread precomputes welcome variants.
- `chat_welcome` has two code paths: a cached path (when `test_context_key` is present) and a non-cached path that duplicates the `_generate_welcome_text` logic inline.

## Inclusion Rule

This file only includes findings with 40% or higher criticality. Low-value nitpicks, cosmetic inconsistencies, and speculative improvements have been intentionally excluded.

---

## Issue 1: ChatSidebar refetches all sessions on every currentSessionId change

**Criticality Score:** 70
**Priority:** High
**Confidence:** High
**Files:** `components/chat-sidebar.tsx:44`

### Current Behavior
The `ChatSidebar` `useEffect` dependency array is `[user?.id, currentSessionId]`. Every time `currentSessionId` changes (new chat started, session loaded, session switched), it calls `apiGetRecentSessions(user.id, 30)` — a full network round-trip to the backend.

### Why This Matters
On a single chat page visit, this fires: once on mount, once when welcome loads (`setCurrentSessionId(null)`), and once when a session is saved (`setCurrentSessionId(saveResponse.session.session_id)`). Switching between sessions fires it twice more. This means 3-5 full session-list fetches per typical chat interaction, each hitting the database.

### Impact
Backend load, latency, duplicate traffic. The sidebar visually flickers if sessions reorder between fetches.

### Safe Recommendation
Remove `currentSessionId` from the dependency array. Instead, refetch only on `user?.id` change. If the sidebar needs to reflect a newly-created session, either:
- (a) Optimistically prepend/update the local `sessions` state when the parent notifies of a save, or
- (b) Expose a `refreshSessions()` callback and call it once after save completes.

### Why This Should Not Break Existing Behavior
The sidebar already seeds from cache on mount. The only behavioral difference is that the sidebar won't automatically show a brand-new session mid-chat until the user triggers a refresh (new chat, page revisit). This matches user expectation — they don't expect the sidebar to live-update while chatting.

### Needs Confirmation?
No.

### Validation Checklist
- [ ] Sidebar still loads sessions on initial mount
- [ ] Sidebar still shows sessions from cache instantly
- [ ] After ending a chat and creating a new one, the sidebar eventually shows the new session
- [ ] No duplicate fetch calls visible in network tab during normal chat flow

---

## Issue 2: Full conversation history sent with every chat message (growing payload)

**Criticality Score:** 65
**Priority:** High
**Confidence:** High
**Files:** `app/chat/page.tsx:247-250`, `app/voice-chat/page.tsx:417-423`, `lib/api.ts:228-243`, `backend/api/views.py:866-944`

### Current Behavior
Every `apiChatMessage` call sends the entire `conversation_history` array. After 10 exchanges, this is 20 messages. After 20 exchanges, 40 messages. The backend receives this, iterates through all of them to populate `ConversationMemory`, then only uses the last ~20 (the deque's `maxlen`).

### Why This Matters
- Network payload grows linearly with conversation length.
- Backend CPU time spent repopulating the deque is wasted for messages beyond the window.
- For voice chat, this is compounded because `content_type: "audio"` messages with long transcripts are included.

### Impact
Latency (larger request body), backend CPU (re-parsing), bandwidth waste.

### Safe Recommendation
Truncate the `conversation_history` on the frontend before sending. Only send the last 20 messages (matching the backend's `max_history_length=20`). This can be done in `apiChatMessage` and `apiChatMessageStream`:

```ts
const trimmedHistory = conversation_history.slice(-20)
```

### Why This Should Not Break Existing Behavior
The backend already truncates to 20 via `deque(maxlen=20)`. Sending only the last 20 produces identical backend behavior. The full history remains in the frontend's `messages` state (untouched) for display, summary, and session save.

### Needs Confirmation?
No. The backend's `max_history_length=20` confirms that older messages are already discarded.

### Validation Checklist
- [ ] Chat responses remain contextually accurate after 20+ messages
- [ ] Session save still sends the full history (not truncated)
- [ ] Summary generation still receives the full history
- [ ] Voice chat maintains same behavior
- [ ] No regression in emotion detection or test_context flow

---

## Issue 3: save_session makes two LLM calls (title + short_summary) on every save

**Criticality Score:** 60
**Priority:** Medium
**Confidence:** High
**Files:** `backend/api/views.py:1557-1561`

### Current Behavior
Every `save_session` call (including background saves and end-chat saves) instantiates `LLMClient()` and calls `_generate_session_title()` and `_generate_short_summary()` — two separate LLM inference calls. Background saves fire on every session switch (handleNewChat, handleSessionSelect).

### Why This Matters
Each LLM call takes 1-5 seconds (depending on model and load). Two calls per save means 2-10 seconds of backend processing. During background saves, this blocks a Django thread. For users who switch sessions frequently, this creates a queue of expensive LLM calls.

### Impact
Backend latency, LLM inference cost, thread pool exhaustion under load.

### Safe Recommendation
Combine the title and short_summary into a single LLM call with a structured prompt that asks for both in one response (e.g., "Return JSON: {title, short_summary}"). This halves the LLM cost per save. Alternatively, for background saves specifically, skip the title generation if the session already has one (update path).

### Why This Should Not Break Existing Behavior
The output is purely cosmetic (title + summary displayed in session list). A combined prompt produces the same quality output. The update path (`session_identifier` present) could skip title regeneration since the title was already set on first save.

### Needs Confirmation?
Yes — confirm that session title quality from a combined prompt matches the current separate-prompt quality. Test with 5-10 example conversations.

### Validation Checklist
- [ ] Session titles remain descriptive and concise
- [ ] Short summaries remain accurate
- [ ] Background saves complete without errors
- [ ] Session list displays correctly after save
- [ ] No regression when updating an existing session

---

## Issue 4: Duplicate welcome generation logic in chat_welcome view

**Criticality Score:** 55
**Priority:** Medium
**Confidence:** High
**Files:** `backend/api/views.py:1190-1311`

### Current Behavior
The `chat_welcome` view has two code paths:
1. **Cached path** (lines 1216-1222): When `test_context` AND `test_context_key` are both present, it calls `_ensure_welcome_text_cached()` which handles generation + file caching with single-flight locks.
2. **Non-cached path** (lines 1224-1299): When `test_context` is present but `test_context_key` is absent, it duplicates the exact same LLM generation logic that `_generate_welcome_text()` already encapsulates, including the same system prompt, meta-phrase stripping, and Urdu handling.

The non-cached path is ~75 lines of duplicated code.

### Why This Matters
- Maintenance burden: any change to the welcome generation logic must be made in two places.
- The non-cached path misses the `_strip_welcome_meta_phrases` helper (it re-implements it inline with subtly different behavior).
- Without `test_context_key`, there's no caching, so repeated requests regenerate via LLM every time.

### Impact
Maintainability, potential inconsistency, wasted LLM calls.

### Safe Recommendation
Replace the non-cached path with a call to `_generate_welcome_text()` (which already exists and handles all variants). If caching isn't desired without a key, just call the function without caching:

```python
if test_context:
    if test_context_key:
        welcome_msg = _ensure_welcome_text_cached(...)
    else:
        welcome_msg = _generate_welcome_text(
            user_first_name, test_context, lang_pref,
            voice_welcome_urdu_script=voice_welcome_urdu_script,
        )
```

### Why This Should Not Break Existing Behavior
`_generate_welcome_text` already implements the same logic. The only difference is the non-cached path has inline meta-phrase stripping that `_generate_welcome_text` handles via `_strip_welcome_meta_phrases`. The helper function is actually more thorough.

### Needs Confirmation?
No. The function already exists and is tested via the cached code path.

### Validation Checklist
- [ ] Welcome with test_context (no key) still produces appropriate messages
- [ ] Welcome with test_context + key still uses cache path
- [ ] Welcome without test_context still returns static messages
- [ ] Urdu + Arabic-script variants still work correctly
- [ ] No meta-phrases leak into the welcome message

---

## Issue 5: Voice chat welcome can trigger up to 3 sequential API calls

**Criticality Score:** 55
**Priority:** Medium
**Confidence:** High
**Files:** `app/voice-chat/page.tsx:179-241`

### Current Behavior
In `loadWelcomeMessage`:
1. First tries `apiGetWelcomeAudio()` (GET cached audio).
2. If audio exists but no `welcomeMessage` header: calls `apiChatWelcome()` additionally for text.
3. If audio fetch fails: calls `apiChatWelcome()` for text, THEN calls `apiGenerateAndSaveWelcomeAudio()` to synthesize + cache audio.

Worst case: 3 sequential API calls, including an LLM call (welcome text) and a TTS call (audio synthesis). This creates a waterfall: audio GET (fast) -> welcome text (LLM, slow) -> TTS synthesis (slow).

### Why This Matters
First voice chat load for a new user can take 8-15 seconds due to the waterfall. The `apiGetWelcomeAudio` endpoint already returns the welcome text in the `X-Welcome-Message` header when available, but the fallback path doesn't benefit from this.

### Impact
User experience (long wait on first voice chat), avoidable LLM + TTS calls.

### Safe Recommendation
Two improvements:
1. **Backend**: Ensure `voice_welcome_audio` GET always writes the `X-Welcome-Message` header from the sidecar `.json` file if it exists. (Verify this is already the case.)
2. **Frontend**: When `apiGetWelcomeAudio` fails, fire `apiChatWelcome()` and `apiGenerateAndSaveWelcomeAudio()` in parallel — the text can display immediately while audio generates in the background. Currently they're sequential.

The parallel approach:
```ts
const [welcomeRes, audioBlob] = await Promise.allSettled([
  apiChatWelcome(...),
  apiGenerateAndSaveWelcomeAudio(...)
])
```

However, `apiGenerateAndSaveWelcomeAudio` needs the welcome text as input, so true parallelism isn't possible without backend changes. The safer fix: have the backend's `POST /voice/welcome-audio/` generate its own welcome text if `welcome_message` isn't provided (it already can via `_ensure_welcome_text_cached`), removing the need for the frontend to call `apiChatWelcome` separately.

### Why This Should Not Break Existing Behavior
The welcome text and audio content remain identical. The only change is reducing the number of round-trips.

### Needs Confirmation?
Yes — need to verify the backend's welcome-audio POST endpoint can self-generate welcome text (it currently requires `welcome_message` in the body).

### Validation Checklist
- [ ] Voice chat welcome loads for new users (no cache)
- [ ] Voice chat welcome loads for returning users (cache hit)
- [ ] Welcome with test context works correctly
- [ ] Audio plays after loading
- [ ] Welcome text displays while audio is still generating

---

## Issue 6: ShareTestModal fetches test history independently from dashboard data

**Criticality Score:** 50
**Priority:** Medium
**Confidence:** Medium
**Files:** `components/share-test-modal.tsx:91-106`, `context/DashboardDataContext.tsx`

### Current Behavior
When the user navigates from the dashboard to `/chat`, the `ShareTestModal` calls `apiGetDiagnosticTestHistory(user.id)` to fetch the latest test result. The dashboard already fetched this exact data via the consolidated `apiGetDashboardData` endpoint, and it's available in `DashboardDataContext` — but the chat page doesn't have access to that context (it's only wrapped around the dashboard page content).

The `lib/cache.ts` test history cache helps (60s TTL), but only if the navigation happens within 60 seconds.

### Why This Matters
Every chat session start (new tab, page refresh, or after 60s) triggers a redundant database query for test history that was just fetched on the dashboard.

### Impact
Redundant backend query, slight latency on chat page load.

### Safe Recommendation
Two options (pick one):
1. **Extend cache TTL** to 5 minutes for test history. Test results don't change frequently (once per day max), so a longer cache is safe.
2. **Seed the cache from dashboard data**: When `DashboardDataProvider` fetches data, also call `setTestHistoryCache(user.id, { results: data.test_history })` so the ShareTestModal's cache is pre-warmed.

Option 2 is better because it eliminates the redundant call entirely for the common flow (dashboard -> chat).

### Why This Should Not Break Existing Behavior
Test history data is read-only and changes at most once per day (when a test is submitted). The modal already handles the case where cache is stale by fetching fresh data in the background.

### Needs Confirmation?
Yes — confirm that `DashboardData.test_history` has the same shape as `apiGetDiagnosticTestHistory` response (specifically `results` field with `TestHistoryItem[]`).

### Validation Checklist
- [ ] ShareTestModal shows latest test result correctly
- [ ] Modal works when navigated to directly (no dashboard visit first)
- [ ] After submitting a new test, modal shows the new result
- [ ] No stale data shown after test submission

---

## Issue 7: Diagnostic test page re-fetches test status independently

**Criticality Score:** 45
**Priority:** Low
**Confidence:** Medium
**Files:** `app/diagnostic-test/[testType]/page.tsx:66-81`

### Current Behavior
When the user navigates from the dashboard (which already fetched `test_status` via `apiGetDashboardData`) to `/diagnostic-test/[testType]`, the test page calls `apiGetDiagnosticTestStatus(user.id)` independently. This is a separate backend round-trip.

### Why This Matters
The test status was already fetched on the dashboard. For the common flow (dashboard -> "Take Test" button -> test page), this is a redundant call.

### Impact
Minor latency, redundant backend query.

### Safe Recommendation
Use the same approach as Issue 6: seed a test-status cache from the dashboard data. The test page can check the cache first and only fetch if missing/stale.

Add to `lib/cache.ts`:
```ts
let _testStatusCache: CacheEntry<DiagnosticTestStatus> | null = null
export function getTestStatusCache(userId: string) { ... }
export function setTestStatusCache(userId: string, data: DiagnosticTestStatus) { ... }
```

The test page uses the cache to show UI instantly while still validating freshness via a background fetch (important because test status changes after submission).

### Why This Should Not Break Existing Behavior
The test page still fetches the authoritative status — it just shows cached data faster. The critical guard (preventing retaking a test) relies on the fresh fetch, which still happens.

### Needs Confirmation?
Yes — ensure the guard logic (`setTestAlreadyTaken`) still uses the fresh fetch result, not the cached one.

### Validation Checklist
- [ ] Test page loads faster when coming from dashboard
- [ ] Test already taken guard still works correctly
- [ ] Direct navigation to test page (no dashboard) still works
- [ ] After submitting a test, the guard blocks retaking

---

## Issue 8: Dead mock code in apiGetMe / apiUpdateMe

**Criticality Score:** 45
**Priority:** Low
**Confidence:** High
**Files:** `lib/api.ts:179-199`

### Current Behavior
`apiGetMe` and `apiUpdateMe` are mock functions that simulate network delay with `setTimeout(r, 500)` and operate on a module-level `mockUser` object. They never hit the backend. They appear to be leftover from early development.

### Why This Matters
- Dead code that could confuse future developers.
- The `mockUser` object (`test@example.com`, `John Doe`) will leak into any code that accidentally calls these functions.
- The 500ms artificial delay would directly hurt UX if these functions were ever called.

### Impact
Maintainability, potential confusion, dead code.

### Safe Recommendation
Check if `apiGetMe` or `apiUpdateMe` are imported anywhere in the codebase. If not, remove them. If they are imported, verify they're not actually called.

### Why This Should Not Break Existing Behavior
These are mock functions that don't connect to any backend endpoint. The actual profile operations use `apiGetUserProfile` and `apiUpdateUserProfile`.

### Needs Confirmation?
Yes — verify no component imports or calls `apiGetMe` / `apiUpdateMe`.

### Validation Checklist
- [ ] Grep for `apiGetMe` and `apiUpdateMe` across codebase
- [ ] If unused, remove them
- [ ] If used somewhere, determine if that usage is also dead code
- [ ] Profile page still works correctly

---

## Issue 9: Inconsistent BASE_URL definitions in api.ts

**Criticality Score:** 42
**Priority:** Low
**Confidence:** High
**Files:** `lib/api.ts:3,103` + ~30 hardcoded URLs throughout the file

### Current Behavior
The file defines `const BASE_URL = "http://127.0.0.1:8000/api"` on line 3 and `const API_BASE = "http://localhost:8000/api"` on line 103. Most functions use neither — they hardcode `"http://localhost:8000/api/..."` directly. Only `apiLoginOauth`, `apiRegisterOauth`, and `apiGetDashboardData` use `API_BASE`. No function uses `BASE_URL`.

### Why This Matters
- `127.0.0.1` and `localhost` can behave differently in some network configurations (CORS, DNS resolution, IPv6).
- When deploying or switching environments, every URL must be changed individually.
- `BASE_URL` is defined but never used — dead code.

### Impact
Maintainability, deployment fragility, potential CORS issues.

### Safe Recommendation
1. Remove the unused `BASE_URL` constant.
2. Consolidate all fetch URLs to use `API_BASE`.
3. Optionally source `API_BASE` from an environment variable (`NEXT_PUBLIC_API_URL`).

This is a mechanical find-and-replace with no behavioral change.

### Why This Should Not Break Existing Behavior
All URLs currently resolve to the same backend. Consolidating to `API_BASE` (`http://localhost:8000/api`) maintains the same target.

### Needs Confirmation?
No.

### Validation Checklist
- [ ] All API functions still hit the correct endpoints
- [ ] Auth flow (login, register, OAuth) works
- [ ] Chat, voice, sessions, profile all work
- [ ] No CORS errors in browser console

---

## Issue 10: Background save fires LLM summary even when conversation hasn't meaningfully changed

**Criticality Score:** 48
**Priority:** Medium
**Confidence:** Medium
**Files:** `app/chat/page.tsx:142-158`, `app/voice-chat/page.tsx:165-176`

### Current Behavior
`backgroundSaveCurrentSession` (chat) and `backgroundSave` (voice-chat) check `currentUserMessages > baselineUserMessageCount` to avoid saving empty sessions. However, they fire on every session switch and new chat action — even if only 1 new user message was added since the last save. Each background save triggers an LLM summary call + an LLM title call + an LLM short_summary call (via `save_session`), totaling 3 LLM calls.

### Why This Matters
If a user sends 1 message, switches to another session, sends 1 message, switches back — that's 6 LLM calls (3 per background save) for 2 messages. The baseline check prevents saving empty sessions but not saving after minimal interaction.

### Impact
LLM inference cost, backend thread usage.

### Safe Recommendation
Add a minimum threshold before triggering background save. For example, only save if there are at least 2 new user messages since the last save:

```ts
if (currentUserMessages - baselineUserMessageCount < 2) return
```

This prevents expensive saves for trivially short interactions while still preserving meaningful conversations.

### Why This Should Not Break Existing Behavior
The end-chat explicit save (handleEndChat) has no such threshold — it always saves if there's at least 1 user message beyond baseline. So conversations are never lost; they're just saved at end-chat rather than mid-session for very short interactions.

### Needs Confirmation?
Yes — confirm that the end-chat save path (explicit "End Chat" button) still fires without the threshold, so no conversation is ever lost.

### Validation Checklist
- [ ] Short conversations (1 message) are saved when user clicks "End Chat"
- [ ] Background save doesn't fire for 1-message sessions
- [ ] Longer conversations (3+ messages) still background-save on session switch
- [ ] No data loss when browser is closed mid-chat

---

## Issue 11: Backend chat_message instantiates new ConversationMemory and replays all history per request

**Criticality Score:** 42
**Priority:** Low
**Confidence:** Medium
**Files:** `backend/chatbot/chat.py:36-54`, `backend/api/views.py:893-904`

### Current Behavior
`get_cached_chatbot()` resets `bot.memory = ConversationMemory(max_history_length=20)` on every call. Then `chat_message` view iterates through the full `conversation_history` from the client and calls `bot.memory.add_message()` for each one. This means every request:
1. Creates a new deque
2. Iterates through up to 20+ messages
3. Calls `_update_session_summary()` every 6 messages (the internal periodic summary)

### Why This Matters
The `_update_session_summary()` call inside `add_message` every 6 messages is designed for long-running sessions — but here it fires during replay of existing history, doing unnecessary work.

### Impact
Minor CPU overhead per request, mostly in the `_update_session_summary()` calls during replay.

### Safe Recommendation
Batch-load the conversation history without triggering the periodic summary update. Add a method to `ConversationMemory`:

```python
def load_history(self, messages: list):
    """Bulk-load history without triggering periodic summaries."""
    for msg in messages:
        self.conversation_history.append(msg)
```

And use it in the view instead of the loop of `add_message` calls.

### Why This Should Not Break Existing Behavior
The periodic summary (`_update_session_summary`) during replay doesn't contribute to the response — only the final state of the deque matters. The LLM response quality depends on the messages in the deque, which are identical either way.

### Needs Confirmation?
Yes — verify that `_update_session_summary()` doesn't produce side effects that affect the LLM response (e.g., prepending a summary to the system prompt).

### Validation Checklist
- [ ] Chat responses remain contextually accurate
- [ ] No regression in emotion detection
- [ ] No regression in RAG retrieval
- [ ] Session summary at end-of-chat is still correct

---

## Recommended Fix Order

Ordered by safety (lowest risk first) and impact:

1. **Issue 8** (Dead mock code) — Pure deletion, zero risk. Verify unused first.
2. **Issue 9** (BASE_URL consolidation) — Mechanical find-and-replace, no logic change.
3. **Issue 4** (Duplicate welcome logic) — Replace duplicated code with existing function call.
4. **Issue 1** (ChatSidebar refetch) — Remove `currentSessionId` from dependency array.
5. **Issue 2** (Truncate conversation history) — Add `.slice(-20)` before sending.
6. **Issue 6** (Seed test history cache from dashboard) — Add one `setTestHistoryCache` call.
7. **Issue 7** (Seed test status cache) — Similar pattern to Issue 6.
8. **Issue 10** (Background save threshold) — Add minimum message check.
9. **Issue 11** (Batch-load ConversationMemory) — Small backend refactor.
10. **Issue 3** (Combine title + summary LLM calls) — Requires prompt engineering + testing.
11. **Issue 5** (Voice welcome waterfall) — Requires backend endpoint change.

## Deferred / Not Included

The following were considered but excluded for being below the 40% criticality threshold:

- **`transition-all` usage in inline styles**: Some `onMouseEnter`/`onMouseLeave` handlers use `transition: "all 0.15s ease"`. This is a CSS performance concern, not an API issue, and is minor.
- **Therapist filters endpoint unused on dashboard**: `apiGetTherapistFilters` is only used on the full therapist directory page, not the dashboard preview. Not redundant — it's correctly scoped.
- **Session export waterfall (multiple `apiGetSessionById` calls)**: When exporting multiple sessions, each is fetched individually. A batch endpoint would be better, but exports are rare user actions and the current behavior is correct.
- **`apiSTTTranscribePartial` endpoint exists but may be unused**: Needs verification but low impact even if dead.
- **Django CSRF exempt on all views**: Security concern, not an API efficiency issue. Out of scope for this audit.
- **No request cancellation / AbortController usage**: Chat sidebar, session loads, and other fetches don't abort in-flight requests when superseded. Low practical impact because most requests complete quickly, but could cause stale data in edge cases. Too speculative to include.
- **Profile page fetches `apiGetUserProfile` independently**: Similar to Issue 6/7 but the profile page is visited rarely and the data must be fully fresh for editing. Intentionally excluded.
