"use client"

import { MapPin, Globe, ExternalLink } from "lucide-react"
import type { TherapistListItem } from "@/lib/api"
import { useProfileLanguage } from "@/lib/i18n"

const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }
const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }

const PLACE_UR: Record<string, string> = {
  "lahore": "لاہور", "karachi": "کراچی", "islamabad": "اسلام آباد",
  "rawalpindi": "راولپنڈی", "faisalabad": "فیصل آباد", "multan": "ملتان",
  "peshawar": "پشاور", "quetta": "کوئٹہ", "sialkot": "سیالکوٹ",
  "gujranwala": "گوجرانوالہ", "hyderabad": "حیدرآباد", "bahawalpur": "بہاولپور",
  "sargodha": "سرگودھا", "sukkur": "سکھر", "abbottabad": "ایبٹ آباد",
  "mardan": "مردان", "mingora": "مینگورہ", "gujrat": "گجرات", "sahiwal": "ساہیوال",
  "murree": "مری", "attock": "اٹک", "jhelum": "جہلم", "kasur": "قصور",
  "okara": "اوکاڑہ", "larkana": "لاڑکانہ", "nawabshah": "نواب شاہ",
  "mirpur": "میرپور", "chakwal": "چکوال", "khuzdar": "خضدار",
  "kot mithan": "کوٹ مٹھن", "lower dir": "لوئر دیر", "mansehra": "مانسہرہ",
  "sheikhupura": "شیخوپورہ",
  "pakistan": "پاکستان", "punjab": "پنجاب", "sindh": "سندھ",
  "balochistan": "بلوچستان", "kpk": "خیبر پختونخوا",
  "khyber pakhtunkhwa": "خیبر پختونخوا",
}
const toUrPlace = (s: string) => PLACE_UR[s.trim().toLowerCase()] ?? s

const LANG_UR: Record<string, string> = {
  "english": "انگریزی", "urdu": "اردو", "hindi": "ہندی",
  "hindi/urdu": "اردو", "urdu/hindi": "اردو",
  "punjabi": "پنجابی", "sindhi": "سندھی", "pashto": "پشتو",
  "pashtu": "پشتو", "balochi": "بلوچی", "saraiki": "سرائیکی",
  "arabic": "عربی", "persian": "فارسی", "farsi": "فارسی",
}
const toUrLang = (s: string) => LANG_UR[s.trim().toLowerCase()] ?? s

const SERVICE_UR: Record<string, string> = {
  "online": "آن لائن",
  "in-person": "ان-پرسن",
  "in person": "ان-پرسن",
}
const toUrService = (s: string) => SERVICE_UR[s.trim().toLowerCase()] ?? s

type TherapistCardProps = {
  therapist: TherapistListItem
  match?: "exact_city" | "nearest_region" | "other"
  compact?: boolean
}

