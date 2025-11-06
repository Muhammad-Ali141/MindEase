"use client"

import { useState, KeyboardEvent, useRef, useEffect } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

export function ChatInput({ onSendMessage, disabled, autoFocus }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus when autoFocus prop changes to true
  useEffect(() => {
    if (autoFocus && textareaRef.current && !disabled) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [autoFocus, disabled])

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage("")
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/30 p-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
            className="min-h-[60px] max-h-[120px] resize-none border-purple-200 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400 dark:focus:ring-purple-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
            disabled={disabled}
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-[60px] px-6"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

