"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"

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
        className="tour-tooltip-card"
        style={tooltipPositionStyle}
        data-placement={targetRect ? tooltipStyle.placement : undefined}
        role="dialog"
        aria-live="assertive"
      >
        <div className="tour-tooltip-header">
          <span className="tour-tooltip-step">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <button type="button" onClick={handleSkip} className="tour-tooltip-skip">
            Skip
          </button>
        </div>

        <h2 className="tour-tooltip-title">{step.title}</h2>
        <p className="tour-tooltip-body">{step.description}</p>

        {missingTarget && (
          <p className="tour-tooltip-warning">
            We couldn’t highlight this section. Please make sure the dashboard is fully loaded and try again.
          </p>
        )}

        <div className="tour-tooltip-actions">
          <div className="tour-tooltip-primary">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="min-w-[88px]"
            >
              Back
            </Button>
            <Button type="button" onClick={handleNext} className="min-w-[105px]">
              {currentStep === totalSteps - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

