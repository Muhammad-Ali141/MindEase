"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useClerk } from "@clerk/nextjs"
import { apiGetRecentSessions, type SessionPreview } from "@/lib/api"
import { getSessionsCache, setSessionsCache } from "@/lib/cache"
import {
  Plus, LayoutDashboard, Settings, LogOut,
  MessageCircle, Mic2, ChevronLeft, ChevronRight,
} from "lucide-react"

const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export interface ChatSidebarProps {
  currentSessionId?: string | null
  onNewChat: () => void
  onSessionSelect?: (session: SessionPreview) => void
  open: boolean
  onToggle: () => void
  /** Bump this number after a session save to trigger a sidebar refresh. */
  refreshKey?: number
}

function groupByDate(sessions: SessionPreview[]) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const weekStart  = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 6)
  const today: SessionPreview[] = [], thisWeek: SessionPreview[] = [], older: SessionPreview[] = []
  for (const s of sessions) {
    const d = new Date(s.updated_at)
    if (d >= todayStart) today.push(s)
    else if (d >= weekStart) thisWeek.push(s)
    else older.push(s)
  }
  return { today, thisWeek, older }
}

export function ChatSidebar({ currentSessionId, onNewChat, onSessionSelect, open, onToggle, refreshKey }: ChatSidebarProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { signOut: clerkSignOut } = useClerk()
  const cached = user?.id ? getSessionsCache(user.id) : null
  const [sessions, setSessions] = useState<SessionPreview[]>(cached?.data.sessions ?? [])

  useEffect(() => { if (user?.id) loadSessions() }, [user?.id, refreshKey])

  const loadSessions = async () => {
    try {
      const res = await apiGetRecentSessions(user!.id, 30)
      setSessions(res.sessions)
      setSessionsCache(user!.id, res)
    } catch {}
  }

  const handleLogout = async () => {
    await clerkSignOut?.()
    logout()
    window.location.href = "/"
  }

  const handleSessionClick = (s: SessionPreview) => {
    if (onSessionSelect) {
      onSessionSelect(s)
    } else {
      router.push(s.has_voice ? `/voice-chat?session_id=${s.session_id}` : `/chat?session_id=${s.session_id}`)
    }
  }

  const getInitial = () => (user?.first_name || user?.email || "U").charAt(0).toUpperCase()
  const { today, thisWeek, older } = groupByDate(sessions)

  const iconBtn = (onClick: () => void, icon: React.ReactNode, title: string) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36, height: 36, borderRadius: 9, border: "1px solid transparent",
        background: "none", cursor: "pointer", color: "var(--muted-foreground)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "color 0.15s ease, background-color 0.15s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--muted) 50%, transparent)" }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.backgroundColor = "transparent" }}
    >
      {icon}
    </button>
  )

  return (
    <div
      style={{
        width: open ? 240 : 56,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "color-mix(in srgb, var(--card) 80%, transparent)",
        backdropFilter: "blur(16px)",
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
        overflow: "hidden",
        transition: "width 0.22s ease",
      }}
    >
      {/* ── Top area ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: open ? "0.875rem 0.875rem 0.75rem" : "0.875rem 0.625rem 0.75rem",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {open ? (
          <>
            {/* Logo + toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <img src="/logo.svg" alt="MindEase" style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, objectFit: "contain" }} />
                <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                  MindEase
                </span>
              </div>
              <button
                onClick={onToggle}
                title="Collapse sidebar"
                style={{
                  width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)",
                  background: "none", cursor: "pointer", color: "var(--muted-foreground)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "color 0.15s ease, border-color 0.15s ease",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--foreground)" }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)" }}
              >
                <ChevronLeft size={13} />
              </button>
            </div>

            {/* New Chat */}
            <button
              onClick={onNewChat}
              style={{
                ...sans, width: "100%", height: 34, borderRadius: 9,
                background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
                border: "none", color: "white", fontSize: "0.8125rem", fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                boxShadow: "0 2px 10px rgba(166,124,82,0.28)", transition: "opacity 0.15s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.87"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <Plus size={14} strokeWidth={2.5} /> New Chat
            </button>
          </>
        ) : (
          /* Collapsed top */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
            <button
              onClick={onToggle}
              title="Expand sidebar"
              style={{
                width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border)",
                background: "none", cursor: "pointer", color: "var(--muted-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "color 0.15s ease", marginBottom: "0.25rem",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)" }}
            >
              <ChevronRight size={13} />
            </button>
            <button
              onClick={onNewChat}
              title="New Chat"
              style={{
                width: 36, height: 36, borderRadius: 9, border: "none",
                background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
                cursor: "pointer", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(166,124,82,0.28)", transition: "opacity 0.15s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.87"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* ── Nav links ────────────────────────────────────────────────────── */}
      <div style={{ padding: open ? "0.5rem 0.625rem 0" : "0.5rem 0.625rem 0", display: "flex", flexDirection: "column", alignItems: open ? "stretch" : "center" }}>
        {open
          ? <SidebarAction icon={<LayoutDashboard size={13} />} label="Back to Dashboard" onClick={() => router.push("/dashboard")} />
          : iconBtn(() => router.push("/dashboard"), <LayoutDashboard size={15} />, "Dashboard")}
      </div>

      {/* ── Session list ─────────────────────────────────────────────────── */}
      {open && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.625rem" }}>
          {sessions.length === 0 && (
            <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", padding: "0.75rem 0.5rem", opacity: 0.5 }}>
              No conversations yet
            </p>
          )}
          {today.length > 0 && (
            <SessionGroup label="Today" sessions={today} currentSessionId={currentSessionId} onSessionClick={handleSessionClick} />
          )}
          {thisWeek.length > 0 && (
            <SessionGroup label="This Week" sessions={thisWeek} currentSessionId={currentSessionId} onSessionClick={handleSessionClick} />
          )}
          {older.length > 0 && (
            <SessionGroup label="Earlier" sessions={older} currentSessionId={currentSessionId} onSessionClick={handleSessionClick} />
          )}
        </div>
      )}
      {!open && <div style={{ flex: 1 }} />}

      {/* ── Bottom ───────────────────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--border)", padding: open ? "0.75rem 0.875rem" : "0.75rem 0.625rem", flexShrink: 0 }}>
        {open ? (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.4rem 0.5rem", borderRadius: 9, marginBottom: "0.5rem",
              backgroundColor: "color-mix(in srgb, var(--muted) 40%, transparent)",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                backgroundColor: "var(--primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                ...sans, fontWeight: 700, fontSize: "0.6875rem", color: "white",
              }}>
                {getInitial()}
              </div>
              <p style={{ ...sans, fontSize: "0.78125rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {user?.first_name} {user?.last_name}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <BottomBtn onClick={() => router.push("/profile")} icon={<Settings size={11} />} label="Settings" danger={false} />
              <BottomBtn onClick={handleLogout} icon={<LogOut size={11} />} label="Log out" danger />
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", ...sans, fontWeight: 700, fontSize: "0.6875rem", color: "white" }}>
              {getInitial()}
            </div>
            {iconBtn(() => router.push("/profile"), <Settings size={14} />, "Settings")}
            {iconBtn(handleLogout, <LogOut size={14} />, "Log out")}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionGroup({ label, sessions, currentSessionId, onSessionClick }: {
  label: string
  sessions: SessionPreview[]
  currentSessionId?: string | null
  onSessionClick: (s: SessionPreview) => void
}) {
  return (
    <div style={{ marginBottom: "0.375rem" }}>
      <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)", padding: "0.5rem 0.5rem 0.25rem", opacity: 0.55 }}>
        {label}
      </p>
      {sessions.map(s => (
        <SessionItem key={s.session_id} session={s} isActive={s.session_id === currentSessionId} onClick={() => onSessionClick(s)} />
      ))}
    </div>
  )
}

function SessionItem({ session, isActive, onClick }: { session: SessionPreview; isActive: boolean; onClick: () => void }) {
  const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
  const Icon = session.has_voice ? Mic2 : MessageCircle
  return (
    <button
      onClick={onClick}
      style={{
        ...sans, width: "100%", textAlign: "left",
        padding: "0.375rem 0.625rem", borderRadius: 7,
        border: isActive ? "1px solid color-mix(in srgb, var(--primary) 28%, transparent)" : "1px solid transparent",
        backgroundColor: isActive ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
        cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
        transition: "background-color 0.12s ease",
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--muted) 50%, transparent)" }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent" }}
    >
      <Icon size={11} style={{ flexShrink: 0, color: isActive ? "var(--primary)" : "var(--muted-foreground)", opacity: isActive ? 1 : 0.65 }} />
      <span style={{ fontSize: "0.8125rem", color: isActive ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {session.title || "Conversation"}
      </span>
    </button>
  )
}

function SidebarAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
  return (
    <button
      onClick={onClick}
      style={{
        ...sans, width: "100%", textAlign: "left", padding: "0.375rem 0.625rem", borderRadius: 7,
        border: "1px solid transparent", background: "none", color: "var(--muted-foreground)",
        fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
        display: "flex", alignItems: "center", gap: "0.5rem",
        transition: "color 0.12s ease, background-color 0.12s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--muted) 50%, transparent)" }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.backgroundColor = "transparent" }}
    >
      {icon} {label}
    </button>
  )
}

function BottomBtn({ onClick, icon, label, danger }: { onClick: () => void; icon: React.ReactNode; label: string; danger: boolean }) {
  const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
  return (
    <button
      onClick={onClick}
      style={{
        ...sans, flex: 1, height: 28, borderRadius: 7,
        border: "1px solid var(--border)", background: "none",
        color: "var(--muted-foreground)", fontSize: "0.6875rem", fontWeight: 500,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem",
        transition: "color 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = danger ? "var(--destructive)" : "var(--foreground)"; e.currentTarget.style.borderColor = danger ? "var(--destructive)" : "var(--foreground)" }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)" }}
    >
      {icon} {label}
    </button>
  )
}
