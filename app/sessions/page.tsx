"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiGetRecentSessions, type SessionPreview } from "@/lib/api"
import { MessageCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SessionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [loading, setLoading] = useState(true)

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

  // No need for truncation - we'll use short_summary directly

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
                      <button
                        key={session.session_id}
                        onClick={() => handleSessionClick(session.session_id)}
                        className="w-full text-left p-6 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition cursor-pointer group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                            <MessageCircle className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition mb-2">
                              {session.title}
                            </h3>
                            {(session.short_summary || session.summary) && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
                                {session.short_summary || session.summary}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(session.updated_at)}
                            </p>
                          </div>
                        </div>
                      </button>
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

