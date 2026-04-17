"use client"

import { Sparkles, Sun, Moon, Languages } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useClerk } from "@clerk/nextjs"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useProfileDict, useProfileLanguage, dict } from "@/lib/i18n"
import { apiUpdateUserProfile } from "@/lib/api"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

// Transliteration for common Pakistani / Arabic-origin first names.
// Falls back to the Roman form when a match isn't found.
const NAME_UR: Record<string, string> = {
  hasnain: "حسنین", ahmad: "احمد", ahmed: "احمد", ali: "علی",
  hassan: "حسن", hasan: "حسن", hussain: "حسین", hussein: "حسین", husain: "حسین",
  muhammad: "محمد", mohammad: "محمد", mohammed: "محمد", mohamed: "محمد",
  fatima: "فاطمہ", fatimah: "فاطمہ", ayesha: "عائشہ", aisha: "عائشہ",
  zainab: "زینب", zaynab: "زینب", omar: "عمر", umar: "عمر", abdullah: "عبداللہ",
  bilal: "بلال", usman: "عثمان", uthman: "عثمان", khalid: "خالد",
  saad: "سعد", hamza: "حمزہ", zain: "زین", yasir: "یاسر",
  ibrahim: "ابراہیم", ismail: "اسماعیل", aafia: "عافیہ", afia: "عافیہ",
  salman: "سلمان", imran: "عمران", faisal: "فیصل", tariq: "طارق",
  nadia: "نادیہ", sara: "سارہ", sarah: "سارہ", maryam: "مریم",
  noor: "نور", hiba: "ہبہ", rida: "ریدا", aleena: "علینہ",
  anaya: "انایا", ayaan: "ایان", arham: "ارحم", rayyan: "ریان",
  zoya: "زویا", hira: "حرا", kiran: "کرن", asad: "اسد",
  waqas: "وقاص", kashif: "کاشف", arif: "عارف", adeel: "عدیل",
  haris: "حارث", harris: "حارث", owais: "اویس", daniyal: "دانیال",
  junaid: "جنید", talha: "طلحہ", musa: "موسیٰ", isa: "عیسیٰ",
  yusuf: "یوسف", yousuf: "یوسف", uzair: "عزیر", anas: "انس",
  abubakr: "ابوبکر", abubakar: "ابوبکر", raza: "رضا", haider: "حیدر",
  abbas: "عباس", jafar: "جعفر", kamran: "کامران", farhan: "فرحان",
  ibrar: "ابرار", butt: "بٹ",
}

function toUrName(name: string): string {
  if (!name) return ""
  return name.split(/\s+/)
    .map((part) => NAME_UR[part.toLowerCase()] ?? part)
    .join(" ")
}

type HeaderProps = { onStartTutorial?: () => void }

