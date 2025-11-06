# Session Tracking & Recent Sessions Implementation

## Overview
This document describes the temporary in-memory session tracking and recent sessions system implemented for the MindEase dashboard. This includes:
- Session count tracking (number of completed sessions)
- Recent sessions storage with LLM-generated titles
- Ability to continue previous conversations

This is a temporary solution until database persistence is implemented.

## Current Implementation

### Backend (Django)

#### In-Memory Storage
- **Location**: `backend/api/views.py`
- **Session Counts**: Dictionary `SESSION_COUNTS = {}` where key is `user_id` (string) and value is session count (integer)
- **User Sessions**: Dictionary `USER_SESSIONS = {}` where key is `user_id` (string) and value is a list of session objects
- **Scope**: Server process only - resets when server restarts
- **Multi-user**: Each user has their own count and sessions stored separately

#### Session Object Structure
Each session in `USER_SESSIONS` contains:
```python
{
    "session_id": str,           # Unique UUID
    "title": str,                # LLM-generated title
    "messages": [ChatMessage],   # Full conversation history
    "summary": str,              # Session summary
    "created_at": str,           # ISO timestamp
    "updated_at": str            # ISO timestamp
}
```

#### API Endpoints

1. **GET Session Count** (`/api/sessions/count/`)
   - **Method**: POST
   - **Request Body**:
     ```json
     {
       "user_id": "123"
     }
     ```
   - **Response**:
     ```json
     {
       "session_count": 5,
       "user_id": "123"
     }
     ```
   - **Behavior**: Returns current session count for user (defaults to 0 if user has no sessions)

2. **Increment Session Count** (`/api/sessions/increment/`)
   - **Method**: POST
   - **Request Body**:
     ```json
     {
       "user_id": "123"
     }
     ```
   - **Response**:
     ```json
     {
       "session_count": 6,
       "user_id": "123"
     }
     ```
   - **Behavior**: Increments session count for user by 1 and returns new count

3. **Save Session** (`/api/sessions/save/`)
   - **Method**: POST
   - **Request Body**:
     ```json
     {
       "user_id": "123",
       "conversation_history": [...],
       "summary": "Session summary...",
       "session_id": "optional-uuid",  // If provided, updates existing session
       "user_first_name": "John"
     }
     ```
   - **Response**:
     ```json
     {
       "session": {
         "session_id": "uuid",
         "title": "Anxiety about upcoming exams",
         "messages": [...],
         "summary": "...",
         "created_at": "2024-01-01T12:00:00",
         "updated_at": "2024-01-01T12:00:00"
       },
       "user_id": "123"
     }
     ```
   - **Behavior**: Creates new session or updates existing one. Generates LLM title automatically.

4. **Get Recent Sessions** (`/api/sessions/recent/`)
   - **Method**: POST
   - **Request Body**:
     ```json
     {
       "user_id": "123",
       "limit": 3
     }
     ```
   - **Response**:
     ```json
     {
       "sessions": [
         {
           "session_id": "uuid",
           "title": "Anxiety about upcoming exams",
           "summary": "...",
           "created_at": "2024-01-01T12:00:00",
           "updated_at": "2024-01-01T12:00:00"
         }
       ],
       "total": 5,
       "user_id": "123"
     }
     ```
   - **Behavior**: Returns most recent sessions (limited by `limit` parameter)

5. **Get Session By ID** (`/api/sessions/get/`)
   - **Method**: POST
   - **Request Body**:
     ```json
     {
       "user_id": "123",
       "session_id": "uuid"
     }
     ```
   - **Response**:
     ```json
     {
       "session": {
         "session_id": "uuid",
         "title": "Anxiety about upcoming exams",
         "messages": [...],
         "summary": "...",
         "created_at": "2024-01-01T12:00:00",
         "updated_at": "2024-01-01T12:00:00"
       },
       "user_id": "123"
     }
     ```
   - **Behavior**: Returns full session data including all messages

### Frontend (Next.js)

#### Components Updated

1. **QuickStats Component** (`components/quick-stats.tsx`)
   - Now fetches and displays session count from backend
   - Shows loading state while fetching
   - Displays count or "No sessions yet" message
   - Auto-refreshes when component mounts

