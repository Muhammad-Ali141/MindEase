"use client"

import { useState, KeyboardEvent, useRef, useEffect } from "react"
import { ArrowUp } from "lucide-react"

const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
}

export function ChatInput({
  onSendMessage,
  disabled,
  autoFocus,
  placeholder = "Message…",
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && textareaRef.current && !disabled) {
      setTimeout(() => textareaRef.current?.focus(), 120)
    }
  }, [autoFocus, disabled])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 140) + "px"
  }, [message])

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage("")
      if (textareaRef.current) textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = message.trim().length > 0 && !disabled

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "0.5rem",
        borderRadius: 14,
        border: focused
          ? "1px solid color-mix(in srgb, var(--primary) 55%, transparent)"
          : "1px solid var(--border)",
        backgroundColor: "color-mix(in srgb, var(--card) 92%, transparent)",
        backdropFilter: "blur(16px)",
        boxShadow: focused
          ? "0 0 0 3px color-mix(in srgb, var(--primary) 9%, transparent), 0 2px 16px rgba(0,0,0,0.08)"
          : "0 2px 12px rgba(0,0,0,0.06)",
        padding: "0.625rem 0.625rem 0.625rem 1rem",
        transition: "border-color 0.18s ease, box-shadow 0.18s ease",
      }}
    >
      <textarea
        ref={textareaRef}
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          ...sans,
          flex: 1,
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: "0.9375rem",
          lineHeight: 1.55,
          color: "var(--foreground)",
          minHeight: 22,
          maxHeight: 140,
          padding: 0,
          alignSelf: "center",
        }}
      />

      <button
        onClick={handleSend}
        disabled={!canSend}
        style={{
          width: 32, height: 32,
          borderRadius: 9,
          border: "none",
          cursor: canSend ? "pointer" : "default",
          background: canSend
            ? "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)"
            : "color-mix(in srgb, var(--muted) 70%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: canSend ? "0 2px 8px rgba(166,124,82,0.32)" : "none",
          transition: "opacity 0.15s ease, transform 0.1s ease",
        }}
        onMouseEnter={e => { if (canSend) e.currentTarget.style.opacity = "0.85" }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1" }}
        onMouseDown={e => { if (canSend) e.currentTarget.style.transform = "scale(0.91)" }}
        onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}
      >
        <ArrowUp size={14} color={canSend ? "white" : "var(--muted-foreground)"} strokeWidth={2.5} />
      </button>
    </div>
  )
}
