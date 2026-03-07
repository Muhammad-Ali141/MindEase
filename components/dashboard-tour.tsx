"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

type TourStep = {
  id: string
  selector: string
  title: string
  description: string
}

export type TourCompletionAction = "completed" | "skipped" | "dont-show"

type DashboardTourProps = {
  open: boolean
  onComplete: (action: TourCompletionAction) => void
}

type HighlightSnapshot = {
  element: HTMLElement
  zIndex: string
  position: string
  addedPosition: boolean
  hadInlinePosition: boolean
}

export function DashboardTour({ open, onComplete }: DashboardTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [missingTarget, setMissingTarget] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number; placement: "top" | "bottom" }>({
    top: 0,
    left: 0,
    placement: "bottom",
  })

  const previousHighlightRef = useRef<HighlightSnapshot | null>(null)

  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "theme-toggle",
        selector: '[data-tour-target="theme-toggle"]',
        title: "Switch between light and dark mode",
        description: "Toggle between light and dark themes to match your comfort level any time.",
      },
      {
        id: "profile-menu",
        selector: '[data-tour-target="profile-menu"]',
        title: "Manage your profile",
        description: "Open your account menu to edit profile details or log out when you're done.",
      },
      {
        id: "quick-check-in",
        selector: '[data-tour-target="quick-check-in"]',
        title: "Take a quick check-in",
        description:
          "Run a short diagnostic to capture how you're feeling. We use it to tailor future conversations.",
      },
      {
        id: "text-chat",
        selector: '[data-tour-target="text-chat"]',
        title: "Start a text session",
        description: "Jump into a supportive text conversation with the AI therapist whenever you need to talk.",
      },
      {
        id: "voice-chat",
        selector: '[data-tour-target="voice-chat"]',
        title: "Plan a voice conversation",
        description: "Prefer speaking out loud? Use the voice option to prepare for upcoming audio sessions.",
      },
      {
        id: "sessions-completed",
        selector: '[data-tour-target="sessions-completed"]',
        title: "Track completed sessions",
        description: "See how many sessions you've finished so far and celebrate your progress.",
      },
      {
        id: "mood-trend",
        selector: '[data-tour-target="mood-trend"]',
        title: "Watch your mood trend",
        description: "We’ll chart how your mood shifts over time as assessments and sessions build up.",
      },
      {
        id: "current-streak",
        selector: '[data-tour-target="current-streak"]',
        title: "Stay motivated with streaks",
        description: "Come back regularly to build a streak and keep consistent with your wellbeing check-ins.",
      },
      {
        id: "recent-sessions",
        selector: '[data-tour-target="recent-sessions"]',
        title: "Resume recent sessions",
        description: "Pick up right where you left off. We store the last few chats so nothing gets lost.",
      },
      {
        id: "mental-health-assessments",
        selector: '[data-tour-target="mental-health-assessments"]',
        title: "Explore mental health assessments",
        description: "Review any self-assessments you’ve taken and discover new tools as we add them.",
      },
      {
        id: "find-therapist",
        selector: '[data-tour-target="find-therapist"]',
        title: "Connect with professionals",
        description: "Browse the therapist directory when you’re ready for human support alongside the AI.",
      },
      {
        id: "tutorial-button",
        selector: '[data-tour-target="tutorial-button"]',
        title: "Replay this anytime",
        description: "Tap the Tutorial button whenever you want a refresher. It lives here in the header for quick access.",
      },
    ],
    [],
  )

  const totalSteps = steps.length

  const clearHighlight = useCallback(() => {
    const snapshot = previousHighlightRef.current
    if (!snapshot) return

    const { element, zIndex, position, addedPosition, hadInlinePosition } = snapshot
    element.removeAttribute("data-tour-highlight")
    element.style.zIndex = zIndex

    if (addedPosition && !hadInlinePosition) {
      element.style.removeProperty("position")
    } else {
      element.style.position = position
    }

    previousHighlightRef.current = null
    setTargetRect(null)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      clearHighlight()
      setMissingTarget(false)
      setTargetRect(null)
      return
    }

    setCurrentStep(0)
  }, [open, clearHighlight])

  useEffect(() => {
    if (!open) return

    const step = steps[currentStep]
    if (!step) return

    clearHighlight()

    const element = document.querySelector(step.selector) as HTMLElement | null

    if (!element) {
      setMissingTarget(true)
      setTargetRect(null)
      return
    }

    setMissingTarget(false)

    const originalZIndex = element.style.zIndex
    const originalPosition = element.style.position
    const computedPosition = window.getComputedStyle(element).position
    const hadInlinePosition = originalPosition !== ""
    let addedPosition = false

    if (computedPosition === "static") {
      element.style.position = "relative"
      addedPosition = !hadInlinePosition
    }

    element.style.zIndex = "1100"
    element.setAttribute("data-tour-highlight", "true")

    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
    const updateMetrics = () => {
      setTargetRect(element.getBoundingClientRect())
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }
    updateMetrics()

    previousHighlightRef.current = {
      element,
      zIndex: originalZIndex,
      position: originalPosition,
      addedPosition,
      hadInlinePosition,
    }

    const handleRecalculate = () => {
      updateMetrics()
    }

    window.addEventListener("resize", handleRecalculate)
    window.addEventListener("scroll", handleRecalculate, true)

    return () => {
      window.removeEventListener("resize", handleRecalculate)
      window.removeEventListener("scroll", handleRecalculate, true)
    }
  }, [clearHighlight, currentStep, open, steps])

  useEffect(
    () => () => {
      clearHighlight()
    },
    [clearHighlight],
  )

  const finishTour = useCallback(
    (action: TourCompletionAction) => {
      clearHighlight()
      onComplete(action)
    },
    [clearHighlight, onComplete],
  )

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= totalSteps - 1) {
        finishTour("completed")
        return prev
      }
      return prev + 1
    })
  }, [finishTour, totalSteps])

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev))
  }, [])

  const handleSkip = useCallback(() => {
    finishTour("skipped")
  }, [finishTour])

  useLayoutEffect(() => {
    if (!open || !targetRect || !tooltipRef.current) return

    const tooltipBox = tooltipRef.current.getBoundingClientRect()
    const padding = 18
    let top = targetRect.bottom + padding
    let placement: "top" | "bottom" = "bottom"

    if (top + tooltipBox.height > window.innerHeight - padding) {
      top = Math.max(targetRect.top - tooltipBox.height - padding, padding)
      placement = "top"
    }

    let left = targetRect.left + targetRect.width / 2 - tooltipBox.width / 2
    left = Math.min(Math.max(left, padding), window.innerWidth - tooltipBox.width - padding)

    setTooltipStyle({ top, left, placement })
  }, [currentStep, open, targetRect])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        finishTour("skipped")
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        handleNext()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        handleBack()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [finishTour, handleBack, handleNext, open])

  if (!mounted || !open) {
    return null
  }

  const step = steps[currentStep]
  if (!step) {
    return null
  }

  const overlayPadding = 16
  const highlightStyle = targetRect
    ? {
        top: Math.max(targetRect.top - overlayPadding, 8),
        left: Math.max(targetRect.left - overlayPadding, 8),
        width: targetRect.width + overlayPadding * 2,
        height: targetRect.height + overlayPadding * 2,
      }
    : undefined

  const segments =
    targetRect && highlightStyle
      ? (() => {
          const { width: viewportWidth, height: viewportHeight } = viewportSize.width
            ? viewportSize
            : { width: window.innerWidth, height: window.innerHeight }

          const topHeight = Math.max(highlightStyle.top, 0)
          const leftWidth = Math.max(highlightStyle.left, 0)
          const rightStart = highlightStyle.left + highlightStyle.width
          const bottomStart = highlightStyle.top + highlightStyle.height

          return {
            top: {
              top: 0,
              left: 0,
              width: viewportWidth,
              height: topHeight,
            },
            left: {
              top: highlightStyle.top,
              left: 0,
              width: leftWidth,
              height: highlightStyle.height,
            },
            right: {
              top: highlightStyle.top,
              left: rightStart,
              width: Math.max(viewportWidth - rightStart, 0),
              height: highlightStyle.height,
            },
            bottom: {
              top: bottomStart,
              left: 0,
              width: viewportWidth,
              height: Math.max(viewportHeight - bottomStart, 0),
            },
          }
        })()
      : null

  const tooltipPositionStyle = targetRect
    ? {
        top: tooltipStyle.top,
        left: tooltipStyle.left,
        transform: "translateZ(0)",
      }
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }

  return createPortal(
    <div className="tour-overlay-root fixed inset-0 z-[1000]">
      {segments ? (
        <>
          <div className="tour-overlay-segment" style={segments.top} aria-hidden="true" />
          <div className="tour-overlay-segment" style={segments.left} aria-hidden="true" />
          <div className="tour-overlay-segment" style={segments.right} aria-hidden="true" />
          <div className="tour-overlay-segment" style={segments.bottom} aria-hidden="true" />
        </>
      ) : (
        <div className="tour-overlay-dim" aria-hidden="true" />
      )}
      {targetRect && (
        <div
          className="tour-highlight-ring"
          style={highlightStyle}
          aria-hidden="true"
        />
      )}

      <div
        ref={tooltipRef}
        style={{
          ...sans,
          pointerEvents: "auto",
          position: "fixed",
          width: 340,
          padding: "1.25rem 1.375rem 1.125rem",
          borderRadius: 18,
          backgroundColor: "var(--card)",
          border: "1px solid rgba(166,124,82,0.22)",
          boxShadow: "0 24px 64px rgba(40,22,8,0.22), 0 4px 16px rgba(166,124,82,0.1)",
          ...tooltipPositionStyle,
        }}
        data-placement={targetRect ? tooltipStyle.placement : undefined}
        role="dialog"
        aria-live="assertive"
      >
        {/* Arrow */}
        {targetRect && (
          <div style={{
            position: "absolute",
            width: 0, height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            ...(tooltipStyle.placement === "bottom"
              ? { top: -10, left: "calc(50% - 10px)", borderBottom: "10px solid var(--card)" }
              : { bottom: -10, left: "calc(50% - 10px)", borderTop: "10px solid var(--card)" }
            ),
          }} />
        )}

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Brand icon */}
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              backgroundColor: "rgba(166,124,82,0.13)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M8 13.5C8 13.5 2 10 2 6C2 4 3.5 2.5 5.5 2.5C6.5 2.5 7.5 3 8 4C8.5 3 9.5 2.5 10.5 2.5C12.5 2.5 14 4 14 6C14 10 8 13.5 8 13.5Z" fill="#a67c52" />
              </svg>
            </div>
            <span style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)" }}>
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              ...sans, background: "none", border: "none", cursor: "pointer",
              fontSize: "0.6875rem", color: "var(--muted-foreground)",
              textDecoration: "underline", textDecorationStyle: "dashed",
              textUnderlineOffset: 3,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--foreground)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted-foreground)"}
          >
            Skip tour
          </button>
        </div>

        {/* Title */}
        <h2 style={{ ...serif, fontSize: "1.3125rem", fontWeight: 600, color: "var(--foreground)", lineHeight: 1.2, marginBottom: "0.4rem" }}>
          {step.title}
        </h2>

        {/* Body */}
        <p style={{ ...sans, fontSize: "0.8125rem", lineHeight: 1.65, color: "var(--muted-foreground)", marginBottom: "1rem" }}>
          {step.description}
        </p>

        {/* Warning */}
        {missingTarget && (
          <div style={{
            ...sans, marginBottom: "0.75rem",
            padding: "0.5rem 0.75rem", borderRadius: 10,
            border: "1px solid rgba(181,74,53,0.3)",
            backgroundColor: "rgba(181,74,53,0.08)",
            fontSize: "0.6875rem", color: "var(--destructive)", lineHeight: 1.5,
          }}>
            Couldn’t highlight this section — make sure the dashboard is fully loaded.
          </div>
        )}

        {/* Progress bar */}
        <div style={{ height: 2, borderRadius: 100, backgroundColor: "rgba(166,124,82,0.12)", marginBottom: "1rem" }}>
          <div style={{
            height: "100%", borderRadius: 100,
            backgroundColor: "var(--primary)",
            width: `${((currentStep + 1) / totalSteps) * 100}%`,
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            style={{
              ...sans, height: 34, padding: "0 1rem", borderRadius: 100,
              border: "1px solid rgba(166,124,82,0.3)",
              backgroundColor: "transparent",
              color: currentStep === 0 ? "rgba(166,124,82,0.28)" : "var(--primary)",
              fontSize: "0.8125rem", fontWeight: 600,
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
              transition: "background-color 0.15s ease",
              minWidth: 80,
            }}
            onMouseEnter={e => { if (currentStep > 0) e.currentTarget.style.backgroundColor = "rgba(166,124,82,0.08)" }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent" }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            style={{
              ...sans, height: 34, padding: "0 1.25rem", borderRadius: 100,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "white",
              fontSize: "0.8125rem", fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(166,124,82,0.35)",
              transition: "opacity 0.15s ease",
              minWidth: 100,
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            {currentStep === totalSteps - 1 ? "Finish ✓" : "Next →"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

