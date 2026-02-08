// lib/api.ts — aligned with Django backend

const BASE_URL = "http://127.0.0.1:8000/api";

// Send OTP for email verification
export const apiSendOtp = async (email: string) => {
  const res = await fetch("http://localhost:8000/api/send-otp/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to send OTP");
  }

  return res.json();
}

// Verify OTP
export const apiVerifyOtp = async (email: string, otp: string) => {
  const res = await fetch("http://localhost:8000/api/verify-otp/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, otp }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to verify OTP");
  }

  return res.json();
}

// Check if email exists
export const apiCheckEmail = async (email: string) => {
  const res = await fetch("http://localhost:8000/api/check-email/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to check email");
  }

  return res.json();
}

// lib/api.ts
export const apiRegister = async (data: any) => {
  const res = await fetch("http://localhost:8000/api/register/", { // ✅ Django backend URL
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      password: data.password,
      city: data.city,
      nearest_major_city: data.nearest_major_city,
      dob: data.dob,
      gender: data.gender,
      lang_pref: data.preferred_language,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Registration failed");
  }

  return res.json();
}

export async function apiLogin(body: { email: string; password: string }) {
  const response = await fetch('http://localhost:8000/api/login/', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Login failed");
  }

  return data;
}

export async function apiUpdateDashboardTour(user_id: string, seen: boolean) {
  const response = await fetch("http://localhost:8000/api/users/dashboard-tour/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id, seen }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to update tutorial status");
  }

  return data;
}

// lib/api.ts
export type UserProfile = {
  display_name: string
  preferred_language: "en" | "ur"
}

export type User = {
  email: string
  profile: UserProfile
}

let mockUser: User = {
  email: "test@example.com",
  profile: {
    display_name: "John Doe",
    preferred_language: "en",
  },
}

export async function apiGetMe(token: string): Promise<User> {
  // simulate network delay
  await new Promise((r) => setTimeout(r, 500))
  if (!token) throw new Error("Unauthorized")
  return mockUser
}

export async function apiUpdateMe(token: string, data: Partial<UserProfile>): Promise<User> {
  await new Promise((r) => setTimeout(r, 500))
  if (!token) throw new Error("Unauthorized")
  mockUser = { ...mockUser, profile: { ...mockUser.profile, ...data } }
  return mockUser
}

// Chat API functions
export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  emotion_label?: string
  emotion_score?: number
  metadata?: Record<string, unknown>
  content_type?: "text" | "audio"
}

export type ChatResponse = {
  response: string
  emotions: Array<{ emotion: string; score: number }>
  user_id: string
  conversation_history: ChatMessage[]
}

export async function apiChatMessage(
  message: string,
  user_id: string,
  user_first_name: string | null,
  user_gender: string | null,
  conversation_history: ChatMessage[],
  test_context: string | null = null,
  emotions?: Array<{ emotion: string; score: number }>
): Promise<ChatResponse> {
  const res = await fetch("http://localhost:8000/api/chat/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      user_id,
      user_first_name,
      user_gender,
      conversation_history,
      test_context,
      ...(emotions && emotions.length > 0 ? { emotions } : {}),
    }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to send message")
  }

  return res.json()
}

export type ChatStreamDonePayload = {
  full_response: string
  emotions: Array<{ emotion: string; score: number }>
}

