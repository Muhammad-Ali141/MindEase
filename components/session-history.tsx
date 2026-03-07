"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { apiGetRecentSessions, apiToggleSessionStar, type SessionPreview } from "@/lib/api"
import { MessageCircle, Star, Mic2, ArrowRight, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export function SessionHistory() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [loading, setLoading]   = useState(true)
  const { toast } = useToast()

  useEffect(() => { if (user?.id) loadRecentSessions() }, [user?.id])

  const loadRecentSessions = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const res = await apiGetRecentSessions(user.id, 5)
      setSessions(res.sessions)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSessionClick = (s: SessionPreview) => {
    router.push(s.has_voice ? `/voice-chat?session_id=${s.session_id}` : `/chat?session_id=${s.session_id}`)
  }

  const formatDate = (d: string) => {
    try {
      const date = new Date(d), now = new Date()
      const diff = Math.floor(Math.abs(now.getTime() - date.getTime()) / 86400000)
      if (diff === 0) return "Today"
      if (diff === 1) return "Yesterday"
      if (diff < 7) return `${diff}d ago`
      return date.toLocaleDateString()
    } catch { return "Recent" }
  }

  const toggleStar = async (s: SessionPreview) => {
    if (!user) return
    if (s.state !== "full" && !s.is_starred) {
      toast({ title: "Cannot star session", description: "Archived sessions cannot be starred.", variant: "destructive" })
      return
    }
    try {
      const res = await apiToggleSessionStar(user.id, s.session_id, !s.is_starred)
      setSessions(prev => prev.map(item => item.session_id === s.session_id ? { ...item, ...res.session } : item))
      toast({ title: res.session.is_starred ? "Session starred" : "Session unstarred" })
    } catch (e: any) {
      toast({ title: "Unable to update session", description: e.message, variant: "destructive" })
    }
  }

  return (
    <div
      data-tour-target="recent-sessions"
      style={{
        ...sans,
        backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
        backdropFilter: "blur(8px)",
        borderRadius: 16, border: "1px solid var(--border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "1.125rem 1.375rem 0.875rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.2rem" }}>
              History
            </p>
            <h2 style={{ ...serif, fontSize: "1.25rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
              Recent Sessions
            </h2>
          </div>
          <button
            onClick={() => router.push("/sessions")}
            style={{
              ...sans, display: "flex", alignItems: "center", gap: "0.25rem",
              fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)",
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            View all <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>Loading…</p>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.375rem" }}>
            <Clock size={28} style={{ color: "var(--muted-foreground)", marginBottom: "0.75rem" }} />
            <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>No sessions yet</p>
            <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem", opacity: 0.7 }}>Your history will appear here</p>
          </div>
        ) : (
          sessions.map((s, idx) => (
            <div
              key={s.session_id}
              style={{
                flex: 1,
                borderTop: idx > 0 ? "1px solid var(--border)" : "none",
              }}
            >
              {/* Row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSessionClick(s)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSessionClick(s) } }}
                style={{
                  height: "100%",
                  display: "grid",
                  gridTemplateColumns: "30px 1.7fr 1fr auto",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0 1.125rem",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                  boxSizing: "border-box",
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--muted) 40%, transparent)"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                {/* Icon */}
                <div style={{
                  width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: s.has_voice
                    ? "linear-gradient(135deg, #325944, #5D8A6B)"
                    : "linear-gradient(135deg, #7a5535, #a67c52)",
                }}>
                  {s.has_voice
                    ? <Mic2 size={13} color="white" />
                    : <MessageCircle size={13} color="white" />}
                </div>

                {/* Title + badge */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ ...sans, fontSize: "0.84375rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </span>
                    <span style={{
                      ...sans, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.07em",
                      textTransform: "uppercase", padding: "0.1rem 0.35rem", borderRadius: 3, flexShrink: 0,
                      backgroundColor: s.has_voice ? "color-mix(in srgb, var(--sage) 15%, transparent)" : "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: s.has_voice ? "var(--sage)" : "var(--primary)",
                    }}>
                      {s.has_voice ? "Voice" : "Text"}
                    </span>
                  </div>
                  <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.1rem" }}>
                    {formatDate(s.updated_at)}
                    {!s.has_full_transcript && <span style={{ color: "#d97706", marginLeft: "0.3rem" }}>· Summary only</span>}
                  </p>
                </div>

                {/* Summary */}
                <p style={{
                  ...sans, fontSize: "0.71875rem", color: "var(--muted-foreground)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  minWidth: 0, opacity: 0.85,
                }}>
                  {s.short_summary || s.summary || "—"}
                </p>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); toggleStar(s) }}
                    style={{
                      width: 24, height: 24, borderRadius: 5,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backgroundColor: s.is_starred ? "color-mix(in srgb, #f59e0b 12%, transparent)" : "transparent",
                      border: `1px solid ${s.is_starred ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
                      cursor: "pointer", color: s.is_starred ? "#f59e0b" : "var(--muted-foreground)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Star size={10} strokeWidth={1.75} fill={s.is_starred ? "currentColor" : "none"} />
                  </button>
                  <div style={{ width: 24, height: 24, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", opacity: 0.6 }}>
                    <ArrowRight size={12} />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
