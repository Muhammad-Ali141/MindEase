"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { TherapyOptions } from "@/components/therapy-options"
import { QuickStats } from "@/components/quick-stats"
import { SessionHistory } from "@/components/session-history"
import { DiagnosticTests } from "@/components/diagnostic-tests"
import { TherapistDirectory } from "@/components/therapist-directory"
import { useAuth } from "@/context/AuthContext"
import { DashboardTour, type TourCompletionAction } from "@/components/dashboard-tour"
import { apiUpdateDashboardTour } from "@/lib/api"

export default function Dashboard() {
  const router = useRouter()
  const { token, user, setAuth } = useAuth()
  const [isTourOpen, setIsTourOpen] = useState(false)
  const autoTriggeredRef = useRef(false)
  const previousUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (!token) {
      router.push("/login")
    }
  }, [token, router])

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
