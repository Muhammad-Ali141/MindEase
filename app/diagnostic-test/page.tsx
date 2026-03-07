"use client"

import { useRouter } from "next/navigation"
import { Brain, Heart, AlertCircle, Smile, ArrowLeft, Clock, CheckCircle2, Zap, Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { BeamsBackground } from "@/components/ui/beams-background"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "next-themes"
import { apiGetDiagnosticTestStatus } from "@/lib/api"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

const testOptions = [
  {
    id: "depression",
    name: "Depression",
    testName: "PHQ-9",
    description: "Track how you've been feeling lately — this helps identify patterns of low mood.",
    duration: "5-7 min",
    questions: 9,
    icon: Heart,
    bg: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
    ring: "rgba(166,124,82,0.2)",
  },
  {
    id: "anxiety",
    name: "Anxiety",
    testName: "GAD-7",
    description: "Understand if worry or nervousness is affecting your day-to-day life.",
    duration: "3-5 min",
    questions: 7,
    icon: AlertCircle,
    bg: "linear-gradient(135deg, #6b3f1f 0%, #a0622f 100%)",
    ring: "rgba(160,98,47,0.2)",
  },
  {
    id: "stress",
    name: "Stress",
    testName: "PSS-10",
    description: "Find out how much pressure you're under and if things feel overwhelming.",
    duration: "5-7 min",
    questions: 10,
    icon: Brain,
    bg: "linear-gradient(135deg, #5a2020 0%, #8c3a3a 100%)",
    ring: "rgba(140,58,58,0.2)",
  },
  {
    id: "general-mood",
    name: "General Mood",
    testName: "Mood Check",
    description: "A quick emotional temperature check — see how you're really feeling right now.",
    duration: "3-5 min",
    questions: 8,
    icon: Smile,
    bg: "linear-gradient(135deg, #325944 0%, #5D8A6B 100%)",
    ring: "rgba(93,138,107,0.2)",
  },
]

export default function DiagnosticTestPage() {
  const router  = useRouter()
  const { user }= useAuth()
  const { resolvedTheme } = useTheme()
  const isDark  = resolvedTheme === "dark"

  const [sidebarOpen,      setSidebarOpen]      = useState(true)
  const [primaryCondition, setPrimaryCondition] = useState<string | null>(null)
  const [loading,          setLoading]          = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!user?.id) { setLoading(false); return }
      try {
        const status = await apiGetDiagnosticTestStatus(user.id)
        setPrimaryCondition(status.primary_condition)
        if (status.available_test) {
          router.push(`/diagnostic-test/${status.available_test}`)
          return
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [user?.id, router])

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)" }}>
        <BeamsBackground isDark={isDark} intensity="subtle" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={28} style={{ color: "var(--primary)" }} className="animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <BeamsBackground isDark={isDark} intensity="subtle" />
      </div>

      <div style={{ position: "relative", zIndex: 10, flexShrink: 0, height: "100%" }}>
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header />

        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "1.75rem 1.5rem 3rem" }}>

            {/* Back */}
            <button
              onClick={() => router.push("/dashboard")}
              style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", marginBottom: "2rem", padding: 0 }}
            >
              <ArrowLeft size={14} /> Dashboard
            </button>

            {/* Page heading */}
            <div style={{ marginBottom: "2rem" }}>
              <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.25rem" }}>
                Clinical
              </p>
              <h1 style={{ ...serif, fontSize: "2.25rem", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1.1, marginBottom: "0.75rem" }}>
                Mental Health Check-ups
              </h1>
              <p style={{ ...sans, fontSize: "0.9375rem", color: "var(--muted-foreground)", lineHeight: 1.7, maxWidth: 520 }}>
                Brief, clinically-validated assessments to track how you're feeling over time.
              </p>
            </div>

            {/* Screening card (primary CTA) */}
            {!primaryCondition && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  position: "relative", overflow: "hidden",
                  borderRadius: 20, marginBottom: "2rem",
                  background: "linear-gradient(135deg, #4a3220 0%, #7a5535 45%, #5a7a5a 100%)",
                  boxShadow: "0 12px 40px rgba(166,124,82,0.25)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {/* Decorative orbs */}
                <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -60, left: "30%", width: 300, height: 300, borderRadius: "50%", background: "rgba(93,138,107,0.12)", pointerEvents: "none" }} />

                <div style={{ position: "relative", zIndex: 1, padding: "2rem 2.25rem", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "0.4rem",
                      ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em",
                      textTransform: "uppercase", color: "rgba(255,255,255,0.6)",
                      padding: "0.2rem 0.6rem", borderRadius: 100,
                      border: "1px solid rgba(255,255,255,0.18)",
                      marginBottom: "0.875rem",
                    }}>
                      <Zap size={10} /> Start here
                    </div>
                    <h2 style={{ ...serif, fontSize: "1.875rem", fontWeight: 400, color: "white", letterSpacing: "-0.02em", marginBottom: "0.625rem" }}>
                      Initial Screening
                    </h2>
                    <p style={{ ...sans, fontSize: "0.875rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.7, marginBottom: "1.25rem" }}>
                      8 quick questions to identify your primary concern. We'll then guide you to the most relevant daily assessment.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem" }}>
                      <span style={{ ...sans, fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Clock size={12} /> 3-5 minutes
                      </span>
                      <span style={{ ...sans, fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <CheckCircle2 size={12} /> 8 questions
                      </span>
                    </div>
                    <button
                      onClick={() => router.push("/diagnostic-test/generic-screening")}
                      style={{
                        ...sans, height: 46, padding: "0 1.75rem", borderRadius: 12,
                        backgroundColor: "rgba(255,255,255,0.18)",
                        border: "1px solid rgba(255,255,255,0.28)",
                        color: "white", fontSize: "0.9375rem", fontWeight: 600,
                        cursor: "pointer", backdropFilter: "blur(8px)",
                        display: "inline-flex", alignItems: "center", gap: "0.5rem",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.26)"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)"}
                    >
                      Begin Screening →
                    </button>
                  </div>

                  {/* Icon visual */}
                  <div style={{
                    width: 88, height: 88, borderRadius: 22, flexShrink: 0,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(8px)",
                  }}>
                    <Brain size={44} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Section divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
              <p style={{ ...sans, fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", flexShrink: 0 }}>
                {primaryCondition ? "Available Assessments" : "Or explore a specific area"}
              </p>
              <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
            </div>

            {/* Test cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.875rem" }}>
              {testOptions.map((test, i) => {
                const Icon = test.icon
                const isPrimary = test.id === primaryCondition
                return (
                  <motion.div
                    key={test.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.35 }}
                    style={{
                      position: "relative", overflow: "hidden",
                      borderRadius: 16,
                      backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
                      backdropFilter: "blur(10px)",
                      border: isPrimary
                        ? "1px solid color-mix(in srgb, var(--primary) 40%, transparent)"
                        : "1px solid var(--border)",
                      boxShadow: isPrimary ? `0 4px 20px ${test.ring}` : "0 2px 8px rgba(0,0,0,0.04)",
                      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `color-mix(in srgb, var(--primary) 35%, transparent)`
                      e.currentTarget.style.boxShadow = `0 6px 24px ${test.ring}`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = isPrimary ? `color-mix(in srgb, var(--primary) 40%, transparent)` : "var(--border)"
                      e.currentTarget.style.boxShadow = isPrimary ? `0 4px 20px ${test.ring}` : "0 2px 8px rgba(0,0,0,0.04)"
                    }}
                  >
                    {isPrimary && (
                      <div style={{
                        position: "absolute", top: 12, right: 12,
                        ...sans, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "var(--primary)",
                        backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
                        padding: "0.2rem 0.5rem", borderRadius: 100,
                        border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}>
                        Your focus
                      </div>
                    )}

                    {/* Card gradient strip */}
                    <div style={{ height: 6, background: test.bg }} />

                    <div style={{ padding: "1.375rem 1.375rem 1.25rem" }}>
                      {/* Icon + meta */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "0.875rem" }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                          background: test.bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 4px 12px ${test.ring}`,
                        }}>
                          <Icon size={20} color="white" strokeWidth={1.75} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ ...sans, fontSize: "0.9375rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.1rem" }}>
                            {test.name}
                          </h3>
                          <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                            {test.testName} · {test.questions} questions
                          </p>
                        </div>
                      </div>

                      <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", lineHeight: 1.65, marginBottom: "1.125rem" }}>
                        {test.description}
                      </p>

                      {/* Duration chip + CTA */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={11} /> {test.duration}
                        </span>
                        <button
                          onClick={() => router.push(`/diagnostic-test/${test.id}`)}
                          style={{
                            ...sans, height: 34, padding: "0 1rem", borderRadius: 8,
                            background: test.bg,
                            color: "white", fontSize: "0.8125rem", fontWeight: 600,
                            border: "none", cursor: "pointer",
                            boxShadow: `0 3px 10px ${test.ring}`,
                            display: "inline-flex", alignItems: "center", gap: "0.3rem",
                            transition: "opacity 0.15s ease",
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >
                          Start <ArrowLeft size={12} style={{ transform: "rotate(180deg)" }} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
