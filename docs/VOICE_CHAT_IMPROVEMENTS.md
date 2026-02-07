# Voice Chat Improvements

## Overview

This document describes two major improvements made to the voice chat experience in MindEase:

1. **Synchronized Text/Audio Display** - Text now appears only when audio is ready to play
2. **Real-time Speech-to-Text (STT)** - Live transcription while recording

---

## 1. Synchronized Text/Audio Display

### Problem
Previously, when receiving a therapist response:
- LLM text appeared immediately (typewriter effect)
- Audio played seconds/minutes later
- For a voice chat, this disconnect was jarring and broke immersion

### Solution
Text now appears **sentence-by-sentence, synchronized with audio playback**:

1. LLM streams response (hidden from user)
2. As each sentence completes, TTS is triggered
3. When TTS audio blob is ready, the sentence text appears AND audio plays
4. Next sentence appears only when its audio is ready
5. Audio plays in strict sequential order

### Implementation

**Frontend (`app/voice-chat/page.tsx`):**
```typescript
// Store sentences and their TTS promises
const sentences: string[] = []
const ttsPromises: Promise<Blob | null>[] = []
let displayedText = ""
let nextDisplayIdx = 0

// When sentence detected in LLM stream
const enqueueSentence = (sentence: string) => {
  const idx = sentences.length
  sentences.push(sentence)
  const p = apiTTSSynthesize(sentence, userLanguage)
  ttsPromises.push(p)
  p.then(() => tryDisplayAndPlayNext())
}

// Display text ONLY when audio is ready
const tryDisplayAndPlayNext = () => {
  // Wait for TTS promise
  ttsPromises[nextDisplayIdx].then((blob) => {
    // Append sentence text to UI
    displayedText += sentences[nextDisplayIdx]
    setMessages(/* update with displayedText */)
    // Play audio
    const audio = new Audio(URL.createObjectURL(blob))
    audio.play()
  })
}
```

**Key Changes:**
- `onDelta`: Detects sentences but **does NOT update UI**
- `enqueueSentence`: Fires TTS for each sentence
- `tryDisplayAndPlayNext`: Shows text **only when audio is ready**

**Result:**
- User sees and hears each sentence simultaneously
- Natural conversational flow
- No jarring delay between text and audio

---

## 2. Real-time Speech-to-Text (STT)

### Problem
Previously:
1. Click mic → start recording
2. Click mic again → stop recording
3. **Then** audio gets transcribed
4. User sees "Transcribing..." for several seconds

No live feedback during recording.

### Solution
**Live transcription while recording:**
- Audio chunks sent every 2 seconds during recording
- Backend transcribes accumulated audio so far
- Partial transcript displayed live below "Recording..." status
- When recording stops, final transcription runs for accuracy

### Implementation

#### 1. Microphone Hook (`hooks/use-microphone.ts`)
```typescript
// Modified startRecording to accept onChunk callback
const startRecording = async (onChunk?: (blob: Blob) => void): Promise<void> => {
  // ... existing setup ...
  
  // Send accumulated chunks every 2 seconds
  if (onChunk) {
    chunkIntervalRef.current = setInterval(() => {
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        onChunk(blob)
      }
    }, 2000)
  }
}
```

#### 2. Backend Endpoint (`backend/api/views.py`)
```python
@csrf_exempt
def stt_transcribe_partial(request):
    """
    Real-time STT endpoint for live transcription.
    Returns partial transcript for accumulated audio.
    """
    # Accept audio chunk
    audio_file = request.FILES['audio']
    
    # Skip if too small (< 0.5s)
    if audio_file.size < 8000:
        return JsonResponse({"transcript": "", "is_partial": True})
    
    # Transcribe with faster-whisper (beam_size=3 for speed)
    stt_service = SpeechToTextService(beam_size=3, vad_filter=True)
    transcript = stt_service.transcribe_file(temp_file_path)
    
    return JsonResponse({
        "transcript": transcript.strip(),
        "is_partial": True
    })
```

**URL Route (`backend/api/urls.py`):**
```python
path("stt/transcribe-partial/", views.stt_transcribe_partial, name="stt_transcribe_partial")
```

