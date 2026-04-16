"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useAuth } from "@/context/AuthContext"
import {
  apiGetDashboardData,
  type DashboardData,
  type SessionPreview,
  type DiagnosticTestStatus,
  type TestHistoryItem,
  type MoodTrendData,
  type TherapistListItem,
} from "@/lib/api"
import { setTestHistoryCache, setTestStatusCache } from "@/lib/cache"

type DashboardCtx = {
  loading: boolean
  sessionCount: number
  sessions: SessionPreview[]
  sessionsTotal: number
  testStatus: DiagnosticTestStatus | null
  testHistory: TestHistoryItem[]
  moodTrend: MoodTrendData[]
  primaryCondition: string | null
  streak: { current: number; longest: number } | null
  therapists: TherapistListItem[]
  therapistsTotal: number
  patchSession: (sessionId: string, patch: Partial<SessionPreview>) => void
}

const DashboardDataContext = createContext<DashboardCtx>({
  loading: true,
  sessionCount: 0,
  sessions: [],
  sessionsTotal: 0,
  testStatus: null,
  testHistory: [],
  moodTrend: [],
  primaryCondition: null,
  streak: null,
  therapists: [],
  therapistsTotal: 0,
  patchSession: () => {},
})

// ── Module-level cache ──────────────────────────────────────────────────────
// Survives route changes (SPA navigation) so revisiting /dashboard is instant.
// Cleared on full page reload or when user changes.
let _cache: { userId: string; data: DashboardData; ts: number } | null = null
const CACHE_TTL = 60_000 // 60s — show stale data instantly, refresh in background

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // Seed state from cache if it matches the current user
  const cached = _cache && user?.id && _cache.userId === user.id ? _cache.data : null
  const [loading, setLoading] = useState(!cached)
  const [data, setData] = useState<DashboardData | null>(cached)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const city = (user as any).city || (user as any).nearest_major_city || undefined

    // If we have fresh cache, skip the loading state but still refresh in background
    const hasFreshCache = _cache && _cache.userId === user.id && Date.now() - _cache.ts < CACHE_TTL
    if (!hasFreshCache) {
      setLoading(true)
    }

    apiGetDashboardData(user.id, city, 4, 5)
      .then(d => {
        if (cancelled) return
        _cache = { userId: user.id, data: d, ts: Date.now() }
        setData(d)
        // Seed shared caches so downstream pages (chat, diagnostic-test) skip redundant fetches
        if (d.test_history) setTestHistoryCache(user.id, { results: d.test_history })
        if (d.test_status) setTestStatusCache(user.id, d.test_status)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [user?.id])

  const patchSession = useCallback((sessionId: string, patch: Partial<SessionPreview>) => {
    setData(prev => {
      if (!prev) return prev
      const updated = {
        ...prev,
        sessions: {
          ...prev.sessions,
          sessions: prev.sessions.sessions.map(s =>
            s.session_id === sessionId ? { ...s, ...patch } : s
          ),
        },
      }
      // Also update cache
      if (_cache && _cache.data === prev) {
        _cache = { ..._cache, data: updated }
      }
      return updated
    })
  }, [])

  const ctx: DashboardCtx = {
    loading,
    sessionCount: data?.session_count ?? 0,
    sessions: data?.sessions.sessions ?? [],
    sessionsTotal: data?.sessions.total ?? 0,
    testStatus: data?.test_status ?? null,
    testHistory: data?.test_history ?? [],
    moodTrend: data?.mood_trend.trend_data ?? [],
    primaryCondition: data?.mood_trend.primary_condition ?? null,
    streak: data?.streak
      ? { current: data.streak.current_streak, longest: data.streak.longest_streak }
      : null,
    therapists: data?.therapists.therapists ?? [],
    therapistsTotal: data?.therapists.total ?? 0,
    patchSession,
  }

  return (
    <DashboardDataContext.Provider value={ctx}>
      {children}
    </DashboardDataContext.Provider>
  )
}

export function useDashboardData() {
  return useContext(DashboardDataContext)
}
