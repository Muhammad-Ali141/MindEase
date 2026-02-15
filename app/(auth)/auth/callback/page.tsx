"use client"

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

export default function AuthCallbackPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/auth"
        signUpForceRedirectUrl="/auth"
      />
      <p className="text-slate-600 dark:text-slate-400 text-sm">Completing sign in…</p>
    </div>
  )
}
