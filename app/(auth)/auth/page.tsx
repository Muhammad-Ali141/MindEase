"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import { useUser, useSignIn, useClerk } from "@clerk/nextjs"
import { useToast } from "@/hooks/use-toast"
import { apiLogin, apiRegister, apiCheckEmail, apiSendOtp, apiVerifyOtp, apiLoginOauth, apiRegisterOauth } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { dict, useLanguage } from "@/lib/i18n"
import { FormError } from "@/components/FormError"
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator"
import { Loader2, Mail, Lock, CheckCircle2, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { LanguageToggle } from "@/components/LanguageToggle"
import { BeamsBackground } from "@/components/ui/beams-background"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

// ─── Schemas ─────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

const createRegisterSchema = (t: typeof dict.en) =>
  z.object({
    email: z.string().min(1, "Email is required").email("Invalid email"),
    password: z.string()
      .min(8, t.passwordTooShort || "Password must be at least 8 characters")
      .max(16, t.passwordTooLong || "Password must be no more than 16 characters")
      .regex(/[0-9]/, t.passwordNoNumbers || "Password must contain at least one number")
      .regex(/[a-zA-Z]/, t.passwordNoLetters || "Password must contain at least one letter")
      .regex(/[^a-zA-Z0-9]/, t.passwordNoSpecialChars || "Password must contain at least one special character"),
    confirmPassword: z.string().min(8, t.passwordTooShort || "Password must be at least 8 characters"),
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    city: z.string().min(1, "City is required"),
    nearest_major_city: z.string().min(1, "Nearest major city is required").max(100, "Must be less than 100 characters"),
    dob: z.string().nonempty("Date of birth is required"),
    gender: z.string().nonempty("Gender is required"),
    preferred_language: z.string().nonempty("Preferred language is required"),
  }).refine((d) => d.password === d.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] })

type LoginFormValues = z.infer<typeof loginSchema>

const majorCitySuggestions = [
  { value: "Islamabad", labelUr: "اسلام آباد" },
  { value: "Lahore",    labelUr: "لاہور" },
  { value: "Karachi",   labelUr: "کراچی" },
  { value: "Multan",    labelUr: "ملتان" },
  { value: "Peshawar",  labelUr: "پشاور" },
  { value: "Faisalabad",labelUr: "فیصل آباد" },
]

const ease = { type: "tween", duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }
type GoogleUser = { email: string; firstName: string; lastName: string }

// ─── Shared style tokens ──────────────────────────────────────────────────────
const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

const inputStyle: React.CSSProperties = {
  ...sans,
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1.5px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 0.875rem",
  fontSize: "0.875rem",
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
}

const labelStyle: React.CSSProperties = {
  ...sans,
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  display: "block",
  marginBottom: "0.375rem",
}

