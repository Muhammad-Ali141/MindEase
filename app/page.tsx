"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { dict, useLanguage } from "@/lib/i18n"
import { LanguageToggle } from "@/components/LanguageToggle"
import { useEffect, useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { ArrowRight, MessageCircle, Mic2, Play, Pause, Volume2, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"

import { BeamsBackground } from "@/components/ui/beams-background"

// FeatureSteps is below the fold — lazy-load it
const FeatureSteps = dynamic(() => import("@/components/ui/feature-section").then(m => ({ default: m.FeatureSteps })), { ssr: false })

// ─── Design tokens — all CSS variables so dark mode works automatically ───────
const C = {
  bg:        "color-mix(in srgb, var(--background) 90%, transparent)",
  ink:       "var(--foreground)",
  clay:      "var(--primary)",
  clayLight: "var(--muted)",
  sage:      "var(--sage)",
  sageLight: "var(--sage-light)",
  muted:     "var(--muted-foreground)",
  border:    "var(--border)",
  surface:   "color-mix(in srgb, var(--card) 90%, transparent)",
  white:     "#FFFFFF",
} as const

const serif = { fontFamily: 'var(--font-cormorant, Georgia, serif)' } as const
const sans  = { fontFamily: 'var(--font-dm-sans, var(--font-inter), system-ui, sans-serif)' } as const

// ─── Framer variants ──────────────────────────────────────────────────────────
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.11 } } }
const rise    = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] } },
}

// ─── Web app browser mockup ───────────────────────────────────────────────────
function WebAppMockup() {
  const bubbleBase: React.CSSProperties = {
    ...sans,
    fontSize: "0.8125rem",
    lineHeight: 1.55,
    padding: "0.6rem 0.875rem",
    borderRadius: "1rem",
    maxWidth: "72%",
  }

  return (
    <div style={{
      width: "100%",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 24px 64px rgba(166,124,82,0.18), 0 4px 16px rgba(166,124,82,0.1)",
      border: "1px solid var(--border)",
      backgroundColor: "var(--card)",
    }}>
      {/* Browser chrome */}
      <div style={{
        backgroundColor: "var(--secondary)",
        borderBottom: "1px solid var(--border)",
        padding: "0.6rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
      }}>
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#ff5f57" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#febc2e" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#28c840" }} />
        </div>
        {/* Address bar */}
        <div style={{
          flex: 1,
          height: 26,
          backgroundColor: "var(--background)",
          borderRadius: 6,
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          paddingLeft: "0.625rem",
          gap: "0.375rem",
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--primary)", opacity: 0.5 }} />
          <span style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>mindease.app/chat</span>
        </div>
      </div>

      {/* App layout */}
      <div style={{ display: "flex", height: 420 }}>
        {/* Sidebar */}
        <div style={{
          width: 200,
          borderRight: "1px solid var(--border)",
          backgroundColor: "var(--muted)",
          padding: "1rem 0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", padding: "0 0.25rem" }}>
            <img src="/logo.svg" alt="MindEase" style={{ width: 26, height: 26, borderRadius: 7, objectFit: "contain" }} />
            <span style={{ ...serif, fontSize: "0.9375rem", fontWeight: 600, color: "var(--foreground)" }}>MindEase</span>
          </div>
          {/* Nav items */}
          {[
            { icon: "💬", label: "Chat", active: true },
            { icon: "📊", label: "Progress" },
            { icon: "📋", label: "Assessments" },
            { icon: "⚙️", label: "Settings" },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 0.625rem", borderRadius: 8,
              backgroundColor: item.active ? "var(--primary)" : "transparent",
              cursor: "pointer",
            }}>
              <span style={{ fontSize: "0.875rem" }}>{item.icon}</span>
              <span style={{ ...sans, fontSize: "0.8125rem", fontWeight: item.active ? 600 : 400, color: item.active ? "white" : "var(--muted-foreground)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Chat header */}
          <div style={{
            padding: "0.75rem 1.25rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            backgroundColor: "var(--card)",
          }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ ...serif, fontSize: "0.875rem", color: "white", fontWeight: 600 }}>M</span>
            </div>
            <div>
              <div style={{ ...sans, fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>MindEase AI</div>
              <div style={{ ...sans, fontSize: "0.6875rem", color: "var(--primary)" }}>● Online</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", overflowY: "hidden", backgroundColor: "var(--background)" }}>
            {/* AI message */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ ...serif, fontSize: "0.75rem", color: "white", fontWeight: 600 }}>M</span>
              </div>
              <div style={{ ...bubbleBase, backgroundColor: "var(--card)", border: "1px solid var(--border)", borderBottomLeftRadius: 4, color: "var(--foreground)" }}>
                How are you feeling today? I'm here to listen. 🌿
              </div>
            </div>
            {/* User message */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ ...bubbleBase, backgroundColor: "var(--primary)", color: "white", borderBottomRightRadius: 4 }}>
                A bit overwhelmed, honestly.
              </div>
            </div>
            {/* AI message */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ ...serif, fontSize: "0.75rem", color: "white", fontWeight: 600 }}>M</span>
              </div>
              <div style={{ ...bubbleBase, backgroundColor: "var(--card)", border: "1px solid var(--border)", borderBottomLeftRadius: 4, color: "var(--foreground)" }}>
                That's completely okay. I'm here with you. Take your time. 💛
              </div>
            </div>
            {/* User message */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ ...bubbleBase, backgroundColor: "var(--primary)", color: "white", borderBottomRightRadius: 4 }}>
                Thank you, I needed to hear that.
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            display: "flex",
            gap: "0.625rem",
            alignItems: "center",
          }}>
            <div style={{
              flex: 1, height: 38, backgroundColor: "var(--background)",
              borderRadius: 19, border: "1px solid var(--border)",
              display: "flex", alignItems: "center",
              paddingLeft: "1rem",
            }}>
              <span style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>Type a message...</span>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ArrowRight size={14} color="white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Custom audio player ───────────────────────────────────────────────────────
