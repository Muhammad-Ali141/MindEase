import { clerkMiddleware } from "@clerk/nextjs/server"

// Run Clerk middleware only on routes that need it:
// - /auth(.*)     : login, signup, Google OAuth initiation, OTP
// - /auth/callback: Clerk OAuth callback handler
// - /dashboard(.*): receives the __clerk_handshake token after Google OAuth completes
// All other routes (/, /chat, /voice-chat, etc.) skip Clerk middleware — they use MindEase's own JWT.
export default clerkMiddleware()

export const config = {
  matcher: [
    "/auth(.*)",
    "/dashboard(.*)",
  ],
}
