import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { TherapyOptions } from "@/components/therapy-options"
import { QuickStats } from "@/components/quick-stats"
import { SessionHistory } from "@/components/session-history"
import { DiagnosticTests } from "@/components/diagnostic-tests"
import { TherapistDirectory } from "@/components/therapist-directory"

export default function Dashboard() {
  return (
    <div className="fixed inset-0 flex h-screen w-screen bg-gray-50 z-50">
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