function VoicePlayer({ isUrdu }: { isUrdu: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else         { a.play().catch(() => {}); setPlaying(true) }
  }, [playing])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

  return (
    <div
      style={{
        ...sans,
        marginTop: "1.5rem",
        padding: "0.875rem 1rem",
        borderRadius: 14,
        backgroundColor: "var(--card)",
        border: `1px solid var(--border)`,
        display: "flex", alignItems: "center", gap: "0.75rem",
        boxShadow: "0 2px 12px rgba(166,124,82,0.1)",
      }}
    >
      <audio
        ref={audioRef}
        src="/sample-voice.mp3"
        onTimeUpdate={e => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
      />

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={toggle}
        style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          backgroundColor: C.sage, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "0 2px 8px rgba(93,138,107,0.25)",
        }}
        aria-label={playing ? "Pause" : "Play voice sample"}
      >
        {playing
          ? <Pause size={14} color="white" fill="white" />
          : <Play  size={14} color="white" fill="white" style={{ marginLeft: 2 }} />
        }
      </motion.button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground)" }}>
            {isUrdu ? "اپنے AI ساتھی کی آواز سنیں" : "Hear your AI companion"}
          </span>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
            {duration ? fmt(duration * progress / 100) + " / " + fmt(duration) : "0:00"}
          </span>
        </div>
        <div
          style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden", cursor: "pointer" }}
          onClick={e => {
            const a = audioRef.current
            if (!a || !duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            a.currentTime = ((e.clientX - rect.left) / rect.width) * duration
          }}
        >
          <div style={{ height: "100%", width: `${progress}%`, backgroundColor: C.sage, borderRadius: 2, transition: "width 0.1s linear" }} />
        </div>
      </div>

      <Volume2 size={13} color={C.muted as string} />
    </div>
  )
}

