"use client"

import { Home, MessageCircle, Mic2, FileText, Users, Settings, LogOut, Heart } from "lucide-react"
import { useRouter } from "next/navigation"

export function Sidebar() {
  const router = useRouter()

  return (
    <div className="w-24 bg-gradient-to-b from-blue-600 to-purple-600 flex flex-col items-center py-8 gap-8">
      {/* MindEase Logo */}
      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg">
        <Heart size={24} className="text-purple-600 fill-purple-600" />
      </div>

      <nav className="flex flex-col gap-6 flex-1">
        <button 
          onClick={() => router.push("/dashboard")}
          className="p-3 hover:bg-white/20 rounded-lg transition" 
          title="Dashboard"
        >
          <Home size={24} className="text-white" />
        </button>
        <button 
          onClick={() => router.push("/chat")}
          className="p-3 hover:bg-white/20 rounded-lg transition" 
          title="Text Chat"
        >
          <MessageCircle size={24} className="text-white" />
        </button>
        <button 
          onClick={() => router.push("/voice-chat")}
          className="p-3 hover:bg-white/20 rounded-lg transition" 
          title="Voice Call"
        >
          <Mic2 size={24} className="text-white" />
        </button>
        <button 
          onClick={() => router.push("/sessions")}
          className="p-3 hover:bg-white/20 rounded-lg transition" 
          title="Session History"
        >
          <FileText size={24} className="text-white" />
        </button>
        <button className="p-3 hover:bg-white/20 rounded-lg transition" title="Find Therapist">
          <Users size={24} className="text-white" />
        </button>
      </nav>

      <div className="flex flex-col gap-4">
        <button className="p-3 hover:bg-white/20 rounded-lg transition" title="Settings">
          <Settings size={24} className="text-white" />
        </button>
        <button className="p-3 hover:bg-white/20 rounded-lg transition" title="Logout">
          <LogOut size={24} className="text-white" />
        </button>
      </div>
    </div>
  )
}
