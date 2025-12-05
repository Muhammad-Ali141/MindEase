"use client"

import { MessageCircle, Mic2, Zap } from "lucide-react"
import { useRouter } from "next/navigation"

export function TherapyOptions() {
  const router = useRouter()

  const handleStartChat = () => {
    router.push("/chat")
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Quick Check-in Option - Blue */}
      <div
        data-tour-target="quick-check-in"
        className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-700/80 dark:to-blue-800/80 p-8 text-white hover:shadow-xl transition cursor-pointer group rounded-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <Zap size={32} className="group-hover:scale-110 transition" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Quick Check-in</h3>
        <p className="text-blue-100 dark:text-blue-200/80 mb-6">A brief mood assessment</p>
        <button className="w-full bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-semibold py-3 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-500 hover:ring-offset-2 dark:hover:ring-offset-blue-900/50 transition border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-600/50">
          Start Check-in
        </button>
      </div>

      {/* Text Chat Option - Purple */}
      <div
        data-tour-target="text-chat"
        className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-700/80 dark:to-purple-800/80 p-8 text-white hover:shadow-xl transition cursor-pointer group rounded-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <MessageCircle size={32} className="group-hover:scale-110 transition" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Text Chat</h3>
        <p className="text-purple-100 dark:text-purple-200/80 mb-6">
          Chat with our AI companion
        </p>
        <button 
          onClick={handleStartChat}
          className="w-full bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 font-semibold py-3 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:ring-2 hover:ring-purple-300 dark:hover:ring-purple-500 hover:ring-offset-2 dark:hover:ring-offset-purple-900/50 transition border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-600/50"
        >
          Start Chat
        </button>
      </div>

      {/* Voice Call Option - Green */}
      <div
        data-tour-target="voice-chat"
        className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-700/80 dark:to-emerald-800/80 p-8 text-white hover:shadow-xl transition cursor-pointer group rounded-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <Mic2 size={32} className="group-hover:scale-110 transition" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Voice Call</h3>
        <p className="text-emerald-100 dark:text-emerald-200/80 mb-6">
          Have a natural conversation
        </p>
        <button 
          onClick={() => router.push("/voice-chat")}
          className="w-full bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 font-semibold py-3 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:ring-2 hover:ring-emerald-300 dark:hover:ring-emerald-500 hover:ring-offset-2 dark:hover:ring-offset-emerald-900/50 transition border-2 border-transparent hover:border-emerald-200 dark:hover:border-emerald-600/50"
        >
          Start Call
        </button>
      </div>
    </div>
  )
}
