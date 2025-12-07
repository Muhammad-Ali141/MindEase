"use client"

import { TrendingUp, Calendar, Award, TrendingDown, Minus, Info } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { apiGetSessionCount, apiGetMoodTrend, apiGetStreak, type MoodTrendData } from "@/lib/api"

export function QuickStats() {
  const { user } = useAuth()
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [moodTrend, setMoodTrend] = useState<MoodTrendData[]>([])
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      loadAllData()
    }
  }, [user?.id])

  // Refresh data when component becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        loadAllData()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user?.id])

  const loadAllData = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      const [sessionResponse, trendResponse, streakResponse] = await Promise.all([
        apiGetSessionCount(user.id).catch(() => ({ session_count: 0 })),
        apiGetMoodTrend(user.id).catch(() => ({ trend_data: [], primary_condition: null, test_type: "" })),
        apiGetStreak(user.id).catch(() => ({ current_streak: 0, longest_streak: 0, last_test_date: null }))
      ])
      
      setSessionCount(sessionResponse.session_count)
      setMoodTrend(trendResponse.trend_data || [])
      setStreak({
        current: streakResponse.current_streak || 0,
        longest: streakResponse.longest_streak || 0
      })
    } catch (error) {
      console.error("Failed to load stats:", error)
      setSessionCount(0)
      setMoodTrend([])
      setStreak({ current: 0, longest: 0 })
    } finally {
      setLoading(false)
    }
  }

  // Simple line chart component
  const MoodTrendChart = ({ data }: { data: MoodTrendData[] }) => {
    if (data.length === 0) {
      return (
        <div className="h-24 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
          No data available
        </div>
      )
    }

    // Get last 7 days or all available
    const displayData = data.slice(-7)
    const maxScore = Math.max(...displayData.map(d => d.score), 1)
    const minScore = Math.min(...displayData.map(d => d.score), 0)
    const range = maxScore - minScore || 1

    const width = 200
    const height = 60
    const padding = 10
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Generate points
    const points = displayData.map((item, index) => {
      const x = padding + (index / (displayData.length - 1 || 1)) * chartWidth
      const normalizedScore = (item.score - minScore) / range
      const y = padding + chartHeight - (normalizedScore * chartHeight)
      return { x, y, ...item }
    })

    // Create path for line (only if more than 1 point)
    const pathData = points.length > 1 
      ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : ''

    // Determine overall trend
    // Need at least 2 data points to determine trend
    const overallTrend = data.length >= 2 
      ? (data[data.length - 1].score < data[data.length - 2].score ? "improved" : 
         data[data.length - 1].score > data[data.length - 2].score ? "worsened" : "stable")
      : "insufficient_data"
    
    // Get current severity for single data point
    const currentSeverity = displayData.length === 1 ? displayData[0].severity : null

    return (
      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          {/* Grid lines */}
          {[0, 0.5, 1].map((val) => {
            const y = padding + chartHeight - (val * chartHeight)
            return (
              <line
                key={val}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.1"
              />
            )
          })}
          
          {/* Line (only show if more than 1 point) */}
          {pathData && points.length > 1 && (
            <path
              d={pathData}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-500 dark:text-purple-400"
            />
          )}
          
          {/* Points */}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="currentColor"
              className={
                point.trend === "improved" ? "text-green-500" :
                point.trend === "worsened" ? "text-red-500" :
                "text-gray-400"
              }
            />
          ))}
        </svg>
        
        {/* Trend indicator */}
        <div className="flex items-center gap-1 mt-1 text-xs">
          {overallTrend === "improved" && (
            <>
              <TrendingUp size={12} className="text-green-500" />
              <span className="text-green-600 dark:text-green-400">Improving</span>
            </>
          )}
          {overallTrend === "worsened" && (
            <>
              <TrendingDown size={12} className="text-red-500" />
              <span className="text-red-600 dark:text-red-400">Declining</span>
            </>
          )}
          {overallTrend === "stable" && (
            <>
              <Minus size={12} className="text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">Stable</span>
            </>
          )}
          {overallTrend === "insufficient_data" && currentSeverity && (
            <>
              <Info size={12} className={
                currentSeverity === "severe" || currentSeverity === "extremely severe" 
                  ? "text-red-500" 
                  : currentSeverity === "moderate"
                  ? "text-orange-500"
                  : currentSeverity === "mild"
                  ? "text-yellow-500"
                  : "text-green-500"
              } />
              <span className={
                currentSeverity === "severe" || currentSeverity === "extremely severe" 
                  ? "text-red-600 dark:text-red-400" 
                  : currentSeverity === "moderate"
                  ? "text-orange-600 dark:text-orange-400"
                  : currentSeverity === "mild"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-green-600 dark:text-green-400"
              }>
                Current: {currentSeverity.charAt(0).toUpperCase() + currentSeverity.slice(1)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                (Need more data for trend)
              </span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Sessions Completed */}
      <div
        data-tour-target="sessions-completed"
        className="bg-white dark:bg-slate-800 p-6 h-full rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
      >
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
      <div
        data-tour-target="mood-trend"
        className="bg-white dark:bg-slate-800 p-6 h-full rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 dark:text-gray-300 font-semibold">Mood Trend</h3>
          <TrendingUp size={20} className="text-purple-500 dark:text-purple-400" />
        </div>
        {loading ? (
          <div className="h-24 flex items-center justify-center">
            <span className="text-gray-400 dark:text-gray-500">Loading...</span>
          </div>
        ) : (
          <>
            <MoodTrendChart data={moodTrend} />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {moodTrend.length > 0 
                ? moodTrend.length === 1
                  ? `1 assessment - Complete more to see trend`
                  : `${moodTrend.length} assessments tracked`
                : "Complete screening to see trends"}
            </p>
          </>
        )}
      </div>

      {/* Streak */}
      <div
        data-tour-target="current-streak"
        className="bg-white dark:bg-slate-800 p-6 h-full rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 dark:text-gray-300 font-semibold">Current Streak</h3>
          <Award size={20} className="text-amber-500 dark:text-amber-400" />
        </div>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <span className="text-3xl font-bold text-gray-900 dark:text-white">-</span>
          ) : (
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {streak?.current || 0}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {loading 
            ? "Loading..." 
            : streak && streak.current > 0
              ? `🔥 ${streak.current} day${streak.current !== 1 ? 's' : ''} in a row`
              : streak && streak.longest > 0
                ? `Best: ${streak.longest} days`
                : "Start your daily check-in"}
        </p>
      </div>
    </div>
  )
}
