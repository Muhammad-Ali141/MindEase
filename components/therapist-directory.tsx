"use client"

import { MapPin, ArrowRight } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useMemo, useEffect, useState } from "react"
import Link from "next/link"
import { apiGetTherapists, type TherapistListItem } from "@/lib/api"
import { TherapistCard } from "@/components/therapist-card"

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cityParam = useMemo(() => {
    const userCity = (user?.city || "").trim()
    const nearest = (user?.nearest_major_city || "").trim()
    return userCity || nearest || undefined
  }, [user?.city, user?.nearest_major_city])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiGetTherapists({ city: cityParam, limit: PREVIEW_LIMIT })
      .then((res) => {
        if (!cancelled) setTherapists(res.therapists)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [cityParam])

  const { therapistsWithMatch, locationLabel } = useMemo(() => {
    const userCity = normalizeLocation(user?.city)
    const userNearest = normalizeLocation(user?.nearest_major_city)
    const withMatch = therapists.map((t) => ({
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
      className="bg-white dark:bg-slate-800 overflow-hidden flex flex-col rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"
    >
      <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Find a Professional Therapist
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {cityParam ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} />
                Showing near {locationLabel}
              </span>
            ) : (
              "Connect with licensed mental health professionals"
            )}
          </p>
        </div>
        <Link
          href="/dashboard/therapists"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          View all therapists
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="p-5">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {therapistsWithMatch.slice(0, PREVIEW_LIMIT).map(({ therapist, match }) => (
              <TherapistCard key={therapist.id} therapist={therapist} match={match} compact />
            ))}
            {!loading && therapistsWithMatch.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 col-span-2">
                No therapists found for your area.{" "}
                <Link href="/dashboard/therapists" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Browse all
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