export async function apiChatMessageStream(
  message: string,
  user_id: string,
  user_first_name: string | null,
  user_gender: string | null,
  conversation_history: ChatMessage[],
  callbacks: {
    onDelta: (delta: string) => void
    onDone: (payload: ChatStreamDonePayload) => void
  },
  test_context: string | null = null,
  emotions?: Array<{ emotion: string; score: number }>
): Promise<void> {
  const res = await fetch("http://localhost:8000/api/chat/stream/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      user_id,
      user_first_name,
      user_gender,
      conversation_history,
      test_context,
      ...(emotions && emotions.length > 0 ? { emotions } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Stream failed")
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const dec = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += dec.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6)) as { delta?: string; done?: boolean; full_response?: string; emotions?: Array<{ emotion: string; score: number }> }
          if (data.delta != null) callbacks.onDelta(data.delta)
          if (data.done && data.full_response != null) callbacks.onDone({ full_response: data.full_response, emotions: data.emotions ?? [] })
        } catch {
          // skip invalid JSON
        }
      }
    }
  }
  if (buffer.startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.slice(6)) as { delta?: string; done?: boolean; full_response?: string; emotions?: Array<{ emotion: string; score: number }> }
      if (data.delta != null) callbacks.onDelta(data.delta)
      if (data.done && data.full_response != null) callbacks.onDone({ full_response: data.full_response, emotions: data.emotions ?? [] })
    } catch {
      // skip
    }
  }
}

export type WelcomeResponse = {
  welcome_message: string
  user_id: string
}

export async function apiChatWelcome(
  user_id: string,
  user_first_name: string | null,
  test_context: string | null = null
): Promise<WelcomeResponse> {
  const res = await fetch("http://localhost:8000/api/chat/welcome/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id,
      user_first_name,
      test_context,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to get welcome message")
  }

  return res.json()
}

export type SummaryResponse = {
  summary: string
  user_id: string
}

export async function apiChatSummary(
  user_id: string,
  user_first_name: string | null,
  user_gender: string | null,
  conversation_history: ChatMessage[]
): Promise<SummaryResponse> {
  const res = await fetch("http://localhost:8000/api/chat/summary/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id,
      user_first_name,
      user_gender,
      conversation_history,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to get summary")
  }

  return res.json()
}

export type SessionCountResponse = {
  session_count: number
  user_id: string
}

export async function apiGetSessionCount(user_id: string): Promise<SessionCountResponse> {
  const res = await fetch("http://localhost:8000/api/sessions/count/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to get session count")
  }

  return res.json()
}

export type SessionState = "full" | "pending_archive" | "summary_only"

export type StoredChatMessage = ChatMessage & {
  sequence?: number | null
  metadata?: Record<string, unknown>
  created_at?: string | null
}

export type Session = {
  session_id: string
  title: string
  messages: StoredChatMessage[]
  summary: string
  short_summary: string
  resume_message?: string
  state: SessionState
  is_starred: boolean
  has_full_transcript: boolean
  created_at: string
  updated_at: string
  resume_context?: Record<string, unknown>
}

export type SessionPreview = {
  session_id: string
  title: string
  summary: string
  short_summary: string
  resume_message?: string
  state: SessionState
  is_starred: boolean
  has_full_transcript: boolean
  /** True if session contains voice (audio) messages; use for icon/label and routing to voice-chat vs chat */
  has_voice?: boolean
  created_at: string
  updated_at: string
}

export type SaveSessionResponse = {
  session: Session
  user_id: string
}

export async function apiSaveSession(
  user_id: string,
  conversation_history: ChatMessage[],
  summary: string,
  session_id?: string,
  user_first_name?: string | null,
  user_gender?: string | null
): Promise<SaveSessionResponse> {
  const formattedHistory = conversation_history.map((message, index) => ({
    role: message.role,
    sender: message.role,
    content: message.content,
    content_type: message.content_type ?? "text",
    sequence: index,
    emotion_label: message.emotion_label,
    emotion_score: message.emotion_score,
    metadata: message.metadata ?? {},
  }))

  const res = await fetch("http://localhost:8000/api/sessions/save/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id,
      conversation_history: formattedHistory,
      summary,
      session_id,
      user_first_name,
      user_gender,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to save session")
  }

  return res.json()
}

export type RecentSessionsResponse = {
  sessions: SessionPreview[]
  total: number
  user_id: string
}

export async function apiGetRecentSessions(
  user_id: string,
  limit: number = 3
): Promise<RecentSessionsResponse> {
  const res = await fetch("http://localhost:8000/api/sessions/recent/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id, limit }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to get recent sessions")
  }

  return res.json()
}

