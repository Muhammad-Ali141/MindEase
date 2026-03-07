"use client"

import { useState, useEffect } from "react"
import { X, Brain, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { apiGetDiagnosticTestStatus, apiGetDiagnosticTestHistory, type TestHistoryItem } from "@/lib/api"
import { useRouter } from "next/navigation"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

const severityColor = (level?: string) => {
  if (!level) return { bg: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)", border: "color-mix(in srgb, var(--primary) 22%, transparent)" }
  if (level === "severe" || level === "extremely severe")
    return { bg: "rgba(220,38,38,0.1)", color: "#ef4444", border: "rgba(220,38,38,0.25)" }
  if (level === "moderate")
    return { bg: "rgba(234,88,12,0.1)", color: "#f97316", border: "rgba(234,88,12,0.25)" }
  if (level === "mild")
    return { bg: "rgba(202,138,4,0.1)", color: "#eab308", border: "rgba(202,138,4,0.25)" }
  return { bg: "rgba(22,163,74,0.1)", color: "#22c55e", border: "rgba(22,163,74,0.25)" }
}

type ShareTestModalProps = {
  open: boolean
  onClose: () => void
  onShare: (testContext: string, resultId?: number) => void
  onSkip: () => void
}

export function ShareTestModal({ open, onClose, onShare, onSkip }: ShareTestModalProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [latestTest, setLatestTest] = useState<TestHistoryItem | null>(null)
  const [hasTests, setHasTests] = useState(false)

  useEffect(() => {
    if (open && user?.id) loadTestData()
  }, [open, user?.id])

  const loadTestData = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const [, history] = await Promise.all([
        apiGetDiagnosticTestStatus(user.id).catch(() => null),
        apiGetDiagnosticTestHistory(user.id).catch(() => ({ results: [] })),
      ])
      const dailyTests = history.results.filter((r: TestHistoryItem) => r.test_type !== "generic-screening")
      if (dailyTests.length > 0) { setLatestTest(dailyTests[0]); setHasTests(true) }
      else setHasTests(false)
    } catch { setHasTests(false) }
    finally { setLoading(false) }
  }

  const handleShare = () => {
    if (!latestTest) return
    const dateStr = new Date(latestTest.taken_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    const severityCapitalized = latestTest.severity_level?.replace(/\b\w/g, c => c.toUpperCase()) || latestTest.severity_level
    const testContext = `The user has completed a ${latestTest.test_name} assessment.\n\nAssessment results:\n- Assessment: ${latestTest.test_name}\n- Total score: ${latestTest.score} (higher scores indicate greater symptom burden, except for Daily Mood Check-In where higher means better mood)\n- Severity: ${severityCapitalized}\n- Date completed: ${dateStr}\n\nUse this information to understand the user's current mental health context and provide appropriate, personalized support. You do not need to ask them to repeat their assessment results.`
    onShare(testContext, latestTest.result_id)
  }

  if (!open) return null

  const sev = severityColor(latestTest?.severity_level)

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          padding: "1rem",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            ...sans,
            position: "relative",
            width: "100%", maxWidth: 440,
            backgroundColor: "color-mix(in srgb, var(--card) 96%, transparent)",
            backdropFilter: "blur(16px)",
            borderRadius: 20,
            border: "1px solid var(--border)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {/* Top gradient strip */}
          <div style={{ height: 4, background: "linear-gradient(90deg, #7a5535 0%, #a67c52 50%, #5D8A6B 100%)" }} />

          <div style={{ padding: "1.5rem 1.625rem 1.625rem" }}>
            {/* Close button */}
            <button
              type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); onClose() }}
              style={{
                position: "absolute", top: 16, right: 16,
                width: 28, height: 28, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid var(--border)", background: "none",
                color: "var(--muted-foreground)", cursor: "pointer",
                transition: "color 0.15s ease, border-color 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--foreground)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)" }}
            >
              <X size={14} />
            </button>

            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <Loader2 size={24} style={{ color: "var(--primary)", margin: "0 auto 0.875rem", display: "block" }} className="animate-spin" />
                <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Loading…</p>
              </div>
            ) : hasTests && latestTest ? (
              <>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "1.125rem", paddingRight: "1.5rem" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 3px 10px rgba(166,124,82,0.3)",
                  }}>
                    <Brain size={20} color="white" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.15rem" }}>
                      Assessment Context
                    </p>
                    <h2 style={{ ...serif, fontSize: "1.4rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)", lineHeight: 1.2 }}>
                      Share your results?
                    </h2>
                  </div>
                </div>

                <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "1.25rem" }}>
                  Sharing your latest assessment helps personalize the conversation without you having to explain your situation from scratch.
                </p>

                {/* Test result card */}
                <div style={{
                  backgroundColor: "color-mix(in srgb, var(--muted) 35%, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "1rem 1.125rem",
                  marginBottom: "1.375rem",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <div>
                      <p style={{ ...sans, fontSize: "0.9375rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.15rem" }}>
                        {latestTest.test_name}
                      </p>
                      <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                        {new Date(latestTest.taken_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    {latestTest.severity_level && (
                      <span style={{
                        ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        color: sev.color,
                        backgroundColor: sev.bg,
                        border: `1px solid ${sev.border}`,
                        padding: "0.2rem 0.55rem", borderRadius: 100,
                        flexShrink: 0,
                      }}>
                        {latestTest.severity_level}
                      </span>
                    )}
                  </div>
                  <div style={{ height: 1, backgroundColor: "var(--border)", margin: "0.625rem 0" }} />
                  <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                    Score: <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{latestTest.score}</span>
                  </p>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); handleShare() }}
                    style={{
                      flex: 1, height: 44, borderRadius: 11, border: "none",
                      background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
                      color: "white", ...sans, fontSize: "0.9rem", fontWeight: 600,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                      boxShadow: "0 3px 12px rgba(166,124,82,0.35)",
                      transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.87"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    <CheckCircle2 size={15} /> Share Results
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onSkip() }}
                    style={{
                      flex: 1, height: 44, borderRadius: 11,
                      border: "1px solid var(--border)", background: "none",
                      color: "var(--muted-foreground)", ...sans, fontSize: "0.9rem", fontWeight: 600,
                      cursor: "pointer", transition: "border-color 0.15s ease, color 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--foreground)"; e.currentTarget.style.color = "var(--foreground)" }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)" }}
                  >
                    Skip
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* No tests header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "1.125rem", paddingRight: "1.5rem" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: "linear-gradient(135deg, #5a4a1a, #a67c52)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 3px 10px rgba(166,124,82,0.25)",
                  }}>
                    <AlertCircle size={20} color="white" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.15rem" }}>
                      No Results Yet
                    </p>
                    <h2 style={{ ...serif, fontSize: "1.4rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)", lineHeight: 1.2 }}>
                      Take an assessment first?
                    </h2>
                  </div>
                </div>

                <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "1.25rem" }}>
                  A quick mental health check-in helps personalize your session with context your AI therapist can act on immediately.
                </p>

                {/* Benefits */}
                <div style={{
                  backgroundColor: "color-mix(in srgb, var(--muted) 35%, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: 12, padding: "1rem 1.125rem",
                  marginBottom: "1.375rem",
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                }}>
                  {["Personalized support from your first message", "Track mood and progress over time", "No need to explain your situation from scratch"].map((benefit, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, #7a5535, #a67c52)",
                      }} />
                      <span style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>{benefit}</span>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onClose(); router.push("/diagnostic-test") }}
                    style={{
                      flex: 1, height: 44, borderRadius: 11, border: "none",
                      background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
                      color: "white", ...sans, fontSize: "0.875rem", fontWeight: 600,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                      boxShadow: "0 3px 12px rgba(166,124,82,0.35)",
                      transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.87"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    Take Assessment <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onSkip() }}
                    style={{
                      flex: 1, height: 44, borderRadius: 11,
                      border: "1px solid var(--border)", background: "none",
                      color: "var(--muted-foreground)", ...sans, fontSize: "0.875rem", fontWeight: 600,
                      cursor: "pointer", transition: "border-color 0.15s ease, color 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--foreground)"; e.currentTarget.style.color = "var(--foreground)" }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)" }}
                  >
                    Continue Without
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
