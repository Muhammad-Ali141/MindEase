"use client"

import { Sparkles, User, ChevronDown } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useClerk } from "@clerk/nextjs"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

type HeaderProps = {
  onStartTutorial?: () => void
}

export function Header({ onStartTutorial }: HeaderProps) {
  const { user, logout } = useAuth()
  const { signOut: clerkSignOut } = useClerk()
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

  const handleLogout = async () => {
    setIsProfileOpen(false)
    await clerkSignOut?.()
    logout()
    window.location.href = "/"
  }

  const getUserDisplayName = () => {
    if (!user) return 'User'
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.first_name || user.email?.split('@')[0] || 'User'
  }

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {getUserDisplayName()}! 💙
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ready for a supportive conversation?</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => onStartTutorial?.()}
          className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
          aria-label="Start dashboard tutorial"
          data-tour-target="tutorial-button"
        >
          <Sparkles size={20} className="text-blue-600 dark:text-blue-400" />
        </button>
        
        {/* Theme Toggle */}
        <div data-tour-target="theme-toggle">
          <ThemeToggle />
        </div>
        
        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50 transition focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500"
            data-tour-target="profile-menu"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
          >
            <User size={20} className="text-purple-600 dark:text-purple-400" />
            <ChevronDown size={16} className="text-purple-600 dark:text-purple-400" />
          </button>
          
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50">
              <button 
                onClick={() => {
                  router.push("/profile")
                  setIsProfileOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Manage Profile
              </button>
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
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
