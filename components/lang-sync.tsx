"use client"

import { useEffect } from "react"
import { useProfileLanguage } from "@/lib/i18n"

export function LangSync() {
  const lang = useProfileLanguage()
  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.setAttribute("lang", lang)
  }, [lang])
  return null
}