export type GetSessionResponse = {
  session: Session
  user_id: string
}

export async function apiGetSessionById(
  user_id: string,
  session_id: string
): Promise<GetSessionResponse> {
  const res = await fetch("http://localhost:8000/api/sessions/get/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id, session_id }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to get session")
  }

  return res.json()
}

export type ToggleStarResponse = {
  session: SessionPreview
  user_id: string
}

export async function apiToggleSessionStar(
  user_id: string,
  session_id: string,
  star: boolean
): Promise<ToggleStarResponse> {
  const res = await fetch("http://localhost:8000/api/sessions/star/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id, session_id, star }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to update session star")
  }

  return res.json()
}

export type UserProfileData = {
  user_id: number
  email: string
  first_name: string
  last_name: string
  dob: string
  gender: string
  lang_pref: string
  city: string
  nearest_major_city: string
  created_at: string | null
}

export async function apiGetUserProfile(user_id: string): Promise<UserProfileData> {
  const res = await fetch("http://localhost:8000/api/profile/get/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to get user profile")
  }

  return res.json()
}

export type UpdateProfileData = {
  first_name?: string
  last_name?: string
  email?: string
  dob?: string
  gender?: "Male" | "Female" | "Other"
  lang_pref?: "en" | "ur"
  city?: string
  nearest_major_city?: string
  password?: string
}

export type UpdateProfileResponse = {
  message: string
  user_id: number
  email: string
  first_name: string
  last_name: string
  dob: string
  gender: string
  lang_pref: string
  city: string
  nearest_major_city: string
}

export async function apiUpdateUserProfile(
  user_id: string,
  data: UpdateProfileData
): Promise<UpdateProfileResponse> {
  const res = await fetch("http://localhost:8000/api/profile/update/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id,
      ...data,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to update user profile")
  }

  return res.json()
}

// Therapist directory

export type TherapistListParams = {
  city?: string
  specialty?: string
  service_type?: "in-person" | "online"
  limit?: number
}

export type TherapistListItem = {
  id: string
  name: string
  credentials?: string | null
  specialty?: string | null
  city?: string | null
  region?: string | null
  website?: string | null
  profile_url?: string | null
  languages?: string[] | null
  address?: string | null
  service_type?: string[] | null
}

export type TherapistsResponse = {
  therapists: TherapistListItem[]
  total: number
}

