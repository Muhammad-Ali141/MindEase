/**
 * Simple module-level caches that survive SPA navigation.
 * Each cache is keyed by user ID and has a TTL.
 * Cleared automatically on user change or full page reload.
 */

import type { DiagnosticTestStatus } from "@/lib/api"

type CacheEntry<T> = { userId: string; data: T; ts: number }

const DEFAULT_TTL = 60_000 // 60s

// ── Sessions cache (used by chat-sidebar, sessions page) ────────────────────
let _sessionsCache: CacheEntry<{ sessions: any[]; total: number }> | null = null

export function getSessionsCache(userId: string) {
  if (_sessionsCache && _sessionsCache.userId === userId) {
    return { data: _sessionsCache.data, fresh: Date.now() - _sessionsCache.ts < DEFAULT_TTL }
  }
  return null
}

export function setSessionsCache(userId: string, data: { sessions: any[]; total: number }) {
  _sessionsCache = { userId, data, ts: Date.now() }
}

// ── Test history cache (used by share-test-modal) ───────────────────────────
let _testHistoryCache: CacheEntry<{ results: any[] }> | null = null

export function getTestHistoryCache(userId: string) {
  if (_testHistoryCache && _testHistoryCache.userId === userId) {
    return { data: _testHistoryCache.data, fresh: Date.now() - _testHistoryCache.ts < DEFAULT_TTL }
  }
  return null
}

export function setTestHistoryCache(userId: string, data: { results: any[] }) {
  _testHistoryCache = { userId, data, ts: Date.now() }
}

// ── Diagnostic test status cache (used by diagnostic-test page) ─────────────
let _testStatusCache: CacheEntry<DiagnosticTestStatus> | null = null

export function getTestStatusCache(userId: string) {
  if (_testStatusCache && _testStatusCache.userId === userId) {
    return { data: _testStatusCache.data, fresh: Date.now() - _testStatusCache.ts < DEFAULT_TTL }
  }
  return null
}

export function setTestStatusCache(userId: string, data: DiagnosticTestStatus) {
  _testStatusCache = { userId, data, ts: Date.now() }
}
