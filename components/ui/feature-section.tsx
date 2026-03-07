"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { cn } from "@/lib/utils"

// ─── Design tokens (CSS variables — adapts to dark mode) ─────────────────────
const C = {
  clay:      "var(--primary)",
  clayLight: "var(--muted)",
  sage:      "var(--sage)",
  sageLight: "var(--sage-light)",
  ink:       "var(--foreground)",
  muted:     "var(--muted-foreground)",
  border:    "var(--border)",
  surface:   "var(--card)",
  bg:        "var(--background)",
} as const

interface Feature {
  step: string
  title?: string
  content: string
  image: string
}

interface FeatureStepsProps {
  features: Feature[]
  className?: string
  title?: string
  autoPlayInterval?: number
}

export function FeatureSteps({
  features,
  className,
  title = "Key Features",
  autoPlayInterval = 4000,
}: FeatureStepsProps) {
  const [currentFeature, setCurrentFeature] = useState(0)
  const [timerKey, setTimerKey] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFeature(f => (f + 1) % features.length)
    }, autoPlayInterval)
    return () => clearInterval(timer)
  }, [features.length, autoPlayInterval, timerKey])

  const serif = { fontFamily: 'var(--font-cormorant, Georgia, serif)' }
  const sans  = { fontFamily: 'var(--font-dm-sans, var(--font-inter), system-ui, sans-serif)' }

  return (
    <div className={cn("w-full", className)}>
      {/* Section title */}
      <div style={{ marginBottom: "3.5rem", textAlign: "center" }}>
        <p style={{ ...sans, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: C.clay, marginBottom: "0.75rem" }}>
          What we offer
        </p>
        <h2 style={{ ...serif, fontSize: "clamp(2.25rem, 4vw, 3.25rem)", fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.12, color: C.ink }}>
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">

        {/* Left — feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {features.map((feature, index) => {
            const isActive = index === currentFeature
            return (
              <motion.div
                key={index}
                onClick={() => { setCurrentFeature(index); setTimerKey(k => k + 1) }}
                animate={{ opacity: isActive ? 1 : 0.45 }}
                transition={{ duration: 0.4 }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "1.125rem",
                  padding: "1.25rem 1rem",
                  borderRadius: 14,
                  backgroundColor: isActive ? C.clayLight : "transparent",
                  cursor: "pointer",
                  transition: "background-color 0.3s ease",
                }}
              >
                {/* Step indicator */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: isActive ? C.clay : "transparent",
                  border: `2px solid ${isActive ? C.clay : C.border}`,
                  transition: "all 0.3s ease",
                }}>
                    <span style={{ ...sans, fontSize: "0.75rem", fontWeight: 700, color: isActive ? "white" : C.muted }}>
                      {index + 1}
                    </span>
                </div>

                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ ...sans, fontWeight: 600, fontSize: "0.9375rem", color: C.ink, marginBottom: "0.25rem" }}>
                    {feature.title || feature.step}
                  </div>
                  <div style={{ ...sans, fontSize: "0.875rem", color: C.muted, lineHeight: 1.65 }}>
                    {feature.content}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Right — image */}
        <div style={{ position: "relative", height: 420, borderRadius: 20, overflow: "hidden", backgroundColor: C.surface }}>
          <AnimatePresence mode="wait">
            {features.map((feature, index) =>
              index === currentFeature && (
                <motion.div
                  key={index}
                  style={{ position: "absolute", inset: 0 }}
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -60, opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Image
                    src={feature.image}
                    alt={feature.step}
                    fill
                    style={{ objectFit: "contain" }}
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  {/* Top fade — blends letterbox into container */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `linear-gradient(to bottom, ${C.surface} 0%, transparent 22%)`,
                    pointerEvents: "none",
                  }} />
                  {/* Bottom fade — label area */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `linear-gradient(to top, ${C.surface} 0%, transparent 30%)`,
                    pointerEvents: "none",
                  }} />
                  {/* Feature label at bottom */}
                  <div style={{
                    position: "absolute", bottom: 24, left: 24, right: 24, zIndex: 2,
                    display: "flex", alignItems: "center", gap: "0.625rem",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: C.clay, flexShrink: 0 }} />
                    <span style={{ ...sans, fontSize: "0.875rem", fontWeight: 600, color: C.ink }}>
                      {feature.title}
                    </span>
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
