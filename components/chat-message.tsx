"use client"

import { type ChatMessage as ChatMessageType } from "@/lib/api"
import { Brain } from "lucide-react"

const sans = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

interface ChatMessageProps {
  message: ChatMessageType
  userInitial?: string
  grouped?: boolean
}

export function ChatMessage({ message, userInitial = "U", grouped = false }: ChatMessageProps) {
  const isUser = message.role === "user"

  // ── User ──────────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem" }}>
        {/* Bubble */}
        <div
          style={{
            ...sans,
            fontSize: "0.9375rem",
            lineHeight: 1.7,
            padding: "0.7rem 1rem",
            borderRadius: grouped ? "16px 4px 4px 16px" : "16px 4px 16px 16px",
            background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
            color: "white",
            boxShadow: "0 2px 12px rgba(166,124,82,0.2)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxWidth: "62%",
          }}
        >
          {message.content}
        </div>

        {/* Avatar — centered with bubble via parent alignItems:center */}
        <div style={{ width: 28, height: 28, flexShrink: 0 }}>
          {!grouped && (
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #7a5535 0%, #a67c52 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 6px rgba(166,124,82,0.28)",
            }}>
              <span style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, color: "white" }}>
                {userInitial}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
      {/* Avatar — centered with bubble */}
      <div style={{ width: 28, height: 28, flexShrink: 0 }}>
        {!grouped && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #325944 0%, #5D8A6B 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 6px rgba(93,138,107,0.25)",
          }}>
            <Brain size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
          </div>
        )}
      </div>

      {/* Bubble */}
      <div
        style={{
          ...sans,
          fontSize: "0.9375rem",
          lineHeight: 1.8,
          color: "var(--foreground)",
          padding: "0.7rem 1rem",
          borderRadius: grouped ? "4px 16px 16px 4px" : "4px 16px 16px 16px",
          backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
          borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
          borderRight: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
          borderLeft: "2px solid color-mix(in srgb, #5D8A6B 55%, transparent)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxWidth: "82%",
        }}
      >
        {message.content}
      </div>
    </div>
  )
}
