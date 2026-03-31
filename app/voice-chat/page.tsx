"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { BeamsBackground } from "@/components/ui/beams-background"
import { AIVoiceInput, type AIVoiceState } from "@/components/ui/ai-voice-input"
import { useTheme } from "next-themes"
import { Header } from "@/components/header"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ShareTestModal } from "@/components/share-test-modal"
import { useProfileDict } from "@/lib/i18n"
import {
  apiChatWelcome, apiChatMessage, apiVoiceProcess, apiSTTTranscribe,
  apiGetWelcomeAudio, apiGenerateAndSaveWelcomeAudio,
  apiChatSummary, apiSaveSession, apiGetSessionById, apiToggleSessionStar,
  apiTTSSynthesize, type ChatMessage, type Session, type SessionPreview,
} from "@/lib/api"
import { ArrowLeft, Star, Loader2, CheckCircle2, Mic2, MessageCircle, Brain, Volume2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useMicrophone } from "@/hooks/use-microphone"
import { motion, AnimatePresence } from "framer-motion"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

type VoiceState = AIVoiceState

export default function VoiceChatPage() {
  const router           = useRouter()
  const { user, token }  = useAuth()
  const { toast }        = useToast()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? resolvedTheme === "dark" : false

  // ── State ───────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen]               = useState(true)
  const [messages, setMessages]                     = useState<ChatMessage[]>([])
  const [voiceState, setVoiceState]                 = useState<VoiceState>("idle")
  const [welcomeLoading, setWelcomeLoading]         = useState(true)
  const [showSummary, setShowSummary]               = useState(false)
  const [summary, setSummary]                       = useState("")
  const [savedSession, setSavedSession]             = useState<Session | null>(null)
  const [isEnding, setIsEnding]                     = useState(false)
  const [currentSessionId, setCurrentSessionId]     = useState<string | null>(null)
  const [baselineUserMessageCount, setBaselineUserMessageCount] = useState(0)
  const [showShareModal, setShowShareModal]         = useState(false)
  const [testContext, setTestContext]               = useState<string | null>(null)

  const currentAudioRef        = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef         = useRef<HTMLDivElement>(null)
  const welcomeLoadedRef       = useRef(false)
  const shareModalShownRef     = useRef(false)
  const isMountedRef           = useRef(true)

  const {
    isRecording, hasPermission, error: micError,
    startRecording, stopRecording, requestPermission, recordingTime,
  } = useMicrophone()

  const hasUserMessages = messages.some(m => m.role === "user")

  const t = useProfileDict()
  const sessionTitle =
    savedSession?.title || (currentSessionId ? t.voiceSessionShort : t.voiceNewVoiceSession)
  const profileLangPref: "en" | "ur" = (() => {
    const lp = (user as { lang_pref?: string } | undefined)?.lang_pref
    const s = (lp || "en").toLowerCase()
    return s === "ur" || s === "urdu" ? "ur" : "en"
  })()
  const apiLangPref = profileLangPref === "ur" ? ("ur" as const) : undefined
  /** Urdu profile only: voice welcome uses Arabic-script Urdu (text chat unchanged). */
  const voiceWelcomeUrduScript = profileLangPref === "ur"

  const voiceStatusLabels = {
    idle: t.voiceTapToSpeak,
    recording: t.voiceListening,
    transcribing: t.voiceTranscribing,
    thinking: t.voiceThinking,
    synthesizing: t.voiceGeneratingVoice,
    playing: t.voiceSpeaking,
  }

  // Sync voiceState with recording hook
  useEffect(() => {
    if (isRecording) setVoiceState("recording")
  }, [isRecording])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, voiceState])

  // URL → load session or show share modal
  useEffect(() => {
    if (user && token && !welcomeLoadedRef.current) {
      const params    = new URLSearchParams(window.location.search)
      const sessionId = params.get("session_id")
      if (sessionId) {
        loadSession(sessionId)
      } else {
        if (!shareModalShownRef.current) {
          shareModalShownRef.current = true
          setShowShareModal(true)
          setWelcomeLoading(false)
        }
      }
    }
  }, [user, token])

  // Cleanup audio on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      currentAudioRef.current?.pause()
      currentAudioRef.current = null
    }
  }, [])

  // ── Background save ─────────────────────────────────────────────────────────
  const backgroundSave = () => {
    if (!user || !token) return
    const userMsgCount = messages.filter(m => m.role === "user").length
    if (userMsgCount <= baselineUserMessageCount) return
    const snap = [...messages]; const sessSnap = currentSessionId
    apiChatSummary(user.id, user.first_name || null, user.gender || null, snap, apiLangPref)
      .then(res => {
        if (res.no_user_messages || !res.summary?.trim()) return
        return apiSaveSession(user.id, snap, res.summary, sessSnap || undefined, user.first_name || null, user.gender || null)
      })
      .catch(err => console.error("[voice] background save failed:", err))
  }

  // ── Welcome / load ──────────────────────────────────────────────────────────
  const loadWelcomeMessage = async (sharedTestContext?: string, testContextKey?: string | number) => {
    if (!user) return
    const includeContext = !!sharedTestContext
    const key = includeContext ? testContextKey : undefined
    try {
      setWelcomeLoading(true)
      setSavedSession(null); setShowSummary(false); setSummary("")
      currentAudioRef.current?.pause(); currentAudioRef.current = null

      let welcomeText = ""
      let audioBlob: Blob | null = null

      try {
        setVoiceState("synthesizing")
        const result = await apiGetWelcomeAudio(
          user.id, includeContext, key, apiLangPref, voiceWelcomeUrduScript
        )
        audioBlob = result.blob
        if (result.welcomeMessage) {
          welcomeText = result.welcomeMessage
        } else {
          const r = await apiChatWelcome(
            user.id, user.first_name || null, sharedTestContext || null, apiLangPref, voiceWelcomeUrduScript
          )
          welcomeText = r.welcome_message
        }
      } catch {
        audioBlob = null
        const r = await apiChatWelcome(
          user.id, user.first_name || null, sharedTestContext || null, apiLangPref, voiceWelcomeUrduScript
        )
        if (!isMountedRef.current) return
        welcomeText = r.welcome_message
        try {
          audioBlob = await apiGenerateAndSaveWelcomeAudio(
            user.id, welcomeText, user.lang_pref || null, includeContext, key, voiceWelcomeUrduScript
          )
        } catch (e) { console.warn("Generate/save welcome audio failed:", e) }
      }
      if (!isMountedRef.current) return
      setVoiceState("idle")
      setMessages([{ role: "assistant", content: welcomeText, content_type: "text" }])
      setCurrentSessionId(null); setBaselineUserMessageCount(0)

      if (audioBlob) {
        const url = URL.createObjectURL(audioBlob)
        const audio = new Audio(url)
        audio.onplay  = () => { if (isMountedRef.current) setVoiceState("playing") }
        audio.onended = () => { URL.revokeObjectURL(url); if (isMountedRef.current) setVoiceState("idle"); currentAudioRef.current = null }
        audio.onerror = () => { URL.revokeObjectURL(url); if (isMountedRef.current) setVoiceState("idle"); currentAudioRef.current = null }
        audio.onpause = () => { if (isMountedRef.current) setVoiceState("idle") }
        currentAudioRef.current = audio
        await audio.play()
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setVoiceState("idle")
        toast({ title: "Error", description: error.message || "Failed to load welcome message", variant: "destructive" })
      }
    } finally {
      if (isMountedRef.current) setWelcomeLoading(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    try {
      setWelcomeLoading(true)
      const response = await apiGetSessionById(user!.id, sessionId)
      if (!isMountedRef.current) return
      const session = response.session
      setCurrentSessionId(session.session_id); setSavedSession(session)
      setBaselineUserMessageCount(
        session.has_full_transcript ? session.messages.filter(m => m.role === "user").length : 0
      )
      let initialMessages: ChatMessage[]
      if (session.has_full_transcript && session.messages.length > 0) {
        initialMessages = session.messages.map(msg => ({
          role: msg.role, content: msg.content,
          emotion_label: msg.emotion_label, emotion_score: msg.emotion_score,
          metadata: msg.metadata, content_type: msg.content_type,
        }))
      } else {
        const reminder = session.resume_message || (session.summary
          ? `${session.summary}\n\n${t.chatResumePickUp}`
          : t.chatResumeContinue)
        initialMessages = [{ role: "assistant", content: reminder, content_type: "text" }]
      }
      setMessages(initialMessages)
    } catch (error: any) {
      if (isMountedRef.current) {
        toast({ title: "Error", description: error.message || "Failed to load session", variant: "destructive" })
        loadWelcomeMessage()
      }
    } finally {
      if (isMountedRef.current) setWelcomeLoading(false)
    }
  }

  // ── Session actions ─────────────────────────────────────────────────────────
  const handleShareTest = (context: string, resultId?: number) => {
    setTestContext(context); setShowShareModal(false)
    welcomeLoadedRef.current = true
    loadWelcomeMessage(context, resultId)
  }

  const handleSkipShare = () => {
    setTestContext(null); setShowShareModal(false)
    welcomeLoadedRef.current = true
    loadWelcomeMessage()
  }

  const handleNewChat = () => {
    backgroundSave()
    currentAudioRef.current?.pause(); currentAudioRef.current = null
    setMessages([]); setCurrentSessionId(null); setSavedSession(null)
    setShowSummary(false); setSummary(""); setTestContext(null)
    setBaselineUserMessageCount(0); setVoiceState("idle")
    welcomeLoadedRef.current = false; shareModalShownRef.current = false
    window.history.pushState({}, "", "/voice-chat")
    setShowShareModal(true)
  }

  const handleSessionSelect = (session: SessionPreview) => {
    backgroundSave()
    currentAudioRef.current?.pause(); currentAudioRef.current = null
    if (!session.has_voice) {
      router.push(`/chat?session_id=${session.session_id}`)
      return
    }
    setMessages([]); setCurrentSessionId(null); setSavedSession(null)
    setShowSummary(false); setSummary(""); setTestContext(null); setVoiceState("idle")
    window.history.pushState({}, "", `/voice-chat?session_id=${session.session_id}`)
    loadSession(session.session_id)
  }

  const handleEndChat = async () => {
    if (isEnding || !user || !token || messages.length === 0) return
    const userMsgCount = messages.filter(m => m.role === "user").length
    if (userMsgCount <= baselineUserMessageCount) { router.push("/dashboard"); return }
    currentAudioRef.current?.pause(); currentAudioRef.current = null; setVoiceState("idle")
    setIsEnding(true)
    try {
      const response = await apiChatSummary(user.id, user.first_name || null, user.gender || null, messages, apiLangPref)
      if (response.no_user_messages || !response.summary?.trim()) { router.push("/dashboard"); return }
      try {
        const saveRes = await apiSaveSession(user.id, messages, response.summary, currentSessionId || undefined, user.first_name || null, user.gender || null)
        setSavedSession(saveRes.session); setCurrentSessionId(saveRes.session.session_id)
        setBaselineUserMessageCount(saveRes.session.messages.filter(m => m.role === "user").length)
      } catch (err) { console.error("Failed to save session:", err) }
      setSummary(response.summary); setShowSummary(true)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate summary", variant: "destructive" })
      router.push("/dashboard")
    } finally {
      setIsEnding(false)
    }
  }

  const handleToggleStar = async () => {
    if (!user || !savedSession) return
    if (savedSession.state !== "full" && !savedSession.is_starred) {
      toast({ title: "Cannot star session", description: "Archived sessions cannot be starred.", variant: "destructive" })
      return
    }
    try {
      const res = await apiToggleSessionStar(user.id, savedSession.session_id, !savedSession.is_starred)
      setSavedSession(prev => prev ? {
        ...prev, is_starred: res.session.is_starred, state: res.session.state,
        has_full_transcript: res.session.has_full_transcript,
        resume_message: res.session.resume_message ?? prev.resume_message,
      } : prev)
      toast({ title: res.session.is_starred ? "Session starred" : "Session unstarred" })
    } catch (error: any) {
      toast({ title: "Unable to update star", description: error.message, variant: "destructive" })
    }
  }

  // ── Mic / Recording ─────────────────────────────────────────────────────────
  const handleMicClick = async () => {
    if (voiceState === "transcribing" || voiceState === "thinking" || voiceState === "synthesizing") return

    try {
      if (isRecording) {
        const audioBlob = await stopRecording()
        if (audioBlob) {
          setVoiceState("transcribing")
          await processRecording(audioBlob)
        } else {
          setVoiceState("idle")
        }
      } else {
        if (hasPermission === false) {
          const granted = await requestPermission()
          if (!granted) {
            toast({ title: "Microphone access denied", description: micError || "Please allow microphone access.", variant: "destructive" })
            return
          }
        }
        currentAudioRef.current?.pause(); currentAudioRef.current = null
        setVoiceState("idle") // will flip to "recording" via useEffect
        await startRecording()
      }
    } catch (error: any) {
      setVoiceState("idle")
      toast({ title: "Recording error", description: error.message || "Failed to start/stop recording", variant: "destructive" })
    }
  }

  const processRecording = async (audioBlob: Blob) => {
    if (!user || !token) return

    let transcript = ""
    let emotionsFromVoice: Array<{ emotion: string; score: number }> = []

    try {
      const voiceResult = await apiVoiceProcess(audioBlob, profileLangPref)
      if (!isMountedRef.current) return
      transcript = voiceResult.transcript?.trim() || ""
      emotionsFromVoice = voiceResult.emotions || []
    } catch {
      try {
        const sttRes = await apiSTTTranscribe(audioBlob, profileLangPref)
        transcript = sttRes.transcript?.trim() || ""
      } catch { transcript = "" }
    }

    if (!transcript) {
      if (isMountedRef.current) {
        setVoiceState("idle")
        toast({ title: "No speech detected", description: "Please try speaking again.", variant: "destructive" })
      }
      return
    }

    try {
      const userMessage: ChatMessage = { role: "user", content: transcript, content_type: "audio" }
      setMessages(prev => [...prev, userMessage])
      setVoiceState("thinking")
      const historyForRequest = [...messages, { role: "user" as const, content: transcript, content_type: "audio" as const }]

      const chatResponse = await apiChatMessage(
        transcript, user.id, user.first_name || null, user.gender || null,
        historyForRequest, testContext || null,
        emotionsFromVoice.length > 0 ? emotionsFromVoice : undefined,
        apiLangPref
      )
      if (!isMountedRef.current) return

      // Attach emotion label to user message
      const primaryEmotion = chatResponse.emotions?.[0]
      if (primaryEmotion) {
        setMessages(prev => {
          const updated = [...prev]
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "user") {
              updated[i] = { ...updated[i], emotion_label: primaryEmotion.emotion, emotion_score: primaryEmotion.score }
              break
            }
          }
          return updated
        })
      }

      // TTS
      setVoiceState("synthesizing")
      currentAudioRef.current?.pause(); currentAudioRef.current = null

      let userLanguage = "en"
      if (user?.lang_pref) {
        const lp = user.lang_pref.toLowerCase()
        if (lp === "urdu" || lp === "ur") userLanguage = "ur"
      }

      let ttsBlob: Blob | null = null
      try {
        ttsBlob = await apiTTSSynthesize(chatResponse.response, userLanguage)
      } catch { /* silent */ }
      if (!isMountedRef.current) return

      setMessages(prev => [...prev, { role: "assistant", content: chatResponse.response, content_type: "text" }])

      if (ttsBlob) {
        const url = URL.createObjectURL(ttsBlob)
        const audio = new Audio(url)
        audio.onplay  = () => { if (isMountedRef.current) setVoiceState("playing") }
        audio.onended = () => { URL.revokeObjectURL(url); if (isMountedRef.current) setVoiceState("idle"); currentAudioRef.current = null }
        audio.onerror = () => { URL.revokeObjectURL(url); if (isMountedRef.current) setVoiceState("idle"); currentAudioRef.current = null }
        currentAudioRef.current = audio
        audio.play()
      } else {
        setVoiceState("idle")
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setVoiceState("idle")
        const msg = error.message || "Failed to process recording"
        if (msg.includes("No speech detected")) {
          toast({ title: "No speech detected", description: "Please try speaking again.", variant: "destructive" })
        } else if (msg.includes("network") || msg.includes("fetch")) {
          toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" })
        } else {
          toast({ title: "Error", description: msg, variant: "destructive" })
        }
      }
    }
  }

  // ── Shell ───────────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BeamsBackground isDark={isDark} intensity="subtle" />
        <div style={{ position: "absolute", inset: 0, backgroundColor: isDark ? "rgba(0,0,0,0.36)" : "rgba(255,255,255,0.18)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 10, flexShrink: 0, height: "100%" }}>
        <ChatSidebar
          currentSessionId={currentSessionId}
          onNewChat={handleNewChat}
          onSessionSelect={handleSessionSelect}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
        />
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  )

  // ── Summary screen ──────────────────────────────────────────────────────────
  if (showSummary) {
    return (
      <AuthGuard>
        <Shell>
          <Header />
          <main style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "1.75rem 1.5rem 3rem" }}>
              <button
                onClick={() => router.push("/dashboard")}
                style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", marginBottom: "2rem", padding: 0 }}
              >
                <ArrowLeft size={13} /> {t.dashboard}
              </button>

              <div style={{ marginBottom: "1.625rem" }}>
                <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.25rem" }}>
                  {t.chatSessionComplete}
                </p>
                <h1 style={{ ...serif, fontSize: "2rem", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1.1 }}>
                  {t.chatYourSummary}
                </h1>
              </div>

              <div style={{ backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)", backdropFilter: "blur(14px)", borderRadius: 18, border: "1px solid var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ height: 4, background: "linear-gradient(90deg, #325944, #5D8A6B, #a67c52)" }} />
                <div style={{ padding: "1.5rem 1.75rem" }}>

                  {savedSession && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Mic2 size={11} color="white" strokeWidth={2} />
                          </div>
                          <h2 style={{ ...sans, fontSize: "0.9375rem", fontWeight: 700, color: "var(--foreground)" }}>
                            {savedSession.title || t.voiceSessionShort}
                          </h2>
                        </div>
                        <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                          {new Date(savedSession.updated_at).toLocaleString()}
                        </p>
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
                    <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground)" }}>
                      {t.chatSessionSaved}
                    </span>
                  </div>

                  <div style={{ ...sans, fontSize: "0.9375rem", color: "var(--foreground)", lineHeight: 1.82 }}>
                    {summary.split(/\n{2,}/).map((p, i, arr) => (
                      <p key={i} style={{ marginBottom: i < arr.length - 1 ? "1rem" : 0, whiteSpace: "pre-line" }}>{p.trim()}</p>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", justifyContent: "flex-end" }}>
                    <button onClick={handleNewChat} style={{ ...sans, height: 36, padding: "0 1rem", borderRadius: 10, background: "none", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.375rem", transition: "border-color 0.15s ease" }} onMouseEnter={e => e.currentTarget.style.borderColor = "var(--sage)"} onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                      <Mic2 size={13} /> {t.voiceNewVoiceChat}
                    </button>
                    <button onClick={() => router.push("/dashboard")} style={{ ...sans, height: 36, padding: "0 1.125rem", borderRadius: 10, background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)", border: "none", color: "white", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 10px rgba(166,124,82,0.28)", transition: "opacity 0.15s ease" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.87"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                      {t.chatReturnDashboard}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </Shell>
      </AuthGuard>
    )
  }

  // ── Main chat screen ────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <Shell>
        <ShareTestModal
          open={showShareModal}
          onClose={handleSkipShare}
          onShare={handleShareTest}
          onSkip={handleSkipShare}
        />

        <Header />

        {/* Session bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 1.25rem", height: 44, flexShrink: 0,
          borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--card) 70%, transparent)",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              backgroundColor: voiceState === "recording" ? "#5D8A6B" : voiceState === "playing" ? "#a67c52" : welcomeLoading ? "var(--muted-foreground)" : "#5D8A6B",
              boxShadow: (voiceState === "recording" || voiceState === "playing") ? "0 0 0 2px rgba(93,138,107,0.22)" : "none",
              transition: "background-color 0.3s ease",
            }} />
            <span style={{ ...sans, fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
              {welcomeLoading ? t.chatStarting : sessionTitle}
            </span>
            <span style={{ ...sans, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sage)", backgroundColor: "color-mix(in srgb, var(--sage) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--sage) 22%, transparent)", padding: "0.15rem 0.45rem", borderRadius: 100 }}>
              {t.voiceCaps}
            </span>
            {testContext && (
              <span style={{ ...sans, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)", padding: "0.15rem 0.45rem", borderRadius: 100 }}>
                {t.chatWithResults}
              </span>
            )}
          </div>

          <button
            onClick={handleEndChat}
            disabled={isEnding || welcomeLoading}
            style={{ ...sans, display: "inline-flex", alignItems: "center", gap: "0.35rem", height: 28, padding: "0 0.75rem", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)", cursor: (isEnding || welcomeLoading) ? "default" : "pointer", opacity: (isEnding || welcomeLoading) ? 0.45 : 1, transition: "border-color 0.15s ease, color 0.15s ease" }}
            onMouseEnter={e => { if (!isEnding && !welcomeLoading) { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)" } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)" }}
          >
            {isEnding ? <><Loader2 size={11} className="animate-spin" /> {t.chatSaving}</> : <><ArrowLeft size={11} /> {t.chatEndChat}</>}
          </button>
        </div>

        {/* Chat body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Landing (no user messages) */}
          {!hasUserMessages ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1.5rem 1rem" }}>
              <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{ textAlign: "center", marginBottom: "1.75rem" }}
                >
                  <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sage)", marginBottom: "0.5rem" }}>
                    {t.voiceCompanionLabel}
                  </p>
                  <h1 style={{ ...serif, fontSize: "clamp(1.875rem, 3.5vw, 2.625rem)", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1.1, marginBottom: "0.6rem" }}>
                    {t.voiceSpeakFreely}{" "}
                    <span style={{ fontStyle: "italic", color: "var(--primary)" }}>
                      {user?.first_name || t.voiceFriendFallback}
                    </span>
                    .
                  </h1>
                  <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                    {t.voiceHeardSub}
                  </p>
                </motion.div>

                {/* AI welcome card */}
                {messages.length > 0 && messages[0].role === "assistant" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: "100%", marginBottom: "1.5rem", padding: "0.875rem 1rem",
                      borderRadius: 14,
                      backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
                      backdropFilter: "blur(12px)",
                      borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                      borderRight: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                      borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                      borderLeft: "2px solid color-mix(in srgb, #5D8A6B 55%, transparent)",
                      display: "flex", alignItems: "center", gap: "0.75rem",
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(93,138,107,0.25)" }}>
                      <Brain size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
                    </div>
                    <p
                      dir={profileLangPref === "ur" ? "rtl" : "ltr"}
                      style={{
                        ...sans,
                        fontSize: "0.9375rem",
                        lineHeight: 1.78,
                        color: "var(--foreground)",
                        margin: 0,
                        flex: 1,
                        textAlign: profileLangPref === "ur" ? "right" : "left",
                      }}
                    >
                      {messages[0].content}
                    </p>
                    {voiceState === "playing" && (
                      <div style={{ flexShrink: 0, display: "flex", gap: 3, alignItems: "flex-end", height: 16 }}>
                        {[0,1,2,3].map(i => (
                          <div key={i} style={{ width: 3, borderRadius: 2, backgroundColor: "var(--sage)", animation: `voice-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate` }} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Welcome loading state */}
                {welcomeLoading && messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}
                  >
                    <Loader2 size={16} color="var(--sage)" className="animate-spin" />
                    <span style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                      {t.voicePreparingCompanion}
                    </span>
                  </motion.div>
                )}

                {/* Voice input */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: "100%" }}
                >
                  <AIVoiceInput
                    voiceState={voiceState}
                    recordingTime={recordingTime}
                    disabled={welcomeLoading || voiceState === "transcribing" || voiceState === "thinking" || voiceState === "synthesizing"}
                    onMicClick={handleMicClick}
                    statusLabels={voiceStatusLabels}
                  />
                </motion.div>
              </div>
            </div>
          ) : (
            /* Chat mode — messages + voice input */
            <>
              {/* Messages scroll area */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, minHeight: "1.5rem" }} />
                <div style={{ padding: "1rem 1.5rem 0.5rem" }}>

                  <AnimatePresence initial={false}>
                    {messages.map((msg, i) => {
                      const isUser = msg.role === "user"
                      const isAudio = msg.content_type === "audio"
                      const isLastMsg = i === messages.length - 1
                      const prev = messages[i - 1]
                      const grouped = prev?.role === msg.role

                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          style={{ marginBottom: grouped ? "0.3rem" : "0.875rem" }}
                        >
                          {isUser ? (
                            /* User bubble */
                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{
                                maxWidth: "62%", padding: "0.625rem 0.875rem",
                                borderRadius: "16px 4px 16px 16px",
                                background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
                                boxShadow: "0 2px 12px rgba(166,124,82,0.22)",
                                display: "flex", alignItems: "flex-start", gap: "0.5rem",
                              }}>
                                {isAudio && <Mic2 size={12} color="rgba(255,255,255,0.7)" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 3 }} />}
                                <p style={{ ...sans, fontSize: "0.9375rem", lineHeight: 1.65, color: "rgba(255,255,255,0.95)", margin: 0 }}>
                                  {msg.content}
                                </p>
                              </div>
                              {!grouped && (
                                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #7a5535, #a67c52)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(166,124,82,0.28)" }}>
                                  <span style={{ ...sans, fontSize: "0.6875rem", fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
                                    {(user?.first_name?.[0] || "U").toUpperCase()}
                                  </span>
                                </div>
                              )}
                              {grouped && <div style={{ width: 28, flexShrink: 0 }} />}
                            </div>
                          ) : (
                            /* AI bubble */
                            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                              {!grouped ? (
                                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(93,138,107,0.25)" }}>
                                  <Brain size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
                                </div>
                              ) : (
                                <div style={{ width: 28, flexShrink: 0 }} />
                              )}
                              <div style={{
                                maxWidth: "82%", padding: "0.625rem 0.875rem",
                                borderRadius: "4px 16px 16px 16px",
                                backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
                                backdropFilter: "blur(12px)",
                                borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                                borderRight: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                                borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                                borderLeft: "2px solid color-mix(in srgb, #5D8A6B 55%, transparent)",
                                display: "flex", alignItems: "flex-start", gap: "0.625rem",
                              }}>
                                <p style={{ ...sans, fontSize: "0.9375rem", lineHeight: 1.78, color: "var(--foreground)", margin: 0, flex: 1 }}>
                                  {msg.content}
                                </p>
                                {/* Audio playback indicator on last AI message */}
                                {isLastMsg && (
                                  voiceState === "synthesizing" ? (
                                    <Loader2 size={14} color="var(--sage)" className="animate-spin" style={{ flexShrink: 0, marginTop: 2 }} />
                                  ) : voiceState === "playing" ? (
                                    <div style={{ flexShrink: 0, display: "flex", gap: 2, alignItems: "flex-end", height: 18, marginTop: 1 }}>
                                      {[0,1,2].map(j => (
                                        <div key={j} style={{ width: 3, borderRadius: 2, backgroundColor: "var(--sage)", animation: `voice-bar 0.7s ease-in-out ${j * 0.18}s infinite alternate` }} />
                                      ))}
                                    </div>
                                  ) : (
                                    <Volume2 size={14} color="var(--sage)" style={{ flexShrink: 0, marginTop: 2, opacity: 0.5 }} />
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {/* Transcribing indicator */}
                  <AnimatePresence>
                    {voiceState === "transcribing" && (
                      <motion.div key="transcribing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
                        style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Mic2 size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
                        </div>
                        <div style={{ padding: "0.625rem 0.875rem", borderRadius: "4px 14px 14px 14px", backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)", backdropFilter: "blur(12px)", border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)", borderLeft: "2px solid color-mix(in srgb, #5D8A6B 55%, transparent)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {[0,1,2].map(j => <div key={j} style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--sage)", opacity: 0.8, animation: `mindease-bounce 1.2s ease-in-out ${j * 0.18}s infinite` }} />)}
                          <span style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", marginLeft: "0.25rem" }}>Transcribing…</span>
                        </div>
                      </motion.div>
                    )}

                    {/* AI thinking indicator */}
                    {voiceState === "thinking" && (
                      <motion.div key="thinking" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
                        style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Brain size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
                        </div>
                        <div style={{ padding: "0.625rem 0.875rem", borderRadius: "4px 14px 14px 14px", backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)", backdropFilter: "blur(12px)", border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)", borderLeft: "2px solid color-mix(in srgb, #5D8A6B 55%, transparent)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {[0,1,2].map(j => <div key={j} style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--primary)", opacity: 0.65, animation: `mindease-bounce 1.2s ease-in-out ${j * 0.18}s infinite` }} />)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Voice input bar */}
              <div style={{
                flexShrink: 0,
                borderTop: "1px solid color-mix(in srgb, var(--border) 45%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--background) 65%, transparent)",
                backdropFilter: "blur(12px)",
                padding: "1rem 1.5rem 1.25rem",
              }}>
                <AIVoiceInput
                  voiceState={voiceState}
                  recordingTime={recordingTime}
                  disabled={welcomeLoading}
                  onMicClick={handleMicClick}
                  statusLabels={voiceStatusLabels}
                />
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes mindease-bounce { 0%,60%,100%{transform:translateY(0);opacity:.65} 30%{transform:translateY(-5px);opacity:1} }
          @keyframes voice-bar { from { height: 4px } to { height: 14px } }
        `}</style>
      </Shell>
    </AuthGuard>
  )
}
