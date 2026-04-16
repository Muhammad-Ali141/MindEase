"use client"

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"
import { PageLoading } from "@/components/page-loading"

export default function AuthCallbackPage() {
  return (
    <>
      <PageLoading message="Signing you in…" />
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
      />
    </>
  )
}
