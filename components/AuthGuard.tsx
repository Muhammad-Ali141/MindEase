"use client"

import { type ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"

export function AuthGuard({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return // wait for localStorage hydration
    if (!token) {
      router.replace("/login")
    }
  }, [token, isLoading, router])

  if (isLoading || !token) return null
  return <>{children}</>
}
