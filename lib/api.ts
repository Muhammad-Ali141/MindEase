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
};

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
};

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
};

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
};


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
  conversation_history: ChatMessage[]
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
    }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || "Failed to send message")
  }

  return res.json()
}

export type WelcomeResponse = {
  welcome_message: string
  user_id: string
}

export async function apiChatWelcome(
  user_id: string,
  user_first_name: string | null
): Promise<WelcomeResponse> {
  const res = await fetch("http://localhost:8000/api/chat/welcome/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id,
      user_first_name,
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

