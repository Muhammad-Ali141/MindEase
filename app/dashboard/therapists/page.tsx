"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { Users, MapPin } from "lucide-react"
import {
  apiGetTherapists,
  apiGetTherapistFilters,
  type TherapistListItem,
  type TherapistListParams,
} from "@/lib/api"
import { TherapistCard } from "@/components/therapist-card"
import { BeamsBackground } from "@/components/ui/beams-background"
import { motion } from "framer-motion"

const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }

function normalizeLocation(s: string | undefined | null): string {
  if (!s || typeof s !== "string") return ""
  return s.trim().toLowerCase()
}

function therapistMatchesUserLocation(
  t: TherapistListItem, userCity: string, userNearestCity: string
): "exact_city" | "nearest_region" | "other" {
  const tCity   = normalizeLocation(t.city)
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
  { value: "online",    label: "Online" },
  { value: "",          label: "All" },
]

export default function TherapistsPage() {
  const router   = useRouter()
  const { user } = useAuth()
  const [cities, setCities]                   = useState<string[]>([])
  const [therapists, setTherapists]           = useState<TherapistListItem[]>([])
  const [loadingFilters, setLoadingFilters]   = useState(true)
  const [loadingTherapists, setLoadingTherapists] = useState(true)
  const [error, setError]                     = useState<string | null>(null)
  const [filters, setFilters]                 = useState<TherapistListParams>({ service_type: "in-person" })
  const [sidebarOpen, setSidebarOpen]         = useState(true)
  const defaultCitySetRef = useRef(false)

  const cityOptions = useMemo(() => {
    const userCity  = (user?.city || "").trim()
    const nearest   = (user?.nearest_major_city || "").trim()
    const normalizedCities = new Set(cities.map(c => c.trim().toLowerCase()))
    const needUserCity = userCity && !normalizedCities.has(userCity.toLowerCase())
    const needNearest  = nearest && !normalizedCities.has(nearest.toLowerCase())
    if (needUserCity || needNearest) {
      const extra: string[] = []
      if (needUserCity) extra.push(userCity)
      if (needNearest && nearest !== userCity) extra.push(nearest)
      return ["", ...extra, ...cities]
    }
    return ["", ...cities]
  }, [cities, user?.city, user?.nearest_major_city])

  const defaultCity = useMemo(() => {
    const userCity  = (user?.city || "").trim()
    const nearest   = (user?.nearest_major_city || "").trim()
    const normalized = new Set(cities.map(c => c.trim().toLowerCase()))
    if (userCity && normalized.has(userCity.toLowerCase())) return userCity
    if (nearest  && normalized.has(nearest.toLowerCase()))  return nearest
    if (userCity) return userCity
    if (nearest)  return nearest
    return ""
  }, [cities, user?.city, user?.nearest_major_city])

  useEffect(() => {
    let cancelled = false
    setLoadingFilters(true)
    apiGetTherapistFilters()
      .then(res => { if (!cancelled) setCities(res.cities || []) })
      .catch(()  => { if (!cancelled) setCities([]) })
      .finally(() => { if (!cancelled) setLoadingFilters(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (defaultCitySetRef.current || !defaultCity) return
    if (cityOptions.length > 0) {
      defaultCitySetRef.current = true
      setFilters(f => ({ ...f, city: defaultCity }))
    }
  }, [defaultCity, cityOptions])

  useEffect(() => {
    let cancelled = false
    setLoadingTherapists(true)
    setError(null)
    apiGetTherapists(filters)
      .then(res => { if (!cancelled) setTherapists(res.therapists) })
      .catch(e   => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed to load"); setTherapists([]) } })
      .finally(() => { if (!cancelled) setLoadingTherapists(false) })
    return () => { cancelled = true }
  }, [filters.city, filters.specialty, filters.service_type])

  const therapistsWithMatch = useMemo(() => {
    const userCity    = normalizeLocation(user?.city)
    const userNearest = normalizeLocation(user?.nearest_major_city)
    const order = { exact_city: 0, nearest_region: 1, other: 2 } as const
    return therapists
      .map(t => ({ therapist: t, match: therapistMatchesUserLocation(t, userCity, userNearest) }))
      .sort((a, b) => order[a.match] - order[b.match])
  }, [therapists, user?.city, user?.nearest_major_city])

  const nearbyCount = therapistsWithMatch.filter(({ match }) => match !== "other").length

  const selectStyle: React.CSSProperties = {
    ...sans,
    fontSize: "0.875rem",
    color: "var(--foreground)",
    backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.5rem 2rem 0.5rem 0.875rem",
    outline: "none",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23888' d='M5 7L0.5 2.5h9z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.625rem center",
  }

  return (
    <AuthGuard>
      <div style={{ position: "fixed", inset: 0, display: "flex", width: "100vw", height: "100vh", zIndex: 50, overflow: "hidden" }}>

        {/* Background */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <BeamsBackground isDark intensity="subtle" />
          <div style={{ position: "absolute", inset: 0, backgroundColor: "color-mix(in srgb, var(--background) 72%, transparent)" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, display: "flex", width: "100%", height: "100%" }}>
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Header />

            <div style={{ flex: 1, overflowY: "auto", padding: "1.75rem 2rem 2.5rem" }}>
              <div style={{ maxWidth: 1100, margin: "0 auto" }}>

                {/* ── Page header ─────────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  style={{ marginBottom: "1.75rem" }}
                >
                  <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.4rem" }}>
                    Professional support
                  </p>
                  <h1 style={{ ...serif, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1.1, marginBottom: "0.5rem" }}>
                    Find a Therapist
                  </h1>
                  <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                    Browse verified mental health professionals by location, specialty, and service type.
                  </p>
                </motion.div>

                {/* ── Filter bar ──────────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.08 }}
                  style={{
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem",
                    marginBottom: "1.5rem", padding: "0.875rem 1.125rem",
                    borderRadius: 14,
                    backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
                    border: "1px solid var(--border)", backdropFilter: "blur(12px)",
                  }}
                >
                  {/* Service type pills */}
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {SERVICE_OPTIONS.map(opt => {
                      const active = (filters.service_type ?? "") === opt.value
                      return (
                        <button
                          key={opt.value || "all"}
                          onClick={() => setFilters(f => ({ ...f, service_type: opt.value || undefined }))}
                          style={{
                            ...sans, fontSize: "0.8125rem", fontWeight: 600,
                            padding: "0.375rem 0.875rem", borderRadius: 100,
                            cursor: "pointer", transition: "all 0.15s ease",
                            border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                            backgroundColor: active ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "transparent",
                            color: active ? "var(--primary)" : "var(--muted-foreground)",
                          }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 30%, transparent)" }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "var(--border)" }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ width: 1, height: 20, backgroundColor: "var(--border)" }} />

                  {/* City */}
                  <select
                    value={filters.city ?? ""}
                    onChange={e => setFilters(f => ({ ...f, city: e.target.value || undefined }))}
                    style={{ ...selectStyle, minWidth: 160 }}
                  >
                    {cityOptions.map(c => (
                      <option key={c || "all"} value={c}>{c || "All cities"}</option>
                    ))}
                  </select>

                  {/* Specialty */}
                  <select
                    value={filters.specialty ?? ""}
                    onChange={e => setFilters(f => ({ ...f, specialty: e.target.value || undefined }))}
                    style={{ ...selectStyle, minWidth: 188 }}
                  >
                    {SPECIALTIES.map(opt => (
                      <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* Result count */}
                  {!loadingTherapists && (
                    <span style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", marginLeft: "auto" }}>
                      {therapistsWithMatch.length} therapist{therapistsWithMatch.length !== 1 ? "s" : ""}
                      {nearbyCount > 0 && (
                        <span style={{ color: "var(--sage)" }}> · {nearbyCount} near you</span>
                      )}
                    </span>
                  )}
                </motion.div>

                {/* ── Near-you banner ─────────────────────────────── */}
                {!loadingTherapists && nearbyCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.12 }}
                    style={{
                      ...sans, display: "flex", alignItems: "center", gap: "0.625rem",
                      padding: "0.625rem 1rem", borderRadius: 10, marginBottom: "1.25rem",
                      backgroundColor: "color-mix(in srgb, var(--sage) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--sage) 25%, transparent)",
                    }}
                  >
                    <MapPin size={14} color="var(--sage)" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                    <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--sage)", margin: 0 }}>
                      <strong>{nearbyCount}</strong> therapist{nearbyCount !== 1 ? "s" : ""} found near{" "}
                      <strong>{user?.city || user?.nearest_major_city || "your location"}</strong> — shown first.
                    </p>
                  </motion.div>
                )}

                {error && (
                  <p style={{ ...sans, color: "var(--destructive)", marginBottom: "1rem", fontSize: "0.875rem" }}>{error}</p>
                )}

                {/* ── Therapist grid ──────────────────────────────── */}
                {loadingTherapists ? (
                  <div style={{ ...sans, textAlign: "center", padding: "5rem 0", color: "var(--muted-foreground)", fontSize: "0.9375rem" }}>
                    Loading therapists…
                  </div>
                ) : therapistsWithMatch.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      textAlign: "center", padding: "4rem 2rem", borderRadius: 20,
                      backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
                      border: "1px solid var(--border)", backdropFilter: "blur(12px)",
                    }}
                  >
                    <div style={{
                      width: 56, height: 56, borderRadius: 14, margin: "0 auto 1rem",
                      background: "linear-gradient(135deg, #7a5535, #a67c52)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 16px rgba(166,124,82,0.25)",
                    }}>
                      <Users size={24} color="rgba(255,255,255,0.9)" strokeWidth={1.5} />
                    </div>
                    <p style={{ ...sans, fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.4rem" }}>No therapists found</p>
                    <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Try a different city, specialty, or service type.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}
                  >
                    {therapistsWithMatch.map(({ therapist, match }, i) => (
                      <motion.div
                        key={therapist.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: i * 0.04 }}
                      >
                        <TherapistCard therapist={therapist} match={match} />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
