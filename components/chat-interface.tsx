"use client"

import { useEffect, useRef } from "react"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { type ChatMessage as ChatMessageType } from "@/lib/api"
import { Loader2 } from "lucide-react"

interface ChatInterfaceProps {
  messages: ChatMessageType[]
  onSendMessage: (message: string) => void
  loading: boolean
  onResponseComplete?: () => void
}

export function ChatInterface({
  messages,
  onSendMessage,
  loading,
  onResponseComplete,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevLoadingRef = useRef(loading)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Call onResponseComplete when loading changes from true to false
  useEffect(() => {
    if (prevLoadingRef.current && !loading && onResponseComplete) {
      onResponseComplete()
    }
    prevLoadingRef.current = loading
  }, [loading, onResponseComplete])

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg">Start a conversation...</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}

        {loading && messages.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">AI</span>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-6 py-4 shadow-md border border-purple-100 dark:border-purple-900/30">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSendMessage={onSendMessage} disabled={loading} />
    </div>
  )
}

