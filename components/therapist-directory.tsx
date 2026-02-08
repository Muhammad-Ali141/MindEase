"use client"

import { MapPin, Phone, Mail, Globe, ExternalLink, Loader2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useEffect, useMemo, useState } from "react"
import { apiGetTherapists, type TherapistListItem } from "@/lib/api"

export type Therapist = TherapistListItem

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

export function TherapistDirectory() {
  const { user } = useAuth()
  const [therapists, setTherapists] = useState<TherapistListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setTherapists([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    apiGetTherapists(user.id, {
      city: user.city ?? undefined,
      nearest_major_city: user.nearest_major_city ?? undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setTherapists(res.therapists || [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load therapists")
          setTherapists([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.city, user?.nearest_major_city])

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
    if (userCity) locationLabel = `Near you (${user?.city})`
    else if (userNearest) locationLabel = `Near you (${user?.nearest_major_city})`
    return { therapistsWithMatch: withMatch, locationLabel }
  }, [therapists, user?.city, user?.nearest_major_city])

  return (
    <div
      data-tour-target="find-therapist"
      className="bg-white dark:bg-slate-800 overflow-hidden h-full flex flex-col rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
    >
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Find a Professional Therapist
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Connect with licensed mental health professionals in your area
        </p>
        {user?.city || user?.nearest_major_city ? (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
            <MapPin size={12} />
            Showing therapists · {locationLabel}
          </p>
        ) : null}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p>Loading therapists...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-amber-600 dark:text-amber-400">
            <p className="font-medium">Could not load directory</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : therapistsWithMatch.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No therapists in the directory yet.</p>
            <p className="text-sm mt-2">
              Add data using the NPI import (US) or JSON import (see backend docs).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {therapistsWithMatch.map(({ therapist: t, match }) => (
              <div
                key={t.id}
                className="p-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30 hover:border-blue-200 dark:hover:border-blue-800/50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{t.name}</h3>
                      {match !== "other" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          <MapPin size={10} />
                          In your area
                        </span>
                      )}
                      {t.credentials && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t.credentials}
                        </span>
                      )}
                    </div>
                    {t.specialty && (
                      <p className="text-sm text-purple-600 dark:text-purple-400 mt-0.5">{t.specialty}</p>
                    )}
                    {(t.city || t.region) && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-600 dark:text-gray-300">
                        <MapPin size={12} className="flex-shrink-0 text-gray-400" />
                        <span>
                          {t.city || ""}
                          {t.region ? (t.city ? `, ${t.region}` : t.region) : ""}
                        </span>
                      </div>
                    )}
                    {t.languages && t.languages.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t.languages.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {t.phone && (
                      <a
                        href={`tel:${t.phone.replace(/\s/g, "")}`}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Phone size={12} />
                        Call
                      </a>
                    )}
                    {t.email && (
                      <a
                        href={`mailto:${t.email}`}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Mail size={12} />
                        Email
                      </a>
                    )}
                    {t.website && (
                      <a
                        href={t.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Globe size={12} />
                        Website
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 text-center border-t border-gray-100 dark:border-slate-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Listing is based on your profile location. Update your profile to see therapists near you.
        </p>
        <button
          type="button"
          className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition disabled:opacity-50"
          disabled
          title="Coming soon"
        >
          View More Therapists
        </button>
      </div>
    </div>
  )
}
