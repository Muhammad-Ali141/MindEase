/**
 * Lazy-loaded wrapper for BeamsBackground.
 * All pages import from this file — the actual canvas component is
 * excluded from the initial bundle and loaded after hydration.
 */
import dynamic from "next/dynamic"

export const BeamsBackground = dynamic(
  () => import("./beams-background-impl").then(m => ({ default: m.BeamsBackground })),
  { ssr: false }
)