export function Header({ onStartTutorial }: HeaderProps) {
  const { user, token, setAuth, logout } = useAuth()
  const { signOut: clerkSignOut } = useClerk()
  const router = useRouter()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const profileT = useProfileDict()
  const profileLang = useProfileLanguage()
  const [forceEn, setForceEn] = useState(false)
  useEffect(() => {
    if (typeof document === "undefined") return
    const check = () => setForceEn(document.documentElement.getAttribute("data-layout") === "ltr")
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-layout"] })
    return () => obs.disconnect()
  }, [])
  const lang: "en" | "ur" = forceEn ? "en" : profileLang
  const t = forceEn ? dict.en : profileT
  const [langSwitching, setLangSwitching] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? theme === "dark" : false

  const handleToggleLanguage = async () => {
    if (!user || langSwitching) return
    const next: "en" | "ur" = lang === "ur" ? "en" : "ur"
    // Optimistic UI update so fonts/RTL flip immediately
    setAuth({ token: (token ?? user.id).toString(), user: { ...user, lang_pref: next } })
    setLangSwitching(true)
    try {
      await apiUpdateUserProfile(user.id, { lang_pref: next })
    } catch {
      // Revert on failure
      setAuth({ token: (token ?? user.id).toString(), user: { ...user, lang_pref: lang } })
    } finally {
      setLangSwitching(false)
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setIsProfileOpen(false)
    await clerkSignOut?.()
    logout()
    window.location.href = "/"
  }

  const getFirstName = () => {
    const raw = user?.first_name || user?.email?.split("@")[0] || "there"
    return lang === "ur" ? toUrName(raw) : raw
  }
  const getInitial  = () => (user?.first_name || user?.email || "U").charAt(0).toUpperCase()

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t.goodMorning
    if (h < 17) return t.goodAfternoon
    return t.goodEvening
  }

  const getDate = () => {
    const d = new Date()
    if (lang === "ur") {
      const weekdaysUr = ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"]
      const monthsUr = ["جنوری","فروری","مارچ","اپریل","مئی","جون","جولائی","اگست","ستمبر","اکتوبر","نومبر","دسمبر"]
      const day = String(d.getDate()).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[+c])
      return `${weekdaysUr[d.getDay()]}، ${day} ${monthsUr[d.getMonth()]}`
    }
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  return (
    <div
      style={{
        ...sans,
        backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(14px)",
        height: 52,
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      {/* ── Left: compact greeting pill ─────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>

        {/* Greeting + name inline */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
          <span style={{
            ...sans, fontSize: "0.6875rem", fontWeight: 500,
            color: "var(--muted-foreground)", letterSpacing: "0.01em",
          }}>
            {getGreeting()},
          </span>
          <span style={{
            ...serif, fontSize: "1.1rem", fontWeight: 400,
            letterSpacing: "-0.02em", color: "var(--foreground)",
          }}>
            {getFirstName()}
          </span>
        </div>

        {/* Separator dot */}
        <span style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "var(--border)", display: "inline-block" }} />

        {/* Date chip */}
        <span style={{
          ...sans, fontSize: "0.625rem", fontWeight: 600,
          letterSpacing: "0.05em", textTransform: "uppercase",
          color: "var(--muted-foreground)",
          backgroundColor: "color-mix(in srgb, var(--muted) 60%, transparent)",
          border: "1px solid var(--border)",
          padding: "0.15rem 0.55rem", borderRadius: 100,
        }}>
          {getDate()}
        </span>
      </div>

      {/* ── Right: controls ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>

        {/* Language toggle — icon pill with EN/UR indicator */}
        <button
          type="button"
          onClick={handleToggleLanguage}
          disabled={!user || langSwitching}
          aria-label={lang === "ur" ? "Switch to English" : "Switch to Urdu"}
          title={lang === "ur" ? "Switch to English" : "اردو میں تبدیل کریں"}
          style={{
            height: 32, padding: "0 0.55rem",
            borderRadius: 100,
            backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--primary) 28%, transparent)",
            display: "flex", alignItems: "center", gap: "0.3rem",
            color: "var(--primary)",
            cursor: user && !langSwitching ? "pointer" : "not-allowed",
            opacity: langSwitching ? 0.6 : 1,
            transition: "background-color 0.15s ease",
            ...sans, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 18%, transparent)"}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 10%, transparent)"}
        >
          <Languages size={13} />
          <span>{lang === "ur" ? "UR" : "EN"}</span>
        </button>

        {/* Tour — icon-only pill */}
        {onStartTutorial && (
          <button
            type="button"
            onClick={() => onStartTutorial()}
            data-tour-target="tutorial-button"
            aria-label="Start dashboard tutorial"
            title="Product tour"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--primary) 28%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--primary)", cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 18%, transparent)"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 10%, transparent)"}
          >
            <Sparkles size={13} />
          </button>
        )}

        {/* Divider */}
        <div style={{ width: 1, height: 18, backgroundColor: "var(--border)" }} />

        {/* Theme toggle */}
        {mounted && (
          <button
            data-tour-target="theme-toggle"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--muted)"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            {isDark
              ? <Sun  size={14} color="var(--primary)" />
              : <Moon size={14} color="var(--muted-foreground)" />}
          </button>
        )}

        {/* Profile avatar + dropdown */}
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            data-tour-target="profile-menu"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
            title="Profile menu"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              backgroundColor: "var(--primary)",
              border: "2px solid color-mix(in srgb, var(--primary) 35%, transparent)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white",
              ...sans, fontWeight: 700, fontSize: "0.8125rem",
              boxShadow: "0 2px 8px rgba(166,124,82,0.3)",
              transition: "box-shadow 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 3px 14px rgba(166,124,82,0.5)"
              e.currentTarget.style.borderColor = "var(--primary)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(166,124,82,0.3)"
              e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 35%, transparent)"
            }}
          >
            {getInitial()}
          </button>

          {isProfileOpen && (
            <div data-urdu-rtl={lang === "ur" ? "" : undefined} style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)",
              width: 180,
              backgroundColor: "color-mix(in srgb, var(--card) 96%, transparent)",
              backdropFilter: "blur(14px)",
              borderRadius: 12,
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
              zIndex: 50, overflow: "hidden",
            }}>
              <div style={{ padding: "0.75rem 1rem 0.625rem", borderBottom: "1px solid var(--border)" }}>
                <p style={{ ...sans, fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground)" }}>
                  {user?.first_name} {user?.last_name}
                </p>
                <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email}
                </p>
              </div>
              {[
                { label: t.manageProfile, action: () => { router.push("/profile"); setIsProfileOpen(false) }, danger: false },
                { label: t.logOut,        action: handleLogout,                                                danger: true  },
              ].map(({ label, action, danger }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    ...sans, width: "100%", textAlign: lang === "ur" ? "right" : "left",
                    padding: "0.5rem 1rem", fontSize: "0.8125rem",
                    color: danger ? "var(--destructive)" : "var(--foreground)",
                    backgroundColor: "transparent", border: "none", cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--muted)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
