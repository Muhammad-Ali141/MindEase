image.png# Chatbot Frontend Integration Plan

## Overview
This document outlines the plan to integrate the terminal-based MindEase chatbot (`backend/chatbot/chat.py`) into the Next.js frontend application, allowing users to chat with the AI therapist through a web interface.

## Current Architecture

### Frontend (Next.js)
- **Location**: Root directory (`app/`, `components/`, `lib/`)
- **Tech Stack**: Next.js 14, TypeScript, React, Tailwind CSS
- **API Base URL**: `http://localhost:8000/api/`
- **Routing**: Next.js App Router (`app/` directory)
- **Auth**: Context-based (`context/AuthContext.tsx`)

### Backend (Django)
- **Location**: `backend/` directory
- **Tech Stack**: Django REST Framework
- **Current Endpoints**: `/api/register/`, `/api/login/`, `/api/send-otp/`, etc.
- **Port**: 8000 (default Django dev server)

### Chatbot (Python)
- **Location**: `backend/chatbot/`
- **Main Class**: `MindEaseChat` in `chat.py`
- **Components**:
  - `EmotionDetector`: Detects emotions from user input
  - `RAGSystem`: Retrieves relevant context from MentalChat dataset
  - `LLMClient`: Generates therapist responses using Ollama
  - `ConversationMemory`: Manages conversation history and summaries

## Integration Plan

### Phase 1: Backend API Endpoint ✅
**Goal**: Create Django API endpoint to handle chat messages

**Tasks**:
1. Create new Django view in `backend/api/views.py`:
   - `chat_message(request)` - POST endpoint to process chat messages
   - Accepts: `{ "message": "user message", "session_id": "optional" }`
   - Returns: `{ "response": "therapist response", "emotions": [...], "session_id": "..." }`

2. Add URL route in `backend/api/urls.py`:
   - `/api/chat/` → `chat_message` view

3. Integrate chatbot components:
   - Import `MindEaseChat` class
   - Initialize chatbot instance (singleton pattern for efficiency)
   - Process messages through the full pipeline:
     - Emotion Detection → RAG Retrieval → LLM Generation
   - Handle conversation memory per session

4. Session Management:
   - Create/retrieve conversation sessions per user
   - Store session_id in frontend (localStorage or state)
   - Maintain conversation history per session

**File Changes**:
- `backend/api/views.py` - Add `chat_message` function
- `backend/api/urls.py` - Add chat route
- `backend/api/models.py` - May need Session model (check if exists)

### Phase 2: Frontend Chat Page ✅
**Goal**: Create new chat page with UI similar to terminal interface

**Tasks**:
1. Create new route: `app/chat/page.tsx`
   - Protected route (use `AuthGuard`)
   - Chat interface with message bubbles
   - Input field at bottom
   - Real-time message display

2. Create chat components:
   - `components/chat-interface.tsx` - Main chat UI
   - `components/chat-message.tsx` - Individual message bubble
   - `components/chat-input.tsx` - Message input field

3. Chat UI Features:
   - Therapist messages (left side, styled differently)
   - User messages (right side)
   - Welcome message from therapist on page load
   - Loading indicator while waiting for response
   - Auto-scroll to latest message
   - Session summary on page exit (optional)

**File Changes**:
- `app/chat/page.tsx` - New chat page
- `components/chat-interface.tsx` - Chat UI component
- `components/chat-message.tsx` - Message bubble component
- `components/chat-input.tsx` - Input component

### Phase 3: Connect Dashboard Button ✅
**Goal**: Make "Start Chat" button navigate to chat page

**Tasks**:
1. Update `components/therapy-options.tsx`:
   - Add `onClick` handler to "Start Chat" button
   - Use `useRouter` from `next/navigation`
   - Navigate to `/chat` on click

**File Changes**:
- `components/therapy-options.tsx` - Add navigation

### Phase 4: API Integration ✅
**Goal**: Connect frontend to backend chat API

**Tasks**:
1. Add API function in `lib/api.ts`:
   - `apiChatMessage(message: string, sessionId?: string)` - Send message to backend
   - Handle response and errors

2. Update chat page to use API:
   - Send messages to `/api/chat/`
   - Display responses in real-time
   - Handle loading states
   - Handle errors gracefully

**File Changes**:
- `lib/api.ts` - Add `apiChatMessage` function
- `app/chat/page.tsx` - Integrate API calls

### Phase 5: Session Management ✅
**Goal**: Maintain conversation sessions across page refreshes

**Tasks**:
1. Frontend session storage:
   - Store `session_id` in localStorage
   - Retrieve on page load
   - Create new session if none exists

2. Backend session handling:
   - Create session records in database (if Session model exists)
   - Link messages to sessions
   - Retrieve conversation history per session

**File Changes**:
- `app/chat/page.tsx` - Add session management
- `backend/api/views.py` - Handle session creation/retrieval

