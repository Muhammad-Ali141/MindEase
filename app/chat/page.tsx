"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { BeamsBackground } from "@/components/ui/beams-background"
import { useTheme } from "next-themes"
import { Header } from "@/components/header"
import { ChatSidebar } from "@/components/chat-sidebar"
import {
  apiChatMessage, apiChatWelcome, apiChatSummary, apiSaveSession,
  apiGetSessionById, apiToggleSessionStar,
  type ChatMessage, type Session, type SessionPreview,
} from "@/lib/api"
import { ChatInterface } from "@/components/chat-interface"
import { ShareTestModal } from "@/components/share-test-modal"
import { ArrowLeft, Star, Loader2, CheckCircle2, MessageCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { dict } from "@/lib/i18n"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

type ChatShellProps = {
  isDark: boolean
  currentSessionId: string | null
  sidebarOpen: boolean
  sidebarRefreshKey?: number
  onNewChat: () => void
  onSessionSelect: (session: SessionPreview) => void
  onToggleSidebar: () => void
  children: ReactNode
}

function ChatShell({
  isDark,
  currentSessionId,
  sidebarOpen,
  sidebarRefreshKey,
  onNewChat,
  onSessionSelect,
  onToggleSidebar,
  children,
}: ChatShellProps) {
  return (
    <div data-page-root style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)" }}>
      {/* Background */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BeamsBackground isDark={isDark} intensity="subtle" />
        <div style={{ position: "absolute", inset: 0, backgroundColor: isDark ? "rgba(0,0,0,0.36)" : "rgba(255,255,255,0.18)" }} />
      </div>

      {/* Chat sidebar */}
      <div style={{ position: "relative", zIndex: 10, flexShrink: 0, height: "100%" }}>
        <ChatSidebar
          currentSessionId={currentSessionId}
          onNewChat={onNewChat}
          onSessionSelect={onSessionSelect}
          open={sidebarOpen}
          onToggle={onToggleSidebar}
          refreshKey={sidebarRefreshKey}
        />
      </div>

      {/* Main column */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const router = useRouter()
  const { user, token } = useAuth()
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? resolvedTheme === "dark" : false

  const [sidebarOpen, setSidebarOpen]           = useState(true)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [messages, setMessages]                 = useState<ChatMessage[]>([])
  const [loading, setLoading]                   = useState(false)
  const [welcomeLoading, setWelcomeLoading]     = useState(true)
  const [showSummary, setShowSummary]           = useState(false)
  const [summary, setSummary]                   = useState("")
  const [savedSession, setSavedSession]         = useState<Session | null>(null)
  const [isEnding, setIsEnding]                 = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [baselineUserMessageCount, setBaselineUserMessageCount] = useState(0)
  const [showShareModal, setShowShareModal]     = useState(false)
  const [testContext, setTestContext]           = useState<string | null>(null)
  const shareModalShownRef = useRef(false)

  /** Language for THIS chat session. Seeded from profile, overridable in ShareTestModal. */
  const profileLangPref: "en" | "ur" = (() => {
    const lp = (user as { lang_pref?: string })?.lang_pref
    const s = (lp || "en").toLowerCase()
    return s === "ur" || s === "urdu" ? "ur" : "en"
  })()
  const [chatLang, setChatLang] = useState<"en" | "ur">(profileLangPref)
  const t = dict[chatLang]

  const sessionTitle = savedSession?.title || (currentSessionId ? t.chatConversation : t.chatNewConversation)

  useEffect(() => {
    if (user && token) {
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get("session_id")
      if (sessionId) {
        loadSession(sessionId)
      } else {
        if (!shareModalShownRef.current) {
          shareModalShownRef.current = true
          setShowShareModal(true)
        }
      }
    }
  }, [user, token])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const loadWelcomeMessage = async (sharedTestContext?: string, testContextKey?: string | number, langOverride?: "en" | "ur") => {
    try {
      setWelcomeLoading(true)
      setSavedSession(null)
      setShowSummary(false)
      setSummary("")
      const lp = langOverride ?? chatLang
      const response = await apiChatWelcome(
        user!.id, user!.first_name || null, sharedTestContext || null,
        lp, undefined, testContextKey ?? null,
      )
      setMessages([{ role: "assistant", content: response.welcome_message, content_type: "text" }])
      setCurrentSessionId(null)
      setBaselineUserMessageCount(0)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load welcome message", variant: "destructive" })
    } finally {
      setWelcomeLoading(false)
    }
  }

  /** Background-save current session (fire-and-forget). Safe to call while navigating away. */
  const backgroundSaveCurrentSession = () => {
    if (!user || !token) return
    const currentUserMessages = messages.filter(m => m.role === "user").length
    if (currentUserMessages <= baselineUserMessageCount) return
    // Skip background save for very short interactions (< 2 new user messages since last save).
    // The explicit end-chat save (handleEndChat) has its own threshold and still saves at >= 1.
    if (currentUserMessages - baselineUserMessageCount < 2) return
    const msgSnapshot     = [...messages]
    const sessionSnapshot = currentSessionId

    apiChatSummary(user.id, user.first_name || null, user.gender || null, msgSnapshot, chatLang)
      .then(res => {
        if (res.no_user_messages || !res.summary?.trim()) return
        return apiSaveSession(
          user.id, msgSnapshot, res.summary,
          sessionSnapshot || undefined, user.first_name || null, user.gender || null
        )
      })
      .catch(err => console.error("[chat] background save failed:", err))
  }

  const loadSession = async (sessionId: string) => {
    try {
      setWelcomeLoading(true)
      const response = await apiGetSessionById(user!.id, sessionId)
      const session  = response.session
      setCurrentSessionId(session.session_id)
      setSavedSession(session)
      setBaselineUserMessageCount(
        session.has_full_transcript ? session.messages.filter(m => m.role === "user").length : 0
      )
      let initialMessages: ChatMessage[] = []
      if (session.has_full_transcript && session.messages.length > 0) {
        initialMessages = session.messages.map(msg => ({
          role: msg.role, content: msg.content,
          emotion_label: msg.emotion_label, emotion_score: msg.emotion_score,
          metadata: msg.metadata, content_type: msg.content_type,
        }))
      } else {
        const reminder = session.summary
          ? `${session.summary}\n\n${t.chatResumePickUp}`
          : session.resume_message || t.chatResumeContinue
        initialMessages = [{ role: "assistant", content: reminder, content_type: "text" }]
      }
      setMessages(initialMessages)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load session", variant: "destructive" })
      loadWelcomeMessage()
    } finally {
      setWelcomeLoading(false)
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleNewChat = () => {
    backgroundSaveCurrentSession()
    setMessages([])
    setCurrentSessionId(null)
    setSavedSession(null)
    setShowSummary(false)
    setSummary("")
    setTestContext(null)
    setBaselineUserMessageCount(0)
    setChatLang(profileLangPref)
    shareModalShownRef.current = false
    window.history.pushState({}, "", "/chat")
    setShowShareModal(true)
  }

  /** Called when user clicks an older session in the sidebar */
  const handleSessionSelect = (session: SessionPreview) => {
    // Voice sessions: route away normally
    if (session.has_voice) {
      backgroundSaveCurrentSession()
      router.push(`/voice-chat?session_id=${session.session_id}`)
      return
    }
    // Text session: background-save current, then load inline
    backgroundSaveCurrentSession()
    setMessages([])
    setCurrentSessionId(null)
    setSavedSession(null)
    setShowSummary(false)
    setSummary("")
    setTestContext(null)
    window.history.pushState({}, "", `/chat?session_id=${session.session_id}`)
    loadSession(session.session_id)
  }

  const handleShareTest = (context: string, resultId: number | undefined, lang: "en" | "ur") => {
    setChatLang(lang)
    setTestContext(context)
    setShowShareModal(false)
    loadWelcomeMessage(context, resultId, lang)
  }

  const handleSkipShare = (lang: "en" | "ur") => {
    setChatLang(lang)
    setTestContext(null)
    setShowShareModal(false)
    loadWelcomeMessage(undefined, undefined, lang)
  }

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || loading || !user || !token) return
    const userMessage: ChatMessage = { role: "user", content: message, content_type: "text" }
    const historyForRequest = [...messages, userMessage]
    setMessages(historyForRequest)
    setLoading(true)
    try {
      const response = await apiChatMessage(
        message, user.id, user.first_name || null,
        user.gender || null, historyForRequest, testContext || null,
        undefined,
        chatLang
      )
      const primaryEmotion = response.emotions?.[0]
      const assistantMessage: ChatMessage = { role: "assistant", content: response.response, content_type: "text" }
      setMessages(prev => {
        const updated = [...prev]
        if (primaryEmotion) {
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "user") {
              updated[i] = { ...updated[i], emotion_label: primaryEmotion.emotion, emotion_score: primaryEmotion.score }
              break
            }
          }
        }
        updated.push(assistantMessage)
        return updated
      })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" })
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleEndChat = async () => {
    if (isEnding || !user || !token || messages.length === 0) return
    const currentUserMessages = messages.filter(m => m.role === "user").length
    if (currentUserMessages <= baselineUserMessageCount) { router.push("/dashboard"); return }
    setIsEnding(true)
    setLoading(true)
    try {
      const response = await apiChatSummary(user.id, user.first_name || null, user.gender || null, messages, chatLang)
      if (response.no_user_messages || !response.summary?.trim()) { router.push("/dashboard"); return }
      try {
        const saveResponse = await apiSaveSession(
          user.id, messages, response.summary,
          currentSessionId || undefined, user.first_name || null, user.gender || null
        )
        setSavedSession(saveResponse.session)
        setCurrentSessionId(saveResponse.session.session_id)
        setBaselineUserMessageCount(saveResponse.session.messages.filter(m => m.role === "user").length)
        setSidebarRefreshKey(k => k + 1)
      } catch (err) { console.error("Failed to save session:", err) }
      setSummary(response.summary)
      setShowSummary(true)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate summary", variant: "destructive" })
      router.push("/dashboard")
    } finally {
      setLoading(false)
      setIsEnding(false)
    }
  }

  const handleToggleStar = async () => {
    if (!user || !savedSession) return
    if (savedSession.state !== "full" && !savedSession.is_starred) {
      toast({ title: t.chatCannotStarTitle, description: t.archivedCannotStar, variant: "destructive" })
      return
    }
    try {
      const response = await apiToggleSessionStar(user.id, savedSession.session_id, !savedSession.is_starred)
      setSavedSession(prev => prev ? {
        ...prev, is_starred: response.session.is_starred, state: response.session.state,
        has_full_transcript: response.session.has_full_transcript,
        resume_message: response.session.resume_message ?? prev.resume_message,
      } : prev)
      toast({ title: response.session.is_starred ? t.chatSessionStarredToast : t.chatSessionUnstarredToast })
    } catch (error: any) {
      toast({ title: "Unable to update star", description: error.message, variant: "destructive" })
    }
  }

  // ── Summary screen ─────────────────────────────────────────────────────────
  if (showSummary) {
    return (
      <AuthGuard>
        <ChatShell
          isDark={isDark}
          currentSessionId={currentSessionId}
          sidebarOpen={sidebarOpen}
          sidebarRefreshKey={sidebarRefreshKey}
          onNewChat={handleNewChat}
          onSessionSelect={handleSessionSelect}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
        >
          <Header />
          <main style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "1.75rem 1.5rem 3rem" }}>
              <button
                onClick={() => router.push("/dashboard")}
                style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", marginBottom: "2rem", padding: 0 }}
              >
                <ArrowLeft size={13} /> {t.chatDashboardNav}
              </button>

              <div style={{ marginBottom: "1.625rem" }}>
                <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.25rem" }}>{t.chatSessionComplete}</p>
                <h1 style={{ ...serif, fontSize: "2rem", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1.1 }}>{t.chatYourSummary}</h1>
              </div>

              <div style={{ backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)", backdropFilter: "blur(14px)", borderRadius: 18, border: "1px solid var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ height: 4, background: "linear-gradient(90deg, #7a5535, #a67c52, #5D8A6B)" }} />
                <div style={{ padding: "1.5rem 1.75rem" }}>
                  {savedSession && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <h2 style={{ ...sans, fontSize: "0.9375rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.15rem" }}>{savedSession.title || t.chatTherapySession}</h2>
                        <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{new Date(savedSession.updated_at).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={handleToggleStar}
                        style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.375rem", height: 32, padding: "0 0.875rem", borderRadius: 9, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", border: savedSession.is_starred ? "1px solid rgba(245,158,11,0.4)" : "1px solid var(--border)", backgroundColor: savedSession.is_starred ? "color-mix(in srgb, #f59e0b 10%, transparent)" : "transparent", color: savedSession.is_starred ? "#f59e0b" : "var(--muted-foreground)", transition: "all 0.15s ease" }}
                      >
                        <Star size={12} strokeWidth={1.75} fill={savedSession.is_starred ? "currentColor" : "none"} />
                        {savedSession.is_starred ? t.chatStarredBtn : t.chatStarBtn}
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={13} color="white" strokeWidth={2} />
                    </div>
                    <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground)" }}>{t.chatSessionSaved}</span>
                  </div>

                  <div style={{ ...sans, fontSize: "0.9375rem", color: "var(--foreground)", lineHeight: 1.82 }}>
                    {summary.split(/\n{2,}/).map((p, i, arr) => (
                      <p key={i} style={{ marginBottom: i < arr.length - 1 ? "1rem" : 0, whiteSpace: "pre-line" }}>{p.trim()}</p>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", justifyContent: "flex-end" }}>
                    <button onClick={handleNewChat} style={{ ...sans, height: 36, padding: "0 1rem", borderRadius: 10, background: "none", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.375rem", transition: "border-color 0.15s ease" }} onMouseEnter={e => e.currentTarget.style.borderColor = "var(--primary)"} onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                      <MessageCircle size={13} /> {t.chatNewChat}
                    </button>
                    <button onClick={() => router.push("/dashboard")} style={{ ...sans, height: 36, padding: "0 1.125rem", borderRadius: 10, background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)", border: "none", color: "white", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 10px rgba(166,124,82,0.28)", transition: "opacity 0.15s ease" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.87"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                      {t.chatReturnDashboard}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </ChatShell>
      </AuthGuard>
    )
  }

  // ── Chat screen ────────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <ChatShell
        isDark={isDark}
        currentSessionId={currentSessionId}
        sidebarOpen={sidebarOpen}
        sidebarRefreshKey={sidebarRefreshKey}
        onNewChat={handleNewChat}
        onSessionSelect={handleSessionSelect}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
      >
        {/* Header (greeting + date + theme + avatar) */}
        <Header />

        {/* Slim session bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 1.25rem", height: 44, flexShrink: 0,
          borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--card) 70%, transparent)",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: welcomeLoading ? "var(--muted-foreground)" : "#5D8A6B", boxShadow: welcomeLoading ? "none" : "0 0 0 2px rgba(93,138,107,0.22)", transition: "background-color 0.3s ease" }} />
            <span style={{ ...sans, fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
              {welcomeLoading ? t.chatStarting : sessionTitle}
            </span>
            {testContext && (
              <span style={{ ...sans, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)", padding: "0.15rem 0.45rem", borderRadius: 100 }}>
                {t.chatWithResults}
              </span>
            )}
          </div>

          <button
            onClick={handleEndChat}
            disabled={isEnding || loading || welcomeLoading}
            style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.35rem", height: 28, padding: "0 0.75rem", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)", cursor: (isEnding || loading || welcomeLoading) ? "default" : "pointer", opacity: (isEnding || loading || welcomeLoading) ? 0.45 : 1, transition: "border-color 0.15s ease, color 0.15s ease" }}
            onMouseEnter={e => { if (!isEnding && !loading && !welcomeLoading) { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)" } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)" }}
          >
            {isEnding ? <><Loader2 size={11} className="animate-spin" /> {t.chatSaving}</> : <><ArrowLeft size={11} /> {t.chatEndChat}</>}
          </button>
        </div>

        <ShareTestModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          onShare={handleShareTest}
          onSkip={handleSkipShare}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            loading={loading || welcomeLoading}
            lang={chatLang}
            onResponseComplete={() => {
              setTimeout(() => { const ta = document.querySelector("textarea") as HTMLTextAreaElement; if (ta) ta.focus() }, 100)
            }}
          />
        </div>
      </ChatShell>
    </AuthGuard>
  )
}
