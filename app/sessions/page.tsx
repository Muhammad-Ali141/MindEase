"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiGetRecentSessions, apiToggleSessionStar, type SessionPreview } from "@/lib/api"
import { getSessionsCache, setSessionsCache } from "@/lib/cache"
import { MessageCircle, Star, Mic2, BookOpen, Download, Loader2, CheckSquare, Square, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useProfileDict } from "@/lib/i18n"
import {
  exportPreviewsToPdfFile,
  exportSinglePreviewToPdfFile,
  anyTranscriptsAvailable,
} from "@/lib/export-sessions"
import { BeamsBackground } from "@/components/ui/beams-background"
import { motion, AnimatePresence } from "framer-motion"

const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }

type Group = { label: string; sessions: SessionPreview[] }

export default function SessionsPage() {
  const router   = useRouter()
  const { user } = useAuth()
  const cached = user?.id ? getSessionsCache(user.id) : null
  const [sessions, setSessions]       = useState<SessionPreview[]>(cached?.data.sessions ?? [])
  const [loading, setLoading]         = useState(!cached)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"all" | "starred" | "voice" | "text">("all")
  const { toast } = useToast()
  const t = useProfileDict()
  const [exporting, setExporting] = useState(false)
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null)

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Transcript modal state
  const [transcriptModal, setTranscriptModal] = useState<{
    previews: SessionPreview[]
    hasTranscripts: boolean
  } | null>(null)

  useEffect(() => {
    if (user?.id) loadAllSessions()
  }, [user?.id])

  const loadAllSessions = async () => {
    if (!user?.id) return
    try {
      if (!cached) setLoading(true)
      const response = await apiGetRecentSessions(user.id, 0)
      setSessions(response.sessions)
      setSessionsCache(user.id, response)
    } catch {
      if (!cached) setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSessionClick = (session: SessionPreview) => {
    if (selectMode) {
      toggleSelect(session.session_id)
      return
    }
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

  const displayNameForExport = () =>
    user ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email || null : null

  // ── Multi-select helpers ──────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSessions.map(s => s.session_id)))
    }
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  // ── Export flow with transcript prompt ────────────────────────────────────
  const promptAndExport = (previews: SessionPreview[]) => {
    if (previews.length === 0) {
      toast({ title: t.exportSessionsEmpty, variant: "destructive" })
      return
    }
    const hasTranscripts = anyTranscriptsAvailable(previews)
    if (hasTranscripts) {
      setTranscriptModal({ previews, hasTranscripts })
    } else {
      // No transcripts available — export without asking
      void doExport(previews, false)
    }
  }

  const doExport = async (previews: SessionPreview[], includeTranscript: boolean) => {
    if (!user?.id) return
    try {
      setExporting(true)
      if (previews.length === 1) {
        await exportSinglePreviewToPdfFile(user.id, previews[0], displayNameForExport(), includeTranscript)
      } else {
        await exportPreviewsToPdfFile(user.id, previews, displayNameForExport(), includeTranscript)
      }
      toast({ title: t.exportSessionsSuccess })
      exitSelectMode()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({
        title: t.exportSessionsError,
        description: msg === "NO_SESSIONS" ? t.exportSessionsEmpty : msg,
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExportFiltered = () => {
    promptAndExport(filteredSessions)
  }

  const handleExportSelected = () => {
    const selected = filteredSessions.filter(s => selectedIds.has(s.session_id))
    promptAndExport(selected)
  }

  const handleExportSession = (session: SessionPreview) => {
    promptAndExport([session])
  }

  const handleTranscriptChoice = (include: boolean) => {
    if (!transcriptModal) return
    const { previews } = transcriptModal
    setTranscriptModal(null)
    void doExport(previews, include)
  }

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

  const anyBusy = exporting || exportingSessionId !== null

  return (
    <AuthGuard>
      <div data-page-root style={{ position: "fixed", inset: 0, display: "flex", width: "100vw", height: "100vh", zIndex: 50, overflow: "hidden" }}>

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
                              backgroundColor: isActive ? "var(--card)" : "var(--muted)",
                              border: isActive ? `1.5px solid ${s.accent}` : "1px solid var(--border)",
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

                  {/* Action buttons row */}
                  {!loading && filteredSessions.length > 0 && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                      {/* Download All / Download Selected */}
                      {!selectMode ? (
                        <>
                          <ActionButton
                            onClick={handleExportFiltered}
                            disabled={anyBusy}
                            busy={exporting}
                            icon={<Download size={14} />}
                            label={exporting ? t.exportSessionsLoading : t.exportSessions}
                            title={t.exportSessionsTitle}
                          />
                          <ActionButton
                            onClick={() => setSelectMode(true)}
                            disabled={anyBusy}
                            icon={<CheckSquare size={14} />}
                            label={t.selectSessions}
                          />
                        </>
                      ) : (
                        <>
                          <ActionButton
                            onClick={handleExportSelected}
                            disabled={anyBusy || selectedIds.size === 0}
                            busy={exporting}
                            icon={<Download size={14} />}
                            label={exporting ? t.exportSessionsLoading : `${t.exportSelected} (${selectedIds.size})`}
                            title={t.exportSelectedTitle}
                            accent
                          />
                          <ActionButton
                            onClick={toggleSelectAll}
                            disabled={anyBusy}
                            icon={selectedIds.size === filteredSessions.length
                              ? <CheckSquare size={14} />
                              : <Square size={14} />}
                            label={selectedIds.size === filteredSessions.length ? t.deselectAll : t.selectAll}
                          />
                          <ActionButton
                            onClick={exitSelectMode}
                            disabled={anyBusy}
                            icon={<X size={14} />}
                            label={t.cancelSelect}
                          />
                          {selectedIds.size > 0 && (
                            <span style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                              {selectedIds.size} {t.sessionsSelected}
                            </span>
                          )}
                        </>
                      )}
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
                              onDownload={() => handleExportSession(session)}
                              downloadLocked={anyBusy}
                              downloadActive={exportingSessionId === session.session_id}
                              formatDate={formatDate}
                              selectMode={selectMode}
                              selected={selectedIds.has(session.session_id)}
                              onToggleSelect={() => toggleSelect(session.session_id)}
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

        {/* ── Transcript prompt modal ────────────────────────────── */}
        <AnimatePresence>
          {transcriptModal && (
            <TranscriptModal
              t={t}
              onInclude={() => handleTranscriptChoice(true)}
              onExclude={() => handleTranscriptChoice(false)}
              onCancel={() => setTranscriptModal(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </AuthGuard>
  )
}

// ── Reusable action button ──────────────────────────────────────────────────

function ActionButton({
  onClick, disabled, busy, icon, label, title, accent,
}: {
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  icon: React.ReactNode
  label: string
  title?: string
  accent?: boolean
}) {
  const sans2 = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...sans2,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: accent ? "var(--primary)" : "var(--foreground)",
        background: "color-mix(in srgb, var(--muted) 40%, transparent)",
        border: accent ? "1.5px solid color-mix(in srgb, var(--primary) 45%, transparent)" : "1px solid var(--border)",
        borderRadius: 10,
        padding: "0.45rem 0.9rem",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !busy ? 0.5 : 1,
        transition: "border-color 0.15s ease, color 0.15s ease",
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 45%, transparent)"
          e.currentTarget.style.color = "var(--primary)"
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = accent ? "color-mix(in srgb, var(--primary) 45%, transparent)" : "var(--border)"
        e.currentTarget.style.color = accent ? "var(--primary)" : "var(--foreground)"
      }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

// ── Transcript prompt modal ─────────────────────────────────────────────────

function TranscriptModal({
  t, onInclude, onExclude, onCancel,
}: {
  t: ReturnType<typeof useProfileDict>
  onInclude: () => void
  onExclude: () => void
  onCancel: () => void
}) {
  const sans2 = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22 }}
        style={{
          ...sans2,
          width: "min(420px, 92vw)",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          padding: "1.75rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.5rem" }}>
          {t.transcriptModalTitle}
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          {t.transcriptModalDesc}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            onClick={onInclude}
            style={{
              ...sans2, width: "100%", padding: "0.65rem 1rem", borderRadius: 10,
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              backgroundColor: "var(--primary)", color: "#fff", border: "none",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.88" }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1" }}
          >
            {t.transcriptModalYes}
          </button>
          <button
            onClick={onExclude}
            style={{
              ...sans2, width: "100%", padding: "0.65rem 1rem", borderRadius: 10,
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              backgroundColor: "var(--muted)", color: "var(--foreground)",
              border: "1px solid var(--border)",
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 45%, transparent)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)" }}
          >
            {t.transcriptModalNo}
          </button>
          <button
            onClick={onCancel}
            style={{
              ...sans2, width: "100%", padding: "0.5rem 1rem", borderRadius: 10,
              fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
              backgroundColor: "transparent", color: "var(--muted-foreground)",
              border: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)" }}
          >
            {t.transcriptModalCancel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Session card ─────────────────────────────────────────────────────────────

const sans2 = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

function SessionCard({
  session, index, onOpen, onStar, onDownload, downloadLocked, downloadActive, formatDate,
  selectMode, selected, onToggleSelect,
}: {
  session: SessionPreview
  index: number
  onOpen: () => void
  onStar: () => void
  onDownload: () => void
  downloadLocked: boolean
  downloadActive: boolean
  formatDate: (d: string) => string
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const t = useProfileDict()
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
        backgroundColor: "var(--card)",
        border: `1px solid ${
          selected ? "color-mix(in srgb, var(--primary) 50%, transparent)"
          : starred ? "color-mix(in srgb, #e8a030 30%, transparent)"
          : "var(--border)"
        }`,
        boxShadow: selected
          ? "0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent)"
          : starred ? "0 2px 12px rgba(232,160,48,0.07)" : "0 1px 6px rgba(0,0,0,0.04)",
        transition: "border-color 0.18s ease, box-shadow 0.18s ease",
        cursor: selectMode ? "pointer" : undefined,
      } as React.CSSProperties}
      onClick={selectMode ? onToggleSelect : undefined}
      onMouseEnter={e => {
        if (selectMode) return
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = starred ? "color-mix(in srgb, #e8a030 50%, transparent)" : "color-mix(in srgb, var(--primary) 35%, transparent)"
        el.style.boxShadow = "0 4px 18px rgba(166,124,82,0.1)"
      }}
      onMouseLeave={e => {
        if (selectMode) return
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = starred ? "color-mix(in srgb, #e8a030 30%, transparent)" : "var(--border)"
        el.style.boxShadow = starred ? "0 2px 12px rgba(232,160,48,0.07)" : "0 1px 6px rgba(0,0,0,0.04)"
      }}
    >
      {/* Checkbox in select mode */}
      {selectMode && (
        <div style={{ flexShrink: 0, color: selected ? "var(--primary)" : "var(--muted-foreground)" }}>
          {selected
            ? <CheckSquare size={20} strokeWidth={1.75} />
            : <Square size={20} strokeWidth={1.75} />
          }
        </div>
      )}

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
        onClick={selectMode ? undefined : onOpen}
        style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: selectMode ? "pointer" : "pointer", textAlign: "left" }}
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

      {/* Action buttons (hidden in select mode) */}
      {!selectMode && (
        <>
          {/* Download this session */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDownload() }}
            title={t.exportOneSessionTitle}
            disabled={downloadLocked}
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 9,
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: downloadLocked && !downloadActive ? "default" : "pointer",
              transition: "border-color 0.15s ease, color 0.15s ease",
              color: "var(--muted-foreground)",
              opacity: downloadLocked && !downloadActive ? 0.45 : 1,
            } as React.CSSProperties}
            onMouseEnter={e => {
              if (!downloadLocked || downloadActive) {
                e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 45%, transparent)"
                e.currentTarget.style.color = "var(--primary)"
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.color = "var(--muted-foreground)"
            }}
          >
            {downloadActive ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} strokeWidth={1.75} />
            )}
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
        </>
      )}
    </motion.div>
  )
}
