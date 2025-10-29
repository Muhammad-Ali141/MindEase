"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { LanguageToggle } from "./LanguageToggle"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted">
      <header className="w-full border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* Placeholder wordmark SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="text-primary">
              <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
              <path
                d="M7 12c0-2.8 2.2-5 5-5 1.8 0 3.4.9 4.3 2.3-.6-.2-1.3-.3-2-.3-3 0-5.3 2.4-5.3 5.3 0 .7.1 1.4.3 2C7.9 15.4 7 13.8 7 12z"
                fill="currentColor"
              />
            </svg>
            <span className="text-lg font-semibold">MindEase</span>
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <div className="mx-auto max-w-4xl">{children}</div>
    </div>
  )
}
