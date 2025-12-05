# Voice Chat Integration Plan for MindEase

## Overview

This document outlines the complete plan for integrating the Speech-to-Text (STT) module with the MindEase application to enable voice chat functionality. The integration will allow users to speak into their microphone, have their speech transcribed in real-time, and interact with the AI assistant through voice.

**Status**: Planning Phase  
**Last Updated**: 2025-01-XX  
**Next Step**: Begin Phase 1 Implementation

---

## Current Architecture

### Frontend (Next.js)
- **Text Chat**: `/app/chat/page.tsx` - Full text chat interface
- **Chat Components**: 
  - `components/chat-interface.tsx` - Main chat UI
  - `components/chat-input.tsx` - Text input component
  - `components/chat-message.tsx` - Message display component
- **API Client**: `lib/api.ts` - All API functions
- **Therapy Options**: `components/therapy-options.tsx` - Dashboard cards (includes Voice Call button)
- **Navigation**: Uses Next.js router for page navigation

### Backend (Django)
- **Chat API**: `/api/chat/` - Handles text messages
- **STT API**: `/api/stt/transcribe/` - ✅ **Already implemented** (accepts audio files)
- **Chat Views**: `backend/api/views.py` - `chat_message()`, `chat_welcome()`, `chat_summary()`
- **STT Module**: `backend/stt/` - Standalone STT service
  - `stt_service.py` - Core STT service class ✅
  - `stt_live.py` - CLI for live transcription ✅
  - `requirements.txt` - STT dependencies ✅

### Existing STT Backend Endpoint
- **URL**: `POST /api/stt/transcribe/`
- **Method**: POST
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `audio`: Audio file (WAV, WebM, MP3, M4A, OGG)
  - `language`: Optional language code (default: "en")
- **Response**:
  ```json
  {
    "transcript": "Transcribed text here",
    "language": "en",
    "confidence": 0.95
  }
  ```
- **File Size Limit**: 10MB
- **Status**: ✅ Fully implemented and tested

---

## Integration Goals

1. **Voice Chat Page**: Create `/app/voice-chat/page.tsx` similar to text chat
2. **Microphone Access**: Request and handle microphone permissions
3. **Audio Recording**: Capture audio from user's microphone using browser MediaRecorder API
4. **Real-time Transcription**: Send audio to backend STT endpoint, receive transcribed text
5. **Chat Integration**: Feed transcribed text to existing chat API (`/api/chat/`)
6. **Visual Feedback**: Show recording status, transcription in progress, etc.
7. **Session Management**: Integrate with existing session save/load functionality

---

## Phase-by-Phase Implementation Plan

### Phase 1: Frontend Voice Chat Page Structure

**Objective**: Create the voice chat page with basic UI structure, similar to text chat.

**Tasks**:
1. Create `/app/voice-chat/page.tsx`
   - Reuse layout structure from `/app/chat/page.tsx`
   - Include Sidebar, Header, and ChatInterface
   - Add microphone button (prominent, green/emerald theme)
   - Add recording status indicator
   - Handle navigation from dashboard

2. Update `components/therapy-options.tsx`
   - Make "Start Call" button navigate to `/voice-chat`
   - Add click handler: `router.push("/voice-chat")`

3. Update `components/sidebar.tsx` (optional)
   - Make Voice Call button navigate to `/voice-chat`

**Expected Output**:
- Voice chat page loads correctly
- Navigation from dashboard works
- UI matches design (green/emerald theme for voice)
- Page structure matches text chat

**Testing**:
- Navigate to `/voice-chat` from dashboard
- Verify UI renders correctly
- Test responsive design on mobile

---

### Phase 2: Microphone Recording Hook

**Objective**: Create a reusable hook for microphone access and audio recording.

**Tasks**:
1. Create `hooks/use-microphone.ts`
   - Request microphone permissions
   - Start/stop recording using MediaRecorder API
   - Convert MediaStream to Blob (WebM format)
   - Handle permissions denied/errors
   - Return recording state, audio blob, and control functions

2. Features:
   - `isRecording`: Boolean state
   - `hasPermission`: Boolean state
   - `error`: Error message if any
   - `startRecording()`: Function to start recording
   - `stopRecording()`: Function to stop recording (returns Promise<Blob>)
   - `requestPermission()`: Function to request microphone access

