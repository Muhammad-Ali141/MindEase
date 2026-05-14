"use client"

import { useState, useEffect, useRef } from "react"
import DIDAvatar, { type DIDAvatarHandle } from "@/components/did-avatar"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { BeamsBackground } from "@/components/ui/beams-background"
import type { AIVoiceState } from "@/components/ui/ai-voice-input"
import { useTheme } from "next-themes"
import { Header } from "@/components/header"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ShareTestModal } from "@/components/share-test-modal"
import { dict } from "@/lib/i18n"
import {
  apiChatWelcome, apiChatMessageStream, apiVoiceProcess, apiSTTTranscribe,
  apiGetWelcomeAudio, apiGenerateAndSaveWelcomeAudio,
  apiChatSummary, apiSaveSession, apiGetSessionById, apiToggleSessionStar,
  apiTTSSynthesize, type ChatMessage, type Session, type SessionPreview,
} from "@/lib/api"
import { ArrowLeft, Star, Loader2, CheckCircle2, Mic, Mic2, Maximize, Minimize } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useMicrophone } from "@/hooks/use-microphone"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

type VoiceState = AIVoiceState

function VoiceChatShell({
  children,
  isDark,
  sidebarOpen,
  sidebarRefreshKey,
  currentSessionId,
  onNewChat,
  onSessionSelect,
  onToggleSidebar,
}: {
  children: React.ReactNode
  isDark: boolean
  sidebarOpen: boolean
  sidebarRefreshKey?: number
  currentSessionId: string | null
  onNewChat: () => void
  onSessionSelect: (session: SessionPreview) => void
  onToggleSidebar: () => void
}) {
  return (
    <div data-page-root style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BeamsBackground isDark={isDark} intensity="subtle" />
        <div style={{ position: "absolute", inset: 0, backgroundColor: isDark ? "rgba(0,0,0,0.36)" : "rgba(255,255,255,0.18)" }} />
      </div>
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
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  )
}

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
  const [sidebarRefreshKey, setSidebarRefreshKey]   = useState(0)
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
  // Streaming TTS — ordered promise chain
  const ttsPromisesRef         = useRef<Array<Promise<Blob | null>>>([])
  const ttsSequenceActiveRef   = useRef(false)
  // D-ID avatar (English only)
  const didRef                 = useRef<DIDAvatarHandle>(null)
  const avatarContainerRef     = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      avatarContainerRef.current?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const {
    isRecording, hasPermission, error: micError,
    startRecording, stopRecording, requestPermission, recordingTime,
  } = useMicrophone()

  const profileLangPref: "en" | "ur" = (() => {
    const lp = (user as { lang_pref?: string } | undefined)?.lang_pref
    const s = (lp || "en").toLowerCase()
    return s === "ur" || s === "urdu" ? "ur" : "en"
  })()
  /** Language for THIS voice session. Seeded from profile, overridable in ShareTestModal. */
  const [chatLang, setChatLang] = useState<"en" | "ur">(profileLangPref)
  const chatLangRef            = useRef(chatLang)
  chatLangRef.current          = chatLang
  const t = dict[chatLang]

  const sessionTitle =
    savedSession?.title || (currentSessionId ? t.voiceSessionShort : t.voiceNewVoiceSession)
  const apiLangPref = chatLang === "ur" ? ("ur" as const) : undefined
  /** Urdu only: voice welcome uses Arabic-script Urdu (text chat unchanged). */
  const voiceWelcomeUrduScript = chatLang === "ur"

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

  // Scroll to bottom only when new messages arrive.
  // Scrolling on every voiceState tick causes visible jitter.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

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
    // Skip background save for very short interactions (< 2 new user messages since last save).
    // The explicit end-chat save (handleEndChat) has its own threshold and still saves at >= 1.
    if (userMsgCount - baselineUserMessageCount < 2) return
    const snap = [...messages]; const sessSnap = currentSessionId
    apiChatSummary(user.id, user.first_name || null, user.gender || null, snap, apiLangPref)
      .then(res => {
        if (res.no_user_messages || !res.summary?.trim()) return
        return apiSaveSession(user.id, snap, res.summary, sessSnap || undefined, user.first_name || null, user.gender || null)
      })
      .catch(err => console.error("[voice] background save failed:", err))
  }

  // ── Welcome / load ──────────────────────────────────────────────────────────
  const loadWelcomeMessage = async (sharedTestContext?: string, testContextKey?: string | number, langOverride?: "en" | "ur") => {
    if (!user) return
    const lp = langOverride ?? chatLang
    const effApiLang = lp === "ur" ? ("ur" as const) : undefined
    const effUrduScript = lp === "ur"
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
          user.id, includeContext, key, effApiLang, effUrduScript
        )
        audioBlob = result.blob
        if (result.welcomeMessage) {
          welcomeText = result.welcomeMessage
        } else {
          const r = await apiChatWelcome(
            user.id, user.first_name || null, sharedTestContext || null, effApiLang, effUrduScript
          )
          welcomeText = r.welcome_message
        }
      } catch {
        audioBlob = null
        const r = await apiChatWelcome(
          user.id, user.first_name || null, sharedTestContext || null, effApiLang, effUrduScript
        )
        if (!isMountedRef.current) return
        welcomeText = r.welcome_message
        try {
          audioBlob = await apiGenerateAndSaveWelcomeAudio(
            user.id, welcomeText, lp, includeContext, key, effUrduScript
          )
        } catch (e) { console.warn("Generate/save welcome audio failed:", e) }
      }
      if (!isMountedRef.current) return
      setVoiceState("idle")
      setMessages([{ role: "assistant", content: welcomeText, content_type: "text" }])
      setCurrentSessionId(null); setBaselineUserMessageCount(0)

      if (audioBlob) {
        if (isMountedRef.current) setWelcomeLoading(false)
        if (didRef.current) {
          // wav2lip plays the audio for both English and Urdu
          if (isMountedRef.current) setVoiceState("synthesizing")
          await didRef.current.sendAudio(audioBlob).catch(() => null)
          if (isMountedRef.current) setVoiceState("idle")
        } else {
          // Fallback: play TTS audio directly
          const url = URL.createObjectURL(audioBlob)
          const audio = new Audio(url)
          audio.onplay  = () => { if (isMountedRef.current) setVoiceState("playing") }
          audio.onended = () => { URL.revokeObjectURL(url); if (isMountedRef.current) setVoiceState("idle"); currentAudioRef.current = null }
          audio.onerror = () => { URL.revokeObjectURL(url); if (isMountedRef.current) setVoiceState("idle"); currentAudioRef.current = null }
          audio.onpause = () => { if (isMountedRef.current) setVoiceState("idle") }
          currentAudioRef.current = audio
          await audio.play()
        }
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
  const handleShareTest = (context: string, resultId: number | undefined, lang: "en" | "ur") => {
    setChatLang(lang)
    setTestContext(context); setShowShareModal(false)
    welcomeLoadedRef.current = true
    loadWelcomeMessage(context, resultId, lang)
  }

  const handleSkipShare = (lang: "en" | "ur") => {
    setChatLang(lang)
    setTestContext(null); setShowShareModal(false)
    welcomeLoadedRef.current = true
    loadWelcomeMessage(undefined, undefined, lang)
  }

  const handleNewChat = () => {
    backgroundSave()
    currentAudioRef.current?.pause(); currentAudioRef.current = null
    ttsPromisesRef.current = []; ttsSequenceActiveRef.current = false
    setMessages([]); setCurrentSessionId(null); setSavedSession(null)
    setShowSummary(false); setSummary(""); setTestContext(null)
    setBaselineUserMessageCount(0); setVoiceState("idle")
    setChatLang(profileLangPref)
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
    ttsPromisesRef.current = []; ttsSequenceActiveRef.current = false
    setIsEnding(true)
    try {
      const response = await apiChatSummary(user.id, user.first_name || null, user.gender || null, messages, apiLangPref)
      if (response.no_user_messages || !response.summary?.trim()) { router.push("/dashboard"); return }
      try {
        const saveRes = await apiSaveSession(user.id, messages, response.summary, currentSessionId || undefined, user.first_name || null, user.gender || null)
        setSavedSession(saveRes.session); setCurrentSessionId(saveRes.session.session_id)
        setBaselineUserMessageCount(saveRes.session.messages.filter(m => m.role === "user").length)
        setSidebarRefreshKey(k => k + 1)
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
        ttsPromisesRef.current = []; ttsSequenceActiveRef.current = false
        setVoiceState("idle") // will flip to "recording" via useEffect
        await startRecording()
      }
    } catch (error: any) {
      setVoiceState("idle")
      toast({ title: "Recording error", description: error.message || "Failed to start/stop recording", variant: "destructive" })
    }
  }

  // ── TTS audio fallback (Urdu or wav2lip failure) ────────────────────────────────────────────
  const playBlob = async (blob: Blob): Promise<void> => {
    await new Promise<void>(resolve => {
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onplay  = () => { if (isMountedRef.current) setVoiceState("playing") }
      audio.onended = () => { URL.revokeObjectURL(url); currentAudioRef.current = null; resolve() }
      audio.onerror = () => { URL.revokeObjectURL(url); currentAudioRef.current = null; resolve() }
      currentAudioRef.current = audio
      audio.play().catch(() => resolve())
    })
  }

  const playSequential = async (streamDoneFlag: { done: boolean }) => {
    ttsSequenceActiveRef.current = true

    // Wait for LLM stream + all TTS synthesis to finish
    while (!streamDoneFlag.done) await new Promise(r => setTimeout(r, 30))
    const blobs = (await Promise.all(ttsPromisesRef.current)).filter(Boolean) as Blob[]

    if (!isMountedRef.current || blobs.length === 0) {
      ttsSequenceActiveRef.current = false
      if (isMountedRef.current) setVoiceState("idle")
      return
    }

    // Send full concatenated audio to wav2lip (both English and Urdu)
    if (didRef.current) {
      if (isMountedRef.current) setVoiceState("synthesizing")
      const fullBlob = new Blob(blobs, { type: "audio/mpeg" })
      try {
        await didRef.current.sendAudio(fullBlob)
        ttsSequenceActiveRef.current = false
        if (isMountedRef.current) setVoiceState("idle")
        return
      } catch { /* fall through to TTS audio playback */ }
    }

    // wav2lip fallback: play TTS sentences sequentially
    for (const blob of blobs) {
      if (!isMountedRef.current) break
      await playBlob(blob)
    }
    ttsSequenceActiveRef.current = false
    if (isMountedRef.current) setVoiceState("idle")
  }

  // Sentence boundary: ends with . ! ? ؟ ۔ optionally followed by quotes/brackets then whitespace or end
  const SENTENCE_END_RE = /[.!?؟۔]['")\]]*(?:\s+|$)/

  const processRecording = async (audioBlob: Blob) => {
    if (!user || !token) return

    let transcript = ""
    let emotionsFromVoice: Array<{ emotion: string; score: number }> = []

    try {
      const voiceResult = await apiVoiceProcess(audioBlob, chatLang)
      if (!isMountedRef.current) return
      transcript = voiceResult.transcript?.trim() || ""
      emotionsFromVoice = voiceResult.emotions || []
    } catch {
      try {
        const sttRes = await apiSTTTranscribe(audioBlob, chatLang)
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
      const userLanguage = chatLang === "ur" ? "ur" : "en"

      // Reset for this turn
      currentAudioRef.current?.pause(); currentAudioRef.current = null
      ttsPromisesRef.current = []
      ttsSequenceActiveRef.current = false
      const streamDoneFlag = { done: false }

      let fullResponse = ""
      let sentenceBuffer = ""
      let firstSentenceFired = false
      let finalEmotions: Array<{ emotion: string; score: number }> = []

      const enqueueTTS = (text: string) => {
        const trimmed = text.trim()
        if (!trimmed) return
        if (!firstSentenceFired) {
          firstSentenceFired = true
          if (isMountedRef.current) setVoiceState("synthesizing")
        }
        const p: Promise<Blob | null> = apiTTSSynthesize(trimmed, userLanguage).catch(() => null)
        ttsPromisesRef.current.push(p)
        if (!ttsSequenceActiveRef.current) playSequential(streamDoneFlag)
      }

      // Urdu uses ElevenLabs (free tier = 2 concurrent req cap) → send full text as one TTS request.
      // English keeps per-sentence streaming for low latency.
      const useSingleShotTTS = userLanguage === "ur"

      await apiChatMessageStream(
        transcript,
        user.id,
        user.first_name || null,
        user.gender || null,
        historyForRequest,
        {
          onDelta: (delta: string) => {
            if (!isMountedRef.current) return
            fullResponse += delta
            if (useSingleShotTTS) return
            sentenceBuffer += delta
            // Fire TTS for each complete sentence as it arrives
            let match: RegExpExecArray | null
            while ((match = SENTENCE_END_RE.exec(sentenceBuffer)) !== null) {
              const sentence = sentenceBuffer.slice(0, match.index + match[0].length)
              sentenceBuffer = sentenceBuffer.slice(match.index + match[0].length)
              enqueueTTS(sentence)
            }
          },
          onDone: (payload) => {
            finalEmotions = payload.emotions ?? []
            streamDoneFlag.done = true
            if (useSingleShotTTS) {
              if (fullResponse.trim()) enqueueTTS(fullResponse)
            } else if (sentenceBuffer.trim()) {
              enqueueTTS(sentenceBuffer)
            }
            sentenceBuffer = ""
            if (isMountedRef.current) {
              setMessages(prev => [...prev, { role: "assistant", content: fullResponse, content_type: "text" }])
            }
          },
        },
        testContext || null,
        emotionsFromVoice.length > 0 ? emotionsFromVoice : undefined,
        apiLangPref
      )

      if (!isMountedRef.current) return

      // Attach emotion to user message
      const primaryEmotion = finalEmotions[0]
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

      if (!firstSentenceFired) setVoiceState("idle")

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

  // ── Summary screen ──────────────────────────────────────────────────────────
  if (showSummary) {
    return (
      <AuthGuard>
        <VoiceChatShell
          isDark={isDark}
          sidebarOpen={sidebarOpen}
          sidebarRefreshKey={sidebarRefreshKey}
          currentSessionId={currentSessionId}
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
        </VoiceChatShell>
      </AuthGuard>
    )
  }

  // ── Main chat screen ────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <VoiceChatShell
        isDark={isDark}
        sidebarOpen={sidebarOpen}
        sidebarRefreshKey={sidebarRefreshKey}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSessionSelect={handleSessionSelect}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
      >
        <ShareTestModal
          open={showShareModal}
          onClose={() => handleSkipShare(chatLang)}
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

        {/* Chat body — full-screen avatar for both English and Urdu */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div ref={avatarContainerRef} style={{ position: "relative", flex: 1, overflow: "hidden", background: "#0a0a0a" }}>
            <DIDAvatar
              ref={didRef}
              onSpeakingStart={() => { if (isMountedRef.current) setVoiceState("playing") }}
              onSpeakingEnd={() => { if (isMountedRef.current) setVoiceState("idle") }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />

            {/* Loading spinner while welcome audio processes */}
            {welcomeLoading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.22)" }}>
                <Loader2 size={48} color="var(--sage)" className="animate-spin" style={{ opacity: 0.85 }} />
              </div>
            )}

            {/* Fullscreen toggle — bottom right */}
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              style={{
                position: "absolute", bottom: 24, right: 24, zIndex: 10,
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.65)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.45)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)" }}
            >
              {isFullscreen
                ? <Minimize size={18} color="white" strokeWidth={1.75} />
                : <Maximize size={18} color="white" strokeWidth={1.75} />
              }
            </button>

            {/* Single mic button — bottom center */}
            <div style={{ position: "absolute", bottom: 36, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", pointerEvents: "none" }}>
              <button
                onClick={handleMicClick}
                disabled={welcomeLoading || voiceState === "transcribing" || voiceState === "thinking" || voiceState === "synthesizing"}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: voiceState === "recording" ? "rgba(239,68,68,0.9)" : "rgba(166,124,82,0.92)",
                  backdropFilter: "blur(8px)",
                  border: "2px solid rgba(255,255,255,0.18)",
                  cursor: (welcomeLoading || voiceState === "transcribing" || voiceState === "thinking" || voiceState === "synthesizing") ? "default" : "pointer",
                  opacity: (welcomeLoading || voiceState === "transcribing" || voiceState === "thinking" || voiceState === "synthesizing") ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                  transition: "background 0.2s ease, opacity 0.2s ease",
                  pointerEvents: "auto",
                }}
              >
                {voiceState === "transcribing" || voiceState === "thinking" || voiceState === "synthesizing"
                  ? <Loader2 size={26} color="white" className="animate-spin" />
                  : <Mic size={26} color="white" strokeWidth={1.75} />
                }
              </button>
              <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: 500, color: "rgba(255,255,255,0.75)", letterSpacing: "0.02em", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                {voiceState === "recording" ? (chatLang === "ur" ? "ریکارڈنگ…" : "Recording…") : voiceState === "transcribing" ? (chatLang === "ur" ? "ٹرانسکرائب ہو رہا ہے…" : "Transcribing…") : voiceState === "thinking" ? (chatLang === "ur" ? "سوچ رہا ہے…" : "Thinking…") : voiceState === "synthesizing" ? (chatLang === "ur" ? "پروسیسنگ…" : "Processing…") : voiceState === "playing" ? (chatLang === "ur" ? "بول رہا ہے…" : "Speaking…") : (chatLang === "ur" ? "بولنے کے لیے دبائیں" : "Tap to speak")}
              </span>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes mindease-bounce { 0%,60%,100%{transform:translateY(0);opacity:.65} 30%{transform:translateY(-5px);opacity:1} }
          @keyframes voice-bar { from { height: 4px } to { height: 14px } }
          @keyframes avatar-ring { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(1.18);opacity:0} }
        `}</style>
      </VoiceChatShell>
    </AuthGuard>
  )
}
