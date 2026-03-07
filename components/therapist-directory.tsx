"use client"

import { MapPin, ArrowRight } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useMemo, useEffect, useState } from "react"
import Link from "next/link"
import { apiGetTherapists, type TherapistListItem } from "@/lib/api"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

function normalizeLocation(s: string | undefined | null): string {
  if (!s || typeof s !== "string") return ""
  return s.trim().toLowerCase()
}

function therapistMatchesUserLocation(
  t: TherapistListItem,
  userCity: string,
  userNearestCity: string
): "exact_city" | "nearest_region" | "other" {
  const tCity = normalizeLocation(t.city)
  const tRegion = normalizeLocation(t.region)
  if (userCity && tCity === userCity) return "exact_city"
  if (userNearestCity && (tCity === userNearestCity || tRegion === userNearestCity)) return "nearest_region"
  return "other"
}

const PREVIEW_LIMIT = 4

export function TherapistDirectory() {
  const { user } = useAuth()
  const [therapists, setTherapists] = useState<TherapistListItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const cityParam = useMemo(() => {
    const userCity = (user?.city || "").trim()
    const nearest  = (user?.nearest_major_city || "").trim()
    return userCity || nearest || undefined
  }, [user?.city, user?.nearest_major_city])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    apiGetTherapists({ city: cityParam, limit: PREVIEW_LIMIT })
      .then(res => { if (!cancelled) setTherapists(res.therapists) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cityParam])

  const { therapistsWithMatch, locationLabel } = useMemo(() => {
    const userCity    = normalizeLocation(user?.city)
    const userNearest = normalizeLocation(user?.nearest_major_city)
    const withMatch = therapists.map(t => ({
      therapist: t,
      match: therapistMatchesUserLocation(t, userCity, userNearest),
    }))
    const order = { exact_city: 0, nearest_region: 1, other: 2 }
    withMatch.sort((a, b) => order[a.match] - order[b.match])
    let locationLabel = "All regions"
    if (user?.city) locationLabel = user.city
    else if (user?.nearest_major_city) locationLabel = user.nearest_major_city
    return { therapistsWithMatch: withMatch, locationLabel }
  }, [user?.city, user?.nearest_major_city, therapists])

  return (
    <div
      data-tour-target="find-therapist"
      style={{
        ...sans,
        backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
        backdropFilter: "blur(8px)",
        borderRadius: 16, border: "1px solid var(--border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "1.125rem 1.375rem 0.875rem",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sage)", marginBottom: "0.2rem" }}>
            Connect
          </p>
          <h2 style={{ ...serif, fontSize: "1.25rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
            Find a Professional Therapist
          </h2>
          {cityParam && (
            <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.2rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MapPin size={11} />
              Showing near {locationLabel}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/therapists"
          style={{
            ...sans, display: "inline-flex", alignItems: "center", gap: "0.25rem",
            fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)",
            textDecoration: "none",
          }}
        >
          View all <ArrowRight size={13} />
        </Link>
      </div>

      {/* 2×2 card grid */}
      <div style={{ padding: "1rem 1.25rem" }}>
        {error && (
          <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--destructive)", marginBottom: "0.75rem" }}>{error}</p>
        )}
        {loading ? (
          <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>Loading…</p>
        ) : therapistsWithMatch.length === 0 ? (
          <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
            No therapists found for your area.{" "}
            <Link href="/dashboard/therapists" style={{ color: "var(--primary)", textDecoration: "none" }}>Browse all</Link>
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
            {therapistsWithMatch.slice(0, PREVIEW_LIMIT).map(({ therapist: t, match }) => {
              const isNear = match && match !== "other"
              const initial = (t.name || "T").charAt(0).toUpperCase()
              const profileUrl = t.website || t.profile_url
              return (
                <div
                  key={t.id}
                  style={{
                    borderRadius: 11, padding: "0.75rem 0.875rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "color-mix(in srgb, var(--muted) 25%, transparent)",
                    transition: "border-color 0.15s ease, background-color 0.15s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "rgba(166,124,82,0.35)"
                    e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--muted) 45%, transparent)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--border)"
                    e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--muted) 25%, transparent)"
                  }}
                >
                  {/* Top row: avatar + name + near badge */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                      background: "linear-gradient(135deg, #7a5535, #a67c52)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(166,124,82,0.2)",
                    }}>
                      <span style={{ ...sans, fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
                        {initial}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
                        <p style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.name}
                        </p>
                        {isNear && (
                          <span style={{
                            ...sans, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.06em",
                            padding: "0.1rem 0.35rem", borderRadius: 100, flexShrink: 0,
                            backgroundColor: "color-mix(in srgb, var(--sage) 15%, transparent)",
                            color: "var(--sage)", textTransform: "uppercase",
                          }}>
                            Near you
                          </span>
                        )}
                      </div>
                      {t.credentials && (
                        <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "0.05rem" }}>
                          {t.credentials}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom row: location + profile link */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)" }}>
                    {(t.city || t.region) ? (
                      <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <MapPin size={9} style={{ color: "var(--primary)", flexShrink: 0 }} />
                        {[t.city, t.region].filter(Boolean).join(", ")}
                      </p>
                    ) : <span />}
                    {profileUrl && (
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...sans, flexShrink: 0,
                          display: "inline-flex", alignItems: "center", gap: "0.2rem",
                          fontSize: "0.6875rem", fontWeight: 600, color: "var(--primary)",
                          textDecoration: "none",
                        }}
                      >
                        Profile <ArrowRight size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
