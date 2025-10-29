export async function apiRegister(body: { email: string; password: string }) {
  return new Promise<{ id: string; email: string }>((resolve) => {
    setTimeout(() => {
      resolve({ id: "u_123", email: body.email })
    }, 600)
  })
}

export async function apiLogin(body: { email: string; password: string }) {
  return new Promise<{ access_token: string; user: { id: string; email: string } }>((resolve) => {
    setTimeout(() => {
      resolve({
        access_token: "dummy.jwt.token",
        user: { id: "u_123", email: body.email },
      })
    }, 600)
  })
}

export async function apiGetMe(token: string) {
  return new Promise<{
    id: string
    email: string
    profile: { display_name: string; preferred_language: "en" | "ur"; timezone: string }
  }>((resolve) => {
    setTimeout(() => {
      resolve({
        id: "u_123",
        email: "demo@mindease.app",
        profile: { display_name: "Hasnain", preferred_language: "en", timezone: "Asia/Karachi" },
      })
    }, 500)
  })
}

export async function apiUpdateMe(token: string, body: { display_name: string; preferred_language: "en" | "ur" }) {
  return new Promise<{
    id: string
    email: string
    profile: { display_name: string; preferred_language: "en" | "ur"; timezone: string }
  }>((resolve) => {
    setTimeout(() => {
      resolve({
        id: "u_123",
        email: "demo@mindease.app",
        profile: {
          display_name: body.display_name,
          preferred_language: body.preferred_language,
          timezone: "Asia/Karachi",
        },
      })
    }, 600)
  })
}
