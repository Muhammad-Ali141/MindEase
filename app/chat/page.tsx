"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiChatMessage, apiChatWelcome, apiChatSummary, apiIncrementSessionCount, apiSaveSession, apiGetSessionById, type ChatMessage } from "@/lib/api"
import { ChatInterface } from "@/components/chat-interface"
import { ArrowLeft, Loader2 } from "lucide-react"
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
  const [isEnding, setIsEnding] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

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
      const response = await apiChatWelcome(
        user!.id,
        user!.first_name || null
      )
      
      // Add welcome message to messages
      setMessages([
        {
          role: "assistant",
          content: response.welcome_message,
        },
      ])
      setCurrentSessionId(null) // New session
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
      setMessages(response.session.messages)
      setCurrentSessionId(sessionId)
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
    }
    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const response = await apiChatMessage(
        message,
        user.id,
        user.first_name || null,
        user.gender || null,
        messages
      )

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.response,
      }
      setMessages((prev) => [...prev, assistantMessage])
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

    // Check if there's actual conversation (more than just welcome message)
    const userMessages = messages.filter(msg => msg.role === "user")
    if (userMessages.length === 0) {
      // No actual conversation, just go back to dashboard
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
      
      // Increment session count only if this is a NEW session (not continuing an old one)
      if (!currentSessionId) {
        try {
          await apiIncrementSessionCount(user.id)
        } catch (error) {
          // Log error but don't block summary display
          console.error("Failed to increment session count:", error)
        }
      }
      
      // Save session (create new or update existing)
      try {
        await apiSaveSession(
          user.id,
          messages,
          response.summary,
          currentSessionId || undefined,
          user.first_name || null,
          user.gender || null
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
                  <div className="prose prose-lg max-w-none dark:prose-invert">
                    <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                      {summary}
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

