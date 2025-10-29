"use client"

import { type ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"

export function AuthGuard({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!token) {
      router.replace("/login")
    }
  }, [token, router])

  if (!token) return null
  return <>{children}</>
}