2. **Chat Page** (`app/chat/page.tsx`)
   - Increments session count when chat ends with actual conversation
   - Only increments if there are user messages (not just welcome message)
   - Does NOT increment if user exits without chatting
   - Saves session when chat ends (creates new or updates existing)
   - Loads existing session if `session_id` is in URL query params
   - Auto-focuses input after AI response

3. **SessionHistory Component** (`components/session-history.tsx`)
   - Displays recent sessions (up to 3 visible)
   - Shows LLM-generated session titles
   - Clickable sessions that navigate to `/chat?session_id=...`
   - Auto-refreshes when component becomes visible
   - Shows formatted dates (Today, Yesterday, X days ago)

4. **ChatInterface Component** (`components/chat-interface.tsx`)
   - Added `onResponseComplete` callback prop
   - Triggers callback when AI finishes responding

5. **ChatInput Component** (`components/chat-input.tsx`)
   - Added `autoFocus` prop support
   - Auto-focuses textarea when prop is true

#### API Functions (`lib/api.ts`)

- `apiGetSessionCount(user_id: string)`: Fetches current session count
- `apiIncrementSessionCount(user_id: string)`: Increments and returns new count
- `apiSaveSession(user_id, conversation_history, summary, session_id?, user_first_name?)`: Saves or updates session
- `apiGetRecentSessions(user_id, limit)`: Fetches recent sessions
- `apiGetSessionById(user_id, session_id)`: Fetches full session by ID

## Session Count Logic

### When Count Increments
- ✅ User starts chat, sends at least one message, and ends chat
- ✅ User completes a full conversation (user messages + therapist responses)
- ✅ User ends chat after having actual conversation (not just welcome message)

### When Count Does NOT Increment
- ❌ User opens chat and immediately exits without sending any messages
- ❌ User only sees welcome message and closes chat
- ❌ Chat ends but no user messages were sent

### Multi-User Support
- Each user has their own session count stored by `user_id`
- User A's sessions don't affect User B's count
- Counts are maintained separately in memory dictionary
- Example:
  - User A (ID: 1) completes 3 sessions → count = 3
  - User B (ID: 2) completes 2 sessions → count = 2
  - Both counts stored independently: `SESSION_COUNTS = {"1": 3, "2": 2}`

## Flow Diagrams

### New Chat Flow
```
User Opens Dashboard
    ↓
QuickStats & SessionHistory Load
    ↓
Fetches Session Count & Recent Sessions
    ↓
User Clicks "Start Chat"
    ↓
Chat Page Opens (new session)
    ↓
User Sends Messages & Chats
    ↓
User Clicks "End Chat"
    ↓
Check: Are there user messages?
    ├─ NO → Go back to dashboard (no increment, no save)
    └─ YES → Generate summary
            ↓
        Generate LLM title for session
            ↓
        Save session via /api/sessions/save/
            ↓
        Increment count via /api/sessions/increment/
            ↓
        Show summary
            ↓
        User Returns to Dashboard
            ↓
        QuickStats & SessionHistory Refresh
```

### Continue Existing Chat Flow
```
User Sees Recent Session in Dashboard
    ↓
User Clicks on Session
    ↓
Navigate to /chat?session_id=uuid
    ↓
Chat Page Loads Session via /api/sessions/get/
    ↓
Messages Loaded from Session
    ↓
User Continues Conversation
    ↓
User Clicks "End Chat"
    ↓
Generate Updated Summary (includes new context)
    ↓
Update Session via /api/sessions/save/ (with session_id)
    ↓
Show Updated Summary
    ↓
User Returns to Dashboard
```

## Session Title Generation

### LLM-Generated Titles
- Titles are automatically generated when a session is saved
- Uses LLM to analyze conversation content (first 3 user messages)
- Generates concise, descriptive titles (6-8 words max)
- Examples:
  - "Anxiety about upcoming exams"
  - "Relationship stress and communication"
  - "Work-life balance struggles"
  - "Feeling overwhelmed with daily tasks"

