"use client"

import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Brain, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { BeamsBackground } from "@/components/ui/beams-background"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "next-themes"
import { apiSubmitDiagnosticTest, apiGetDiagnosticTestStatus } from "@/lib/api"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

interface TestData {
  name: string
  scale: string[]
  questions: string[] | Array<{ q: string; domain?: string }>
}


export default function TestPage() {
  const router    = useRouter()
  const params    = useParams()
  const { user }  = useAuth()
  const { resolvedTheme } = useTheme()
  const isDark    = resolvedTheme === "dark"
  const testType  = params?.testType as string

  const [sidebarOpen,     setSidebarOpen]     = useState(true)
  const [testData,        setTestData]        = useState<TestData | null>(null)
  const [answers,         setAnswers]         = useState<Record<number, number>>({})
  const [loading,         setLoading]         = useState(true)
  const [submitting,      setSubmitting]      = useState(false)
  const [submitted,       setSubmitted]       = useState(false)
  const [testStatus,      setTestStatus]      = useState<any>(null)
  const [testAlreadyTaken,setTestAlreadyTaken]= useState(false)
  const [currentQ,        setCurrentQ]        = useState(0)
  const [direction,       setDirection]       = useState(1) // 1=forward, -1=back
  const [justAnswered,    setJustAnswered]    = useState(false)

  const getTestFile = (type: string) => {
    const map: Record<string, string> = {
      "generic-screening": "/diagnosticTests/generic_screening.json",
      depression:          "/diagnosticTests/phq9.json",
      anxiety:             "/diagnosticTests/gad7.json",
      stress:              "/diagnosticTests/pss10.json",
      "general-mood":      "/diagnosticTests/mood_test.json",
      mood_test:           "/diagnosticTests/mood_test.json",
      phq9:                "/diagnosticTests/phq9.json",
      gad7:                "/diagnosticTests/gad7.json",
      pss10:               "/diagnosticTests/pss10.json",
    }
    return map[type] || null
  }

  useEffect(() => {
    const load = async () => {
      if (!user?.id) { setLoading(false); return }
      try {
        const status = await apiGetDiagnosticTestStatus(user.id)
        setTestStatus(status)
        if (testType !== "generic-screening") {
          if (!status.available_test) { setTestAlreadyTaken(true); setLoading(false); return }
          if (status.last_test_date) {
            const last = new Date(status.last_test_date)
            const today = new Date()
            last.setHours(0,0,0,0); today.setHours(0,0,0,0)
            if (last.getTime() === today.getTime()) { setTestAlreadyTaken(true); setLoading(false); return }
          }
        }
      } catch {}
      const path = getTestFile(testType)
      if (!path) { setLoading(false); return }
      try {
        const res  = await fetch(path)
        const data = await res.json()
        setTestData(data)
      } catch {}
      setLoading(false)
    }
    load()
  }, [testType, user?.id])

  const questions = testData?.questions || []
  const total = questions.length
  const progress = total > 0 ? (Object.keys(answers).length / total) * 100 : 0
  const allAnswered = total > 0 && Object.keys(answers).length === total
  const qText = (q: any) => (typeof q === "string" ? q : q.q)

  const handleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [currentQ]: value }))
    setJustAnswered(true)
    setTimeout(() => {
      setJustAnswered(false)
      if (currentQ < total - 1) {
        setDirection(1)
        setCurrentQ(q => q + 1)
      }
    }, 420)
  }

  const goTo = (idx: number) => {
    setDirection(idx > currentQ ? 1 : -1)
    setCurrentQ(idx)
  }

  const handleSubmit = async () => {
    if (!testData || !user?.id || !allAnswered) return
    try {
      setSubmitting(true)
      const forApi: Record<string, number> = {}
      Object.entries(answers).forEach(([k, v]) => { forApi[k] = v })
      await apiSubmitDiagnosticTest(user.id, testType, forApi)
      setSubmitted(true)
      setTimeout(() => router.push("/dashboard"), 3500)
    } catch {
      alert("Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
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
          {children}
        </main>
      </div>
    </div>
  )

  // ── Loading ──
  if (loading) {
    return (
      <Shell>
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <Loader2 size={32} style={{ color: "var(--primary)", margin: "0 auto 1rem" }} className="animate-spin" />
            <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Preparing your check-in…</p>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Already taken ──
  if (testAlreadyTaken) {
    return (
      <Shell>
        <div style={{ maxWidth: 540, margin: "3rem auto", padding: "0 1.5rem" }}>
          <button onClick={() => router.push("/dashboard")} style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", marginBottom: "2rem" }}>
            <ArrowLeft size={15} /> Back to Dashboard
          </button>
          <div style={{
            backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
            backdropFilter: "blur(10px)", borderRadius: 20,
            border: "1px solid color-mix(in srgb, var(--sage) 25%, transparent)",
            padding: "3rem 2.5rem", textAlign: "center",
          }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", boxShadow: "0 8px 24px rgba(93,138,107,0.3)" }}>
              <CheckCircle2 size={36} color="white" />
            </div>
            <h2 style={{ ...serif, fontSize: "1.875rem", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", marginBottom: "0.75rem" }}>
              Today's check-in complete
            </h2>
            <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "2rem" }}>
              You've already completed your daily assessment. Consistent check-ins help us track your wellbeing more accurately — come back tomorrow!
            </p>
            {testStatus?.primary_condition && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.5rem 1rem", borderRadius: 100,
                backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "var(--primary)",
                marginBottom: "2rem",
              }}>
                <Brain size={14} />
                Tracking: {testStatus.primary_condition.charAt(0).toUpperCase() + testStatus.primary_condition.slice(1)}
              </div>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                ...sans, display: "block", width: "100%", height: 48, borderRadius: 12,
                background: "linear-gradient(135deg, #7a5535, #a67c52)",
                color: "white", fontSize: "0.9375rem", fontWeight: 600, border: "none", cursor: "pointer",
                boxShadow: "0 4px 14px rgba(166,124,82,0.3)",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── No test data ──
  if (!testData) {
    return (
      <Shell>
        <div style={{ padding: "3rem", textAlign: "center" }}>
          <p style={{ ...sans, color: "var(--muted-foreground)" }}>Test not found.</p>
          <button onClick={() => router.push("/dashboard")} style={{ ...sans, marginTop: "1rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>
            ← Back to Dashboard
          </button>
        </div>
      </Shell>
    )
  }

  // ── Submitted ──
  if (submitted) {
    return (
      <Shell>
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 20 }}
            style={{
              backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
              backdropFilter: "blur(12px)", borderRadius: 24,
              border: "1px solid var(--border)",
              padding: "3.5rem 3rem", textAlign: "center", maxWidth: 480, width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              style={{
                width: 88, height: 88, borderRadius: "50%",
                background: "linear-gradient(135deg, #325944 0%, #5D8A6B 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 2rem",
                boxShadow: "0 12px 32px rgba(93,138,107,0.4)",
              }}
            >
              <CheckCircle2 size={44} color="white" strokeWidth={1.75} />
            </motion.div>

            <h2 style={{ ...serif, fontSize: "2.25rem", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", marginBottom: "0.875rem" }}>
              {testType === "generic-screening" ? "Screening complete" : "Check-in recorded"}
            </h2>
            <p style={{ ...sans, fontSize: "0.9375rem", color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "2rem" }}>
              {testType === "generic-screening"
                ? "Your primary concern has been identified. Personalised daily assessments will now appear on your dashboard."
                : "Your daily check-in has been saved. Consistent tracking helps us give you better insights over time."}
            </p>

            {/* Animated redirect bar */}
            <div style={{ height: 3, backgroundColor: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.5, ease: "linear" }}
                style={{ height: "100%", background: "linear-gradient(90deg, #7a5535, #5D8A6B)", borderRadius: 2 }}
              />
            </div>
            <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.75rem", opacity: 0.7 }}>
              Returning to dashboard…
            </p>
          </motion.div>
        </div>
      </Shell>
    )
  }

  // ── Main test UI ──
  const scaleLabels = testData.scale.map(s => s.split("=")[1]?.trim() || s)
  const currentAnswer = answers[currentQ]

  return (
    <Shell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.75rem 1.5rem 3rem" }}>

        {/* Back + test name */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={12} style={{ color: "var(--muted-foreground)" }} />
            <span style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>5-10 min</span>
          </div>
        </div>

        {/* Header card */}
        <div style={{
          backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
          backdropFilter: "blur(10px)", borderRadius: 18, border: "1px solid var(--border)",
          padding: "1.375rem 1.625rem", marginBottom: "1.5rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
        }}>
          <div>
            <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.2rem" }}>
              Daily Wellness
            </p>
            <h1 style={{ ...serif, fontSize: "1.5rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
              {testData.name}
            </h1>
          </div>
          {/* Circular progress */}
          <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                stroke="var(--primary)" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress / 100)}`}
                transform="rotate(-90 28 28)"
                style={{ transition: "stroke-dashoffset 0.4s ease" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ ...sans, fontSize: "0.6875rem", fontWeight: 700, color: "var(--primary)" }}>
                {Object.keys(answers).length}/{total}
              </span>
            </div>
          </div>
        </div>

        {/* Question dots navigator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === currentQ ? 24 : 10,
                height: 10, borderRadius: 5,
                backgroundColor: answers[i] !== undefined
                  ? "var(--primary)"
                  : i === currentQ
                    ? "color-mix(in srgb, var(--primary) 50%, transparent)"
                    : "var(--border)",
                border: "none", cursor: "pointer",
                transition: "all 0.22s ease",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Question card */}
        <div style={{ position: "relative", overflow: "hidden", marginBottom: "1.25rem" }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentQ}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d * 60, opacity: 0 }),
                center:                { x: 0, opacity: 1 },
                exit:  (d: number) => ({ x: d * -60, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.32, 0, 0.67, 0] }}
              style={{
                backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
                backdropFilter: "blur(10px)", borderRadius: 20,
                border: `1px solid ${currentAnswer !== undefined ? "color-mix(in srgb, var(--primary) 35%, transparent)" : "var(--border)"}`,
                padding: "2rem 2rem 1.5rem",
                boxShadow: currentAnswer !== undefined
                  ? "0 4px 24px rgba(166,124,82,0.12)"
                  : "0 2px 12px rgba(0,0,0,0.05)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              {/* Question number */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.375rem" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: currentAnswer !== undefined
                    ? "linear-gradient(135deg, #7a5535, #a67c52)"
                    : "color-mix(in srgb, var(--muted) 60%, transparent)",
                  transition: "background 0.2s ease",
                }}>
                  {currentAnswer !== undefined
                    ? <CheckCircle2 size={16} color="white" strokeWidth={2} />
                    : <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: 700, color: "var(--muted-foreground)" }}>{currentQ + 1}</span>
                  }
                </div>
                <p style={{ ...sans, fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                  Question {currentQ + 1} of {total}
                </p>
              </div>

              {/* Question text */}
              <p style={{ ...serif, fontSize: "1.4375rem", fontWeight: 400, lineHeight: 1.5, letterSpacing: "-0.01em", color: "var(--foreground)", marginBottom: "2rem" }}>
                {qText(questions[currentQ])}
              </p>

              {/* Scale answers */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${scaleLabels.length}, 1fr)`, gap: "0.5rem" }}>
                {scaleLabels.map((label, i) => {
                  const isSelected = currentAnswer === i
                  return (
                    <motion.button
                      key={i}
                      onClick={() => !justAnswered && handleAnswer(i)}
                      whileHover={!justAnswered ? { y: -2 } : {}}
                      whileTap={!justAnswered ? { scale: 0.95 } : {}}
                      style={{
                        ...sans,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                        padding: "1rem 0.5rem",
                        borderRadius: 12,
                        border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: isSelected
                          ? "color-mix(in srgb, var(--primary) 14%, transparent)"
                          : "color-mix(in srgb, var(--muted) 40%, transparent)",
                        cursor: justAnswered ? "default" : "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 4px 12px rgba(166,124,82,0.2)" : "none",
                      }}
                    >
                      <span style={{
                        fontSize: "1.25rem", fontWeight: 700, lineHeight: 1,
                        color: isSelected ? "var(--primary)" : "var(--foreground)",
                      }}>{i}</span>
                      <span style={{
                        fontSize: "0.6875rem", fontWeight: 500, lineHeight: 1.35,
                        color: isSelected ? "var(--primary)" : "var(--foreground)",
                        textAlign: "center",
                        opacity: isSelected ? 1 : 0.65,
                      }}>
                        {label}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <button
            onClick={() => currentQ > 0 && goTo(currentQ - 1)}
            disabled={currentQ === 0}
            style={{
              ...sans, display: "inline-flex", alignItems: "center", gap: "0.375rem",
              height: 42, padding: "0 1.125rem", borderRadius: 10,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--muted-foreground)", fontSize: "0.875rem",
              cursor: currentQ === 0 ? "not-allowed" : "pointer",
              opacity: currentQ === 0 ? 0.35 : 1,
            }}
          >
            <ChevronLeft size={15} /> Previous
          </button>

          {currentQ < total - 1 ? (
            <button
              onClick={() => goTo(currentQ + 1)}
              style={{
                ...sans, display: "inline-flex", alignItems: "center", gap: "0.375rem",
                height: 42, padding: "0 1.25rem", borderRadius: 10,
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--foreground)", fontSize: "0.875rem", cursor: "pointer",
              }}
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <motion.button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              animate={allAnswered && !submitting ? { scale: [1, 1.02, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              style={{
                ...sans, display: "inline-flex", alignItems: "center", gap: "0.5rem",
                height: 48, padding: "0 1.75rem", borderRadius: 12,
                background: allAnswered
                  ? "linear-gradient(135deg, #7a5535, #a67c52)"
                  : "var(--muted)",
                color: allAnswered ? "white" : "var(--muted-foreground)",
                fontSize: "0.9375rem", fontWeight: 600, border: "none",
                cursor: allAnswered && !submitting ? "pointer" : "not-allowed",
                boxShadow: allAnswered ? "0 4px 16px rgba(166,124,82,0.35)" : "none",
                transition: "background 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                : <><CheckCircle2 size={16} /> Submit Check-in</>
              }
            </motion.button>
          )}
        </div>

        {/* All answered hint */}
        {allAnswered && currentQ < total - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: "1.25rem", padding: "0.875rem 1.25rem",
              backgroundColor: "color-mix(in srgb, var(--sage) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--sage) 22%, transparent)",
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--sage)", fontWeight: 500 }}>
              All questions answered — ready to submit!
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                ...sans, height: 34, padding: "0 1rem", borderRadius: 8,
                background: "linear-gradient(135deg, #325944, #5D8A6B)",
                color: "white", fontSize: "0.8125rem", fontWeight: 600,
                border: "none", cursor: "pointer",
              }}
            >
              {submitting ? "Submitting…" : "Submit now"}
            </button>
          </motion.div>
        )}
      </div>
    </Shell>
  )
}
