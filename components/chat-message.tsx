"use client"

import { type ChatMessage as ChatMessageType } from "@/lib/api"
import { User, Bot } from "lucide-react"

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={`flex items-start gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-gradient-to-br from-blue-500 to-blue-600"
            : "bg-gradient-to-br from-purple-500 to-blue-500"
        }`}
      >
        {isUser ? (
          <User className="h-5 w-5 text-white" />
        ) : (
          <Bot className="h-5 w-5 text-white" />
        )}
      </div>

      {/* Message Bubble */}
      <div
        className={`max-w-[70%] rounded-2xl px-6 py-4 shadow-md ${
          isUser
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm"
            : "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-purple-100 dark:border-purple-900/30"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  )
}

