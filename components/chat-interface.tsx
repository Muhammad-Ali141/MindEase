"use client"

import { useEffect, useRef } from "react"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { type ChatMessage as ChatMessageType } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { Brain } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useProfileDict, dict, type Language } from "@/lib/i18n"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

interface ChatInterfaceProps {
  messages: ChatMessageType[]
  onSendMessage: (message: string) => void
  loading: boolean
  onResponseComplete?: () => void
  lang?: Language
}

export function ChatInterface({ messages, onSendMessage, loading, onResponseComplete, lang }: ChatInterfaceProps) {
  const messagesEndRef   = useRef<HTMLDivElement>(null)
  const prevLoadingRef   = useRef(loading)
  const { user } = useAuth()
  const profileDict = useProfileDict()
  const t = lang ? dict[lang] : profileDict
  const userInitial      = user?.first_name?.[0]?.toUpperCase() ?? "U"
  const hasUserMessages  = messages.some(m => m.role === "user")
  const welcomeMessage   = !hasUserMessages ? messages.find(m => m.role === "assistant") : null
  const suggestions = [t.chatSug1, t.chatSug2, t.chatSug3, t.chatSug4]
  const latestAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i
    }
    return -1
  })()
  const latestAssistantMessage =
    latestAssistantIndex >= 0 ? messages[latestAssistantIndex] : null
  // Only treat it as "stream text visible" if the latest assistant message
  // comes AFTER the latest user message (i.e. it's the current response, not a prior one)
  const latestUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return i
    }
    return -1
  })()
  const assistantHasVisibleStreamText = Boolean(
    loading &&
    latestAssistantMessage &&
    latestAssistantIndex > latestUserIndex &&
    latestAssistantMessage.content.trim().length > 0
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (prevLoadingRef.current && !loading && onResponseComplete) onResponseComplete()
    prevLoadingRef.current = loading
  }, [loading, onResponseComplete])

  // ── Landing (no user messages yet) ────────────────────────────────────────
  if (!hasUserMessages) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1.5rem 2.5rem" }}>
        <div style={{ width: "100%", maxWidth: 680, margin: "0 auto" }}>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: "center", marginBottom: "1.75rem" }}
          >
            <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.5rem" }}>
              {t.chatSafeSpace}
            </p>
            <h1 style={{ ...serif, fontSize: "clamp(1.875rem, 3.5vw, 2.625rem)", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1.1, marginBottom: "0.6rem" }}>
              {t.chatWhatsOnMind}{" "}
              <span style={{ fontStyle: "italic", color: "var(--primary)" }}>
                {user?.first_name || t.chatToday}
              </span>
              ?
            </h1>
            <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              {t.chatShareFreely}
            </p>
          </motion.div>

          {/* AI welcome card */}
          {welcomeMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{
                marginBottom: "1.25rem", padding: "0.875rem 1rem",
                borderRadius: 14,
                backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
                backdropFilter: "blur(12px)",
                borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                borderRight: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                borderLeft: "2px solid color-mix(in srgb, #5D8A6B 55%, transparent)",
                display: "flex", alignItems: "center", gap: "0.75rem",
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(93,138,107,0.25)" }}>
                <Brain size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
              </div>
              <p style={{ ...sans, fontSize: "0.9375rem", lineHeight: 1.78, color: "var(--foreground)", margin: 0 }}>
                {welcomeMessage.content}
              </p>
            </motion.div>
          )}

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: "1rem", width: "100%" }}
          >
            <ChatInput onSendMessage={onSendMessage} disabled={loading} autoFocus placeholder={t.chatPlaceholder} />
          </motion.div>

          {/* Suggestion chips */}
          {(welcomeMessage || !loading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.18 }}
              style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}
            >
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.05 }}
                  onClick={() => !loading && onSendMessage(s)}
                  disabled={loading}
                  style={{
                    ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)",
                    padding: "0.375rem 0.875rem", borderRadius: 100,
                    border: "1px solid var(--border)", background: "none",
                    cursor: loading ? "default" : "pointer",
                    transition: "border-color 0.15s ease, color 0.15s ease",
                  }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 55%, transparent)"; e.currentTarget.style.color = "var(--primary)" } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)" }}
                >
                  {s}
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>

        <style>{`@keyframes mindease-bounce { 0%,60%,100%{transform:translateY(0);opacity:.65} 30%{transform:translateY(-5px);opacity:1} }`}</style>
      </div>
    )
  }

  // ── Chat mode ──────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Scroll area — full width with side padding */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: "1.5rem" }} />

        <div
          style={{
            width: "100%",
            padding: "1rem 1.5rem 0.5rem",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isEmptyAssistantPlaceholder =
                msg.role === "assistant" &&
                msg.content.trim().length === 0 &&
                loading &&
                i === latestAssistantIndex

              if (isEmptyAssistantPlaceholder) {
                return null
              }

              const prev      = messages[i - 1]
              const isGrouped = prev?.role === msg.role
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{ marginBottom: isGrouped ? "0.3rem" : "0.875rem" }}
                >
                  <ChatMessage
                    message={msg}
                    userInitial={userInitial}
                    grouped={isGrouped}
                    animateTyping={i === latestAssistantIndex}
                    streaming={loading && i === latestAssistantIndex}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>

          <AnimatePresence>
            {loading && !assistantHasVisibleStreamText && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #325944, #5D8A6B)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(93,138,107,0.25)" }}>
                  <Brain size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
                </div>
                <div style={{ padding: "0.7rem 1rem", borderRadius: "4px 16px 16px 16px", backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)", backdropFilter: "blur(12px)", borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)", borderRight: "1px solid color-mix(in srgb, var(--border) 50%, transparent)", borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)", borderLeft: "2px solid color-mix(in srgb, #5D8A6B 55%, transparent)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--primary)", opacity: 0.65, animation: `mindease-bounce 1.2s ease-in-out ${i * 0.18}s infinite` }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: "1px solid color-mix(in srgb, var(--border) 45%, transparent)", backgroundColor: "color-mix(in srgb, var(--background) 65%, transparent)", backdropFilter: "blur(12px)", padding: "0.75rem 1.5rem 0.875rem" }}>
        <div>
          <ChatInput onSendMessage={onSendMessage} disabled={loading} />
          <p style={{ ...sans, fontSize: "0.5625rem", textAlign: "center", color: "var(--muted-foreground)", marginTop: "0.4rem", opacity: 0.45, letterSpacing: "0.02em" }}>
            {t.chatEnterHint}
          </p>
        </div>
      </div>

      <style>{`@keyframes mindease-bounce { 0%,60%,100%{transform:translateY(0);opacity:.65} 30%{transform:translateY(-5px);opacity:1} }`}</style>
    </div>
  )
}
