"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiGetRecentSessions, apiToggleSessionStar, type SessionPreview } from "@/lib/api"
import { MessageCircle, Star, Mic2, BookOpen } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { BeamsBackground } from "@/components/ui/beams-background"
import { motion } from "framer-motion"

const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }

type Group = { label: string; sessions: SessionPreview[] }

export default function SessionsPage() {
  const router   = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions]       = useState<SessionPreview[]>([])
  const [loading, setLoading]         = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"all" | "starred" | "voice" | "text">("all")
  const { toast } = useToast()

  useEffect(() => {
    if (user?.id) loadAllSessions()
  }, [user?.id])

  const loadAllSessions = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const response = await apiGetRecentSessions(user.id, 0)
      setSessions(response.sessions)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSessionClick = (session: SessionPreview) => {
    if (session.has_voice) {
      router.push(`/voice-chat?session_id=${session.session_id}`)
    } else {
      router.push(`/chat?session_id=${session.session_id}`)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now   = new Date()
      const diffMs   = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays === 0) {
        const h = Math.floor(diffMs / (1000 * 60 * 60))
        if (h === 0) return "Just now"
        return h === 1 ? "1 hour ago" : `${h} hours ago`
      }
      if (diffDays === 1) return "Yesterday"
      if (diffDays < 7)  return `${diffDays} days ago`
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(diffDays > 365 ? { year: "numeric" } : {}) })
    } catch {
      return "Recent"
    }
  }

  const filteredSessions = useMemo(() => {
    if (activeFilter === "starred") return sessions.filter(s => s.is_starred)
    if (activeFilter === "voice")   return sessions.filter(s => s.has_voice)
    if (activeFilter === "text")    return sessions.filter(s => !s.has_voice)
    return sessions
  }, [sessions, activeFilter])

  const grouped = useMemo<Group[]>(() => {
    const today: SessionPreview[]     = []
    const yesterday: SessionPreview[] = []
    const thisWeek: SessionPreview[]  = []
    const earlier: SessionPreview[]   = []
    const now = new Date()
    filteredSessions.forEach(s => {
      const diff = Math.floor((now.getTime() - new Date(s.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      if (diff === 0)       today.push(s)
      else if (diff === 1)  yesterday.push(s)
      else if (diff < 7)    thisWeek.push(s)
      else                  earlier.push(s)
    })
    const groups: Group[] = []
    if (today.length)     groups.push({ label: "Today",     sessions: today })
    if (yesterday.length) groups.push({ label: "Yesterday", sessions: yesterday })
    if (thisWeek.length)  groups.push({ label: "This Week", sessions: thisWeek })
    if (earlier.length)   groups.push({ label: "Earlier",   sessions: earlier })
    return groups
  }, [filteredSessions])

  const stats = useMemo(() => ({
    total:   sessions.length,
    starred: sessions.filter(s => s.is_starred).length,
    voice:   sessions.filter(s => s.has_voice).length,
    text:    sessions.filter(s => !s.has_voice).length,
  }), [sessions])

  const toggleStar = async (session: SessionPreview) => {
    if (!user) return
    if (session.state !== "full" && !session.is_starred) {
      toast({ title: "Cannot star session", description: "Archived sessions cannot be starred.", variant: "destructive" })
      return
    }
    try {
      const response = await apiToggleSessionStar(user.id, session.session_id, !session.is_starred)
      setSessions(prev => prev.map(item =>
        item.session_id === session.session_id ? { ...item, ...response.session } : item
      ))
      toast({
        title: response.session.is_starred ? "Session starred" : "Session unstarred",
        description: response.session.is_starred
          ? "We'll keep this session available in detail for you."
          : "This session may be archived if newer sessions are created.",
      })
    } catch (error: any) {
      toast({ title: "Unable to update session", description: error.message || "Please try again later.", variant: "destructive" })
    }
  }

  return (
    <AuthGuard>
      <div style={{ position: "fixed", inset: 0, display: "flex", width: "100vw", height: "100vh", zIndex: 50, overflow: "hidden" }}>

        {/* Background */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <BeamsBackground isDark intensity="subtle" />
          <div style={{ position: "absolute", inset: 0, backgroundColor: "color-mix(in srgb, var(--background) 72%, transparent)" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, display: "flex", width: "100%", height: "100%" }}>
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Header />

            <div style={{ flex: 1, overflowY: "auto", padding: "1.75rem 2rem 2.5rem" }}>
              <div style={{ maxWidth: 860, margin: "0 auto" }}>

                {/* ── Page header ─────────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  style={{ marginBottom: "1.75rem" }}
                >
                  <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.4rem" }}>
                    Your journey
                  </p>
                  <h1 style={{ ...serif, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1.1, marginBottom: "1rem" }}>
                    Session History
                  </h1>

                  {/* Stats chips — click to filter */}
                  {!loading && sessions.length > 0 && (
                    <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
                      {([
                        { label: "Sessions", value: stats.total,   accent: "var(--primary)", filter: "all"     as const },
                        { label: "Starred",  value: stats.starred, accent: "#e8a030",        filter: "starred" as const },
                        { label: "Voice",    value: stats.voice,   accent: "var(--sage)",    filter: "voice"   as const },
                        { label: "Text",     value: stats.text,    accent: "var(--muted-foreground)", filter: "text" as const },
                      ]).map((s, i) => {
                        const isActive = activeFilter === s.filter
                        return (
                          <motion.button
                            key={s.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.22, delay: i * 0.05 }}
                            onClick={() => setActiveFilter(isActive ? "all" : s.filter)}
                            style={{
                              ...sans, display: "flex", alignItems: "center", gap: "0.45rem",
                              padding: "0.4rem 0.875rem", borderRadius: 100,
                              backgroundColor: isActive ? "color-mix(in srgb, var(--card) 95%, transparent)" : "color-mix(in srgb, var(--card) 85%, transparent)",
                              border: isActive ? `1.5px solid ${s.accent}` : "1px solid var(--border)",
                              backdropFilter: "blur(12px)",
                              cursor: "pointer",
                              boxShadow: isActive ? `0 0 0 3px color-mix(in srgb, ${s.accent} 14%, transparent)` : "none",
                              transition: "border 0.15s ease, box-shadow 0.15s ease",
                            }}
                          >
                            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: s.accent }}>{s.value}</span>
                            <span style={{ fontSize: "0.75rem", color: isActive ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: isActive ? 600 : 400 }}>
                              {s.label}
                            </span>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                </motion.div>

                {/* ── Content ─────────────────────────────────────── */}
                {loading ? (
                  <div style={{ ...sans, textAlign: "center", padding: "5rem 0", color: "var(--muted-foreground)", fontSize: "0.9375rem" }}>
                    Loading sessions…
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      textAlign: "center", padding: "5rem 2rem", borderRadius: 20,
                      backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
                      border: "1px solid var(--border)", backdropFilter: "blur(12px)",
                    }}
                  >
                    <div style={{
                      width: 56, height: 56, borderRadius: 14, margin: "0 auto 1rem",
                      background: "linear-gradient(135deg, #7a5535, #a67c52)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 16px rgba(166,124,82,0.25)",
                    }}>
                      <BookOpen size={24} color="rgba(255,255,255,0.9)" strokeWidth={1.5} />
                    </div>
                    <p style={{ ...sans, fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.4rem" }}>
                      {sessions.length === 0 ? "No sessions yet" : `No ${activeFilter} sessions`}
                    </p>
                    <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                      {sessions.length === 0 ? "Your session history will appear here after your first chat." : "Try a different filter above."}
                    </p>
                  </motion.div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {grouped.map((group, gi) => (
                      <motion.div
                        key={group.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: gi * 0.07 }}
                      >
                        {/* Group label */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
                          <p style={{ ...sans, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted-foreground)", flexShrink: 0 }}>
                            {group.label}
                          </p>
                          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)", opacity: 0.45 }} />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                          {group.sessions.map((session, si) => (
                            <SessionCard
                              key={session.session_id}
                              session={session}
                              index={si}
                              onOpen={() => handleSessionClick(session)}
                              onStar={() => toggleStar(session)}
                              formatDate={formatDate}
                            />
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}

// ── Session card ─────────────────────────────────────────────────────────────

const sans2 = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

function SessionCard({
  session, index, onOpen, onStar, formatDate,
}: {
  session: SessionPreview
  index: number
  onOpen: () => void
  onStar: () => void
  formatDate: (d: string) => string
}) {
  const starred     = session.is_starred
  const isVoice     = session.has_voice
  const summary     = session.short_summary || session.summary

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      style={{
        ...sans2,
        display: "flex", alignItems: "center", gap: "0.875rem",
        padding: "0.875rem 1rem",
        borderRadius: 14,
        backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
        border: `1px solid ${starred ? "color-mix(in srgb, #e8a030 30%, transparent)" : "var(--border)"}`,
        backdropFilter: "blur(12px)",
        boxShadow: starred ? "0 2px 12px rgba(232,160,48,0.07)" : "0 1px 6px rgba(0,0,0,0.04)",
        transition: "border-color 0.18s ease, box-shadow 0.18s ease",
      } as React.CSSProperties}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = starred ? "color-mix(in srgb, #e8a030 50%, transparent)" : "color-mix(in srgb, var(--primary) 35%, transparent)"
        el.style.boxShadow = "0 4px 18px rgba(166,124,82,0.1)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = starred ? "color-mix(in srgb, #e8a030 30%, transparent)" : "var(--border)"
        el.style.boxShadow = starred ? "0 2px 12px rgba(232,160,48,0.07)" : "0 1px 6px rgba(0,0,0,0.04)"
      }}
    >
      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
        background: isVoice ? "linear-gradient(135deg, #325944, #5D8A6B)" : "linear-gradient(135deg, #7a5535, #a67c52)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: isVoice ? "0 3px 10px rgba(93,138,107,0.28)" : "0 3px 10px rgba(166,124,82,0.28)",
      }}>
        {isVoice
          ? <Mic2 size={18} color="rgba(255,255,255,0.92)" strokeWidth={1.75} />
          : <MessageCircle size={18} color="rgba(255,255,255,0.92)" strokeWidth={1.75} />
        }
      </div>

      {/* Main content */}
      <button
        onClick={onOpen}
        style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
          <span style={{ ...sans2, fontSize: "0.9375rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.title}
          </span>
          <span style={{
            ...sans2, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.07em", flexShrink: 0,
            padding: "0.15rem 0.5rem", borderRadius: 100,
            backgroundColor: isVoice ? "color-mix(in srgb, var(--sage) 15%, transparent)" : "color-mix(in srgb, var(--primary) 12%, transparent)",
            color: isVoice ? "var(--sage)" : "var(--primary)",
            textTransform: "uppercase",
          } as React.CSSProperties}>
            {isVoice ? "Voice" : "Text"}
          </span>
          {starred && (
            <Star size={11} fill="#e8a030" color="#e8a030" strokeWidth={0} style={{ flexShrink: 0 }} />
          )}
          {!session.has_full_transcript && (
            <span style={{ ...sans2, fontSize: "0.5625rem", color: "var(--muted-foreground)", opacity: 0.6, flexShrink: 0 }}>
              Summary only
            </span>
          )}
        </div>

        {summary && (
          <p style={{
            ...sans2, fontSize: "0.8125rem", color: "var(--muted-foreground)", lineHeight: 1.55,
            marginBottom: "0.3rem",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
            {summary}
          </p>
        )}

        <span style={{ ...sans2, fontSize: "0.6875rem", color: "var(--muted-foreground)", opacity: 0.6 }}>
          {formatDate(session.updated_at)}
        </span>
      </button>

      {/* Star button */}
      <button
        onClick={e => { e.stopPropagation(); onStar() }}
        title={starred ? "Unstar" : "Star this session"}
        style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 9,
          border: `1px solid ${starred ? "color-mix(in srgb, #e8a030 45%, transparent)" : "var(--border)"}`,
          backgroundColor: starred ? "color-mix(in srgb, #e8a030 12%, transparent)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.15s ease",
          color: starred ? "#e8a030" : "var(--muted-foreground)",
        } as React.CSSProperties}
        onMouseEnter={e => {
          if (!starred) {
            e.currentTarget.style.borderColor = "color-mix(in srgb, #e8a030 38%, transparent)"
            e.currentTarget.style.color = "#e8a030"
          } else {
            e.currentTarget.style.opacity = "0.75"
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.opacity = "1"
          if (!starred) {
            e.currentTarget.style.borderColor = "var(--border)"
            e.currentTarget.style.color = "var(--muted-foreground)"
          }
        }}
      >
        <Star size={15} strokeWidth={1.75} fill={starred ? "currentColor" : "none"} style={{ color: "inherit" }} />
      </button>
    </motion.div>
  )
}