function ClayButton({ children, onClick, disabled, type = "button", variant = "primary", fullWidth = false, style }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: "button" | "submit"
  variant?: "primary" | "outline" | "ghost"
  fullWidth?: boolean
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    ...sans, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    height: 44, padding: "0 1.5rem", borderRadius: 100, fontSize: "0.875rem", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", border: "none", width: fullWidth ? "100%" : undefined,
    transition: "opacity 0.2s ease, transform 0.1s ease", opacity: disabled ? 0.5 : 1,
    letterSpacing: "0.01em",
  }
  const variants = {
    primary: { backgroundColor: "var(--primary)", color: "white", boxShadow: "0 4px 16px rgba(166,124,82,0.28)" },
    outline: { backgroundColor: "transparent", color: "var(--foreground)", border: "1.5px solid var(--border)" },
    ghost:   { backgroundColor: "transparent", color: "var(--muted-foreground)", border: "none" },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

function StyledInput({ type = "text", placeholder, value, onChange, autoComplete, disabled, id, register, name, error, hasCheck, isChecking, isVerified }: any) {
  const [show, setShow] = useState(false)
  const isPassword = type === "password"
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={isPassword ? (show ? "text" : "password") : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        disabled={disabled}
        {...(register ? register(name) : {})}
        style={{
          ...inputStyle,
          borderColor: error ? "#ef4444" : isVerified ? "#5D8A6B" : undefined,
          paddingRight: (isPassword || hasCheck) ? "2.75rem" : undefined,
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = "var(--primary)"
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)"
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = error ? "#ef4444" : isVerified ? "#5D8A6B" : "var(--border)"
          e.currentTarget.style.boxShadow = "none"
        }}
      />
      {isPassword && (
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 0 }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
      {isChecking && <Loader2 style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)" }} size={14} className="animate-spin" />}
      {isVerified && !isChecking && <CheckCircle2 style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#5D8A6B" }} size={14} />}
    </div>
  )
}

function StyledSelect({ register, name, children, error }: any) {
  return (
    <select
      {...(register ? register(name) : {})}
      style={{
        ...inputStyle, cursor: "pointer",
        borderColor: error ? "#ef4444" : undefined,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)" }}
      onBlur={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
    >
      {children}
    </select>
  )
}

// ─── Decorative left panel ────────────────────────────────────────────────────
function BrandPanel({ mode, isUrdu }: { mode: "login" | "signup"; isUrdu: boolean }) {
  const content = {
    login: {
      en: { eyebrow: "WELCOME BACK", headline1: "Your sanctuary", headline2: "awaits you.", desc: "Continue your mental wellness journey" },
      ur: { eyebrow: "خوش آمدید", headline1: "آپ کا محفوظ مقام", headline2: "منتظر ہے۔", desc: "اپنا سفر جاری رکھیں" },
    },
    signup: {
      en: { eyebrow: "GET STARTED", headline1: "Healing starts", headline2: "here.", desc: "Join thousands on their wellness journey" },
      ur: { eyebrow: "شروع کریں", headline1: "ذہنی صحت کا سفر", headline2: "یہاں سے شروع ہو۔", desc: "ہزاروں لوگوں کے ساتھ جڑیں" },
    },
  }
  const c = content[mode][isUrdu ? "ur" : "en"]

  const benefits = isUrdu
    ? [
        { icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 3.5V8c0 3.3 2.5 5.8 6 7 3.5-1.2 6-3.7 6-7V3.5L8 1z" stroke="rgba(166,124,82,0.9)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>, label: "مکمل رازداری" },
        { icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="rgba(93,138,107,0.9)" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="rgba(93,138,107,0.9)" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: "AI معالج" },
        { icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="rgba(166,124,82,0.9)" strokeWidth="1.5"/><path d="M8 1.5c0 0-3 2.5-3 6.5s3 6.5 3 6.5M8 1.5c0 0 3 2.5 3 6.5s-3 6.5-3 6.5M1.5 8h13" stroke="rgba(166,124,82,0.9)" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: "دو زبانی" },
      ]
    : [
        { icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 3.5V8c0 3.3 2.5 5.8 6 7 3.5-1.2 6-3.7 6-7V3.5L8 1z" stroke="rgba(166,124,82,0.9)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>, label: "Private & secure" },
        { icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="rgba(93,138,107,0.9)" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="rgba(93,138,107,0.9)" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: "AI-powered" },
        { icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="rgba(166,124,82,0.9)" strokeWidth="1.5"/><path d="M8 1.5c0 0-3 2.5-3 6.5s3 6.5 3 6.5M8 1.5c0 0 3 2.5 3 6.5s-3 6.5-3 6.5M1.5 8h13" stroke="rgba(166,124,82,0.9)" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: "Bilingual" },
      ]

  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column",
      padding: "2.5rem 2.75rem", overflow: "hidden", height: "100%", minHeight: 520,
      background: "linear-gradient(155deg, #3a2d22 0%, #2a3b2e 55%, #1e2922 100%)",
    }}>
      {/* Decorative rings */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", border: "1px solid rgba(166,124,82,0.18)" }} />
      <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", border: "1px solid rgba(166,124,82,0.12)" }} />
      <div style={{ position: "absolute", bottom: -90, left: -60, width: 300, height: 300, borderRadius: "50%", border: "1px solid rgba(93,138,107,0.15)" }} />
      <div style={{ position: "absolute", bottom: 60, left: -30, width: 180, height: 180, borderRadius: "50%", border: "1px solid rgba(93,138,107,0.1)" }} />
      {/* Glow blobs */}
      <div style={{ position: "absolute", top: "35%", right: "8%", width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(166,124,82,0.1)", filter: "blur(50px)" }} />
      <div style={{ position: "absolute", bottom: "20%", left: "0%", width: 160, height: 160, borderRadius: "50%", backgroundColor: "rgba(93,138,107,0.1)", filter: "blur(45px)" }} />

      {/* Logo — anchored top */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(166,124,82,0.45)" }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 13.5C8 13.5 2 10 2 6C2 4 3.5 2.5 5.5 2.5C6.5 2.5 7.5 3 8 4C8.5 3 9.5 2.5 10.5 2.5C12.5 2.5 14 4 14 6C14 10 8 13.5 8 13.5Z" fill="white" />
            </svg>
          </div>
          <span style={{ ...serif, fontSize: "1.25rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>MindEase</span>
        </Link>
      </div>

      {/* Tagline — grows to fill the middle */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "2rem 0" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode + isUrdu}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            dir={isUrdu ? "rtl" : "ltr"}
          >
            {/* Eyebrow */}
            <div style={{
              ...sans, fontSize: "0.625rem", fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "rgba(166,124,82,0.85)", marginBottom: "1rem",
            }}>{c.eyebrow}</div>

            {/* Thin rule */}
            <div style={{ width: 32, height: 1, backgroundColor: "rgba(166,124,82,0.35)", marginBottom: "1.25rem" }} />

            {/* Main headline */}
            <div style={{ ...serif, lineHeight: 1.12, letterSpacing: "-0.025em" }}>
              <div style={{ fontSize: "clamp(1.875rem, 3vw, 2.5rem)", fontWeight: 400, fontStyle: "italic", color: "rgba(255,255,255,0.95)" }}>
                {c.headline1}
              </div>
              <div style={{ fontSize: "clamp(1.875rem, 3vw, 2.5rem)", fontWeight: 300, color: "rgba(255,255,255,0.5)" }}>
                {c.headline2}
              </div>
            </div>

            {/* Description */}
            <div style={{ ...sans, fontSize: "0.8125rem", color: "rgba(255,255,255,0.38)", marginTop: "1.25rem", lineHeight: 1.6 }}>
              {c.desc}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Benefits — anchored bottom */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }} dir={isUrdu ? "rtl" : "ltr"}>
        {/* Separator */}
        <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: "0.75rem" }} />
        {benefits.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {b.icon}
            </div>
            <span style={{ ...sans, fontSize: "0.8125rem", color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { setAuth } = useAuth()
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser()
  const { signIn } = useSignIn()
  const { signOut } = useClerk()
  const lang = useLanguage()
  const t = dict[lang]
  const isUrdu = lang === "ur"
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = theme === "dark"

  const initialMode = (searchParams.get("mode") === "signup" ? "signup" : "login") as "login" | "signup"
  const [mode, setMode] = useState<"login" | "signup">(initialMode)

  const [googleFlow, setGoogleFlow]             = useState<"idle" | "otp" | "profile">("idle")
  const [googleUser, setGoogleUser]             = useState<GoogleUser | null>(null)
  const [googleOtpSent, setGoogleOtpSent]       = useState(false)
  const [googleOtpVerified, setGoogleOtpVerified] = useState(false)
  const [googleOtpCode, setGoogleOtpCode]       = useState("")
  const [sendingGoogleOtp, setSendingGoogleOtp] = useState(false)
  const [verifyingGoogleOtp, setVerifyingGoogleOtp] = useState(false)
  const [isOauthSyncing, setIsOauthSyncing]     = useState(false)
  const clerkSyncedRef = useRef(false)

  useEffect(() => {
    const m = searchParams.get("mode") === "signup" ? "signup" : "login"
    setMode(m)
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get("from_oauth") !== "1" || !clerkLoaded || !isSignedIn || !clerkUser || googleUser) return
    const email = clerkUser.primaryEmailAddress?.emailAddress
    if (!email) return
    setGoogleUser({ email, firstName: clerkUser.firstName || "", lastName: clerkUser.lastName || "" })
    setGoogleFlow("profile")
  }, [searchParams, clerkLoaded, isSignedIn, clerkUser, googleUser])

  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !clerkUser || clerkSyncedRef.current) return
    if (searchParams.get("from_oauth") === "1") return
    if (typeof window === "undefined" || sessionStorage.getItem("mindease_oauth_pending") !== "1") return
    const email = clerkUser.primaryEmailAddress?.emailAddress
    if (!email) return
    clerkSyncedRef.current = true
    sessionStorage.removeItem("mindease_oauth_pending")
    setIsOauthSyncing(true)
    const firstName = clerkUser.firstName || ""
    const lastName  = clerkUser.lastName  || ""
    apiLoginOauth(email)
      .then((res) => {
        setIsOauthSyncing(false)
        setAuth({ token: res.user_id.toString(), user: { id: res.user_id.toString(), email: res.email, first_name: res.first_name, last_name: res.last_name || "", gender: res.gender, city: res.city, nearest_major_city: res.nearest_major_city, dashboard_tour_seen: res.dashboard_tour_seen ?? false } })
        router.push("/dashboard")
      })
      .catch((err) => {
        setIsOauthSyncing(false)
        if (err?.message === "USER_NOT_FOUND") { setGoogleUser({ email, firstName, lastName }); setGoogleFlow("profile") }
      })
  }, [clerkLoaded, isSignedIn, clerkUser, setAuth, router, toast])

  const handleSignInWithGoogle = async () => {
    if (clerkLoaded && isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress
      if (!email) return
      clerkSyncedRef.current = true
      try {
        const res = await apiLoginOauth(email)
        setAuth({ token: res.user_id.toString(), user: { id: res.user_id.toString(), email: res.email, first_name: res.first_name, last_name: res.last_name || "", gender: res.gender, city: res.city, nearest_major_city: res.nearest_major_city, dashboard_tour_seen: res.dashboard_tour_seen ?? false } })
        router.push("/dashboard")
      } catch (err: any) {
        if (err?.message === "USER_NOT_FOUND") { setGoogleUser({ email, firstName: clerkUser.firstName || "", lastName: clerkUser.lastName || "" }); setGoogleFlow("profile") }
      }
      return
    }
    if (typeof window !== "undefined") sessionStorage.setItem("mindease_oauth_pending", "1")
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    signIn?.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: `${origin}/auth/callback`, redirectUrlComplete: `${origin}/dashboard` })
  }

  const handleGoogleOtpVerify = async () => {
    if (!googleUser || !googleOtpCode || googleOtpCode.length !== 6) { toast({ title: t.invalidOtp, variant: "destructive" }); return }
    setVerifyingGoogleOtp(true)
    try {
      await apiVerifyOtp(googleUser.email, googleOtpCode)
      setGoogleOtpVerified(true); setGoogleFlow("profile")
      toast({ title: t.otpVerifySuccess })
    } catch { toast({ title: t.invalidOtp, variant: "destructive" }) }
    finally { setVerifyingGoogleOtp(false) }
  }

  const showGoogleFlow = googleFlow !== "idle" && googleUser
  const showOauthLoading = isOauthSyncing || (clerkLoaded && isSignedIn && !!clerkUser?.primaryEmailAddress?.emailAddress && typeof window !== "undefined" && sessionStorage.getItem("mindease_oauth_pending") === "1" && !showGoogleFlow)

  if (!mounted) return null

  return (
    <div style={{ ...sans, minHeight: "100dvh", backgroundColor: "var(--background)", color: "var(--foreground)", position: "relative", overflow: "hidden" }}>
      {/* Ambient beams */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BeamsBackground isDark={isDark} intensity="subtle" className="absolute inset-0 w-full h-full" />
      </div>

      {/* Page content */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

        {/* Minimal top bar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 2rem", borderBottom: "1px solid var(--border)" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 13.5C8 13.5 2 10 2 6C2 4 3.5 2.5 5.5 2.5C6.5 2.5 7.5 3 8 4C8.5 3 9.5 2.5 10.5 2.5C12.5 2.5 14 4 14 6C14 10 8 13.5 8 13.5Z" fill="white" /></svg>
            </div>
            <span style={{ ...serif, fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em" }}>MindEase</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <LanguageToggle />
            <button onClick={() => setTheme(isDark ? "light" : "dark")} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", backgroundColor: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {isDark ? <Sun size={14} color="var(--primary)" /> : <Moon size={14} color="var(--muted-foreground)" />}
            </button>
          </div>
        </header>

        {/* Main */}
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
          {showOauthLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--primary)" }} />
              </div>
              <p style={{ ...sans, fontSize: "0.9375rem", color: "var(--muted-foreground)" }}>{isUrdu ? "سائن ان ہو رہا ہے…" : "Signing you in…"}</p>
            </div>
          ) : (
            <div style={{
              width: "100%", maxWidth: 920,
              borderRadius: 24, overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.16), 0 4px 20px rgba(0,0,0,0.08)",
              border: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: showGoogleFlow ? "1fr" : "1fr 1fr",
              alignItems: "stretch",
            }} className="max-lg:grid-cols-1">

              {showGoogleFlow ? (
                // ── Google flow ──
                <div style={{ backgroundColor: "var(--card)", padding: "3rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <AnimatePresence mode="wait">
                    {googleFlow === "otp" && (
                      <GoogleOtpStep key="gotp" email={googleUser!.email} otpCode={googleOtpCode} setOtpCode={setGoogleOtpCode} sendingOtp={sendingGoogleOtp} verifyingOtp={verifyingGoogleOtp} otpSent={googleOtpSent} onVerify={handleGoogleOtpVerify}
                        onBack={() => { setGoogleFlow("idle"); setGoogleUser(null); setGoogleOtpSent(false); setGoogleOtpCode(""); clerkSyncedRef.current = false; signOut?.({ redirectUrl: "/auth" }) }}
                        t={t} isUrdu={isUrdu} />
                    )}
                    {googleFlow === "profile" && googleUser && (
                      <GoogleCompleteProfileForm key="gprofile" googleUser={googleUser} t={t} isUrdu={isUrdu}
                        onSuccess={(res) => { setAuth({ token: res.user_id.toString(), user: { id: res.user_id.toString(), email: res.email, first_name: res.first_name, last_name: res.last_name || "", gender: res.gender, city: res.city, nearest_major_city: res.nearest_major_city, dashboard_tour_seen: res.dashboard_tour_seen ?? false } }); router.push("/dashboard") }} />
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  {/* Left — Brand panel (hidden on small screens) */}
                  <div className="hidden lg:flex" style={{ flexDirection: "column" }}>
                    <BrandPanel mode={mode} isUrdu={isUrdu} />
                  </div>

                  {/* Right — Form panel */}
                  <div style={{ backgroundColor: "var(--card)", padding: "3rem 2.75rem", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto", minHeight: 520 }}>
                    <AnimatePresence mode="wait">
                      {mode === "login" ? (
                        <LoginForm key="login" t={t} isUrdu={isUrdu} onSuccess={() => router.push("/dashboard")} onSwitch={() => setMode("signup")} onSignInWithGoogle={handleSignInWithGoogle} />
                      ) : (
                        <RegisterForm key="register" t={t} isUrdu={isUrdu} onSuccess={() => setMode("login")} onSwitch={() => setMode("login")} onSignUpWithGoogle={handleSignInWithGoogle} />
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Google icon ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function OrDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
      <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
      <span style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
    </div>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginForm({ t, isUrdu, onSuccess, onSwitch, onSignInWithGoogle }: {
  t: typeof dict.en; isUrdu: boolean; onSuccess: () => void; onSwitch: () => void; onSignInWithGoogle?: () => void
}) {
  const { toast } = useToast()
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const { handleSubmit, register, formState: { errors }, setError } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), mode: "onTouched" })

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true); setLoginError(null)
    try {
      const res = await apiLogin(values)
      setAuth({ token: res.user_id.toString(), user: { id: res.user_id.toString(), email: res.email, first_name: res.first_name, last_name: res.last_name || "", gender: res.gender || "Other", city: res.city || "", nearest_major_city: res.nearest_major_city || "", dashboard_tour_seen: Boolean(res.dashboard_tour_seen) } })
      toast({ title: "Login successful!" }); onSuccess()
    } catch {
      setLoginError(isUrdu ? "ایمیل یا پاس ورڈ غلط ہیں" : "Invalid email or password")
      setError("email", { type: "manual" }); setError("password", { type: "manual" })
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={ease} dir={isUrdu ? "rtl" : "ltr"}>
      {/* Heading */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ ...sans, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.5rem" }}>
          {isUrdu ? "خوش آمدید" : "Welcome back"}
        </p>
        <h1 style={{ ...serif, fontSize: "2rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)", lineHeight: 1.15 }}>
          {isUrdu ? "سائن ان کریں" : "Sign in to your account"}
        </h1>
      </div>

      {/* Google */}
      {onSignInWithGoogle && (
        <ClayButton variant="outline" onClick={onSignInWithGoogle} fullWidth style={{ marginBottom: "0.5rem" }}>
          <GoogleIcon /> {isUrdu ? "گوگل سے سائن ان" : "Continue with Google"}
        </ClayButton>
      )}
      <OrDivider label={isUrdu ? "یا" : "or"} />

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {loginError && (
          <div style={{ borderRadius: 10, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "#ef4444" }}>
            {loginError}
          </div>
        )}
        <div>
          <label style={labelStyle}>{t.email}</label>
          <StyledInput type="email" autoComplete="email" name="email" register={register} error={errors.email} />
          {errors.email?.message && <FormError message={errors.email.message} />}
        </div>
        <div>
          <label style={labelStyle}>{t.password}</label>
          <StyledInput type="password" autoComplete="current-password" name="password" register={register} error={errors.password} />
          {errors.password?.message && <FormError message={errors.password.message} />}
        </div>
        <ClayButton type="submit" disabled={loading} variant="primary" fullWidth>
          {loading ? <><Loader2 size={15} className="animate-spin" /> {isUrdu ? "لاگ اِن…" : "Signing in…"}</> : (isUrdu ? "سائن ان کریں" : "Sign in")}
        </ClayButton>
      </form>

      <p style={{ ...sans, marginTop: "1.5rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", textAlign: "center" }}>
        {isUrdu ? "اکاؤنٹ نہیں؟" : "Don't have an account?"}{" "}
        <button type="button" onClick={onSwitch} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontWeight: 600, fontSize: "0.8125rem" }}>
          {isUrdu ? "رجسٹر کریں" : "Create one"}
        </button>
      </p>
    </motion.div>
  )
}

// ─── Register form ────────────────────────────────────────────────────────────
function RegisterForm({ t, isUrdu, onSuccess, onSwitch, onSignUpWithGoogle }: {
  t: typeof dict.en; isUrdu: boolean; onSuccess: () => void; onSwitch: () => void; onSignUpWithGoogle?: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading]           = useState(false)
  const [emailExists, setEmailExists]   = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [otpSent, setOtpSent]           = useState(false)
  const [otpVerified, setOtpVerified]   = useState(false)
  const [sendingOtp, setSendingOtp]     = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpCode, setOtpCode]           = useState("")

  const schema = createRegisterSchema(t)
  type FV = z.infer<typeof schema>
  const { handleSubmit, register, watch, setError, formState: { errors } } = useForm<FV>({ resolver: zodResolver(schema), mode: "onTouched" })
  const watchedEmail    = watch("email", "")
  const watchedPassword = watch("password", "")

  useEffect(() => {
    const id = setTimeout(() => {
      if (watchedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedEmail)) {
        setCheckingEmail(true)
        apiCheckEmail(watchedEmail)
          .then((r: { exists: boolean }) => { setEmailExists(r.exists); setError("email", { type: "manual", message: r.exists ? "This email is already registered." : "" }) })
          .catch(() => {}).finally(() => setCheckingEmail(false))
      } else setEmailExists(false)
    }, 800)
    return () => clearTimeout(id)
  }, [watchedEmail, setError])

  const handleSendOtp = async () => {
    if (!watchedEmail) { toast({ title: "Enter your email first", variant: "destructive" }); return }
    setSendingOtp(true)
    try { await apiSendOtp(watchedEmail); setOtpSent(true); toast({ title: t.otpSentSuccess }) }
    catch (e: any) { toast({ title: "Failed to send OTP", description: e.message, variant: "destructive" }) }
    finally { setSendingOtp(false) }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) { toast({ title: t.invalidOtp, variant: "destructive" }); return }
    setVerifyingOtp(true)
    try { await apiVerifyOtp(watchedEmail, otpCode); setOtpVerified(true); toast({ title: t.otpVerifySuccess }) }
    catch { toast({ title: t.invalidOtp, variant: "destructive" }) }
    finally { setVerifyingOtp(false) }
  }

  const onSubmit = async (values: FV) => {
    if (!otpVerified) { toast({ title: t.verifyEmailFirst, variant: "destructive" }); return }
    setLoading(true)
    try { await apiRegister(values); toast({ title: "Account created!" }); onSuccess() }
    catch (e: any) { toast({ title: "Registration failed", description: e.message, variant: "destructive" }) }
    finally { setLoading(false) }
  }

  const field = (label: string, key: string, type = "text", opts: any = {}) => (
    <div key={key}>
      <label style={labelStyle}>{label}</label>
      <StyledInput type={type} name={key} register={register} error={(errors as any)[key]} {...opts} />
      {(errors as any)[key]?.message && <FormError message={(errors as any)[key].message} />}
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={ease} dir={isUrdu ? "rtl" : "ltr"}>
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ ...sans, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.5rem" }}>
          {isUrdu ? "نیا سفر" : "New journey"}
        </p>
        <h1 style={{ ...serif, fontSize: "2rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)", lineHeight: 1.15 }}>
          {isUrdu ? "اکاؤنٹ بنائیں" : "Create your account"}
        </h1>
      </div>

      {onSignUpWithGoogle && (
        <ClayButton variant="outline" onClick={onSignUpWithGoogle} fullWidth style={{ marginBottom: "0.5rem" }}>
          <GoogleIcon /> {isUrdu ? "گوگل سے سائن اپ" : "Continue with Google"}
        </ClayButton>
      )}
      <OrDivider label={isUrdu ? "یا" : "or"} />

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {/* Email + OTP */}
        <div>
          <label style={labelStyle}>{t.email}</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <StyledInput type="email" autoComplete="email" name="email" register={register} error={errors.email} disabled={otpSent && otpVerified} isChecking={checkingEmail} isVerified={otpVerified && !emailExists} />
            </div>
            <ClayButton variant="outline" onClick={handleSendOtp} disabled={sendingOtp || checkingEmail || emailExists || otpVerified || !watchedEmail}
              style={{ height: 44, padding: "0 0.875rem", borderRadius: 12, flexShrink: 0, fontSize: "0.75rem" }}>
              {sendingOtp ? <Loader2 size={14} className="animate-spin" /> : otpSent ? <CheckCircle2 size={14} style={{ color: "#5D8A6B" }} /> : <Mail size={14} />}
              <span>{otpSent ? t.otpSent : t.sendOtp}</span>
            </ClayButton>
          </div>
          {errors.email?.message && <FormError message={errors.email.message} />}
        </div>

        {/* OTP input */}
        {otpSent && !otpVerified && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} style={{ display: "flex", gap: "0.5rem" }}>
            <input type="text" placeholder="000000" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6}
              style={{ ...inputStyle, flex: 1, textAlign: "center", letterSpacing: "0.3em", fontFamily: "monospace", fontSize: "1.125rem" }}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)" }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
            />
            <ClayButton variant="primary" onClick={handleVerifyOtp} disabled={verifyingOtp || otpCode.length !== 6}
              style={{ height: 44, padding: "0 1rem", borderRadius: 12, flexShrink: 0, fontSize: "0.8125rem" }}>
              {verifyingOtp ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {t.verifyOtp}
            </ClayButton>
          </motion.div>
        )}

        {/* Rest of form — only after OTP verified */}
        <AnimatePresence>
          {otpVerified && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={labelStyle}>{t.password}</label>
                <StyledInput type="password" autoComplete="new-password" name="password" register={register} error={errors.password} />
                <PasswordStrengthIndicator password={watchedPassword} />
                {errors.password?.message && <FormError message={errors.password.message} />}
              </div>
              <div>
                <label style={labelStyle}>{t.confirmPassword}</label>
                <StyledInput type="password" name="confirmPassword" register={register} error={errors.confirmPassword} />
                {errors.confirmPassword?.message && <FormError message={errors.confirmPassword.message} />}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                {field(isUrdu ? "پہلا نام" : "First Name", "first_name")}
                {field(isUrdu ? "آخری نام" : "Last Name", "last_name")}
              </div>
              {field(t.city, "city")}
              <div>
                <label style={labelStyle}>{t.nearestMajorCity}</label>
                <input list="major-city-auth" placeholder={t.selectNearestMajorCity} {...register("nearest_major_city")}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)" }}
                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
                />
                <datalist id="major-city-auth">{majorCitySuggestions.map(c => <option key={c.value} value={c.value}>{isUrdu ? c.labelUr : c.value}</option>)}</datalist>
                {errors.nearest_major_city?.message && <FormError message={errors.nearest_major_city.message} />}
              </div>
              <div>
                <label style={labelStyle}>{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</label>
                <input type="date" {...register("dob")} style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)" }}
                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
                />
                {errors.dob?.message && <FormError message={errors.dob.message} />}
              </div>
              <div>
                <label style={labelStyle}>{isUrdu ? "صنف" : "Gender"}</label>
                <StyledSelect register={register} name="gender" error={errors.gender}>
                  <option value="">{isUrdu ? "منتخب کریں" : "Select"}</option>
                  <option value="Male">{isUrdu ? "مرد" : "Male"}</option>
                  <option value="Female">{isUrdu ? "عورت" : "Female"}</option>
                  <option value="Other">{isUrdu ? "دیگر" : "Other"}</option>
                </StyledSelect>
                {errors.gender?.message && <FormError message={errors.gender.message} />}
              </div>
              <div>
                <label style={labelStyle}>{isUrdu ? "ترجیحی زبان" : "Preferred Language"}</label>
                <StyledSelect register={register} name="preferred_language" error={errors.preferred_language}>
                  <option value="">{isUrdu ? "منتخب کریں" : "Select"}</option>
                  <option value="en">{isUrdu ? "انگریزی" : "English"}</option>
                  <option value="ur">{isUrdu ? "اردو" : "Urdu"}</option>
                </StyledSelect>
                {errors.preferred_language?.message && <FormError message={errors.preferred_language.message} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ClayButton type="submit" disabled={loading || !otpVerified} variant="primary" fullWidth style={{ marginTop: "0.5rem" }}>
          {loading ? <><Loader2 size={15} className="animate-spin" /> {isUrdu ? "رجسٹریشن…" : "Creating account…"}</> : (isUrdu ? "اکاؤنٹ بنائیں" : "Create account")}
        </ClayButton>
      </form>

      <p style={{ ...sans, marginTop: "1.25rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", textAlign: "center" }}>
        {isUrdu ? "پہلے سے اکاؤنٹ ہے؟" : "Already have an account?"}{" "}
        <button type="button" onClick={onSwitch} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontWeight: 600, fontSize: "0.8125rem" }}>
          {isUrdu ? "سائن ان کریں" : "Sign in"}
        </button>
      </p>
    </motion.div>
  )
}

// ─── Google OTP step ──────────────────────────────────────────────────────────
function GoogleOtpStep({ email, otpCode, setOtpCode, sendingOtp, verifyingOtp, otpSent, onVerify, onBack, t, isUrdu }: {
  email: string; otpCode: string; setOtpCode: (s: string) => void
  sendingOtp: boolean; verifyingOtp: boolean; otpSent: boolean
  onVerify: () => void; onBack: () => void; t: typeof dict.en; isUrdu: boolean
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={ease} dir={isUrdu ? "rtl" : "ltr"}
      style={{ maxWidth: 400, margin: "0 auto", width: "100%" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
        <Mail size={22} style={{ color: "var(--primary)" }} />
      </div>
      <h2 style={{ ...serif, fontSize: "1.75rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)", marginBottom: "0.5rem" }}>
        {isUrdu ? "ای میل کی تصدیق" : "Verify your email"}
      </h2>
      <p style={{ ...sans, fontSize: "0.875rem", color: "var(--muted-foreground)", marginBottom: "2rem", lineHeight: 1.6 }}>
        {isUrdu ? "ہم نے ایک کوڈ بھیجا " : "We sent a 6-digit code to "}<strong style={{ color: "var(--foreground)" }}>{email}</strong>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <input type="text" placeholder="0 0 0 0 0 0" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6}
          style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.35em", fontFamily: "monospace", fontSize: "1.5rem", height: 56 }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)" }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
        />
        <ClayButton type="button" variant="primary" onClick={onVerify} disabled={verifyingOtp || otpCode.length !== 6} fullWidth>
          {verifyingOtp ? <><Loader2 size={15} className="animate-spin" /> {isUrdu ? "تصدیق…" : "Verifying…"}</> : <><Lock size={14} /> {t.verifyOtp}</>}
        </ClayButton>
      </div>
      {sendingOtp && !otpSent && <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "0.75rem" }}>{isUrdu ? "بھیج رہے ہیں…" : "Sending…"}</p>}
      <button type="button" onClick={onBack} style={{ ...sans, marginTop: "1.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <ArrowLeft size={13} /> {isUrdu ? "واپس جائیں" : "Back"}
      </button>
    </motion.div>
  )
}

// ─── Google complete profile ──────────────────────────────────────────────────
const googleProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  city: z.string().min(1, "City is required"),
  nearest_major_city: z.string().min(1, "Nearest major city is required").max(100),
  dob: z.string().nonempty("Date of birth is required"),
  gender: z.string().nonempty("Gender is required"),
  preferred_language: z.string().nonempty("Preferred language is required"),
})

