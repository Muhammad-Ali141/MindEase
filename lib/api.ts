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