#### 3. Frontend API Call (`lib/api.ts`)
```typescript
export async function apiSTTTranscribePartial(
  audioBlob: Blob,
  language: string = "en"
): Promise<{ transcript: string; is_partial: boolean }> {
  const formData = new FormData()
  formData.append("audio", audioBlob, "partial.webm")
  formData.append("language", language)

  const res = await fetch("http://localhost:8000/api/stt/transcribe-partial/", {
    method: "POST",
    body: formData,
  })

  const data = await res.json()
  return { transcript: data.transcript || "", is_partial: true }
}
```

#### 4. Voice Chat Integration (`app/voice-chat/page.tsx`)
```typescript
// State for live transcript
const [partialTranscript, setPartialTranscript] = useState("")

// Start recording with chunk callback
await startRecording(async (blob: Blob) => {
  // Transcribe every 2 seconds
  const result = await apiSTTTranscribePartial(blob, "en")
  if (result.transcript) {
    setPartialTranscript(result.transcript)
  }
})

// Display live transcript in UI
{isRecording && partialTranscript && (
  <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
    {partialTranscript}
  </div>
)}
```

**Result:**
- User sees live transcript appear as they speak
- Feedback confirms system is hearing them
- Natural conversational flow
- Final transcription still runs for accuracy after recording stops

---

## Technical Details

### Performance Considerations

**Real-time STT:**
- Chunks sent every 2 seconds (configurable)
- Backend uses `beam_size=3` (faster) vs `beam_size=5` (final transcription)
- Errors are silently ignored (partial transcription is best-effort)
- Audio size check: skip chunks < 0.5s (8KB)

**Text/Audio Sync:**
- TTS requests fire concurrently for all sentences (fast)
- Playback enforces strict sequential order
- `nextDisplayIdx` counter ensures correct sequence
- Audio elements managed with `onended` callbacks

### Edge Cases Handled

1. **Real-time STT fails**: Silently continue (final transcription is authoritative)
2. **TTS fails for a sentence**: Skip and move to next
3. **User stops recording early**: Clear partial transcript, run final transcription
4. **Audio chunk too small**: Skip transcription attempt
5. **Multiple sentences complete at once**: All queued in order

---

## User Experience Improvements

### Before
- **Text/Audio**: Text appears fast → long wait → audio plays
- **STT**: Record → stop → wait → see transcript

### After
- **Text/Audio**: First sentence text + audio → second sentence text + audio → ...
- **STT**: Record → see live transcript → stop → final transcript (instant)

### Benefits
1. **Natural conversation**: Audio and text synchronized
2. **Immediate feedback**: User knows system is listening
3. **Lower perceived latency**: Text appears as audio plays
4. **Better immersion**: No jarring delays in voice chat

---

## Configuration

### Adjust Real-time STT Frequency
In `hooks/use-microphone.ts`:
```typescript
chunkIntervalRef.current = setInterval(() => {
  // ...
}, 2000) // Change to 1000 for 1s intervals, 3000 for 3s, etc.
```

### Adjust TTS Playback Speed
In `app/voice-chat/page.tsx`:
```typescript
const audio = new Audio(url)
audio.playbackRate = 1.0 // Change to 1.1, 1.2, etc. for faster playback
audio.play()
```

### Adjust Real-time STT Beam Size
In `backend/api/views.py`:
```python
stt_service = SpeechToTextService(
    beam_size=3,  # Increase to 4-5 for better accuracy (slower)
    # ...
)
```

---

## Testing

1. **Text/Audio Sync:**
   - Start voice chat
   - Record a message with multiple sentences
   - Observe: Text appears sentence-by-sentence as audio plays
   - Verify: Text and audio are synchronized

2. **Real-time STT:**
   - Click mic to start recording
   - Speak slowly and clearly
   - Observe: Partial transcript appears below "Recording..."
   - Verify: Transcript updates every ~2 seconds

---

## Future Enhancements

1. **Voice Activity Detection (VAD)**: Send chunks only when user is speaking
2. **WebSocket STT**: Replace HTTP polling with WebSocket for lower latency
3. **Sentence Boundary Detection**: Use better NLP for sentence splitting
4. **Transcript Confidence**: Show confidence scores in real-time
5. **Multi-language Support**: Detect language and switch STT model dynamically