function GoogleCompleteProfileForm({ googleUser, t, isUrdu, onSuccess }: {
  googleUser: GoogleUser; t: typeof dict.en; isUrdu: boolean
  onSuccess: (res: any) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const { handleSubmit, register, formState: { errors } } = useForm<z.infer<typeof googleProfileSchema>>({
    resolver: zodResolver(googleProfileSchema),
    defaultValues: { first_name: googleUser.firstName, last_name: googleUser.lastName },
  })

  const onSubmit = async (values: z.infer<typeof googleProfileSchema>) => {
    setLoading(true)
    try {
      const res = await apiRegisterOauth({ email: googleUser.email, ...values, oauth_verified: true })
      onSuccess(res)
    } catch (e: any) { toast({ title: "Registration failed", description: e?.message, variant: "destructive" }) }
    finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={ease} dir={isUrdu ? "rtl" : "ltr"}
      style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <h2 style={{ ...serif, fontSize: "1.75rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)", marginBottom: "0.375rem" }}>
        {isUrdu ? "پروفائل مکمل کریں" : "Complete your profile"}
      </h2>
      <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "1.75rem" }}>{googleUser.email}</p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
          <div>
            <label style={labelStyle}>{isUrdu ? "پہلا نام" : "First Name"}</label>
            <StyledInput name="first_name" register={register} error={errors.first_name} />
            {errors.first_name?.message && <FormError message={errors.first_name.message} />}
          </div>
          <div>
            <label style={labelStyle}>{isUrdu ? "آخری نام" : "Last Name"}</label>
            <StyledInput name="last_name" register={register} error={errors.last_name} />
            {errors.last_name?.message && <FormError message={errors.last_name.message} />}
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t.city}</label>
          <StyledInput name="city" register={register} error={errors.city} />
          {errors.city?.message && <FormError message={errors.city.message} />}
        </div>
        <div>
          <label style={labelStyle}>{t.nearestMajorCity}</label>
          <input list="major-city-google" placeholder={t.selectNearestMajorCity} {...register("nearest_major_city")} style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
          />
          <datalist id="major-city-google">{majorCitySuggestions.map(c => <option key={c.value} value={c.value}>{isUrdu ? c.labelUr : c.value}</option>)}</datalist>
          {errors.nearest_major_city?.message && <FormError message={errors.nearest_major_city.message} />}
        </div>
        <div>
          <label style={labelStyle}>{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</label>
          <input type="date" {...register("dob")} style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(166,124,82,0.14)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
          />
          {errors.dob?.message && <FormError message={errors.dob.message} />}
        </div>
        <div>
          <label style={labelStyle}>{isUrdu ? "صنف" : "Gender"}</label>
          <StyledSelect register={register} name="gender" error={errors.gender}>
            <option value="">{isUrdu ? "منتخب کریں" : "Select"}</option>
            <option value="Male">{isUrdu ? "مرد" : "Male"}</option>
            <option value="Female">{isUrdu ? "عورت" : "Female"}</option>
            <option value="Other">{isUrdu ? "دیگر" : "Other"}</option>
          </StyledSelect>
          {errors.gender?.message && <FormError message={errors.gender.message} />}
        </div>
        <div>
          <label style={labelStyle}>{isUrdu ? "ترجیحی زبان" : "Preferred Language"}</label>
          <StyledSelect register={register} name="preferred_language" error={errors.preferred_language}>
            <option value="">{isUrdu ? "منتخب کریں" : "Select"}</option>
            <option value="en">{isUrdu ? "انگریزی" : "English"}</option>
            <option value="ur">{isUrdu ? "اردو" : "Urdu"}</option>
          </StyledSelect>
          {errors.preferred_language?.message && <FormError message={errors.preferred_language.message} />}
        </div>
        <ClayButton type="submit" disabled={loading} variant="primary" fullWidth style={{ marginTop: "0.25rem" }}>
          {loading ? <><Loader2 size={15} className="animate-spin" /> {isUrdu ? "محفوظ…" : "Saving…"}</> : (isUrdu ? "شروع کریں" : "Get started")}
        </ClayButton>
      </form>
    </motion.div>
  )
}