### Title Generation Process
1. Extract user messages from conversation
2. Use first 3 user messages as context
3. Send to LLM with specific prompt for title generation
4. Clean and truncate title if needed (max 60 characters)
5. Fallback to "Therapy Session" if generation fails

## Continuing Conversations

### How It Works
- When user clicks a recent session, navigates to `/chat?session_id=uuid`
- Chat page detects `session_id` in URL query params
- Loads full session data including all messages
- User can continue conversation from where they left off
- When session ends, summary is updated (not regenerated from scratch)
- Summary includes both old and new conversation context seamlessly

### Summary Updates
- When continuing a session, the summary is regenerated with full conversation history
- The summary style remains the same (doesn't say "new things were added")
- LLM naturally incorporates new context into the summary
- Summary reflects the complete conversation, not just new messages

## Current Limitations

### Temporary Nature
- **In-Memory Only**: Data is lost when server restarts
- **No Persistence**: Counts and sessions reset after server restart
- **Single Server**: Won't work with multiple server instances (no shared state)
- **Limited Storage**: All sessions stored in memory (may impact performance with many sessions)

### Future Database Implementation
When database persistence is implemented:
- Session counts will be stored in database
- Sessions will be stored in database with full history
- Counts and sessions will persist across server restarts
- Will support multiple server instances
- Can track additional metadata (session dates, durations, etc.)
- Can implement pagination for session history
- Can add search/filter functionality for sessions

## Testing

### Test Scenarios

1. **New User (First Session)**
   - Login → Dashboard shows "0"
   - Complete chat → Dashboard shows "1"
   - Complete another chat → Dashboard shows "2"

2. **Multiple Users**
   - User A logs in → sees their count
   - User A completes session → count increments
   - User A logs out
   - User B logs in → sees their own count (separate from User A)
   - User B completes session → only User B's count increments

3. **No Conversation**
   - User opens chat
   - User immediately exits without sending messages
   - Count should NOT increment
   - Dashboard still shows previous count

4. **Server Restart**
   - User has 5 sessions
   - Server restarts
   - User logs in → count resets to 0 (expected behavior for temporary solution)

## API Usage Examples

### Get Session Count
```typescript
const response = await apiGetSessionCount("123")
console.log(response.session_count) // e.g., 5
```

### Increment Session Count
```typescript
const response = await apiIncrementSessionCount("123")
console.log(response.session_count) // e.g., 6 (was 5, now 6)
```

## Files Modified

### Backend
- `backend/api/views.py` - Added `SESSION_COUNTS` and `USER_SESSIONS` dictionaries, session endpoints, and title generation
- `backend/api/urls.py` - Added session count and session management routes

### Frontend
- `lib/api.ts` - Added session management API functions
- `components/quick-stats.tsx` - Made component client-side, fetches and displays count
- `components/session-history.tsx` - Displays recent sessions with clickable navigation
- `components/chat-interface.tsx` - Added `onResponseComplete` callback
- `components/chat-input.tsx` - Added auto-focus functionality
- `app/chat/page.tsx` - Handles session saving, loading existing sessions, and auto-focus
- `app/dashboard/page.tsx` - Made client component for auth check

## Migration Path to Database

When ready to implement database persistence:

1. **Database Schema**
   - Add `sessions_completed` field to User model OR
   - Create separate SessionCount table

2. **Backend Changes**
   - Replace `SESSION_COUNTS` dictionary with database queries
   - Update `get_session_count` to query database
   - Update `increment_session_count` to update database

3. **No Frontend Changes Needed**
   - API endpoints remain the same
   - Frontend code continues to work without modification

## Notes

- This is a **temporary solution** for development/testing
- Session counts and sessions are **per-user** and **per-server-instance**
- Counts and sessions **reset on server restart** (by design for temporary solution)
- Only **text chat sessions** are currently tracked
- Session titles are **LLM-generated** based on conversation content
- Sessions can be **continued** by clicking on them in Recent Sessions
- **Auto-focus** on input after AI response for better UX
- Future: Voice calls and quick check-ins can be tracked separately
- Future: "View All Sessions" button will show paginated list of all sessions