// ─── Therapist chat preview (Text Chat card) ──────────────────────────────────
function TherapistChatPreview({ isUrdu }: { isUrdu: boolean }) {
  const msg = isUrdu
    ? "آج آپ کیسا محسوس کر رہے ہیں؟ میں یہاں سننے کے لیے ہوں۔"
    : "How are you feeling today? I'm here to listen."

  return (
    <div style={{
      marginTop: "1.5rem",
      borderRadius: 16,
      backgroundColor: "var(--muted)",
      border: `1px solid var(--border)`,
      padding: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          backgroundColor: C.clay,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ ...serif, fontSize: "0.75rem", color: "white", fontWeight: 600 }}>M</span>
        </div>
        <div style={{
          ...sans,
          fontSize: "0.8125rem",
          lineHeight: 1.55,
          color: "var(--foreground)",
          backgroundColor: "var(--card)",
          padding: "0.5rem 0.75rem",
          borderRadius: "0 12px 12px 12px",
          border: `1px solid var(--border)`,
          boxShadow: "0 1px 4px rgba(166,124,82,0.07)",
        }}>
          {msg}
        </div>
      </div>
    </div>
  )
}

// ─── Feature data ─────────────────────────────────────────────────────────────
const FEATURES_EN = [
  {
    step: "Feature 1",
    title: "Bilingual support",
    content: "Seamless conversations in both English and Urdu across text and voice.",
    image: "/images/features/feature-bilingual.svg",
  },
  {
    step: "Feature 2",
    title: "Emotion-aware conversations",
    content: "AI responds with empathy by understanding emotional tone and conversational context.",
    image: "/images/features/feature-emotion.svg",
  },
  {
    step: "Feature 3",
    title: "Clinical self-assessments",
    content: "Integrated PHQ-9, GAD-7, and stress screening with guided interpretation.",
    image: "/images/features/feature-assessment.svg",
  },
  {
    step: "Feature 4",
    title: "Session memory & summaries",
    content: "Every session is remembered, summarized, and available for reflection later.",
    image: "/images/features/feature-memory.svg",
  },
]

