"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useTheme } from "next-themes"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { TherapyOptions } from "@/components/therapy-options"
import { QuickStats } from "@/components/quick-stats"
import { SessionHistory } from "@/components/session-history"
import { DiagnosticTests } from "@/components/diagnostic-tests"
import { TherapistDirectory } from "@/components/therapist-directory"
import { BeamsBackground } from "@/components/ui/beams-background"
import { useAuth } from "@/context/AuthContext"
import { DashboardDataProvider } from "@/context/DashboardDataContext"
import { DashboardTour, type TourCompletionAction } from "@/components/dashboard-tour"
import { apiUpdateDashboardTour, apiLoginOauth } from "@/lib/api"
import { useProfileDict } from "@/lib/i18n"

const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export default function Dashboard() {
  const router = useRouter()
  const { token, user, setAuth, isLoading: authLoading } = useAuth()
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser()
  const { theme } = useTheme()
  const t = useProfileDict()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    // Prefetch all app routes so navigation feels instant after dashboard loads
    router.prefetch("/chat")
    router.prefetch("/voice-chat")
    router.prefetch("/sessions")
    router.prefetch("/profile")
    router.prefetch("/diagnostic-test")
    router.prefetch("/dashboard/therapists")
  }, [])
  const isDark = mounted ? theme === "dark" : false

  const [isTourOpen, setIsTourOpen]       = useState(false)
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [isOauthSyncing, setIsOauthSyncing] = useState(false)
  const oauthSyncedRef     = useRef(false)
  const autoTriggeredRef   = useRef(false)
  const previousUserRef    = useRef<string | null>(null)

  // OAuth return: sync Clerk with backend
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !clerkUser || oauthSyncedRef.current || token) return
    if (typeof window === "undefined" || sessionStorage.getItem("mindease_oauth_pending") !== "1") return
    const email = clerkUser.primaryEmailAddress?.emailAddress
    if (!email) return
    oauthSyncedRef.current = true
    sessionStorage.removeItem("mindease_oauth_pending")
    setIsOauthSyncing(true)
    apiLoginOauth(email)
      .then(res => {
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
      .catch(err => {
        setIsOauthSyncing(false)
        router.replace(err?.message === "USER_NOT_FOUND" ? "/auth?from_oauth=1" : "/login")
      })
  }, [clerkLoaded, isSignedIn, clerkUser, token, setAuth, router])

  useEffect(() => {
    if (authLoading) return
    if (!clerkLoaded) return
    // oauthSyncedRef is a ref (synchronous) — it's set to true at the very start
    // of the OAuth sync effect, before sessionStorage is cleared and before
    // setIsOauthSyncing(true) takes effect. This is the only reliable guard
    // against the React batching race condition where both effects run in the
    // same synchronous pass when clerkLoaded transitions to true.
    if (oauthSyncedRef.current) return
    if (!token && !isOauthSyncing) router.push("/login")
  }, [token, isOauthSyncing, authLoading, clerkLoaded, router])

  useEffect(() => {
    if (!user) { setIsTourOpen(false); return }
    if (previousUserRef.current !== user.id) { previousUserRef.current = user.id; autoTriggeredRef.current = false }
    if (!user.dashboard_tour_seen && !autoTriggeredRef.current) { autoTriggeredRef.current = true; setIsTourOpen(true) }
  }, [user])

  const persistTourSeen = useCallback(async (seen: boolean) => {
    if (!user) return
    if (user.dashboard_tour_seen === seen) {
      setAuth({ token: (token ?? user.id).toString(), user: { ...user, dashboard_tour_seen: seen } })
      return
    }
    try { await apiUpdateDashboardTour(user.id, seen) } catch { /* silent */ }
    finally { setAuth({ token: (token ?? user.id).toString(), user: { ...user, dashboard_tour_seen: seen } }) }
  }, [setAuth, token, user])

  const handleTourComplete = useCallback(async (action: TourCompletionAction) => {
    setIsTourOpen(false)
    if (!user) return
    if (action === "completed" || action === "dont-show" || action === "skipped") await persistTourSeen(true)
  }, [persistTourSeen, user])

  const handleStartTutorial = useCallback(() => { if (user) setIsTourOpen(true) }, [user])

  // Loading state
  if (!token || authLoading) {
    return (
      <div style={{
        ...sans, position: "fixed", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        backgroundColor: "var(--background)", gap: "1rem",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 13,
          backgroundColor: "#a67c52",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(166,124,82,0.4)",
        }}>
          <img src="/logo.svg" alt="MindEase" style={{ width: 28, height: 28, objectFit: "contain" }} />
        </div>
        <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
          {authLoading ? t.loading : isOauthSyncing ? t.signingIn : t.loading}
        </p>
      </div>
    )
  }

  return (
    <>
      <div data-page-root style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)" }}>

        {/* BeamsBackground — fixed, behind everything */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <BeamsBackground isDark={isDark} intensity="subtle" className="absolute inset-0 w-full h-full" />
        </div>

        {/* Sidebar */}
        <div style={{ position: "relative", zIndex: 10, flexShrink: 0, height: "100%" }}>
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
        </div>

        {/* Main area */}
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <Header onStartTutorial={handleStartTutorial} />
          </div>

          {/* Scrollable content */}
          <main style={{ flex: 1, overflowY: "auto" }}>
            <DashboardDataProvider>
              <div style={{ padding: "1.625rem 1.875rem 2.5rem", display: "flex", flexDirection: "column", gap: "1.375rem" }}>

                {/* 3 action cards */}
                <TherapyOptions />

                {/* 3 stat cards */}
                <QuickStats />

                {/* 2-column: sessions + assessments */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <SessionHistory />
                  <DiagnosticTests />
                </div>

                {/* Full-width therapist preview */}
                <TherapistDirectory />

              </div>
            </DashboardDataProvider>
          </main>
        </div>
      </div>

      <DashboardTour open={isTourOpen && Boolean(user)} onComplete={handleTourComplete} />
    </>
  )
}
