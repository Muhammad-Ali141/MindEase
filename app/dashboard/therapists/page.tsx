"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  apiGetTherapists,
  apiGetTherapistFilters,
  type TherapistListItem,
  type TherapistListParams,
} from "@/lib/api"
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

const SPECIALTIES: { value: string; label: string }[] = [
  { value: "", label: "All specialties" },
  { value: "Anxiety", label: "Anxiety" },
  { value: "Depression", label: "Depression" },
  { value: "CBT", label: "CBT" },
  { value: "Trauma", label: "Trauma" },
  { value: "PTSD", label: "PTSD" },
  { value: "OCD", label: "OCD" },
  { value: "Relationship", label: "Relationship" },
  { value: "Child", label: "Child & adolescent" },
  { value: "Addiction", label: "Addiction" },
  { value: "Stress", label: "Stress" },
  { value: "Grief", label: "Grief" },
  { value: "Bipolar", label: "Bipolar" },
  { value: "Psychotherapy", label: "Psychotherapy" },
  { value: "Family", label: "Family therapy" },
  { value: "Group therapy", label: "Group therapy" },
  { value: "Counseling", label: "Counseling" },
  { value: "Schizophrenia", label: "Schizophrenia" },
  { value: "Eating", label: "Eating disorders" },
]

const SERVICE_OPTIONS: { value: "" | "in-person" | "online"; label: string }[] = [
  { value: "in-person", label: "In-person" },
  { value: "online", label: "Online" },
  { value: "", label: "All" },
]

export default function TherapistsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [cities, setCities] = useState<string[]>([])
  const [therapists, setTherapists] = useState<TherapistListItem[]>([])
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [loadingTherapists, setLoadingTherapists] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TherapistListParams>({
    service_type: "in-person",
  })
  const defaultCitySetRef = useRef(false)

  const cityOptions = useMemo(() => {
    const list = ["", ...cities]
    const userCity = (user?.city || "").trim()
    const nearest = (user?.nearest_major_city || "").trim()
    const normalizedCities = new Set(cities.map((c) => c.trim().toLowerCase()))
    const needUserCity = userCity && !normalizedCities.has(userCity.toLowerCase())
    const needNearest = nearest && !normalizedCities.has(nearest.toLowerCase())
    if (needUserCity || needNearest) {
      const extra: string[] = []
      if (needUserCity) extra.push(userCity)
      if (needNearest && nearest !== userCity) extra.push(nearest)
      return ["", ...extra, ...cities]
    }
    return list
  }, [cities, user?.city, user?.nearest_major_city])

  const defaultCity = useMemo(() => {
    const userCity = (user?.city || "").trim()
    const nearest = (user?.nearest_major_city || "").trim()
    const normalized = new Set(cities.map((c) => c.trim().toLowerCase()))
    if (userCity && normalized.has(userCity.toLowerCase())) return userCity
    if (nearest && normalized.has(nearest.toLowerCase())) return nearest
    if (userCity) return userCity
    if (nearest) return nearest
    return ""
  }, [cities, user?.city, user?.nearest_major_city])

  useEffect(() => {
    let cancelled = false
    setLoadingFilters(true)
    apiGetTherapistFilters()
      .then((res) => {
        if (!cancelled) setCities(res.cities || [])
      })
      .catch(() => {
        if (!cancelled) setCities([])
      })
      .finally(() => {
        if (!cancelled) setLoadingFilters(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (defaultCitySetRef.current || !defaultCity) return
    if (cityOptions.length > 0) {
      defaultCitySetRef.current = true
      setFilters((f) => ({ ...f, city: defaultCity }))
    }
  }, [defaultCity, cityOptions])

  useEffect(() => {
    let cancelled = false
    setLoadingTherapists(true)
    setError(null)
    apiGetTherapists(filters)
      .then((res) => {
        if (!cancelled) setTherapists(res.therapists)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load")
          setTherapists([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTherapists(false)
      })
    return () => { cancelled = true }
  }, [filters.city, filters.specialty, filters.service_type])

  const therapistsWithMatch = useMemo(() => {
    const userCity = normalizeLocation(user?.city)
    const userNearest = normalizeLocation(user?.nearest_major_city)
    return therapists
      .map((t) => ({
        therapist: t,
        match: therapistMatchesUserLocation(t, userCity, userNearest),
      }))
      .sort((a, b) => {
        const order = { exact_city: 0, nearest_region: 1, other: 2 }
        return order[a.match] - order[b.match]
      })
  }, [therapists, user?.city, user?.nearest_major_city])

  return (
    <AuthGuard>
      <div className="fixed inset-0 flex h-screen w-screen bg-gray-50 dark:bg-slate-900 z-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 overflow-auto">
            <div className="p-6 max-w-6xl mx-auto">
              <Button
                variant="ghost"
                className="mb-6 -ml-2"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>

              <header className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Find a Professional Therapist
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Browse by city, specialty, and service type
                </p>
              </header>

              <div className="flex flex-wrap gap-3 mb-8">
                <select
                  value={filters.city ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value || undefined }))}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
                >
                  {cityOptions.map((c) => (
                    <option key={c || "all"} value={c}>
                      {c || "All cities"}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.specialty ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, specialty: e.target.value || undefined }))}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[180px]"
                >
                  {SPECIALTIES.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.service_type ?? "in-person"}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      service_type: (e.target.value as "" | "in-person" | "online") || undefined,
                    }))
                  }
                  className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
                >
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
              )}

              {loadingTherapists ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <p>Loading therapists…</p>
                </div>
              ) : therapistsWithMatch.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-gray-600 dark:text-gray-300">No therapists match your filters.</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Try a different city, specialty, or service type.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
                  {therapistsWithMatch.map(({ therapist, match }) => (
                    <TherapistCard key={therapist.id} therapist={therapist} match={match} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
