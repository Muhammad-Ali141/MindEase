"use client"

import { MessageCircle, Mic2, Zap, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { apiGetDiagnosticTestStatus } from "@/lib/api"
import { useState } from "react"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export function TherapyOptions() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleStartCheckin = async () => {
    if (!user?.id) { router.push("/diagnostic-test/generic-screening"); return }
    try {
      setLoading(true)
      const status = await apiGetDiagnosticTestStatus(user.id)
      router.push(status.available_test ? `/diagnostic-test/${status.available_test}` : "/diagnostic-test")
    } catch {
      router.push("/diagnostic-test/generic-screening")
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    {
      tourTarget: "quick-check-in",
      primary: true,
      icon: <Zap size={20} strokeWidth={2} />,
      eyebrow: "DAILY WELLNESS",
      title: "Quick\nCheck-in",
      desc: "Track your mood with a brief daily assessment",
      action: handleStartCheckin,
      label: loading ? "Loading…" : "Start Check-in",
      disabled: loading,
      bg: "linear-gradient(140deg, #7a5535 0%, #a67c52 60%, #8b6745 100%)",
      ring: "rgba(166,124,82,0.22)",
      shine: "rgba(255,220,160,0.07)",
    },
    {
      tourTarget: "text-chat",
      primary: false,
      icon: <MessageCircle size={18} strokeWidth={2} />,
      eyebrow: "AI COMPANION",
      title: "Text\nChat",
      desc: "Thoughtful conversation with your AI therapist",
      action: () => router.push("/chat"),
      label: "Start Chat",
      disabled: false,
      bg: "linear-gradient(140deg, #2d5040 0%, #4f7d60 60%, #375e49 100%)",
      ring: "rgba(79,125,96,0.2)",
      shine: "rgba(160,230,190,0.06)",
    },
    {
      tourTarget: "voice-chat",
      primary: false,
      icon: <Mic2 size={18} strokeWidth={2} />,
      eyebrow: "VOICE SESSION",
      title: "Voice\nCall",
      desc: "Natural spoken conversation, hands-free",
      action: () => router.push("/voice-chat"),
      label: "Start Call",
      disabled: false,
      bg: "linear-gradient(140deg, #1a130d 0%, #2e2016 60%, #231812 100%)",
      ring: "rgba(166,124,82,0.12)",
      shine: "rgba(255,200,120,0.045)",
    },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.125rem" }}>
      {cards.map((c) => (
        <div
          key={c.tourTarget}
          data-tour-target={c.tourTarget}
          style={{
            position: "relative", overflow: "hidden",
            borderRadius: 18,
            padding: c.primary ? "1.75rem 1.5rem" : "1.5rem 1.375rem",
            background: c.bg,
            boxShadow: `0 5px 18px ${c.ring}, 0 1px 4px rgba(0,0,0,0.1)`,
            border: `1px solid ${c.primary ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`,
            cursor: "pointer",
          }}
        >
          {/* Decorative ring */}
          <div style={{
            position: "absolute", top: -50, right: -50, width: 160, height: 160,
            borderRadius: "50%", border: `1px solid ${c.primary ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"}`,
          }} />
          {/* Diffuse glow blobs — kept subtle */}
          <div style={{
            position: "absolute", top: -20, right: -20, width: 80, height: 80,
            borderRadius: "50%", backgroundColor: c.shine, filter: "blur(28px)",
          }} />
          <div style={{
            position: "absolute", bottom: -25, left: -25, width: 90, height: 90,
            borderRadius: "50%", backgroundColor: c.shine, filter: "blur(32px)",
          }} />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Icon bubble */}
            <div style={{
              width: c.primary ? 42 : 38, height: c.primary ? 42 : 38,
              borderRadius: 11, marginBottom: "1.125rem",
              backgroundColor: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.13)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.85)",
            }}>
              {c.icon}
            </div>

            {/* Eyebrow */}
            <p style={{
              ...sans, fontSize: "0.5625rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.52)", marginBottom: "0.3rem",
            }}>
              {c.eyebrow}
            </p>

            {/* Title */}
            <h3 style={{
              ...serif,
              fontSize: c.primary ? "clamp(1.5rem,2.2vw,1.875rem)" : "clamp(1.375rem,2vw,1.625rem)",
              fontWeight: 400,
              letterSpacing: "-0.025em", color: "rgba(255,255,255,0.95)",
              lineHeight: 1.1, marginBottom: "0.5rem", whiteSpace: "pre-line",
            }}>
              {c.title}
            </h3>

            {/* Desc */}
            <p style={{
              ...sans,
              fontSize: c.primary ? "0.78125rem" : "0.75rem",
              color: c.primary ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.5)",
              lineHeight: 1.6, marginBottom: "1.25rem",
            }}>
              {c.desc}
            </p>

            {/* CTA */}
            <button
              onClick={c.action}
              disabled={c.disabled}
              style={{
                ...sans,
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                height: c.primary ? 38 : 34, padding: "0 0.9rem", borderRadius: 100,
                backgroundColor: c.primary ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.1)",
                border: `1px solid ${c.primary ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.14)"}`,
                color: c.primary ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)",
                fontSize: "0.78125rem", fontWeight: 600,
                cursor: c.disabled ? "not-allowed" : "pointer",
                opacity: c.disabled ? 0.6 : 1,
                transition: "background-color 0.18s ease",
              }}
              onMouseEnter={e => { if (!c.disabled) e.currentTarget.style.backgroundColor = c.primary ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.17)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = c.primary ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.1)" }}
            >
              {c.label}
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
