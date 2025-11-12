"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiGetRecentSessions, apiToggleSessionStar, type SessionPreview } from "@/lib/api"
import { MessageCircle, ArrowLeft, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function SessionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (user?.id) {
      loadAllSessions()
    }
  }, [user?.id])

  const loadAllSessions = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      // Pass 0 or large number to get all sessions
      const response = await apiGetRecentSessions(user.id, 0)
      setSessions(response.sessions)
    } catch (error) {
      console.error("Failed to load sessions:", error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSessionClick = (sessionId: string) => {
    router.push(`/chat?session_id=${sessionId}`)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return "Today"
      if (diffDays === 1) return "Yesterday"
      if (diffDays < 7) return `${diffDays} days ago`
      return date.toLocaleDateString()
    } catch {
      return "Recent"
    }
  }

  const toggleStar = async (session: SessionPreview) => {
    if (!user) return

    if (session.state !== "full" && !session.is_starred) {
      toast({
        title: "Cannot star session",
        description: "Archived sessions cannot be starred because the detailed transcript is no longer available.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await apiToggleSessionStar(user.id, session.session_id, !session.is_starred)
      setSessions((prev) =>
        prev.map((item) =>
          item.session_id === session.session_id ? { ...item, ...response.session } : item
        )
      )
      toast({
        title: response.session.is_starred ? "Session starred" : "Session unstarred",
        description: response.session.is_starred
          ? "We'll keep this session available in detail for you."
          : "This session may be archived if newer sessions are created.",
      })
    } catch (error: any) {
      toast({
        title: "Unable to update session",
        description: error.message || "Please try again later.",
        variant: "destructive",
      })
    }
  }

  return (
    <AuthGuard>
      <div className="fixed inset-0 flex h-screen w-screen bg-gray-50 dark:bg-slate-900 z-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-6xl mx-auto">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="ghost"
                className="mb-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-slate-700">
                <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                  All Sessions
                </h1>

                {loading ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                    <p>Loading sessions...</p>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                    <p>No sessions found</p>
                    <p className="text-sm mt-2">Your session history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session) => (
                      <div
                        key={session.session_id}
                        className="w-full p-6 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
                      >
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => handleSessionClick(session.session_id)}
                            className="flex-1 text-left flex gap-4"
                          >
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                              <MessageCircle className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition mb-2">
                                {session.title}
                              </h3>
                              {(session.short_summary || session.summary) && (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 leading-relaxed line-clamp-3">
                                  {session.short_summary || session.summary}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(session.updated_at)}
                              </p>
                              {!session.has_full_transcript && (
                                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                  Summary view only
                                </p>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStar(session)}
                            className={`mt-1 inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                              session.is_starred
                                ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700/60"
                            }`}
                          >
                            <Star
                              className="h-4 w-4 mr-2"
                              strokeWidth={1.5}
                              fill={session.is_starred ? "currentColor" : "none"}
                            />
                            {session.is_starred ? "Starred" : "Star"}
                          </button>
                        </div>
                      </div>
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

