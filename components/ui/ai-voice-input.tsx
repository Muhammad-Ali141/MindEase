"use client"

import { useState, useEffect, useRef } from "react"
import { Mic2 } from "lucide-react"

// Pre-computed bar heights to avoid hydration mismatch
const BAR_HEIGHTS = Array.from({ length: 48 }, (_, i) =>
  Math.round(20 + Math.sin(i * 0.41) * 28 + Math.cos(i * 0.73) * 22 + 30)
)

type VoiceState = "idle" | "recording" | "transcribing" | "thinking" | "synthesizing" | "playing"

interface AIVoiceInputProps {
  voiceState: VoiceState
  recordingTime?: number
  disabled?: boolean
  onMicClick: () => void
  className?: string
}

const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export function AIVoiceInput({
  voiceState,
  recordingTime = 0,
  disabled = false,
  onMicClick,
}: AIVoiceInputProps) {
  const [mounted, setMounted] = useState(false)
  const [animHeights, setAnimHeights] = useState(BAR_HEIGHTS)
  const animFrameRef = useRef<number>()

  useEffect(() => { setMounted(true) }, [])

  // Animate bars when recording or playing
  useEffect(() => {
    if (!mounted) return
    const isActive = voiceState === "recording" || voiceState === "playing"
    if (!isActive) {
      setAnimHeights(BAR_HEIGHTS)
      return
    }
    const tick = () => {
      setAnimHeights(prev => prev.map((_, i) =>
        Math.round(20 + Math.random() * 80)
      ))
      animFrameRef.current = requestAnimationFrame(tick)
    }
    // Throttle to ~12fps for a natural feel
    let last = 0
    const throttledTick = (ts: number) => {
      if (ts - last > 80) {
        last = ts
        setAnimHeights(prev => prev.map(() => Math.round(20 + Math.random() * 80)))
      }
      animFrameRef.current = requestAnimationFrame(throttledTick)
    }
    animFrameRef.current = requestAnimationFrame(throttledTick)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [voiceState, mounted])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  }

  const isActive     = voiceState === "recording" || voiceState === "playing"
  const isRecording  = voiceState === "recording"
  const isBusy       = voiceState === "transcribing" || voiceState === "thinking" || voiceState === "synthesizing"

  const barColor = isRecording
    ? "rgba(93,138,107,0.7)"   // sage when recording (user speaking)
    : voiceState === "playing"
    ? "rgba(166,124,82,0.6)"   // clay when AI speaking
    : "color-mix(in srgb, var(--border) 80%, transparent)"

  const statusLabel = {
    idle:          "Tap to speak",
    recording:     "Listening…",
    transcribing:  "Transcribing speech…",
    thinking:      "Thinking…",
    synthesizing:  "Generating voice…",
    playing:       "Speaking…",
  }[voiceState]

  // Mic button style
  const micBg = isRecording
    ? "linear-gradient(135deg, #2d6e52 0%, #4a9470 100%)"  // deep sage — recording
    : voiceState === "playing" || voiceState === "synthesizing"
    ? "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)"   // clay — AI turn
    : isBusy
    ? "linear-gradient(135deg, #4a4035 0%, #6b5a44 100%)"   // muted clay — busy
    : "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)"   // clay — idle

  const micGlow = isRecording
    ? "0 0 0 8px rgba(93,138,107,0.18), 0 6px 24px rgba(93,138,107,0.35)"
    : voiceState === "playing"
    ? "0 0 0 8px rgba(166,124,82,0.14), 0 6px 24px rgba(166,124,82,0.3)"
    : "0 4px 20px rgba(166,124,82,0.32)"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.875rem", padding: "0.25rem 0 0.5rem", width: "100%", maxWidth: 480, margin: "0 auto" }}>

      {/* Waveform visualizer */}
      <div style={{ height: 48, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {BAR_HEIGHTS.map((baseH, i) => {
          const h = isActive && mounted ? animHeights[i] : baseH * 0.18
          return (
            <div
              key={i}
              style={{
                width: 3,
                borderRadius: 2,
                backgroundColor: barColor,
                height: `${h}%`,
                transition: isActive ? "height 0.08s ease" : "height 0.4s ease, background-color 0.3s ease",
              }}
            />
          )
        })}
      </div>

      {/* Timer (only during recording) */}
      <div style={{
        ...sans,
        fontSize: "0.8125rem",
        fontFamily: "var(--font-mono, 'Courier New', monospace)",
        color: isRecording ? "var(--sage)" : "var(--muted-foreground)",
        opacity: isRecording ? 1 : 0.45,
        transition: "color 0.2s ease, opacity 0.2s ease",
        letterSpacing: "0.08em",
        minHeight: "1.25rem",
      }}>
        {isRecording ? formatTime(recordingTime) : "\u00A0"}
      </div>

      {/* Mic button */}
      <button
        onClick={onMicClick}
        disabled={disabled || isBusy}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        style={{
          width: 76, height: 76, borderRadius: "50%",
          background: micBg,
          border: "none",
          cursor: disabled || isBusy ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: micGlow,
          opacity: disabled || isBusy ? 0.5 : 1,
          transition: "background 0.22s ease, box-shadow 0.22s ease, opacity 0.18s ease, transform 0.12s ease",
          transform: "scale(1)",
          position: "relative",
          flexShrink: 0,
        }}
        onMouseDown={e => { if (!disabled && !isBusy) (e.currentTarget as HTMLElement).style.transform = "scale(0.94)" }}
        onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)" }}
      >
        {isBusy ? (
          /* Spinning ring when busy */
          <svg width="26" height="26" viewBox="0 0 26 26">
            <circle cx="13" cy="13" r="10" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
            <circle cx="13" cy="13" r="10" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5"
              strokeDasharray="20 43" strokeLinecap="round"
              style={{ animation: "voice-spin 0.9s linear infinite", transformOrigin: "13px 13px" }} />
          </svg>
        ) : isRecording ? (
          /* Square stop icon */
          <div style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.92)" }} />
        ) : (
          /* Mic icon */
          <Mic2 size={28} color="rgba(255,255,255,0.95)" strokeWidth={1.75} />
        )}

        {/* Recording pulse ring */}
        {isRecording && (
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: "2px solid rgba(93,138,107,0.4)",
            animation: "voice-pulse 1.5s ease-in-out infinite",
          }} />
        )}
      </button>

      {/* Status label */}
      <p style={{
        ...sans,
        fontSize: "0.8125rem",
        color: isRecording ? "var(--sage)"
          : voiceState === "playing" ? "var(--primary)"
          : "var(--muted-foreground)",
        transition: "color 0.22s ease",
        minHeight: "1.25rem",
        textAlign: "center",
      }}>
        {statusLabel}
      </p>

      <style>{`
        @keyframes voice-spin  { to { transform: rotate(360deg) } }
        @keyframes voice-pulse { 0%,100% { opacity: 0.6; transform: scale(1) } 50% { opacity: 0.15; transform: scale(1.18) } }
      `}</style>
    </div>
  )
}
