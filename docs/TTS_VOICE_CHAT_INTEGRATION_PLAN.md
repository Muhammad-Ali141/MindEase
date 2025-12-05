# TTS Integration with Voice Chat - Implementation Plan

## Overview
This document outlines the plan to integrate the existing Text-to-Speech (TTS) module with the Voice Chat feature in MindEase. The integration will enable AI responses to be automatically converted to speech and played back to users, creating a fully voice-based conversation experience.

**Status**: Planning Phase  
**Last Updated**: 2025-01-XX  
**Next Step**: Begin Phase 1 Implementation

---

## Current Architecture

### Backend (Django)
- **TTS Module**: `backend/tts/tts_service.py` ✅ **Already implemented**
  - Uses Coqui TTS (XTTS v2) for high-quality speech synthesis
  - Supports 17+ languages including English and Urdu
  - Auto-detects CUDA/CPU
  - Methods: `synthesize()`, `synthesize_to_file()`
  - Requires speaker reference audio file

### Frontend (Next.js)
- **Voice Chat Page**: `app/voice-chat/page.tsx` ✅ **Already implemented**
  - STT transcription working
  - Chat integration working
  - Session management working
  - **Missing**: TTS audio playback

### Existing Flow
```
User speaks → STT transcribes → Text sent to AI → AI responds (text only) → Display text
```

### Target Flow
```
User speaks → STT transcribes → Text sent to AI → AI responds → TTS synthesizes → Play audio + Display text
```

---

## Integration Goals

1. **Backend TTS Endpoint**: Create `/api/tts/synthesize/` endpoint
2. **Frontend TTS API Function**: Add `apiTTSSynthesize()` to `lib/api.ts`
3. **Voice Chat Integration**: Automatically synthesize and play AI responses
4. **Language Support**: Use user's language preference (English/Urdu)
5. **Error Handling**: Graceful fallback if TTS fails (text still displayed)
6. **Audio Management**: Proper cleanup and playback controls

---

## Phase-by-Phase Implementation Plan

### Phase 1: Backend TTS API Endpoint

**Objective**: Create Django endpoint to synthesize text to speech.

**Tasks**:
1. Add `tts_synthesize()` function to `backend/api/views.py`
   - Accept POST request with JSON body: `{ "text": "...", "language": "en" }`
   - Use `TTSService` from `backend/tts/tts_service.py`
   - Synthesize text to audio
   - Return audio file as binary response (WAV format)
   - Handle errors gracefully

2. Add URL route to `backend/api/urls.py`
   - `path("tts/synthesize/", views.tts_synthesize, name="tts_synthesize")`

3. Error handling:
   - Invalid text → 400 error
   - TTS service failure → 500 error with message
   - Missing speaker reference → Clear error message

**Expected Output**:
- Endpoint: `POST /api/tts/synthesize/`
- Request: `{ "text": "Hello", "language": "en" }`
- Response: Binary WAV audio file (Content-Type: audio/wav)

**Testing**:
- Test with curl/Postman
- Verify audio quality
- Test with English and Urdu text
- Test error cases

---

### Phase 2: Frontend TTS API Function

**Objective**: Add frontend function to call TTS endpoint.

**Tasks**:
1. Add `apiTTSSynthesize()` to `lib/api.ts`
   - Accept `text: string` and `language: string` parameters
   - POST to `/api/tts/synthesize/`
   - Return audio Blob
   - Handle errors

**Expected Function**:
```typescript
export async function apiTTSSynthesize(
  text: string,
  language: string = "en"
): Promise<Blob>
```

**Testing**:
- Test function in browser console
- Verify Blob is returned
- Test error handling

---

### Phase 3: Voice Chat TTS Integration

**Objective**: Integrate TTS into voice chat to play AI responses.

**Tasks**:
1. Update `app/voice-chat/page.tsx`:
   - Import `apiTTSSynthesize` from `lib/api.ts`
   - Add state for audio playback: `isSynthesizing`, `isPlayingAudio`
   - Add `useRef` for current audio element
   - After AI response received:
     - Display text (existing)
     - Call `apiTTSSynthesize()` with response text
     - Get user's language preference (from `user.lang_pref` or default "en")
     - Create Audio element from Blob
     - Play audio automatically
     - Show visual indicators (synthesizing, playing)

