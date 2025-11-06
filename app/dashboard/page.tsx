"use client"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { TherapyOptions } from "@/components/therapy-options"
import { QuickStats } from "@/components/quick-stats"
import { SessionHistory } from "@/components/session-history"
import { DiagnosticTests } from "@/components/diagnostic-tests"
import { TherapistDirectory } from "@/components/therapist-directory"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"

export default function Dashboard() {
  const router = useRouter()
  const { token } = useAuth()

  useEffect(() => {
    if (!token) {
      router.push("/login")
    }
  }, [token, router])

  return (
    <div className="fixed inset-0 flex h-screen w-screen bg-gray-50 dark:bg-slate-900 z-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
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
  )
}
