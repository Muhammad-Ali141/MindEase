"use client"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n"

export function LanguageToggle() {
  const lang = useLanguage()

  const setLang = (l: "en" | "ur") => {
    // dynamic import to avoid SSR window issues
    import("@/lib/i18n").then((m) => m.setLanguage(l))
  }

  return (
    <div role="group" aria-label="Language Toggle" className="inline-flex rounded-md border bg-background p-0.5">
      <Button
        type="button"
        size="sm"
        variant={lang === "en" ? "default" : "ghost"}
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
      >
        EN
      </Button>
      <Button
        type="button"
        size="sm"
        variant={lang === "ur" ? "default" : "ghost"}
        onClick={() => setLang("ur")}
        aria-pressed={lang === "ur"}
      >
        UR
      </Button>
    </div>
  )
}
