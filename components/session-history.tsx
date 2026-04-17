"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useDashboardData } from "@/context/DashboardDataContext"
import { apiToggleSessionStar, type SessionPreview } from "@/lib/api"
import { exportPreviewsToPdfFile, exportSinglePreviewToPdfFile } from "@/lib/export-sessions"
import { MessageCircle, Star, Mic2, ArrowRight, ArrowLeft, Clock, Download, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useProfileDict, useProfileLanguage } from "@/lib/i18n"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export function SessionHistory() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useProfileDict()
  const lang = useProfileLanguage()
  const isUr = lang === "ur"
  const { loading, sessions, patchSession } = useDashboardData()
  const [exporting, setExporting] = useState(false)
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSessionClick = (s: SessionPreview) => {
    router.push(s.has_voice ? `/voice-chat?session_id=${s.session_id}` : `/chat?session_id=${s.session_id}`)
  }

  const formatDate = (d: string) => {
    try {
      const date = new Date(d), now = new Date()
      const diff = Math.floor(Math.abs(now.getTime() - date.getTime()) / 86400000)
      if (diff === 0) return t.today
      if (diff === 1) return t.yesterday
      if (diff < 7) return `${diff}${t.daysAgo}`
      return date.toLocaleDateString()
    } catch { return t.recent }
  }

  const displayNameForExport = () =>
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || null

  const handleExportOne = async (s: SessionPreview) => {
    if (!user?.id) return
    try {
      setExportingSessionId(s.session_id)
      await exportSinglePreviewToPdfFile(user.id, s, displayNameForExport())
      toast({ title: t.exportSessionsSuccess })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({
        title: t.exportSessionsError,
        description: msg === "NO_SESSIONS" ? t.exportSessionsEmpty : msg,
        variant: "destructive",
      })
    } finally {
      setExportingSessionId(null)
    }
  }

  const handleExportRecent = async () => {
    if (!user?.id || sessions.length === 0) {
      toast({ title: t.exportSessionsEmpty, variant: "destructive" })
      return
    }
    try {
      setExporting(true)
      await exportPreviewsToPdfFile(user.id, sessions, displayNameForExport())
      toast({ title: t.exportSessionsSuccess })
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

  const toggleStar = async (s: SessionPreview) => {
    if (!user) return
    if (s.state !== "full" && !s.is_starred) {
      toast({ title: t.cannotStarSession, description: t.archivedCannotStar, variant: "destructive" })
      return
    }
    try {
      const res = await apiToggleSessionStar(user.id, s.session_id, !s.is_starred)
      patchSession(s.session_id, res.session)
      toast({ title: res.session.is_starred ? t.sessionStarred : t.sessionUnstarred })
    } catch (e: any) {
      toast({ title: t.unableToUpdateSession, description: (e as Error).message, variant: "destructive" })
    }
  }

  return (
    <div
      data-tour-target="recent-sessions"
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.2rem" }}>
              {t.history}
            </p>
            <h2 style={{ ...serif, fontSize: "1.25rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
              {t.recentSessions}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <button
              type="button"
              title={t.exportSessionsTitle}
              disabled={loading || sessions.length === 0 || exporting || exportingSessionId !== null}
              onClick={e => { e.preventDefault(); void handleExportRecent() }}
              style={{
                ...sans, display: "flex", alignItems: "center", gap: "0.25rem",
                fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground)",
                background: "color-mix(in srgb, var(--muted) 45%, transparent)",
                border: "1px solid var(--border)", borderRadius: 8, padding: "0.35rem 0.65rem",
                cursor: loading || sessions.length === 0 || exporting || exportingSessionId !== null ? "default" : "pointer",
                opacity: loading || sessions.length === 0 || exportingSessionId !== null ? 0.5 : 1,
                transition: "border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
              }}
              onMouseEnter={e => {
                if (!loading && sessions.length > 0 && !exporting && !exportingSessionId) {
                  e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 45%, transparent)"
                  e.currentTarget.style.color = "var(--primary)"
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--border)"
                e.currentTarget.style.color = "var(--foreground)"
              }}
            >
              {isUr ? (
                <>
                  {exporting ? t.exportSessionsLoading : t.exportSessions}
                  {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                </>
              ) : (
                <>
                  {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {exporting ? t.exportSessionsLoading : t.exportSessions}
                </>
              )}
            </button>
            <button
              onClick={() => router.push("/sessions")}
              style={{
                ...sans, display: "flex", alignItems: "center", gap: "0.25rem",
                fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              {t.viewAll} {isUr ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>{t.loading}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.375rem" }}>
            <Clock size={28} style={{ color: "var(--muted-foreground)", marginBottom: "0.75rem" }} />
            <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>{t.noSessionsYet}</p>
            <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem", opacity: 0.7 }}>{t.startConversation}</p>
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
                  gridTemplateColumns: "30px 1.6fr 1fr auto",
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
                  </div>
                  <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.1rem" }}>
                    {formatDate(s.updated_at)}
                    {!s.has_full_transcript && <span style={{ color: "#d97706", marginLeft: "0.3rem" }}>· {t.summaryOnly}</span>}
                  </p>
                </div>

                {/* Summary */}
                {isUr ? (
                  <span />
                ) : (
                  <p style={{
                    ...sans, fontSize: "0.71875rem", color: "var(--muted-foreground)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    minWidth: 0, opacity: 0.85,
                  }}>
                    {s.short_summary || s.summary || "—"}
                  </p>
                )}

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    title={t.exportOneSessionTitle}
                    disabled={Boolean(exportingSessionId) || exporting}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); void handleExportOne(s) }}
                    style={{
                      width: 24, height: 24, borderRadius: 5,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backgroundColor: "transparent",
                      border: "1px solid var(--border)",
                      cursor: exportingSessionId || exporting ? "default" : "pointer",
                      color: "var(--muted-foreground)",
                      transition: "border-color 0.15s ease, color 0.15s ease",
                      opacity: exportingSessionId === s.session_id ? 1 : (exportingSessionId || exporting) ? 0.45 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!exportingSessionId && !exporting) {
                        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 45%, transparent)"
                        e.currentTarget.style.color = "var(--primary)"
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "var(--border)"
                      e.currentTarget.style.color = "var(--muted-foreground)"
                    }}
                  >
                    {exportingSessionId === s.session_id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Download size={10} strokeWidth={2} />
                    )}
                  </button>
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
                    {isUr ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
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