export async function apiGetTherapists(
  params?: TherapistListParams
): Promise<TherapistsResponse> {
  const search = new URLSearchParams()
  if (params?.city) search.set("city", params.city)
  if (params?.specialty) search.set("specialty", params.specialty)
  if (params?.service_type) search.set("service_type", params.service_type)
  if (params?.limit != null && params.limit > 0) search.set("limit", String(params.limit))
  const qs = search.toString()
  const url = `http://localhost:8000/api/therapists/${qs ? `?${qs}` : ""}`
  const res = await fetch(url, { method: "GET" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to load therapists")
  }
  return res.json()
}

export type TherapistFiltersResponse = { cities: string[] }

export async function apiGetTherapistFilters(): Promise<TherapistFiltersResponse> {
  const res = await fetch("http://localhost:8000/api/therapists/filters/", { method: "GET" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to load filters")
  }
  return res.json()
}

// STT (Speech-to-Text) API functions

export type STTTranscribeResponse = {
  transcript: string
  language: string
  confidence: number
}

/**
 * Transcribe audio file to text using the STT service.
 * 
 * @param audioBlob - Audio blob from MediaRecorder (WebM format)
 * @param language - Language code (default: "en")
 * @returns Promise with transcript, language, and confidence
 */
export async function apiSTTTranscribe(
  audioBlob: Blob,
  language: string = "en"
): Promise<STTTranscribeResponse> {
  // Create FormData to send audio file
  const formData = new FormData()
  formData.append("audio", audioBlob, "recording.webm")
  formData.append("language", language)

  const res = await fetch("http://localhost:8000/api/stt/transcribe/", {
    method: "POST",
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary for FormData
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Failed to transcribe audio" }))
    throw new Error(errorData.error || "Failed to transcribe audio")
  }

  const data = await res.json()
  
  // Handle case where no speech was detected
  if (!data.transcript || data.transcript.trim() === "") {
    throw new Error("No speech detected in the audio. Please try speaking again.")
  }

  return data
}

/**
 * Real-time STT: transcribe partial audio chunks for live display.
 * Used while recording is in progress to show live transcript.
 * Does NOT throw on empty transcript (returns empty string).
 */
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

  if (!res.ok) {
    // Silently return empty for real-time errors
    return { transcript: "", is_partial: true }
  }

  const data = await res.json()
  return { transcript: data.transcript || "", is_partial: true }
}

/**
 * Voice process: run STT + Speech Emotion Recognition on audio.
 * Returns transcript and emotions-from-voice for use with chat stream.
 */
export async function apiVoiceProcess(
  audioBlob: Blob,
  language: string = "en"
): Promise<{ transcript: string; emotions: Array<{ emotion: string; score: number }> }> {
  const form = new FormData()
  form.append("audio", audioBlob, "recording.webm")
  form.append("language", language)
  const res = await fetch("http://localhost:8000/api/voice/process/", { method: "POST", body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Voice process failed")
  }
  const data = await res.json()
  return {
    transcript: (data.transcript ?? "").trim(),
    emotions: Array.isArray(data.emotions) ? data.emotions : [],
  }
}

// TTS (Text-to-Speech) API functions

/**
 * Synthesize text to speech using the TTS service.
 * 
 * @param text - Text to synthesize to speech
 * @param language - Language code (default: "en")
 * @param ttsBackend - "xtts" (default) or "qwen3" to test Qwen3-TTS in the pipeline
 * @returns Promise with audio Blob
 */
export type GetWelcomeAudioResult = {
  blob: Blob
  /** When server stored text for this cache entry (e.g. with-context), use this so audio and text match. */
  welcomeMessage?: string
}

/**
 * Get cached welcome audio for voice chat (instant play).
 * includeContext: true for welcome that includes test results.
 * testContextKey: required when includeContext true – e.g. result_id so cache is per test result; new test => new audio.
 * Returns blob + optional welcomeMessage from server (use for display so text matches audio).
 */
export async function apiGetWelcomeAudio(
  userId: string,
  includeContext = false,
  testContextKey?: string | number
): Promise<GetWelcomeAudioResult> {
  const params = new URLSearchParams({ user_id: userId })
  if (includeContext) {
    params.set("include_context", "true")
    if (testContextKey != null) params.set("test_context_key", String(testContextKey))
  }
  const res = await fetch(`http://localhost:8000/api/voice/welcome-audio/?${params}`)
  if (!res.ok) throw new Error(res.status === 404 ? "No welcome audio" : "Failed to get welcome audio")
  const blob = await res.blob()
  const encoded = res.headers.get("X-Welcome-Message")
  let welcomeMessage: string | undefined
  if (encoded) {
    try {
      const raw = atob(encoded)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      welcomeMessage = new TextDecoder().decode(bytes)
    } catch {
      welcomeMessage = undefined
    }
  }
  return { blob, welcomeMessage }
}

/**
 * Generate welcome TTS, save to cache on server, and return audio blob.
 * testContextKey: required when includeTestContext true – e.g. result_id; when user takes a new test, new key => new audio stored.
 */
export async function apiGenerateAndSaveWelcomeAudio(
  userId: string,
  welcomeMessage: string,
  langPref: string | null,
  includeTestContext: boolean,
  testContextKey?: string | number
): Promise<Blob> {
  const body: Record<string, unknown> = {
    user_id: userId,
    welcome_message: welcomeMessage,
    lang_pref: langPref,
    include_test_context: includeTestContext,
  }
  if (includeTestContext && testContextKey != null) body.test_context_key = testContextKey
  const res = await fetch("http://localhost:8000/api/voice/welcome-audio/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Failed to generate welcome audio")
  }
  return res.blob()
}

export async function apiTTSSynthesize(
  text: string,
  language: string = "en",
  ttsBackend: "xtts" | "qwen3" = "xtts"
): Promise<Blob> {
  if (!text || !text.trim()) {
    throw new Error("Text cannot be empty")
  }

  const res = await fetch("http://localhost:8000/api/tts/synthesize/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text.trim(),
      language: language,
      tts_backend: ttsBackend,
    }),
  })

  if (!res.ok) {
    // Try to parse error message from JSON response
    try {
      const errorData = await res.json()
      throw new Error(errorData.error || "Failed to synthesize speech")
    } catch {
      // If not JSON, use status text
      throw new Error(`TTS synthesis failed: ${res.statusText}`)
    }
  }

  // Return audio Blob
  const audioBlob = await res.blob()
  
  // Verify it's an audio file
  if (!audioBlob.type.startsWith("audio/") && audioBlob.size === 0) {
    throw new Error("Invalid audio response from TTS service")
  }

  return audioBlob
}

