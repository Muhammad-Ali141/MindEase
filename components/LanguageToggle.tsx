"use client"

import { useEffect, useState } from "react"
import { useLanguage, setLanguage } from "@/lib/i18n"

export function LanguageToggle() {
  const storeLang = useLanguage()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Before mount, keep the toggle's "active" indicator on EN so server HTML and
  // first client paint agree. After mount, it snaps to the real language —
  // matching exactly what the page content gates on via its own `mounted` flag.
  const lang = mounted ? storeLang : "en"

  const setLang = (l: "en" | "ur") => setLanguage(l)

  const btn = (code: "en" | "ur", label: string) => {
    const active = lang === code
    return (
      <button
        key={code}
        type="button"
        onClick={() => setLang(code)}
        aria-pressed={active}
        style={{
          padding: "0.3rem 0.75rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          border: "none",
          cursor: "pointer",
          transition: "background-color 0.2s ease, color 0.2s ease",
          backgroundColor: active ? "var(--primary)" : "transparent",
          color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      role="group"
      aria-label="Language Toggle"
      style={{
        display: "inline-flex",
        gap: "0.125rem",
        padding: "0.25rem",
        borderRadius: "0.5rem",
        border: "1px solid var(--border)",
        backgroundColor: "var(--muted)",
      }}
    >
      {btn("en", "EN")}
      {btn("ur", "UR")}
    </div>
  )
}
