"use client"

import { Home, MessageCircle, Mic2, FileText, Users, Settings, LogOut, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useClerk } from "@clerk/nextjs"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useProfileDict } from "@/lib/i18n"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

const navConfig = [
  { icon: Home,          key: "dashboard" as const,  href: "/dashboard" },
  { icon: MessageCircle, key: "textChat" as const,   href: "/chat" },
  { icon: Mic2,          key: "voiceChat" as const,  href: "/voice-chat" },
  { icon: FileText,      key: "sessions" as const,    href: "/sessions" },
  { icon: Users,         key: "therapists" as const, href: "/dashboard/therapists" },
]

type SidebarProps = {
  open: boolean
  onToggle: () => void
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const router   = useRouter()
  const { logout, user } = useAuth()
  const { signOut } = useClerk()
  const { theme } = useTheme()
  const t = useProfileDict()
  const [mounted, setMounted] = useState(false)
  const [pathname, setPathname] = useState("")
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (typeof window === "undefined") return
    const updatePath = () => setPathname(window.location.pathname)
    updatePath()
    window.addEventListener("popstate", updatePath)
    return () => window.removeEventListener("popstate", updatePath)
  }, [])
  const isDark = !mounted || theme !== "light"
  const navItems = navConfig.map(({ icon, key, href }) => ({ icon, label: t[key], href }))

  // Theme-aware colour tokens
  const C = {
    bg:         isDark ? "linear-gradient(180deg, #241a13 0%, #1a2118 60%, #1c2820 100%)"
                       : "linear-gradient(180deg, #faf7f4 0%, #f4f7f3 60%, #f2f6f1 100%)",
    borderR:    isDark ? "1px solid rgba(166,124,82,0.1)"   : "1px solid rgba(166,124,82,0.18)",
    brandText:  isDark ? "rgba(255,255,255,0.9)"            : "rgba(30,20,10,0.85)",
    tagText:    isDark ? "rgba(166,124,82,0.6)"             : "rgba(140,90,40,0.65)",
    sectionLbl: isDark ? "rgba(255,255,255,0.18)"           : "rgba(30,20,10,0.28)",
    navText:    isDark ? "rgba(255,255,255,0.42)"           : "rgba(30,20,10,0.52)",
    navActive:  isDark ? "#c8a878"                          : "#8a5a2a",
    navActiveBg:isDark ? "rgba(166,124,82,0.13)"            : "rgba(166,124,82,0.11)",
    navHoverBg: isDark ? "rgba(255,255,255,0.06)"           : "rgba(0,0,0,0.05)",
    navHoverTx: isDark ? "rgba(255,255,255,0.75)"           : "rgba(30,20,10,0.8)",
    divider:    isDark ? "rgba(255,255,255,0.05)"           : "rgba(0,0,0,0.08)",
    toggleBg:   isDark ? "rgba(255,255,255,0.05)"           : "rgba(0,0,0,0.05)",
    toggleBdr:  isDark ? "rgba(255,255,255,0.1)"            : "rgba(0,0,0,0.12)",
    toggleTx:   isDark ? "rgba(255,255,255,0.35)"           : "rgba(30,20,10,0.38)",
    toggleHBg:  isDark ? "rgba(166,124,82,0.18)"            : "rgba(166,124,82,0.15)",
    toggleHTx:  isDark ? "#c8a878"                          : "#8a5a2a",
    userCard:   isDark ? "rgba(255,255,255,0.05)"           : "rgba(0,0,0,0.04)",
    userCardBdr:isDark ? "rgba(166,124,82,0.12)"            : "rgba(166,124,82,0.18)",
    userText:   isDark ? "rgba(255,255,255,0.82)"           : "rgba(30,20,10,0.82)",
    userSub:    isDark ? "rgba(255,255,255,0.35)"           : "rgba(30,20,10,0.38)",
    logoutTx:   isDark ? "rgba(248,113,113,0.4)"            : "rgba(200,60,60,0.5)",
    logoutHBg:  isDark ? "rgba(185,28,28,0.12)"             : "rgba(185,28,28,0.08)",
    logoutHTx:  isDark ? "rgba(248,113,113,0.9)"            : "rgba(200,60,60,0.9)",
    settingsTx: isDark ? "rgba(255,255,255,0.28)"           : "rgba(30,20,10,0.38)",
  }

  const handleLogout = async () => {
    await signOut?.()
    logout()
    window.location.href = "/"
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href))

  const initial = (user?.first_name || user?.email || "U").charAt(0).toUpperCase()

  return (
    <div style={{
      width: open ? 230 : 68,
      flexShrink: 0, height: "100%",
      background: C.bg,
      display: "flex", flexDirection: "column",
      borderRight: C.borderR,
      overflow: "hidden",
      transition: "width 0.22s ease",
    }}>

      {/* Brand area */}
      <div style={{
        padding: open ? "1.25rem 1rem 1rem" : "1rem 0",
        borderBottom: `1px solid ${C.divider}`,
        display: "flex", alignItems: "center",
        justifyContent: open ? "flex-start" : "center",
        gap: "0.625rem",
        flexShrink: 0,
      }}>
        <Link href="/dashboard" style={{ textDecoration: "none", flexShrink: 0 }}>
          <img src="/logo.svg" alt="MindEase" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "contain" }} />
        </Link>

        {open && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...serif, fontSize: "1.0625rem", fontWeight: 600, color: C.brandText, letterSpacing: "-0.01em", lineHeight: 1.1, whiteSpace: "nowrap" }}>
                MindEase
              </p>
              <p style={{ ...sans, fontSize: "0.4875rem", color: C.tagText, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "0.15rem" }}>
                {t.wellnessPlatform}
              </p>
            </div>

            {/* Collapse toggle */}
            <button
              onClick={onToggle}
              title="Collapse sidebar"
              style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                border: `1px solid ${C.toggleBdr}`,
                backgroundColor: C.toggleBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.toggleTx,
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.toggleHBg; e.currentTarget.style.color = C.toggleHTx }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.toggleBg;  e.currentTarget.style.color = C.toggleTx }}
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* Expand toggle when collapsed */}
      {!open && (
        <div style={{ display: "flex", justifyContent: "center", padding: "0.5rem 0 0.25rem" }}>
          <button
            onClick={onToggle}
            title="Expand sidebar"
            style={{
              width: 30, height: 22, borderRadius: 7,
              border: `1px solid ${C.toggleBdr}`,
              backgroundColor: C.toggleBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: C.toggleTx,
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.toggleHBg; e.currentTarget.style.color = C.toggleHTx }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.toggleBg;  e.currentTarget.style.color = C.toggleTx }}
          >
            <ChevronRight size={12} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{
        flex: 1,
        padding: open ? "0.75rem 0.75rem 0.5rem" : "0.625rem 0 0.5rem",
        display: "flex", flexDirection: "column", gap: "0.125rem",
      }}>
        {open && (
          <p style={{ ...sans, fontSize: "0.4875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.sectionLbl, padding: "0 0.5rem", marginBottom: "0.4rem" }}>
            {t.navigation}
          </p>
        )}
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              onClick={() => setPathname(href)}
              title={!open ? label : undefined}
              style={{
                ...sans,
                display: "flex", alignItems: "center",
                gap: open ? "0.625rem" : 0,
                justifyContent: open ? "flex-start" : "center",
                width: "100%",
                padding: open ? "0.5625rem 0.625rem" : "0.625rem 0",
                borderRadius: 9, cursor: "pointer", border: "none",
                borderLeft: open ? `2px solid ${active ? "#a67c52" : "transparent"}` : "none",
                backgroundColor: active ? C.navActiveBg : "transparent",
                color: active ? C.navActive : C.navText,
                fontSize: "0.8125rem", fontWeight: active ? 600 : 400,
                textAlign: "left", textDecoration: "none",
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = C.navHoverBg
                  e.currentTarget.style.color = C.navHoverTx
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = "transparent"
                  e.currentTarget.style.color = C.navText
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {open && label}
            </Link>
          )
        })}
      </nav>

      {/* User card (open) / Avatar (collapsed) */}
      {user && open && (
        <div style={{ padding: "0 0.875rem 0.75rem" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            padding: "0.75rem 0.875rem", borderRadius: 10,
            backgroundColor: C.userCard,
            border: `1px solid ${C.userCardBdr}`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              backgroundColor: "#a67c52",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(166,124,82,0.35)",
            }}>
              <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: 700, color: "white" }}>{initial}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: C.userText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.first_name} {user.last_name}
              </p>
              <p style={{ ...sans, fontSize: "0.625rem", color: C.userSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "0.1rem" }}>
                {user.city || user.email || ""}
              </p>
            </div>
          </div>
        </div>
      )}
      {user && !open && (
        <div style={{ display: "flex", justifyContent: "center", padding: "0.375rem 0 0.75rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            backgroundColor: "#a67c52",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: 700, color: "white" }}>{initial}</span>
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: C.divider, margin: "0 0.75rem" }} />

      {/* Bottom: Settings + Logout */}
      <div style={{
        padding: open ? "0.625rem 0.75rem 1.125rem" : "0.5rem 0 1rem",
        display: "flex", flexDirection: "column", gap: "0.125rem",
      }}>
        {/* Settings link */}
        <Link
          href="/profile"
          prefetch={true}
          title={!open ? t.settings : undefined}
          style={{
            ...sans,
            display: "flex", alignItems: "center",
            gap: open ? "0.625rem" : 0,
            justifyContent: open ? "flex-start" : "center",
            width: "100%",
            padding: open ? "0.5rem 0.625rem" : "0.5625rem 0",
            borderRadius: 9, cursor: "pointer", border: "none",
            borderLeft: open ? "2px solid transparent" : "none",
            backgroundColor: "transparent",
            color: C.settingsTx,
            fontSize: "0.8125rem", textDecoration: "none",
            transition: "background-color 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = C.navHoverBg
            e.currentTarget.style.color = C.navHoverTx
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "transparent"
            e.currentTarget.style.color = C.settingsTx
          }}
        >
          <Settings size={15} style={{ flexShrink: 0 }} />
          {open && t.settings}
        </Link>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          title={!open ? t.logOut : undefined}
          style={{
            ...sans,
            display: "flex", alignItems: "center",
            gap: open ? "0.625rem" : 0,
            justifyContent: open ? "flex-start" : "center",
            width: "100%",
            padding: open ? "0.5rem 0.625rem" : "0.5625rem 0",
            borderRadius: 9, cursor: "pointer", border: "none",
            borderLeft: open ? "2px solid transparent" : "none",
            backgroundColor: "transparent",
            color: C.logoutTx,
            fontSize: "0.8125rem",
            transition: "background-color 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = C.logoutHBg
            e.currentTarget.style.color = C.logoutHTx
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "transparent"
            e.currentTarget.style.color = C.logoutTx
          }}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          {open && t.logOut}
        </button>
      </div>
    </div>
  )
}
