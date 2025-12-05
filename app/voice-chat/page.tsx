"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiChatWelcome, apiChatMessage, apiSTTTranscribe, apiChatSummary, apiSaveSession, apiGetSessionById, apiToggleSessionStar, apiTTSSynthesize, type ChatMessage, type Session } from "@/lib/api"
import { ArrowLeft, Mic2, Square, Loader2, Star, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useMicrophone } from "@/hooks/use-microphone"

export default function VoiceChatPage() {
  const router = useRouter()
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [welcomeLoading, setWelcomeLoading] = useState(true)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary] = useState<string>("")
  const [savedSession, setSavedSession] = useState<Session | null>(null)
  const [isEnding, setIsEnding] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [baselineUserMessageCount, setBaselineUserMessageCount] = useState(0)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const welcomeMessageLoadedRef = useRef(false)
  
  // Microphone hook
  const {
    isRecording,
    hasPermission,
    error: micError,
    startRecording,
    stopRecording,
    requestPermission,
    recordingTime,
  } = useMicrophone()

  // Check for session_id in URL query params or load welcome message
  useEffect(() => {
    if (user && token && !welcomeMessageLoadedRef.current) {
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get("session_id")
      
      if (sessionId) {
        // Load existing session
        loadSession(sessionId)
      } else {
        // Load welcome message for new session (only once)
        welcomeMessageLoadedRef.current = true
        loadWelcomeMessage()
      }
    }
  }, [user, token])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [])

  const loadWelcomeMessage = async () => {
    // Prevent multiple calls
    if (welcomeMessageLoadedRef.current && messages.length > 0) {
      return
    }
    
    try {
      setWelcomeLoading(true)
      setSavedSession(null)
      setShowSummary(false)
      setSummary("")
      
      // Stop any existing audio before loading new welcome message
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      
      const response = await apiChatWelcome(
        user!.id,
        user!.first_name || null
      )
      
      // Get user's language preference for TTS
      let userLanguage = "en" // Default to English
      if (user?.lang_pref) {
        const langPref = user.lang_pref.toLowerCase()
        if (langPref === "urdu" || langPref === "ur") {
          userLanguage = "ur"
        } else if (langPref === "english" || langPref === "en") {
          userLanguage = "en"
        }
      }

      // Synthesize welcome message to audio first
      try {
        setIsSynthesizing(true)
        const audioBlob = await apiTTSSynthesize(response.welcome_message, userLanguage)
        
        // Stop any existing audio before creating new one
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current = null
        }
        
        // Create audio element and play
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        // Set up audio event handlers
        audio.onplay = () => {
          setIsPlayingAudio(true)
        }
        
        audio.onended = () => {
          setIsPlayingAudio(false)
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
        }
        
        audio.onerror = (error) => {
          console.error("Audio playback error:", error)
          setIsPlayingAudio(false)
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
        }
        
        audio.onpause = () => {
          setIsPlayingAudio(false)
        }
        
        // Store audio reference
        currentAudioRef.current = audio
        
        // Add welcome message to messages (after TTS is ready)
        setMessages([
          {
            role: "assistant",
            content: response.welcome_message,
            content_type: "text",
          },
        ])
        
        // Play audio automatically
        await audio.play()
      } catch (error: any) {
        console.error("Welcome message TTS error:", error)
        // Still show message even if TTS fails
        setMessages([
          {
            role: "assistant",
            content: response.welcome_message,
            content_type: "text",
          },
        ])
      } finally {
        setIsSynthesizing(false)
      }
      
      setCurrentSessionId(null) // New session
      setBaselineUserMessageCount(0)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load welcome message",
        variant: "destructive",
      })
    } finally {
      setWelcomeLoading(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    try {
      setWelcomeLoading(true)
      const response = await apiGetSessionById(user!.id, sessionId)
      
      // Load messages from session
      const session = response.session
      setCurrentSessionId(session.session_id)
      setSavedSession(session)
      setBaselineUserMessageCount(
        session.has_full_transcript
          ? session.messages.filter((msg) => msg.role === "user").length
          : 0
      )

      let initialMessages: ChatMessage[] = []

      if (session.has_full_transcript && session.messages.length > 0) {
        initialMessages = session.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          emotion_label: msg.emotion_label,
          emotion_score: msg.emotion_score,
          metadata: msg.metadata,
          content_type: msg.content_type,
        }))
      } else {
        const reminder = session.resume_message
          ? session.resume_message
          : session.summary
            ? `${session.summary}\n\nLet's pick up from where we left off. How are you feeling now?`
            : "Let's continue from our previous conversation. How are you feeling now?"
        initialMessages = [
          {
            role: "assistant",
            content: reminder,
            content_type: "text",
          },
        ]
      }

      setMessages(initialMessages)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load session",
        variant: "destructive",
      })
      // Fallback to welcome message
      loadWelcomeMessage()
    } finally {
      setWelcomeLoading(false)
    }
  }

  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  const handleEndChat = async () => {
    if (isEnding || !user || !token || messages.length === 0) return

    const currentUserMessages = messages.filter((msg) => msg.role === "user").length
    if (currentUserMessages <= baselineUserMessageCount) {
      router.push("/dashboard")
      return
    }

    setIsEnding(true)
    setLoading(true)

    try {
      // Get summary
      const response = await apiChatSummary(
        user.id,
        user.first_name || null,
        user.gender || null,
        messages
      )
      
      // Check if summary indicates no conversation
      if (response.summary && response.summary.includes("No conversation to summarize")) {
        // No actual conversation, just go back to dashboard (don't increment count)
        router.push("/dashboard")
        return
      }
      
      // Save session (create new or update existing)
      try {
        const saveResponse = await apiSaveSession(
          user.id,
          messages,
          response.summary,
          currentSessionId || undefined,
          user.first_name || null,
          user.gender || null
        )
        setSavedSession(saveResponse.session)
        setCurrentSessionId(saveResponse.session.session_id)
        setBaselineUserMessageCount(
          saveResponse.session.messages.filter((msg) => msg.role === "user").length
        )
      } catch (error) {
        // Log error but don't block summary display
        console.error("Failed to save session:", error)
      }
      
      setSummary(response.summary)
      setShowSummary(true)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      })
      // Still allow navigation even if summary fails
      router.push("/dashboard")
    } finally {
      setLoading(false)
      setIsEnding(false)
    }
  }

  const handleToggleStar = async () => {
    if (!user || !savedSession) return

    if (savedSession.state !== "full" && !savedSession.is_starred) {
      toast({
        title: "Cannot star this session",
        description: "Archived sessions cannot be starred because the detailed transcript is no longer available.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await apiToggleSessionStar(user.id, savedSession.session_id, !savedSession.is_starred)
      setSavedSession((prev) =>
        prev
          ? {
              ...prev,
              is_starred: response.session.is_starred,
              state: response.session.state,
              has_full_transcript: response.session.has_full_transcript,
              resume_message: response.session.resume_message ?? prev.resume_message,
            }
          : prev
      )
      toast({
        title: response.session.is_starred ? "Session starred" : "Session unstarred",
        description: response.session.is_starred
          ? "We'll keep this session in full detail for you."
          : "This session may be archived if newer ones are created.",
      })
    } catch (error: any) {
      toast({
        title: "Unable to update star",
        description: error.message || "Please try again later.",
        variant: "destructive",
      })
    }
  }

  // Handle microphone button click
  const handleMicClick = async () => {
    try {
      if (isRecording) {
        // Stop recording and process
        const audioBlob = await stopRecording()
        if (audioBlob) {
          // Process the recording: Transcribe → Send to Chat API
          await processRecording(audioBlob)
        }
      } else {
        // Start recording
        if (hasPermission === false) {
          // Permission was denied, request again
          const granted = await requestPermission()
          if (!granted) {
            toast({
              title: "Microphone access denied",
              description: micError || "Please allow microphone access to record audio.",
              variant: "destructive",
            })
            return
          }
        }
        
        await startRecording()
      }
    } catch (error: any) {
      toast({
        title: "Recording error",
        description: error.message || "Failed to start/stop recording",
        variant: "destructive",
      })
    }
  }

  // Process recording: Transcribe audio and send to chat API
  const processRecording = async (audioBlob: Blob) => {
    if (!user || !token) return

    try {
      setIsTranscribing(true)

      // Step 1: Transcribe audio
      const sttResponse = await apiSTTTranscribe(audioBlob, "en")
      const transcript = sttResponse.transcript.trim()

      if (!transcript) {
        toast({
          title: "No speech detected",
          description: "Please try speaking again.",
          variant: "destructive",
        })
        setIsTranscribing(false)
        return
      }

      // Step 2: Add user message (transcript) to chat
      const userMessage: ChatMessage = {
        role: "user",
        content: transcript,
        content_type: "audio", // Mark as voice message
      }
      const historyForRequest = [...messages, userMessage]
      setMessages(historyForRequest)
      setIsTranscribing(false)
      setLoading(true)

      // Step 3: Send transcript to chat API
      const chatResponse = await apiChatMessage(
        transcript,
        user.id,
        user.first_name || null,
        user.gender || null,
        historyForRequest
      )

      const primaryEmotion = chatResponse.emotions?.[0]

      // Step 4: Prepare assistant message (but don't display yet)
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: chatResponse.response,
        content_type: "text",
      }

      // Step 5: Synthesize assistant response to audio FIRST (before displaying text)
      try {
        setIsSynthesizing(true)
        
        // Stop any currently playing audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current = null
        }

        // Get user's language preference (map to TTS language code)
        let userLanguage = "en" // Default to English
        if (user?.lang_pref) {
          const langPref = user.lang_pref.toLowerCase()
          if (langPref === "urdu" || langPref === "ur") {
            userLanguage = "ur"
          } else if (langPref === "english" || langPref === "en") {
            userLanguage = "en"
          }
        }
        
        // Synthesize text to speech (this takes time, so we do it before showing text)
        const audioBlob = await apiTTSSynthesize(chatResponse.response, userLanguage)
        
        // NOW display the message (text and audio ready at the same time)
        setMessages((prev) => {
          const updated = [...prev]
          // Update user message with emotion if available
          if (primaryEmotion) {
            for (let i = updated.length - 1; i >= 0; i--) {
              const msg = updated[i]
              if (msg.role === "user") {
                updated[i] = {
                  ...msg,
                  emotion_label: primaryEmotion.emotion,
                  emotion_score: primaryEmotion.score,
                }
                break
              }
            }
          }
          updated.push(assistantMessage)
          return updated
        })
        
        // Create audio element and play
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        // Set up audio event handlers
        audio.onplay = () => {
          setIsPlayingAudio(true)
        }
        
        audio.onended = () => {
          setIsPlayingAudio(false)
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
        }
        
        audio.onerror = (error) => {
          console.error("Audio playback error:", error)
          setIsPlayingAudio(false)
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
          // Don't show error toast - audio is optional, text is already shown
        }
        
        audio.onpause = () => {
          setIsPlayingAudio(false)
        }
        
        // Store audio reference
        currentAudioRef.current = audio
        
        // Play audio automatically
        await audio.play()
        
      } catch (error: any) {
        console.error("TTS synthesis error:", error)
        // If TTS fails, still show the message
        setMessages((prev) => {
          const updated = [...prev]
          // Update user message with emotion if available
          if (primaryEmotion) {
            for (let i = updated.length - 1; i >= 0; i--) {
              const msg = updated[i]
              if (msg.role === "user") {
                updated[i] = {
                  ...msg,
                  emotion_label: primaryEmotion.emotion,
                  emotion_score: primaryEmotion.score,
                }
                break
              }
            }
          }
          updated.push(assistantMessage)
          return updated
        })
      } finally {
        setIsSynthesizing(false)
      }
    } catch (error: any) {
      setIsTranscribing(false)
      setLoading(false)
      
      // Handle specific error messages
      let errorMessage = error.message || "Failed to process recording"
      
      if (errorMessage.includes("No speech detected")) {
        toast({
          title: "No speech detected",
          description: "Please try speaking again.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        toast({
          title: "Network error",
          description: "Please check your connection and try again.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  if (showSummary) {
    return (
      <AuthGuard>
        <div className="fixed inset-0 flex h-screen w-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-950/20 dark:to-pink-950/20 z-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-4xl mx-auto">
                <Button
                  onClick={handleBackToDashboard}
                  variant="ghost"
                  className="mb-6"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-purple-100 dark:border-purple-900/30">
                  <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    Session Summary
                  </h2>
                {savedSession && (
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(savedSession.updated_at).toLocaleString()}
                      </p>
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {savedSession.title || "Therapy Session"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleStar}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                        savedSession.is_starred
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <StarIcon filled={savedSession.is_starred} />
                      {savedSession.is_starred ? "Starred" : "Star Session"}
                    </button>
                  </div>
                )}
                  <div className="prose prose-lg max-w-none dark:prose-invert">
                    <div className="space-y-3 text-gray-700 dark:text-gray-300 leading-relaxed">
                      {summary.split(/\n{2,}/).map((paragraph, index) => (
                        <p key={index} className="whitespace-pre-line">
                          {paragraph.trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <Button
                      onClick={handleBackToDashboard}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      Return to Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="fixed inset-0 flex h-screen w-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-950/20 dark:to-pink-950/20 z-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 pb-0">
              <Button
                onClick={handleEndChat}
                variant="ghost"
                disabled={isEnding || loading}
                className="mb-4"
              >
                {isEnding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ending chat...
                  </>
                ) : (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    End Chat
                  </>
                )}
              </Button>
            </div>
            
            {/* Voice Chat Interface */}
            <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                {messages.length === 0 && welcomeLoading && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-lg">Preparing your voice companion...</p>
                      <p className="text-sm mt-2 text-gray-400">Setting up everything for you</p>
                    </div>
                  </div>
                )}
                
                {messages.length === 0 && !welcomeLoading && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <p className="text-lg">Start a voice conversation...</p>
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {message.role === "assistant" ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-sm">AI</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-6 py-4 shadow-md border border-purple-100 dark:border-purple-900/30 max-w-[80%]">
                          <div className="flex items-start gap-2">
                            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap flex-1">
                              {message.content}
                            </p>
                            {/* Show audio icon for the last assistant message if audio is available */}
                            {index === messages.length - 1 && message.role === "assistant" && (
                              <div className="flex-shrink-0 mt-1">
                                {isSynthesizing ? (
                                  <Loader2 size={16} className="text-purple-600 dark:text-purple-400 animate-spin" />
                                ) : isPlayingAudio ? (
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse"></div>
                                  </div>
                                ) : (
                                  <Volume2 size={16} className="text-purple-600 dark:text-purple-400" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex justify-end">
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-2xl rounded-tr-sm px-6 py-4 shadow-md max-w-[80%]">
                          <div className="flex items-start gap-2">
                            <p className="text-white whitespace-pre-wrap flex-1">
                              {message.content}
                            </p>
                            {message.content_type === "audio" && (
                              <Mic2 size={16} className="text-white/80 flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Transcribing indicator */}
                {isTranscribing && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Mic2 size={20} className="text-white" />
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-6 py-4 shadow-md border border-emerald-100 dark:border-emerald-900/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300 ml-2">Transcribing...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading indicator (AI thinking) */}
                {(loading || welcomeLoading) && messages.length > 0 && !isTranscribing && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">AI</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-6 py-4 shadow-md border border-purple-100 dark:border-purple-900/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300 ml-2">Your companion is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TTS Synthesis indicator - only show for non-welcome messages */}
                {isSynthesizing && !loading && !welcomeLoading && messages.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <Volume2 size={20} className="text-white" />
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-6 py-4 shadow-md border border-purple-100 dark:border-purple-900/30">
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="text-purple-600 dark:text-purple-400 animate-spin" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">Generating audio...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Microphone Button - Prominent, Green/Emerald Theme */}
              <div className="flex flex-col items-center mb-4">
                <button
                  onClick={handleMicClick}
                  className={`w-20 h-20 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group ${
                    isRecording
                      ? "bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 animate-pulse"
                      : "bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 hover:from-emerald-600 hover:to-emerald-700 dark:hover:from-emerald-700 dark:hover:to-emerald-800"
                  }`}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  disabled={welcomeLoading || isTranscribing || loading || isSynthesizing}
                >
                  {isRecording ? (
                    <Square 
                      size={24} 
                      className="text-white group-hover:scale-110 transition-transform" 
                    />
                  ) : (
                    <Mic2 
                      size={32} 
                      className="text-white group-hover:scale-110 transition-transform" 
                    />
                  )}
                </button>
                
                {/* Recording Status Indicator */}
                <div className="text-center mt-3">
                  {micError ? (
                    <div className="text-sm text-red-600 dark:text-red-400 mb-2">
                      {micError}
                    </div>
                  ) : null}
                  {isRecording ? (
                    <div className="text-sm text-red-600 dark:text-red-400 font-semibold">
                      Recording... {recordingTime}s
                    </div>
                  ) : isTranscribing ? (
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                      Transcribing your speech...
                    </div>
                  ) : loading ? (
                    <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                      Your companion is thinking...
                    </div>
                  ) : isSynthesizing ? (
                    <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                      Generating audio...
                    </div>
                  ) : isPlayingAudio ? (
                    <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                      Playing audio...
                    </div>
                  ) : hasPermission === false ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Microphone access denied. Click to request permission.
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Click the microphone to start recording
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Star
      className="h-4 w-4"
      strokeWidth={1.5}
      fill={filled ? "currentColor" : "none"}
    />
  )
}

