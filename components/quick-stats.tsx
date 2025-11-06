"use client"

import { TrendingUp, Calendar, Award } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { apiGetSessionCount } from "@/lib/api"

export function QuickStats() {
  const { user } = useAuth()
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      loadSessionCount()
    }
  }, [user?.id])

  // Refresh count when component becomes visible (user returns from chat)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        loadSessionCount()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user?.id])

  const loadSessionCount = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      const response = await apiGetSessionCount(user.id)
      setSessionCount(response.session_count)
    } catch (error) {
      console.error("Failed to load session count:", error)
      setSessionCount(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Sessions Completed */}
      <div className="bg-white dark:bg-slate-800 p-6 h-full rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 dark:text-gray-300 font-semibold">Sessions Completed</h3>
          <Calendar size={20} className="text-blue-500 dark:text-blue-400" />
        </div>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <span className="text-3xl font-bold text-gray-900 dark:text-white">-</span>
          ) : (
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {sessionCount !== null ? sessionCount : 0}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {loading ? "Loading..." : sessionCount !== null && sessionCount > 0 ? "Total sessions" : "No sessions yet"}
        </p>
      </div>

      {/* Mood Trend */}
      <div className="bg-white dark:bg-slate-800 p-6 h-full rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 dark:text-gray-300 font-semibold">Mood Trend</h3>
          <TrendingUp size={20} className="text-purple-500 dark:text-purple-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">-</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No data available</p>
      </div>

      {/* Streak */}
      <div className="bg-white dark:bg-slate-800 p-6 h-full rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 dark:text-gray-300 font-semibold">Current Streak</h3>
          <Award size={20} className="text-amber-500 dark:text-amber-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">-</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No data available</p>
      </div>
    </div>
  )
}