### Phase 6: Error Handling & Edge Cases ✅
**Goal**: Handle all edge cases and errors gracefully

**Tasks**:
1. Error handling:
   - Network errors (show user-friendly message)
   - Backend errors (display error message)
   - Ollama not running (inform user)
   - Database connection errors

2. Edge cases:
   - Empty messages
   - Very long messages
   - Rapid message sending (debounce)
   - Page refresh (restore session)
   - Browser back button (handle navigation)

**File Changes**:
- All chat-related files - Add error handling

## Implementation Details

### Backend API Endpoint Structure

```python
# backend/api/views.py
@csrf_exempt
def chat_message(request):
    if request.method == "POST":
        data = json.loads(request.body)
        message = data.get("message")
        session_id = data.get("session_id")
        user_id = request.user.user_id  # If authenticated
        
        # Initialize chatbot (singleton)
        chatbot = get_or_create_chatbot()
        
        # Process message
        response = chatbot._process_message(message)
        
        # Get emotions (optional)
        emotions = chatbot.emotion_detector.detect_emotions(message)
        
        return JsonResponse({
            "response": response,
            "emotions": emotions,
            "session_id": session_id
        })
```

### Frontend API Call

```typescript
// lib/api.ts
export const apiChatMessage = async (message: string, sessionId?: string) => {
  const res = await fetch("http://localhost:8000/api/chat/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to send message");
  }
  
  return res.json();
};
```

### Chat Page Structure

```typescript
// app/chat/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/AuthGuard"
import { ChatInterface } from "@/components/chat-interface"
import { apiChatMessage } from "@/lib/api"

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Load session from localStorage
  useEffect(() => {
    const storedSession = localStorage.getItem("chat_session_id")
    if (storedSession) {
      setSessionId(storedSession)
    }
  }, [])
  
  // Send welcome message on mount
  useEffect(() => {
    // Show therapist welcome message
  }, [])
  
  const handleSendMessage = async (message: string) => {
    // Send to API and update messages
  }
  
  return (
    <AuthGuard>
      <ChatInterface 
        messages={messages}
        onSendMessage={handleSendMessage}
        loading={loading}
      />
    </AuthGuard>
  )
}
```

## File Structure After Integration

```
MindEase/
├── app/
│   ├── chat/
│   │   └── page.tsx          # NEW: Chat page
│   ├── dashboard/
│   │   └── page.tsx          # Existing
│   └── ...
├── components/
│   ├── chat-interface.tsx    # NEW: Main chat UI
│   ├── chat-message.tsx      # NEW: Message bubble
│   ├── chat-input.tsx         # NEW: Input field
│   ├── therapy-options.tsx   # MODIFY: Add navigation
│   └── ...
├── lib/
│   ├── api.ts                # MODIFY: Add apiChatMessage
│   └── ...
└── backend/
    ├── api/
    │   ├── views.py          # MODIFY: Add chat_message
    │   ├── urls.py           # MODIFY: Add chat route
    │   └── models.py         # CHECK: Session model
    └── chatbot/
        └── ...               # Existing chatbot code
```

## Testing Checklist

- [ ] Backend API endpoint responds correctly
- [ ] Frontend can send messages to backend
- [ ] Chatbot processes messages correctly
- [ ] Responses display in chat UI
- [ ] Session management works (persists across refreshes)
- [ ] Error handling works (network errors, backend errors)
- [ ] Welcome message displays on page load
- [ ] Loading states work correctly
- [ ] Navigation from dashboard works
- [ ] Chat UI is responsive and looks good

## Questions to Clarify

1. **Session Management**: 
   - Should sessions be stored in database or just in-memory?
   - Should we link sessions to user accounts?

2. **Conversation History**:
   - Should users be able to view past conversations?
   - Should we save conversations to database?

3. **UI/UX**:
   - Should chat page have sidebar/header like dashboard?
   - Should we show emotion detection results to user?
   - Should we show session summary at end of chat?

4. **Performance**:
   - Should we use WebSockets for real-time updates or REST API?
   - Should chatbot instance be singleton or per-request?

5. **Authentication**:
   - Should chat endpoint require authentication?
   - How do we get user_id in Django view?

## Next Steps

1. **Clarify questions** with user
2. **Implement Phase 1** (Backend API)
3. **Implement Phase 2** (Frontend Chat Page)
4. **Implement Phase 3** (Connect Button)
5. **Implement Phase 4** (API Integration)
6. **Implement Phase 5** (Session Management)
7. **Implement Phase 6** (Error Handling)
8. **Test end-to-end**
9. **Deploy and verify**

## Notes

- Chatbot code is already working in terminal, so we're just wrapping it in API
- Keep chatbot code in `backend/chatbot/` - no need to move it
- Follow existing patterns in Django views and Next.js pages
- Use existing UI components where possible
- Maintain consistency with dashboard design

