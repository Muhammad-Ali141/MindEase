"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiChatMessage, apiChatWelcome, apiChatSummary, apiSaveSession, apiGetSessionById, apiToggleSessionStar, type ChatMessage, type Session } from "@/lib/api"
import { ChatInterface } from "@/components/chat-interface"
import { ArrowLeft, Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function ChatPage() {
  const router = useRouter()
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [welcomeLoading, setWelcomeLoading] = useState(true)
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary] = useState<string>("")
  const [savedSession, setSavedSession] = useState<Session | null>(null)
  const [isEnding, setIsEnding] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [baselineUserMessageCount, setBaselineUserMessageCount] = useState(0)

  // Check for session_id in URL query params
  useEffect(() => {
    if (user && token) {
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get("session_id")
      
      if (sessionId) {
        // Load existing session
        loadSession(sessionId)
      } else {
        // Load welcome message for new session
        loadWelcomeMessage()
      }
    }
  }, [user, token])

  const loadWelcomeMessage = async () => {
    try {
      setWelcomeLoading(true)
      setSavedSession(null)
      setShowSummary(false)
      setSummary("")
      const response = await apiChatWelcome(
        user!.id,
        user!.first_name || null
      )
      
      // Add welcome message to messages
      setMessages([
        {
          role: "assistant",
          content: response.welcome_message,
          content_type: "text",
        },
      ])
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

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || loading || !user || !token) return

    // Add user message immediately
    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      content_type: "text",
    }
    const historyForRequest = [...messages, userMessage]
    setMessages(historyForRequest)
    setLoading(true)

    try {
      const response = await apiChatMessage(
        message,
        user.id,
        user.first_name || null,
        user.gender || null,
        historyForRequest
      )

      const primaryEmotion = response.emotions?.[0]

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.response,
        content_type: "text",
      }
      setMessages((prev) => {
        const updated = [...prev]
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      })
      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
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

  const handleBackToDashboard = () => {
    router.push("/dashboard")
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
            
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              loading={loading || welcomeLoading}
              onResponseComplete={() => {
                // Auto-focus input after AI response
                setTimeout(() => {
                  const textarea = document.querySelector('textarea[placeholder*="Type your message"]') as HTMLTextAreaElement
                  if (textarea) {
                    textarea.focus()
                  }
                }, 100)
              }}
            />
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

