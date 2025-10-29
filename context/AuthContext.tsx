"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type User = { 
  id: string; 
  email: string; 
  first_name: string; 
  last_name?: string; 
}
type AuthState = {
  token: string | null
  user: User | null
}
type AuthContextType = AuthState & {
  setAuth: (s: AuthState) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null })
  const [isLoading, setIsLoading] = useState(true)

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('user_data')
    
    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        setState({ token: storedToken, user: userData })
      } catch (error) {
        // Clear invalid data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_data')
      }
    }
    setIsLoading(false)
  }, [])

  const logout = () => {
    setState({ token: null, user: null })
    // Clear any stored auth data
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
  }

  const setAuth = (authState: AuthState) => {
    setState(authState)
    // Store auth data in localStorage
    if (authState.token && authState.user) {
      localStorage.setItem('auth_token', authState.token)
      localStorage.setItem('user_data', JSON.stringify(authState.user))
    }
  }

  return (
    <AuthContext.Provider
      value={{
        token: state.token,
        user: state.user,
        setAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
