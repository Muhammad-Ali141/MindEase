"use client"

import { Bell, User, ChevronDown } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    logout()
    router.push("/")
    setIsProfileOpen(false)
  }

  const getUserDisplayName = () => {
    if (!user) return 'User'
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.first_name || user.email?.split('@')[0] || 'User'
  }

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {getUserDisplayName()}! 💙
          </h1>
          <p className="text-sm text-gray-500">Ready for a supportive conversation?</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="p-3 bg-blue-50 rounded-full hover:bg-blue-100 transition">
          <Bell size={20} className="text-blue-600" />
        </button>
        
        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-3 bg-purple-50 rounded-full hover:bg-purple-100 transition"
          >
            <User size={20} className="text-purple-600" />
            <ChevronDown size={16} className="text-purple-600" />
          </button>
          
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Manage Profile
              </button>
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