**Expected Output**:
```typescript
const {
  isRecording,
  hasPermission,
  error,
  startRecording,
  stopRecording,
  requestPermission
} = useMicrophone()
```

**Testing**:
- Test microphone permission request
- Verify audio is captured
- Test on different browsers (Chrome, Firefox, Safari)
- Handle permission denied gracefully

---

### Phase 3: STT API Integration

**Objective**: Add frontend API function to call the STT endpoint.

**Tasks**:
1. Update `lib/api.ts`
   - Add `apiSTTTranscribe(audioBlob: Blob, language?: string)` function
   - Use FormData to send audio file
   - POST to `/api/stt/transcribe/`
   - Handle errors gracefully
   - Return transcript

**Expected Function**:
```typescript
export async function apiSTTTranscribe(
  audioBlob: Blob,
  language: string = "en"
): Promise<{ transcript: string; language: string; confidence: number }>
```

**Testing**:
- Test with sample audio blob
- Verify transcription is received
- Test error handling (network errors, invalid audio, etc.)

---

### Phase 4: Voice Chat Integration

**Objective**: Integrate microphone recording, STT transcription, and chat API.

**Tasks**:
1. Update `/app/voice-chat/page.tsx`
   - Import and use `useMicrophone` hook
   - Import `apiSTTTranscribe` from `lib/api.ts`
   - Reuse `apiChatMessage` for sending transcribed text
   - Implement recording flow:
     - User clicks mic → Request permission → Start recording
     - User speaks → Audio captured
     - User clicks stop → Send audio to STT → Get transcript
     - Display transcript as user message
     - Send transcript to chat API → Get AI response
     - Display AI response

2. Add visual states:
   - "Requesting microphone access..."
   - "Recording..." (with pulsing animation)
   - "Transcribing..." (after stopping recording)
   - "AI is thinking..." (after sending to chat API)

3. Error handling:
   - Microphone permission denied → Show friendly message
   - Transcription error → Show error, allow retry
   - Network error → Show error, allow retry
   - No speech detected → Show message, allow retry

**Expected Flow**:
```
User clicks mic → Permission request → Recording starts
→ User speaks → User clicks stop → Audio sent to STT
→ Transcript received → Text displayed in chat
→ Text sent to chat API → AI response received
→ Response displayed in chat
```

**Testing**:
- Test full flow: Record → Transcribe → Chat
- Test error scenarios
- Test with different audio lengths
- Verify transcription accuracy
- Test session save/load (reuse existing functionality)

---

### Phase 5: Enhanced Features and Polish

**Objective**: Add visual feedback, improve UX, and optimize performance.

**Tasks**:
1. Visual Enhancements:
   - Animated microphone button (pulsing when recording)
   - Recording waveform visualization (optional)
   - Transcription progress indicator
   - Voice message badge/icon in chat messages
   - Different styling for voice messages vs text messages

2. UX Improvements:
   - Show "Listening..." state when recording
   - Show "Transcribing..." state after recording stops
   - Show "AI is thinking..." state after sending message
   - Auto-scroll to latest message
   - Keyboard shortcuts (Space to start/stop recording)

3. Performance Optimization:
   - Chunk audio for long recordings (optional)
   - Debounce transcription requests
   - Cache microphone stream
   - Optimize audio format conversion

4. Accessibility:
   - Keyboard navigation support
   - Screen reader announcements
   - ARIA labels for recording states

**Testing**:
- Test all visual states
- Test on slow networks
- Test with long recordings
- Test accessibility features
- Test keyboard shortcuts

---

## Technical Details

### Audio Format Requirements

**Frontend Recording**:
- Format: WebM (default browser format via MediaRecorder)
- Sample Rate: Browser default (usually 48kHz)
- Channels: Mono or Stereo (backend will convert to mono)
- Codec: Opus (Chrome/Edge) or VP8/VP9 (Firefox)

**Backend Processing**:
- Accept: WebM, WAV, MP3, M4A, OGG
- Convert to: 16kHz mono WAV (handled by STT service)
- Max Size: 10MB
- STT Service: Uses `faster-whisper` with auto device detection

### API Endpoints

