"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { TherapyOptions } from "@/components/therapy-options"
import { QuickStats } from "@/components/quick-stats"
import { SessionHistory } from "@/components/session-history"
import { DiagnosticTests } from "@/components/diagnostic-tests"
import { TherapistDirectory } from "@/components/therapist-directory"
import { useAuth } from "@/context/AuthContext"
import { DashboardTour, type TourCompletionAction } from "@/components/dashboard-tour"
import { apiUpdateDashboardTour, apiLoginOauth } from "@/lib/api"
import { Loader2 } from "lucide-react"

export default function Dashboard() {
  const router = useRouter()
  const { token, user, setAuth, isLoading: authLoading } = useAuth()
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser()
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [isOauthSyncing, setIsOauthSyncing] = useState(false)
  const oauthSyncedRef = useRef(false)
  const autoTriggeredRef = useRef(false)
  const previousUserRef = useRef<string | null>(null)

  // OAuth return: sync Clerk with backend when landing from Google redirect
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !clerkUser || oauthSyncedRef.current || token) return
    if (typeof window === "undefined" || sessionStorage.getItem("mindease_oauth_pending") !== "1") return
    const email = clerkUser.primaryEmailAddress?.emailAddress
    if (!email) return
    oauthSyncedRef.current = true
    sessionStorage.removeItem("mindease_oauth_pending")
    setIsOauthSyncing(true)
    apiLoginOauth(email)
      .then((res) => {
        setIsOauthSyncing(false)
        setAuth({
          token: res.user_id.toString(),
          user: {
            id: res.user_id.toString(),
            email: res.email,
            first_name: res.first_name,
            last_name: res.last_name || "",
            gender: res.gender,
            city: res.city,
            nearest_major_city: res.nearest_major_city,
            dashboard_tour_seen: res.dashboard_tour_seen ?? false,
          },
        })
      })
      .catch((err) => {
        setIsOauthSyncing(false)
        if (err?.message === "USER_NOT_FOUND") {
          router.replace("/auth?from_oauth=1")
        } else {
          router.push("/login")
        }
      })
  }, [clerkLoaded, isSignedIn, clerkUser, token, setAuth, router])

  useEffect(() => {
    if (authLoading) return // wait for localStorage hydration before redirecting
    if (!token && !isOauthSyncing) {
      router.push("/login")
    }
  }, [token, isOauthSyncing, authLoading, router])

  useEffect(() => {
    if (!user) {
      setIsTourOpen(false)
      return
    }

    if (previousUserRef.current !== user.id) {
      previousUserRef.current = user.id
      autoTriggeredRef.current = false
    }

    if (!user.dashboard_tour_seen && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true
      setIsTourOpen(true)
    }
  }, [user])

  const persistTourSeen = useCallback(
    async (seen: boolean) => {
      if (!user) return

      if (user.dashboard_tour_seen === seen) {
        setAuth({
          token: (token ?? user.id).toString(),
          user: { ...user, dashboard_tour_seen: seen },
        })
        return
      }

      try {
        await apiUpdateDashboardTour(user.id, seen)
      } catch (error) {
        console.error("Failed to update dashboard tutorial status:", error)
      } finally {
        setAuth({
          token: (token ?? user.id).toString(),
          user: { ...user, dashboard_tour_seen: seen },
        })
      }
    },
    [setAuth, token, user],
  )

  const handleTourComplete = useCallback(
    async (action: TourCompletionAction) => {
      setIsTourOpen(false)
      if (!user) return

      if (action === "completed" || action === "dont-show" || action === "skipped") {
        await persistTourSeen(true)
      }
    },
    [persistTourSeen, user],
  )

  const handleStartTutorial = useCallback(() => {
    if (!user) return
    setIsTourOpen(true)
  }, [user])

  // Show full-screen loading when no token (syncing from OAuth, hydrating from localStorage, or redirecting)
  if (!token || authLoading) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-slate-600 dark:text-slate-400">
            {authLoading ? "Loading…" : isOauthSyncing ? "Signing you in…" : "Loading…"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex h-screen w-screen bg-gray-50 dark:bg-slate-900">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onStartTutorial={handleStartTutorial} />
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Main therapy options */}
              <TherapyOptions />

              {/* Quick stats and wellness info */}
              <QuickStats />

              {/* Two column layout for history and tests */}
              <div className="grid grid-cols-2 gap-6">
                <SessionHistory />
                <DiagnosticTests />
              </div>

              {/* Therapist directory */}
              <TherapistDirectory />
            </div>
          </div>
        </div>
      </div>

      <DashboardTour open={isTourOpen && Boolean(user)} onComplete={handleTourComplete} />
    </>
  )
}