// ============================================
// DIAGNOSTIC TESTS
// ============================================

export type DiagnosticTestStatus = {
  generic_screening_completed: boolean
  primary_condition: string | null
  daily_test_available: boolean
  last_test_date: string | null
  available_test: string | null
}

export async function apiGetDiagnosticTestStatus(
  user_id: string
): Promise<DiagnosticTestStatus> {
  const res = await fetch("http://localhost:8000/api/diagnostic-tests/status/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Failed to get test status" }));
    throw new Error(errorData.error || "Failed to get test status");
  }

  return res.json();
}

// -------------------------
// Mood trends (diagnostic tests)
// -------------------------
export type MoodTrendData = {
  date: string;
  score: number;
  severity: string;
  trend: "improved" | "worsened" | "stable";
};

export type MoodTrendResponse = {
  trend_data: MoodTrendData[];
  primary_condition: string | null;
  test_type: string;
  message?: string;
};

export async function apiGetMoodTrend(
  user_id: string
): Promise<MoodTrendResponse> {
  const res = await fetch("http://localhost:8000/api/diagnostic-tests/mood-trend/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Failed to get mood trend" }));
    throw new Error(errorData.error || "Failed to get mood trend");
  }

  return res.json();
}

export type StreakResponse = {
  current_streak: number;
  longest_streak: number;
  last_test_date: string | null;
};

export async function apiGetStreak(
  user_id: string
): Promise<StreakResponse> {
  const res = await fetch("http://localhost:8000/api/diagnostic-tests/streak/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Failed to get streak" }));
    throw new Error(errorData.error || "Failed to get streak");
  }

  return res.json();
}

export type TestSubmissionRequest = {
  test_type: string
  answers: Record<string, number>
}

export type TestSubmissionResponse = {
  result_id: number
  score: number
  severity_level: string
  primary_condition?: string
  domain_scores?: Record<string, number>
}

export async function apiSubmitDiagnosticTest(
  user_id: string,
  test_type: string,
  answers: Record<string, number>
): Promise<TestSubmissionResponse> {
  const res = await fetch("http://localhost:8000/api/diagnostic-tests/submit/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id,
      test_type,
      answers,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Failed to submit test" }));
    throw new Error(errorData.error || "Failed to submit test");
  }

  return res.json();
}

export type TestHistoryItem = {
  result_id: number
  test_type: string
  test_name: string
  score: number
  severity_level: string
  taken_at: string
}

export type TestHistoryResponse = {
  results: TestHistoryItem[]
}

export async function apiGetDiagnosticTestHistory(
  user_id: string
): Promise<TestHistoryResponse> {
  const res = await fetch("http://localhost:8000/api/diagnostic-tests/history/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Failed to get test history" }));
    throw new Error(errorData.error || "Failed to get test history");
  }

  return res.json();
}

