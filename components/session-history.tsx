"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { apiGetRecentSessions, type SessionPreview } from "@/lib/api"
import { MessageCircle } from "lucide-react"

export function SessionHistory() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      loadRecentSessions()
    }
  }, [user?.id])

  // Refresh when component becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        loadRecentSessions()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user?.id])

  const loadRecentSessions = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      const response = await apiGetRecentSessions(user.id, 3)
      setSessions(response.sessions)
    } catch (error) {
      console.error("Failed to load recent sessions:", error)
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

  return (
    <div className="bg-white dark:bg-slate-800 overflow-hidden h-full flex flex-col rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Sessions</h2>
      </div>
      <div className="p-6 flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>No recent sessions found</p>
            <p className="text-sm mt-2">Your session history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => handleSessionClick(session.session_id)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                      {session.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(session.updated_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 text-center">
        <button 
          onClick={() => router.push("/sessions")}
          className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition"
        >
          View All Sessions
        </button>
      </div>
    </div>
  )
}