const FEATURES_UR = [
  { step: "خصوصیت 1", title: "دو زبانی سہولت",     content: "انگریزی اور اردو دونوں میں بے رکاوٹ بات چیت۔",                  image: FEATURES_EN[0].image },
  { step: "خصوصیت 2", title: "جذبات کا تجزیہ",    content: "AI آپ کے جذبات کو سمجھ کر ہمدردی سے جواب دیتا ہے۔",              image: FEATURES_EN[1].image },
  { step: "خصوصیت 3", title: "کلینیکل تشخیص",      content: "PHQ-9، GAD-7 اور اسٹریس اسکریننگ رہنمائی کے ساتھ۔",           image: FEATURES_EN[2].image },
  { step: "خصوصیت 4", title: "سیشن یادداشت",       content: "ہر سیشن یاد رکھا، خلاصہ کیا، اور بعد میں دستیاب۔",            image: FEATURES_EN[3].image },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const lang   = useLanguage()
  const t      = dict[lang]
  const isUrdu = lang === "ur"
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const [mounted,  setMounted]  = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    // Prefetch likely next destinations so they compile before user clicks
    router.prefetch("/auth")
    router.prefetch("/auth?mode=signup")
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Don't block render — default to light until mounted (avoids blank page on first load)
  const isDark   = mounted && theme === "dark"
  const features = isUrdu ? FEATURES_UR : FEATURES_EN

  return (
    <div style={{ ...sans, backgroundColor: C.bg, color: C.ink, overflowX: "hidden", position: "relative" }}>
      {/* Fixed animated beams — full page background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BeamsBackground isDark={isDark} intensity="subtle" className="absolute inset-0 w-full h-full" />
      </div>

      {/* All page content sits above the fixed beams */}
      <div style={{ position: "relative", zIndex: 1 }}>

      {/* ═══════════════════════ HEADER ═══════════════════════ */}
      <header
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          backgroundColor: scrolled ? (isDark ? "rgba(45,38,33,0.94)" : "rgba(245,241,230,0.94)") : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
          transition: "background-color 0.35s ease, border-color 0.35s ease",
        }}
      >
        <div
          className="max-w-7xl mx-auto px-6 sm:px-8"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "1.25rem", paddingBottom: "1.25rem" }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
            <img src="/logo.svg" alt="MindEase" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "contain" }} />
            <span style={{ ...serif, fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.01em", color: C.ink }}>MindEase</span>
          </Link>

          <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <LanguageToggle />

            {/* Dark mode toggle */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{
                width: 34, height: 34, borderRadius: "50%", border: `1px solid var(--border)`,
                backgroundColor: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
              aria-label="Toggle dark mode"
            >
              {isDark
                ? <Sun  size={15} color="var(--primary)" />
                : <Moon size={15} color="var(--muted-foreground)" />
              }
            </motion.button>

            <Link href="/auth" style={{ fontSize: "0.875rem", fontWeight: 500, color: C.muted, textDecoration: "none" }}>
              {t.login}
            </Link>
            <Link href="/auth?mode=signup">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1.25rem", borderRadius: 100, backgroundColor: C.ink, color: C.bg, fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
              >
                {t.register} <ArrowRight size={13} />
              </motion.div>
            </Link>
          </nav>
        </div>
      </header>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: "7rem", paddingBottom: "4rem", overflow: "hidden" }}>

        {/* Subtle tint over beams for hero */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundColor: isDark ? "rgba(45,38,33,0.55)" : "rgba(245,241,230,0.55)" }} />

        <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full" style={{ position: "relative", zIndex: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">

            {/* Left content */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              dir={isUrdu ? "rtl" : "ltr"}
              className={isUrdu ? "md:order-2" : "md:order-1"}
              style={{ maxWidth: 540 }}
            >
              {/* Eyebrow */}
              <motion.div variants={rise} style={{ marginBottom: "1.5rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.875rem", borderRadius: 100, backgroundColor: C.clayLight, color: C.clay, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: C.clay, display: "inline-block" }} />
                  {isUrdu ? "آن لائن تھراپی" : "AI-Powered Therapy"}
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={rise}
                style={{ ...serif, fontSize: "clamp(3.25rem, 5.5vw, 5rem)", fontWeight: 400, lineHeight: 1.07, letterSpacing: "-0.03em", marginBottom: "1.375rem", color: C.ink }}
              >
                {isUrdu ? (
                  <>وہ مدد جو<br />آپ کو چاہیے،<br /><em style={{ fontStyle: "italic", color: C.clay }}>جب چاہیے۔</em></>
                ) : (
                  <>Mental wellness<br />built around<br /><em style={{ fontStyle: "italic", color: C.clay }}>you.</em></>
                )}
              </motion.h1>

              {/* Subtitle */}
              <motion.p variants={rise}
                style={{ fontSize: "1.0625rem", lineHeight: 1.75, color: C.muted, marginBottom: "2rem", maxWidth: 420 }}
              >
                {isUrdu
                  ? "MindEase ایک ذہین ذہنی صحت کا ساتھی ہے — اردو اور انگریزی میں، چوبیس گھنٹے آپ کے ساتھ۔"
                  : "MindEase brings personalized, AI-powered mental health support in English and Urdu — whenever you need it."}
              </motion.p>

              {/* CTAs */}
              <motion.div variants={rise}
                style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "2.25rem" }}
              >
                <Link href="/auth?mode=signup">
                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.8125rem 1.875rem", borderRadius: 100, backgroundColor: C.clay, color: "white", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 18px rgba(166,124,82,0.28)", transition: "box-shadow 0.2s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 28px rgba(166,124,82,0.32)")}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 18px rgba(166,124,82,0.28)")}
                  >
                    {isUrdu ? "مفت شروع کریں" : "Start for free"} <ArrowRight size={15} />
                  </motion.div>
                </Link>
                <Link href="/auth" style={{ textDecoration: "none" }}>
                  <motion.div
                    style={{ display: "inline-flex", alignItems: "center", padding: "0.8125rem 1rem", fontSize: "0.9375rem", fontWeight: 500, color: C.muted, cursor: "pointer", borderBottom: `1px solid var(--border)`, transition: "color 0.2s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--foreground)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
                  >
                    {t.login}
                  </motion.div>
                </Link>
              </motion.div>

              {/* Trust signal */}
              <motion.div variants={rise} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span style={{ display: "flex", gap: 2 }}>
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="11" height="11" viewBox="0 0 12 12" fill={C.clay as string}>
                      <path d="M6 1L7.47 4.25L11 4.75L8.5 7.2L9.18 10.75L6 9L2.82 10.75L3.5 7.2L1 4.75L4.53 4.25L6 1Z"/>
                    </svg>
                  ))}
                </span>
                <span style={{ fontSize: "0.8125rem", color: C.muted, fontWeight: 500 }}>
                  {isUrdu ? "محفوظ، نجی اور ہمیشہ دستیاب" : "Secure & confidential · Available 24/7"}
                </span>
              </motion.div>
            </motion.div>

            {/* Right — phone mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, x: 32 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={isUrdu ? "md:order-1" : "md:order-2"}
            >
              <WebAppMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ STATS ═══════════════════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        style={{ borderTop: `1px solid var(--border)`, borderBottom: `1px solid var(--border)`, padding: "2.75rem 0", backgroundColor: C.bg }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { num: "10k+",  label: isUrdu ? "سیشن مکمل"    : "Sessions completed" },
              { num: "2",     label: isUrdu ? "زبانیں"        : "Languages supported" },
              { num: "24/7",  label: isUrdu ? "ہمیشہ دستیاب" : "Always available" },
              { num: "100%",  label: isUrdu ? "رازداری"       : "Private & secure" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                style={{ textAlign: "center" }}
              >
                <div style={{ ...serif, fontSize: "2.375rem", fontWeight: 500, color: C.clay, lineHeight: 1 }}>{stat.num}</div>
                <div style={{ fontSize: "0.8125rem", color: C.muted, marginTop: "0.3rem", fontWeight: 500 }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════ FEATURES (FeatureSteps) ═══════════════════════ */}
      <section style={{ padding: "7rem 0", backgroundColor: C.surface }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <FeatureSteps
              features={features}
              title={isUrdu ? "آپ کو جو چاہیے، سب یہاں ہے" : "Everything you need for mental wellness"}
              autoPlayInterval={4500}
            />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════ COMMUNICATION OPTIONS ═══════════════════════ */}
      <section style={{ padding: "7rem 0", backgroundColor: C.bg }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            dir={isUrdu ? "rtl" : "ltr"}
            style={{ marginBottom: "3.5rem" }}
          >
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: C.sage, marginBottom: "0.75rem" }}>
              {isUrdu ? "رابطے کا طریقہ" : "How you connect"}
            </p>
            <h2 style={{ ...serif, fontSize: "clamp(2.25rem, 4vw, 3.25rem)", fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.12, color: C.ink }}>
              {isUrdu ? "دو طریقوں سے سنا جائیں" : "Two ways to be heard"}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Text Chat card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              whileHover={{ y: -4 }}
              dir={isUrdu ? "rtl" : "ltr"}
              style={{ padding: "2.5rem", borderRadius: 20, backgroundColor: C.clayLight, border: `1px solid var(--border)` }}
              className="transition-shadow duration-300 hover:shadow-lg"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.white, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(166,124,82,0.12)" }}>
                  <MessageCircle size={22} color="var(--primary)" />
                </div>
                <span style={{ padding: "0.3rem 0.8rem", borderRadius: 100, backgroundColor: C.clay, color: "white", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em" }}>
                  {isUrdu ? "ابھی دستیاب" : "Available now"}
                </span>
              </div>
              <h3 style={{ ...serif, fontSize: "2rem", fontWeight: 500, letterSpacing: "-0.01em", marginBottom: "0.75rem", color: C.ink }}>
                {isUrdu ? "ٹیکسٹ چیٹ" : "Text Chat"}
              </h3>
              <p style={{ fontSize: "0.9375rem", color: C.muted, lineHeight: 1.72, marginBottom: "1.25rem" }}>
                {isUrdu
                  ? "لکھ کر اپنے خیالات کا اظہار کریں — اردو یا انگریزی میں، اپنی رفتار سے۔"
                  : "Type out your thoughts and receive thoughtful AI responses — in English or Urdu, at your own pace."}
              </p>
              <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0" }}>
                {(isUrdu
                  ? ["ریئل ٹائم جوابات", "گفتگو کی تاریخ", "سیشن کا خلاصہ"]
                  : ["Real-time responses", "Full conversation history", "AI-generated session summary"]
                ).map((b, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: C.muted }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: C.clay, flexShrink: 0, display: "inline-block" }} />
                    {b}
                  </li>
                ))}
              </ul>
              {/* Therapist chat preview */}
              <TherapistChatPreview isUrdu={isUrdu} />
            </motion.div>

            {/* Voice Chat card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.14 }}
              whileHover={{ y: -4 }}
              dir={isUrdu ? "rtl" : "ltr"}
              style={{ padding: "2.5rem", borderRadius: 20, backgroundColor: C.sageLight, border: `1px solid var(--border)` }}
              className="transition-shadow duration-300 hover:shadow-lg"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.white, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(93,138,107,0.12)" }}>
                  <Mic2 size={22} color="var(--sage)" />
                </div>
                <span style={{ padding: "0.3rem 0.8rem", borderRadius: 100, backgroundColor: C.sage, color: "white", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em" }}>
                  {isUrdu ? "ریئل ٹائم" : "Real-time voice"}
                </span>
              </div>
              <h3 style={{ ...serif, fontSize: "2rem", fontWeight: 500, letterSpacing: "-0.01em", marginBottom: "0.75rem", color: C.ink }}>
                {isUrdu ? "وائس چیٹ" : "Voice Chat"}
              </h3>
              <p style={{ fontSize: "0.9375rem", color: C.muted, lineHeight: 1.72, marginBottom: "1.5rem" }}>
                {isUrdu
                  ? "آواز کے ذریعے فوری گفتگو کریں — آپ کی بات سنی اور سمجھی جاتی ہے۔"
                  : "Speak naturally and have your voice transcribed, processed, and responded to with a warm AI voice."}
              </p>
              <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0" }}>
                {(isUrdu
                  ? ["آواز سے متن", "AI آواز جواب", "ریئل ٹائم پروسیسنگ"]
                  : ["Speech-to-text transcription", "AI voice response", "Low-latency processing"]
                ).map((b, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: C.muted }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: C.sage, flexShrink: 0, display: "inline-block" }} />
                    {b}
                  </li>
                ))}
              </ul>

              <VoicePlayer isUrdu={isUrdu} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section style={{ padding: "7rem 0", backgroundColor: C.surface }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            dir={isUrdu ? "rtl" : "ltr"}
            style={{ marginBottom: "4rem" }}
          >
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: C.clay, marginBottom: "0.75rem" }}>
              {isUrdu ? "آسان عمل" : "Simple process"}
            </p>
            <h2 style={{ ...serif, fontSize: "clamp(2.25rem, 4vw, 3.5rem)", fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.1, maxWidth: 520, color: C.ink }}>
              {isUrdu ? "تین آسان مراحل میں شروع کریں" : <>Start your journey<br />in three steps</>}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3">
            {[
              {
                num: "01", accent: "#a67c52", bg: C.clayLight,
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a67c52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="2"/>
                    <line x1="9" y1="12" x2="15" y2="12"/>
                    <line x1="9" y1="16" x2="13" y2="16"/>
                  </svg>
                ),
                title: isUrdu ? "تشخیص لیں"        : "Take an assessment",
                desc:  isUrdu ? "سادہ سوالات کے ذریعے اپنی ذہنی حالت کو سمجھیں۔"         : "A short questionnaire helps us understand your emotional needs and tailor support for you.",
              },
              {
                num: "02", accent: "var(--sage)", bg: C.sageLight,
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    <line x1="9" y1="10" x2="15" y2="10"/>
                  </svg>
                ),
                title: isUrdu ? "AI سے جڑیں"        : "Connect with your AI",
                desc:  isUrdu ? "ٹیکسٹ یا آواز کے ذریعے بات چیت شروع کریں۔"              : "Start a conversation via text or voice in English or Urdu — no waiting room required.",
              },
              {
                num: "03", accent: "#a67c52", bg: C.clayLight,
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a67c52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                    <line x1="3" y1="20" x2="21" y2="20"/>
                  </svg>
                ),
                title: isUrdu ? "پیشرفت ٹریک کریں" : "Track your progress",
                desc:  isUrdu ? "اپنے سیشنز اور موڈ ٹرینڈز دیکھیں اور آگے بڑھیں۔"       : "Review past sessions, mood trends, and diagnostic results. Grow with every conversation.",
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.13 }}
                dir={isUrdu ? "rtl" : "ltr"}
                style={{ padding: "2.5rem 2rem", borderLeft: i > 0 ? `1px solid var(--border)` : "none", position: "relative", overflow: "hidden" }}
              >
                {/* Ghost step number */}
                <div style={{
                  ...serif, position: "absolute",
                  top: "0.75rem", right: isUrdu ? "auto" : "1.25rem", left: isUrdu ? "1.25rem" : "auto",
                  fontSize: "5.5rem", fontWeight: 600, lineHeight: 1,
                  color: "var(--primary)", opacity: 0.7,
                  userSelect: "none" as const, pointerEvents: "none" as const,
                }}>
                  {step.num}
                </div>

                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: step.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
                  {step.icon}
                </div>

                <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: step.accent, marginBottom: "0.625rem" }}>
                  Step {step.num}
                </div>
                <h3 style={{ ...serif, fontSize: "1.5rem", fontWeight: 500, letterSpacing: "-0.01em", marginBottom: "0.75rem", color: C.ink }}>{step.title}</h3>
                <p style={{ fontSize: "0.9375rem", color: C.muted, lineHeight: 1.72 }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <section style={{ padding: "5rem 1.5rem", paddingBottom: "6rem", backgroundColor: C.bg }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{ maxWidth: "72rem", margin: "0 auto", backgroundColor: C.clay, borderRadius: 24, padding: "clamp(3rem, 6vw, 5rem)", textAlign: "center", position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.07)" }} />
          <div style={{ position: "absolute", bottom: -70, left: -50, width: 250, height: 250, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)" }} />

          <div style={{ position: "relative", zIndex: 1 }} dir={isUrdu ? "rtl" : "ltr"}>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.6)", marginBottom: "1rem" }}>
              {isUrdu ? "آج ہی شروع کریں" : "Get started today"}
            </p>
            <h2 style={{ ...serif, fontSize: "clamp(2.5rem, 5vw, 4.25rem)", fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.08, color: "white", marginBottom: "1.25rem" }}>
              {isUrdu ? <>آج ہی اپنا سفر<br />شروع کریں</> : <>Ready to feel<br />better?</>}
            </h2>
            <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.7)", maxWidth: 420, margin: "0 auto 2.5rem" }}>
              {isUrdu ? "مفت میں رجسٹر کریں اور اپنی پہلی گفتگو شروع کریں۔" : "Join MindEase today. Your first session is just a few clicks away."}
            </p>
            <Link href="/auth?mode=signup">
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.9375rem 2.25rem", borderRadius: 100, backgroundColor: "white", color: C.clay, fontSize: "1rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", transition: "box-shadow 0.2s ease" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)")}
              >
                {isUrdu ? "مفت میں شروع کریں" : "Start for free"} <ArrowRight size={16} />
              </motion.div>
            </Link>
            <p style={{ marginTop: "1.25rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.45)" }}>
              {isUrdu ? "کریڈٹ کارڈ کی ضرورت نہیں" : "No credit card required"}
            </p>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer style={{ borderTop: `1px solid var(--border)`, padding: "2.5rem 1.5rem", backgroundColor: C.bg }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <img src="/logo.svg" alt="MindEase" style={{ width: 26, height: 26, borderRadius: 7, objectFit: "contain" }} />
            <span style={{ ...serif, fontWeight: 600, fontSize: "1.0625rem", color: C.ink }}>MindEase</span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: C.muted }}>
            © {new Date().getFullYear()} MindEase. {t.allRightsReserved}
          </p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {[{ href: "/about", label: t.aboutUs }, { href: "/contact", label: t.contact }, { href: "/privacy", label: t.privacy }].map(link => (
              <Link key={link.href} href={link.href} style={{ fontSize: "0.8125rem", color: C.muted, textDecoration: "none" }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
      </div>{/* end content wrapper */}
    </div>
  )
}
