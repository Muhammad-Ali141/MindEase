"use client"

import { useRouter } from "next/navigation"
import { useDashboardData } from "@/context/DashboardDataContext"
import { CheckCircle2, Brain, AlertCircle, Heart, Smile, ArrowRight, Loader2 } from "lucide-react"
import { useProfileDict } from "@/lib/i18n"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export function DiagnosticTests() {
  const router = useRouter()
  const t = useProfileDict()
  const { loading, testStatus, testHistory } = useDashboardData()

  const getTestInfo = (testType: string | null) => {
    if (!testType) return null
    const map: Record<string, { name: string; icon: typeof Brain; bg: string; color: string; desc: string }> = {
      "generic-screening": { name: t.genericScreening, icon: Brain, bg: "linear-gradient(135deg,#3d2d55,#6d4fa8)", color: "#c4a8ff", desc: t.briefScreening },
      "phq9":  { name: t.phq9Depression,  icon: Heart,        bg: "linear-gradient(135deg,#7a5535,#a67c52)", color: "#d4a87c", desc: t.trackFeeling },
      "gad7":  { name: t.gad7Anxiety,     icon: AlertCircle,  bg: "linear-gradient(135deg,#7a4a25,#b06030)", color: "#f0aa80", desc: t.checkWorry },
      "pss10": { name: t.pss10Stress,     icon: Brain,        bg: "linear-gradient(135deg,#6b2020,#a63030)", color: "#f09090", desc: t.measureStress },
      "mood_test": { name: t.moodAssessment, icon: Smile,       bg: "linear-gradient(135deg,#325944,#5D8A6B)", color: "#90d0a0", desc: t.quickMood },
    }
    return map[testType] || null
  }

  const severityStyle = (level: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string }> = {
      minimal:          { bg: "color-mix(in srgb,#5D8A6B 12%,transparent)", color: "#4a7358" },
      mild:             { bg: "color-mix(in srgb,#d97706 12%,transparent)", color: "#b45309" },
      moderate:         { bg: "color-mix(in srgb,#ea580c 12%,transparent)", color: "#c2410c" },
      severe:           { bg: "color-mix(in srgb,#dc2626 12%,transparent)", color: "#991b1b" },
      "extremely severe":{ bg: "color-mix(in srgb,#dc2626 18%,transparent)", color: "#7f1d1d" },
    }
    const s = map[level] || map.minimal
    return { backgroundColor: s.bg, color: s.color, ...sans, fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "0.2rem 0.5rem", borderRadius: 5 }
  }

  const availableTest = testStatus?.available_test
  const testInfo      = getTestInfo(availableTest || null)
  const TestIcon      = testInfo?.icon || Brain

  return (
    <div
      data-tour-target="mental-health-assessments"
      style={{
        ...sans,
        backgroundColor: "var(--card)",
        borderRadius: 16, border: "1px solid var(--border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "1.125rem 1.375rem 0.875rem", borderBottom: "1px solid var(--border)" }}>
        <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.2rem" }}>
          {t.clinical}
        </p>
        <h2 style={{ ...serif, fontSize: "1.25rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
          {t.assessments}
        </h2>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "0.875rem 1.125rem", overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 0" }}>
            <Loader2 size={20} style={{ color: "var(--primary)" }} className="animate-spin" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

            {/* Available test card */}
            {availableTest && testInfo && (
              <div style={{
                position: "relative", overflow: "hidden",
                borderRadius: 13, padding: "1.125rem",
                background: testInfo.bg,
                boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
              }}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <TestIcon size={17} color="white" />
                    </div>
                    <div>
                      <p style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>{testInfo.name}</p>
                      <p style={{ ...sans, fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)" }}>{testInfo.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/diagnostic-test/${availableTest}`)}
                    style={{
                      ...sans, display: "inline-flex", alignItems: "center", gap: "0.375rem",
                      height: 34, padding: "0 0.875rem", borderRadius: 100,
                      backgroundColor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)",
                      color: "rgba(255,255,255,0.9)", fontSize: "0.78125rem", fontWeight: 600, cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.22)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.14)"}
                  >
                    {testStatus?.generic_screening_completed ? t.takeDailyTest : t.startScreening}
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Test taken today */}
            {!availableTest && testStatus?.generic_screening_completed && (
              <div style={{
                borderRadius: 13, padding: "1rem",
                backgroundColor: "color-mix(in srgb, var(--sage) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--sage) 22%, transparent)",
                display: "flex", alignItems: "flex-start", gap: "0.625rem",
              }}>
                <CheckCircle2 size={18} style={{ color: "var(--sage)", flexShrink: 0, marginTop: "0.1rem" }} />
                <div>
                  <p style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground)" }}>{t.todayAssessmentComplete}</p>
                  <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.2rem", lineHeight: 1.5 }}>
                    {t.checkBackTomorrow}
                  </p>
                </div>
              </div>
            )}

            {/* No screening completed */}
            {!availableTest && !testStatus?.generic_screening_completed && (
              <div style={{ padding: "1.5rem 0", textAlign: "center" }}>
                <Brain size={26} style={{ color: "var(--muted-foreground)", margin: "0 auto 0.625rem" }} />
                <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>{t.completeScreening}</p>
                <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", opacity: 0.7, marginTop: "0.25rem" }}>{t.assessmentsAppearHere}</p>
              </div>
            )}

            {/* History */}
            {testHistory.length > 0 && (
              <div style={{
                backgroundColor: "color-mix(in srgb, var(--muted) 25%, transparent)",
                borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden",
              }}>
                <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)", padding: "0.625rem 1rem 0.5rem" }}>
                  {t.recentAssessments}
                </p>
                {testHistory.slice(0, 5).map((r, idx) => {
                  const rInfo = getTestInfo(r.test_type)
                  const RIcon = rInfo?.icon || Brain
                  return (
                    <div key={r.result_id}>
                      {idx > 0 && (
                        <div style={{ height: 1, backgroundColor: "var(--border)", margin: "0 1rem", opacity: 0.6 }} />
                      )}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr auto auto",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.625rem 1rem",
                      }}>
                        {/* Icon */}
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: rInfo?.bg || "linear-gradient(135deg,#7a5535,#a67c52)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <RIcon size={13} color="white" />
                        </div>

                        {/* Name */}
                        <p style={{ ...sans, fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.test_name}
                        </p>

                        {/* Date */}
                        <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                          {new Date(r.taken_at).toLocaleDateString()}
                        </p>

                        {/* Severity */}
                        <span style={severityStyle(r.severity_level)}>{r.severity_level}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