export function TherapistCard({ therapist: t, match, compact = false }: TherapistCardProps) {
  const profileUrl = t.website || t.profile_url
  const isNear = match && match !== "other"
  const initial = (t.name || "T").charAt(0).toUpperCase()
  const isUr = useProfileLanguage() === "ur"

  if (compact) {
    return (
      <div
        style={{
          ...sans,
          borderRadius: 12, padding: "0.875rem 1rem",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
          cursor: profileUrl ? "pointer" : "default",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(166,124,82,0.35)"
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(166,124,82,0.08)"
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "var(--border)"
          e.currentTarget.style.boxShadow = "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
          {/* Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg, #7a5535, #a67c52)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(166,124,82,0.25)",
          }}>
            <span style={{ ...sans, fontSize: "0.875rem", fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
              {initial}
            </span>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <h3 style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.name}
              </h3>
              {isNear && (
                <span style={{
                  ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em",
                  padding: "0.15rem 0.45rem", borderRadius: 100,
                  backgroundColor: "color-mix(in srgb, var(--sage) 15%, transparent)",
                  color: "var(--sage)", textTransform: "uppercase", flexShrink: 0,
                }}>
                  Near you
                </span>
              )}
            </div>
            {t.credentials && (
              <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.credentials}
              </p>
            )}
            {(t.city || t.region) && (
              <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem" }}>
                <MapPin size={10} style={{ flexShrink: 0, color: "var(--primary)" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[t.city, t.region].filter(Boolean).join(", ")}
                </span>
              </p>
            )}
          </div>

          {/* Profile link */}
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...sans, flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: "0.25rem",
                fontSize: "0.6875rem", fontWeight: 600, color: "var(--primary)",
                textDecoration: "none",
              }}
              onClick={e => e.stopPropagation()}
            >
              <Globe size={12} />
              Profile
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    )
  }

  // Full card (therapists directory page)
  return (
    <article style={{
      ...sans,
      borderRadius: 16, overflow: "hidden",
      backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
      border: "1px solid var(--border)",
      backdropFilter: "blur(8px)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      transition: "border-color 0.18s ease, box-shadow 0.18s ease",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = "rgba(166,124,82,0.35)"
      ;(e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(166,124,82,0.1)"
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"
      ;(e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.05)"
    }}
    >
      <div style={{ padding: "1.25rem 1.375rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>

          {/* Left: avatar + info */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", flex: 1, minWidth: 0 }}>
            {/* Avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: 11, flexShrink: 0,
              background: "linear-gradient(135deg, #7a5535, #a67c52)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(166,124,82,0.3)",
            }}>
              <span style={{ ...serif, fontSize: "1.25rem", fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>
                {initial}
              </span>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ ...sans, fontSize: "0.9375rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {t.name}
                </h2>
                {isNear && (
                  <span style={{
                    ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em",
                    padding: "0.2rem 0.5rem", borderRadius: 100,
                    backgroundColor: "color-mix(in srgb, var(--sage) 15%, transparent)",
                    color: "var(--sage)", textTransform: "uppercase",
                  }}>
                    {isUr ? "آپ کے قریب" : "In your area"}
                  </span>
                )}
              </div>
              {t.credentials && (
                <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "0.2rem" }}>
                  {t.credentials}
                </p>
              )}
              {t.specialty && (
                <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--primary)", marginTop: "0.375rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {t.specialty}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.625rem" }}>
                {(t.city || t.region) && (
                  <span style={{
                    ...sans, display: "inline-flex", alignItems: "center", gap: "0.3rem",
                    fontSize: "0.6875rem", color: "var(--muted-foreground)",
                    backgroundColor: "color-mix(in srgb, var(--muted) 60%, transparent)",
                    padding: "0.2rem 0.55rem", borderRadius: 6,
                    border: "1px solid var(--border)",
                  }}>
                    <MapPin size={11} style={{ color: "var(--primary)" }} />
                    {isUr
                      ? [t.city, t.region].filter(Boolean).map(s => toUrPlace(s as string)).join("، ")
                      : [t.city, t.region].filter(Boolean).join(", ")}
                  </span>
                )}
                {t.languages && t.languages.length > 0 && (
                  <span style={{
                    ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)",
                    backgroundColor: "color-mix(in srgb, var(--muted) 60%, transparent)",
                    padding: "0.2rem 0.55rem", borderRadius: 6,
                    border: "1px solid var(--border)",
                  }}>
                    {(isUr ? t.languages.slice(0, 3).map(toUrLang) : t.languages.slice(0, 3)).join(" · ")}
                    {t.languages.length > 3 ? " …" : ""}
                  </span>
                )}
                {t.service_type && t.service_type.length > 0 && (
                  <span style={{
                    ...sans, fontSize: "0.6875rem",
                    color: "var(--primary)",
                    backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                    padding: "0.2rem 0.55rem", borderRadius: 6,
                    border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
                  }}>
                    {isUr
                      ? t.service_type.map(toUrService).join(" اور ")
                      : t.service_type.join(" & ")}
                  </span>
                )}
              </div>
              {t.address && (
                <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.375rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.address}
                </p>
              )}
            </div>
          </div>

          {/* Profile button */}
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...sans, flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                padding: "0.5rem 0.875rem", borderRadius: 9,
                backgroundColor: "var(--primary)",
                color: "white",
                fontSize: "0.8125rem", fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(166,124,82,0.3)",
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
            >
              <Globe size={14} />
              {isUr ? "پروفائل دیکھیں" : "View profile"}
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