2. Audio playback management:
   - Stop previous audio if new one starts
   - Clean up audio on component unmount
   - Handle audio errors gracefully (don't block text display)

3. Visual indicators:
   - Show "Synthesizing..." while TTS is processing
   - Show "Playing audio..." while audio is playing
   - Add audio icon to assistant messages
   - Optional: Add play/pause button for audio control

4. Language handling:
   - Map user's `lang_pref` to TTS language code
   - English → "en"
   - Urdu → "ur"
   - Default to "en" if not specified

**Expected Flow**:
```
AI response received → Display text → Start TTS synthesis → 
Show "Synthesizing..." → Audio ready → Play audio → 
Show "Playing..." → Audio ends → Clean up
```

**Testing**:
- Test full flow: Record → Transcribe → Chat → TTS → Play
- Test with English and Urdu
- Test error handling (TTS fails, audio fails)
- Test multiple messages (previous audio stops)
- Test cleanup on page navigation

---

### Phase 4: Enhanced Features and Polish

**Objective**: Add optional enhancements for better UX.

**Tasks**:
1. **Audio Controls** (Optional):
   - Add play/pause button for each AI message
   - Allow replaying audio
   - Show audio duration/progress

2. **Performance Optimization**:
   - Cache TTS service instance (backend)
   - Debounce rapid requests
   - Pre-synthesize common responses (optional)

3. **User Preferences** (Future):
   - Toggle TTS on/off in settings
   - Adjust playback speed
   - Choose voice style

4. **Error Recovery**:
   - Retry TTS on failure
   - Fallback to text-only mode
   - Clear error messages

**Testing**:
- Test all enhancements
- Verify performance
- Test edge cases

---

## Technical Details

### API Endpoint Specification

#### POST `/api/tts/synthesize/`
**Request**:
```json
{
  "text": "Hello, how are you?",
  "language": "en"
}
```

**Response**:
- Content-Type: `audio/wav`
- Body: Binary WAV audio file
- Status: 200 OK

**Error Responses**:
- 400: Invalid request (missing text, invalid language)
- 500: TTS synthesis failed

### Language Code Mapping

| User Preference | TTS Language Code |
|----------------|-------------------|
| English        | "en"              |
| Urdu           | "ur"              |
| Default        | "en"              |

### Audio Format
- Format: WAV
- Sample Rate: 22050 Hz (XTTS default)
- Channels: Mono
- Encoding: PCM 16-bit

### Frontend Audio Handling
- Use browser `Audio` API
- Create `Audio` element from Blob URL
- Auto-play after synthesis
- Clean up Blob URLs after playback
- Handle browser autoplay policies

---

## Dependencies

### Backend (Already Installed)
- `TTS>=0.22.0` ✅ (Coqui TTS)
- `torch` ✅ (PyTorch)
- `soundfile` ✅
- `numpy` ✅

### Frontend (No Additional Packages Needed)
- Browser `Audio` API (native)
- `Blob` API (native)
- `URL.createObjectURL()` (native)

---

## File Structure

```
backend/
  api/
    views.py          # Add tts_synthesize() function
    urls.py           # Add tts route
  tts/
    tts_service.py    # ✅ Already exists
    Audios/           # Speaker reference audio files

app/
  voice-chat/
    page.tsx          # Update to integrate TTS

lib/
  api.ts              # Add apiTTSSynthesize() function
```

---

## Security Considerations

1. **Text Length Limits**: Limit text length to prevent abuse (e.g., max 5000 characters)
2. **Rate Limiting**: Consider rate limiting for TTS endpoint
3. **Authentication**: TTS endpoint should require user authentication (optional for now)
4. **Resource Management**: Clean up temporary files and audio resources

---

## Testing Checklist

### Phase 1: Backend Endpoint
- [ ] TTS endpoint responds correctly
- [ ] Audio file is valid WAV format
- [ ] English synthesis works
- [ ] Urdu synthesis works
- [ ] Error handling works
- [ ] Invalid requests are rejected

### Phase 2: Frontend API
- [ ] `apiTTSSynthesize()` function works
- [ ] Returns valid audio Blob
- [ ] Error handling works

### Phase 3: Voice Chat Integration
- [ ] AI responses trigger TTS
- [ ] Audio plays automatically
- [ ] Visual indicators show correctly
- [ ] Previous audio stops when new one starts
- [ ] Cleanup works on unmount
- [ ] Works with English
- [ ] Works with Urdu
- [ ] Error handling (TTS fails gracefully)
- [ ] Text still displays if audio fails

### Phase 4: Polish
- [ ] All enhancements work
- [ ] Performance is acceptable
- [ ] No memory leaks
- [ ] Works on different browsers

---

## Implementation Order

1. **Phase 1**: Create backend TTS endpoint
2. **Phase 2**: Add frontend TTS API function
3. **Phase 3**: Integrate TTS into voice chat
4. **Phase 4**: Add enhancements and polish

**Ready to begin Phase 1?** Let's start implementing! 🚀

---

## Notes

- TTS is **optional** - if it fails, text is still displayed
- Audio playback respects browser autoplay policies
- Speaker reference audio must exist in `backend/tts/Audios/`
- TTS service initialization may take time (first request slower)
- Consider caching TTS service instance for performance

---

## Future Enhancements

- TTS on/off toggle in user settings
- Voice selection (different voices for different moods)
- Playback speed control
- Audio download option
- Streaming TTS (for long responses)
- Voice cloning from user's voice samples