#### Existing: `/api/stt/transcribe/`
```http
POST /api/stt/transcribe/
Content-Type: multipart/form-data

Body:
  audio: <audio file blob>
  language: "en" (optional, default: "en")
```

**Response**:
```json
{
  "transcript": "Transcribed text here",
  "language": "en",
  "confidence": 0.95
}
```

#### Existing: `/api/chat/`
```http
POST /api/chat/
Content-Type: application/json

Body:
{
  "message": "User's transcribed text",
  "user_id": "123",
  "user_first_name": "John",
  "user_gender": "Male",
  "conversation_history": [...]
}
```

**Response**:
```json
{
  "response": "AI response text",
  "emotions": [...],
  "user_id": "123",
  "conversation_history": [...]
}
```

### Dependencies

#### Backend (Already Installed)
- `faster-whisper>=1.0.0` ✅
- `soundfile>=0.12.1` ✅
- `numpy>=1.24.0` ✅
- `resampy>=0.4.2` ✅

**Action Required**: Ensure these are in `backend/requirements.txt` and installed.

#### Frontend (No Additional Packages Needed)
- Browser `MediaRecorder` API (native)
- `FormData` (native)
- `fetch` API (native)

### File Structure

```
backend/
  api/
    views.py          # stt_transcribe() already exists ✅
    urls.py           # stt route already exists ✅
  stt/
    stt_service.py    # Already exists ✅
    stt_live.py       # Already exists ✅
    requirements.txt  # Already exists ✅

app/
  voice-chat/
    page.tsx          # NEW - Voice chat page

components/
  chat-interface.tsx  # Reuse for voice chat
  chat-message.tsx    # Enhance for voice message indicator
  chat-input.tsx       # Reuse or create voice variant
  therapy-options.tsx  # Update Voice Call button

hooks/
  use-microphone.ts   # NEW - Microphone recording hook

lib/
  api.ts              # Add apiSTTTranscribe() function
```

---

## Security Considerations

1. **File Upload Limits**: ✅ Already set (10MB max)
2. **Rate Limiting**: Consider adding rate limiting for STT endpoint
3. **Authentication**: ✅ STT endpoint should require user authentication (check if implemented)
4. **Audio Validation**: ✅ Already validates file format and size
5. **Privacy**: Don't log audio files, only transcripts (ensure backend follows this)

---

## Testing Checklist

### Phase 1: Frontend Page
- [ ] Voice chat page loads
- [ ] Navigation works from dashboard
- [ ] UI matches design
- [ ] Responsive on mobile

### Phase 2: Microphone Hook
- [ ] Permission request works
- [ ] Recording starts/stops
- [ ] Audio is captured
- [ ] Works on different browsers

### Phase 3: STT API
- [ ] API function works
- [ ] Transcription is accurate
- [ ] Error handling works

### Phase 4: Integration
- [ ] Full flow works end-to-end
- [ ] Transcription appears in chat
- [ ] AI responds correctly
- [ ] Error messages are clear
- [ ] Session save/load works

### Phase 5: Polish
- [ ] Visual feedback works
- [ ] Performance is acceptable
- [ ] Accessibility features work
- [ ] Works on slow networks


## Getting Started

1. ✅ Review this plan
2. ✅ Ensure backend STT endpoint is working (already implemented)
3. ✅ Ensure STT dependencies are installed
4. Start with Phase 1 (Frontend Page Structure)
5. Test each phase before moving to next
6. Update this document with any changes
7. Document any issues or blockers

---

## Notes

- The STT backend endpoint is **already implemented** ✅
- The STT service is **production-ready** ✅
- We can **reuse most of the chat UI components** ✅
- Browser MediaRecorder API is **well-supported** ✅
- Focus on **smooth integration** and **UX** ✅
- Voice messages should be marked with `content_type: "audio"` in chat messages
- Session save/load should work seamlessly with voice messages

---

## Implementation Order

1. **Phase 1**: Create voice chat page structure
2. **Phase 2**: Implement microphone recording hook
3. **Phase 3**: Add STT API function to frontend
4. **Phase 4**: Integrate everything together
5. **Phase 5**: Polish and enhance

**Ready to begin Phase 1?** Let's start implementing! 🚀

