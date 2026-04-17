"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useLanguage, useProfileLanguage } from "@/lib/i18n"

// Public routes use the landing-page language toggle (local store).
// Authenticated/dashboard routes follow the profile preference.
const PROFILE_LANG_ROUTES = ["/dashboard", "/chat", "/voice-chat", "/sessions", "/profile", "/diagnostic-test"]

// Routes where we keep the English LTR layout even when the profile is Urdu —
// Urdu text inside still renders in Urdu, but sidebar/direction don't flip.
const FORCE_LTR_ROUTES = ["/chat", "/voice-chat"]

export function LangSync() {
  const { user } = useAuth()
  const profileLang = useProfileLanguage()
  const landingLang = useLanguage()
  const [pathname, setPathname] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const update = () => setPathname(window.location.pathname)
    update()

    window.addEventListener("popstate", update)

    // Next.js router uses history.pushState / replaceState for client-side
    // navigation — those don't fire popstate. Patch them to emit a custom
    // event so LangSync recomputes pathname on every route change.
    const origPush = window.history.pushState
    const origReplace = window.history.replaceState
    window.history.pushState = function (...args) {
      const r = origPush.apply(this, args as Parameters<typeof origPush>)
      update()
      return r
    }
    window.history.replaceState = function (...args) {
      const r = origReplace.apply(this, args as Parameters<typeof origReplace>)
      update()
      return r
    }

    return () => {
      window.removeEventListener("popstate", update)
      window.history.pushState = origPush
      window.history.replaceState = origReplace
    }
  }, [])

  const useProfile =
    !!user && PROFILE_LANG_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))
  const lang = useProfile ? profileLang : landingLang

  const forceLtr = FORCE_LTR_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.setAttribute("lang", lang)
    if (forceLtr) {
      document.documentElement.setAttribute("data-layout", "ltr")
    } else {
      document.documentElement.removeAttribute("data-layout")
    }
  }, [lang, forceLtr])
  return null
}
