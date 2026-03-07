"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useToast } from "@/hooks/use-toast"
import { AuthGuard } from "@/components/AuthGuard"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useAuth } from "@/context/AuthContext"
import { apiGetUserProfile, apiUpdateUserProfile } from "@/lib/api"
import { BeamsBackground } from "@/components/ui/beams-background"
import { useTheme } from "next-themes"
import {
  User, Mail, Calendar, Languages, Lock, Save,
  MapPin, Loader2, Eye, EyeOff, CheckCircle2,
  UserCircle2, ShieldCheck, SlidersHorizontal, Navigation,
} from "lucide-react"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

const majorCitySuggestions = ["Islamabad", "Lahore", "Karachi", "Multan", "Peshawar", "Faisalabad"]

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().max(100).optional().or(z.literal("")),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Select a gender" }),
  lang_pref: z.enum(["en", "ur"], { required_error: "Select a language" }),
  city: z.string().min(1, "City is required").max(100),
  nearest_major_city: z.string().min(1, "Nearest major city is required").max(100),
  password: z.string().min(8, "Min 8 characters").optional().or(z.literal("")),
  confirm_password: z.string().optional(),
}).refine(d => {
  if (d.password && d.password.length > 0) return d.password === d.confirm_password
  return true
}, { message: "Passwords do not match", path: ["confirm_password"] })

type ProfileValues = z.infer<typeof profileSchema>

// ── Styled Field Label ──────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      ...sans, fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "var(--muted-foreground)",
      marginBottom: "0.375rem",
    }}>
      {children}
    </p>
  )
}

// ── Styled Text Input ───────────────────────────────────────────
function StyledInput({
  label, error, icon: Icon, type = "text", rightElement, ...props
}: {
  label: string; error?: string; icon?: any; type?: string
  rightElement?: React.ReactNode; [k: string]: any
}) {
  const [focused, setFocused] = useState(false)
  const [localType, setLocalType] = useState(type)

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ position: "relative" }}>
        {Icon && (
          <div style={{
            position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)",
            color: "var(--muted-foreground)", pointerEvents: "none",
          }}>
            <Icon size={13} />
          </div>
        )}
        <input
          type={localType}
          style={{
            ...sans, display: "block", width: "100%", height: 44,
            paddingLeft: Icon ? "2.25rem" : "0.875rem",
            paddingRight: type === "password" ? "2.75rem" : "0.875rem",
            borderRadius: 10,
            border: `1px solid ${error ? "#c0392b" : focused ? "var(--primary)" : "var(--border)"}`,
            backgroundColor: "color-mix(in srgb, var(--background) 55%, transparent)",
            color: "var(--foreground)", fontSize: "0.875rem",
            outline: "none", transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            boxSizing: "border-box",
            boxShadow: focused
              ? "0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)"
              : "none",
          } as React.CSSProperties}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setLocalType(t => t === "password" ? "text" : "password")}
            style={{
              position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--muted-foreground)", padding: 0, display: "flex",
            }}
          >
            {localType === "password" ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </div>
      {error && (
        <p style={{ ...sans, fontSize: "0.6875rem", color: "#c0392b", marginTop: "0.3rem" }}>{error}</p>
      )}
    </div>
  )
}

// ── Styled Native Select ────────────────────────────────────────
function StyledSelect({
  label, error, options, ...props
}: {
  label: string; error?: string
  options: { value: string; label: string }[]
  [k: string]: any
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ position: "relative" }}>
        <select
          style={{
            ...sans, display: "block", width: "100%", height: 44,
            padding: "0 2.5rem 0 0.875rem",
            borderRadius: 10,
            border: `1px solid ${error ? "#c0392b" : focused ? "var(--primary)" : "var(--border)"}`,
            backgroundColor: "color-mix(in srgb, var(--background) 55%, transparent)",
            color: "var(--foreground)", fontSize: "0.875rem",
            outline: "none", appearance: "none", cursor: "pointer",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            boxSizing: "border-box",
            boxShadow: focused
              ? "0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)"
              : "none",
          } as React.CSSProperties}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {/* Chevron */}
        <div style={{
          position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", color: "var(--muted-foreground)",
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {error && (
        <p style={{ ...sans, fontSize: "0.6875rem", color: "#c0392b", marginTop: "0.3rem" }}>{error}</p>
      )}
    </div>
  )
}

// ── Section Card ────────────────────────────────────────────────
function SectionCard({
  id, icon: Icon, eyebrow, title, children,
}: {
  id: string; icon: any; eyebrow: string; title: string; children: React.ReactNode
}) {
  return (
    <div
      id={id}
      style={{
        ...sans,
        backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
        backdropFilter: "blur(10px)",
        borderRadius: 18, border: "1px solid var(--border)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "1.25rem 1.625rem",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: "0.875rem",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #7a5535, #a67c52)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 10px rgba(166,124,82,0.25)",
          flexShrink: 0,
        }}>
          <Icon size={16} color="white" />
        </div>
        <div>
          <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.1rem" }}>
            {eyebrow}
          </p>
          <h3 style={{ ...serif, fontSize: "1.1875rem", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
            {title}
          </h3>
        </div>
      </div>

      {/* Section body */}
      <div style={{ padding: "1.5rem 1.625rem" }}>
        {children}
      </div>
    </div>
  )
}

// ── Nav Item ────────────────────────────────────────────────────
function NavItem({ active, icon: Icon, label, onClick }: { active: boolean; icon: any; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...sans, display: "flex", alignItems: "center", gap: "0.625rem",
        width: "100%", padding: "0.5rem 0.75rem", borderRadius: 9,
        backgroundColor: active ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "transparent",
        border: `1px solid ${active ? "color-mix(in srgb, var(--primary) 25%, transparent)" : "transparent"}`,
        color: active ? "var(--primary)" : "var(--muted-foreground)",
        fontSize: "0.8125rem", fontWeight: active ? 600 : 400,
        cursor: "pointer", textAlign: "left",
        transition: "all 0.15s ease",
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

// ══ Page ══════════════════════════════════════════════════════════
export default function ProfilePage() {
  const router = useRouter()
  const { user, token, setAuth } = useAuth()
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<any>(null)
  const [activeSection, setActiveSection] = useState("personal")
  const [saved, setSaved] = useState(false)

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    personal:    useRef<HTMLDivElement>(null),
    contact:     useRef<HTMLDivElement>(null),
    preferences: useRef<HTMLDivElement>(null),
    security:    useRef<HTMLDivElement>(null),
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
  })

  const password = watch("password")

  useEffect(() => {
    if (user?.id) loadProfile()
  }, [user?.id])

  // Reset form AFTER profileData is set (and loading guard drops) so inputs are mounted
  useEffect(() => {
    if (!profileData) return
    const dobFormatted = profileData.dob ? profileData.dob.split("T")[0] : ""
    reset({
      first_name: profileData.first_name || "",
      last_name: profileData.last_name || "",
      dob: dobFormatted,
      gender: (profileData.gender as "Male" | "Female" | "Other") || "Other",
      lang_pref: (profileData.lang_pref as "en" | "ur") || "en",
      city: profileData.city || "",
      nearest_major_city: profileData.nearest_major_city || "",
      password: "",
      confirm_password: "",
    })
  }, [profileData])

  const loadProfile = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const data = await apiGetUserProfile(user.id)
      setProfileData(data)
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load profile", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (values: ProfileValues) => {
    if (!user?.id) return
    try {
      const updateData: any = {
        first_name: values.first_name,
        last_name: values.last_name || "",
        dob: values.dob,
        gender: values.gender,
        lang_pref: values.lang_pref,
        city: values.city,
        nearest_major_city: values.nearest_major_city,
      }
      if (values.password && values.password.length > 0) updateData.password = values.password

      const updated = await apiUpdateUserProfile(user.id, updateData)
      if (updated) {
        setAuth({
          token: user.id.toString(),
          user: {
            id: updated.user_id.toString(),
            email: updated.email,
            first_name: updated.first_name,
            last_name: updated.last_name || "",
            gender: updated.gender || "Other",
            city: updated.city || "",
            nearest_major_city: updated.nearest_major_city || "",
          },
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast({ title: "Profile updated" })
      const { password: _p, confirm_password: _c, ...rest } = values
      reset({ ...rest, password: "", confirm_password: "" })
      await loadProfile()
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update profile", variant: "destructive" })
    }
  }

  const scrollTo = (key: string) => {
    setActiveSection(key)
    sectionRefs[key]?.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const fullName = [profileData?.first_name, profileData?.last_name].filter(Boolean).join(" ") || "Your Profile"
  const initial  = (profileData?.first_name || "U").charAt(0).toUpperCase()
  const memberSince = profileData?.created_at
    ? new Date(profileData.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently"

  const nav = [
    { key: "personal",    icon: UserCircle2,       label: "Personal Info"  },
    { key: "contact",     icon: Navigation,         label: "Contact & Location" },
    { key: "preferences", icon: SlidersHorizontal,  label: "Preferences"   },
    { key: "security",    icon: ShieldCheck,        label: "Security"      },
  ]

  if (loading) {
    return (
      <AuthGuard>
        <div style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)", zIndex: 50 }}>
          <BeamsBackground isDark={isDark} intensity="subtle" />
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={28} style={{ color: "var(--primary)" }} className="animate-spin" />
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div style={{ position: "fixed", inset: 0, display: "flex", backgroundColor: "var(--background)", zIndex: 50, overflow: "hidden" }}>

        {/* Beams background */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <BeamsBackground isDark={isDark} intensity="subtle" />
        </div>

        {/* Sidebar */}
        <div style={{ position: "relative", zIndex: 10, flexShrink: 0, height: "100%" }}>
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
        </div>

        {/* Main */}
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Header />

          <main style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ padding: "2rem 2.25rem 3rem", maxWidth: 1060, margin: "0 auto" }}>

              {/* Page title row */}
              <div style={{ marginBottom: "2rem" }}>
                <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.25rem" }}>
                  Account
                </p>
                <h1 style={{ ...serif, fontSize: "2rem", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)" }}>
                  Profile Settings
                </h1>
              </div>

              {/* Two-column layout */}
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.75rem", alignItems: "start" }}>

                {/* ── Left: sticky profile card ── */}
                <div style={{ position: "sticky", top: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

                  {/* Avatar card */}
                  <div style={{
                    ...sans,
                    backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 18, border: "1px solid var(--border)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                    padding: "1.75rem 1.25rem",
                    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                    gap: "0.75rem",
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 72, height: 72, borderRadius: "50%",
                      background: "linear-gradient(135deg, #7a5535 0%, #a67c52 55%, #c0955a 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 8px 24px rgba(166,124,82,0.35), 0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent)",
                    }}>
                      <span style={{ ...serif, fontSize: "2rem", fontWeight: 600, color: "rgba(255,255,255,0.95)", lineHeight: 1 }}>
                        {initial}
                      </span>
                    </div>

                    {/* Name */}
                    <div>
                      <h2 style={{ ...serif, fontSize: "1.25rem", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
                        {fullName}
                      </h2>
                      <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                        {profileData?.email || ""}
                      </p>
                    </div>

                    {/* Member since */}
                    <div style={{
                      ...sans, fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.07em",
                      textTransform: "uppercase", padding: "0.25rem 0.75rem", borderRadius: 100,
                      backgroundColor: "color-mix(in srgb, var(--sage) 12%, transparent)",
                      color: "var(--sage)", border: "1px solid color-mix(in srgb, var(--sage) 22%, transparent)",
                    }}>
                      Since {memberSince}
                    </div>
                  </div>

                  {/* Section nav */}
                  <div style={{
                    backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 18, border: "1px solid var(--border)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                    padding: "0.75rem",
                    display: "flex", flexDirection: "column", gap: "0.25rem",
                  }}>
                    <p style={{ ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted-foreground)", padding: "0.25rem 0.75rem 0.5rem" }}>
                      Sections
                    </p>
                    {nav.map(n => (
                      <NavItem
                        key={n.key}
                        active={activeSection === n.key}
                        icon={n.icon}
                        label={n.label}
                        onClick={() => scrollTo(n.key)}
                      />
                    ))}
                  </div>

                </div>

                {/* ── Right: form sections ── */}
                <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* Personal */}
                  <div ref={sectionRefs.personal}>
                    <SectionCard id="personal" icon={UserCircle2} eyebrow="Personal" title="Personal Information">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <StyledInput
                          label="First Name"
                          icon={User}
                          error={errors.first_name?.message}
                          placeholder="First name"
                          {...register("first_name")}
                        />
                        <StyledInput
                          label="Last Name"
                          icon={User}
                          error={errors.last_name?.message}
                          placeholder="Last name"
                          {...register("last_name")}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                        <StyledInput
                          label="Date of Birth"
                          icon={Calendar}
                          type="date"
                          error={errors.dob?.message}
                          {...register("dob")}
                        />
                        <StyledSelect
                          label="Gender"
                          error={errors.gender?.message}
                          options={[
                            { value: "Male",   label: "Male" },
                            { value: "Female", label: "Female" },
                            { value: "Other",  label: "Other" },
                          ]}
                          {...register("gender")}
                        />
                      </div>
                    </SectionCard>
                  </div>

                  {/* Contact */}
                  <div ref={sectionRefs.contact}>
                    <SectionCard id="contact" icon={Navigation} eyebrow="Contact" title="Contact & Location">
                      {/* Email: read-only display */}
                      <div style={{ marginBottom: "1rem" }}>
                        <FieldLabel>Email Address</FieldLabel>
                        <div style={{
                          display: "flex", alignItems: "center", gap: "0.625rem",
                          height: 44, padding: "0 0.875rem 0 0.75rem",
                          borderRadius: 10, border: "1px solid var(--border)",
                          backgroundColor: "color-mix(in srgb, var(--muted) 30%, transparent)",
                        }}>
                          <Mail size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                          <span style={{ ...sans, fontSize: "0.875rem", color: "var(--foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {profileData?.email || ""}
                          </span>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "0.25rem",
                            ...sans, fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.07em",
                            textTransform: "uppercase", color: "var(--muted-foreground)",
                            backgroundColor: "color-mix(in srgb, var(--muted) 50%, transparent)",
                            padding: "0.2rem 0.5rem", borderRadius: 5,
                          }}>
                            <Lock size={9} />
                            Locked
                          </div>
                        </div>
                        <p style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "0.3rem", opacity: 0.7 }}>
                          Email cannot be changed. Contact support if needed.
                        </p>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                        <StyledInput
                          label="City"
                          icon={MapPin}
                          error={errors.city?.message}
                          placeholder="Your city"
                          {...register("city")}
                        />
                        <div>
                          <FieldLabel>Nearest Major City</FieldLabel>
                          <div style={{ position: "relative" }}>
                            <div style={{
                              position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)",
                              color: "var(--muted-foreground)", pointerEvents: "none",
                            }}>
                              <MapPin size={13} />
                            </div>
                            <input
                              list="major-city-list"
                              style={{
                                ...sans, display: "block", width: "100%", height: 44,
                                paddingLeft: "2.25rem", paddingRight: "0.875rem",
                                borderRadius: 10,
                                border: `1px solid ${errors.nearest_major_city ? "#c0392b" : "var(--border)"}`,
                                backgroundColor: "color-mix(in srgb, var(--background) 55%, transparent)",
                                color: "var(--foreground)", fontSize: "0.875rem",
                                outline: "none", boxSizing: "border-box",
                              } as React.CSSProperties}
                              placeholder="Nearest major city"
                              {...register("nearest_major_city")}
                            />
                            <datalist id="major-city-list">
                              {majorCitySuggestions.map(c => <option key={c} value={c} />)}
                            </datalist>
                          </div>
                          {errors.nearest_major_city && (
                            <p style={{ ...sans, fontSize: "0.6875rem", color: "#c0392b", marginTop: "0.3rem" }}>{errors.nearest_major_city.message}</p>
                          )}
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  {/* Preferences */}
                  <div ref={sectionRefs.preferences}>
                    <SectionCard id="preferences" icon={SlidersHorizontal} eyebrow="Preferences" title="App Preferences">
                      <div style={{ maxWidth: 320 }}>
                        <StyledSelect
                          label="Preferred Language"
                          error={errors.lang_pref?.message}
                          options={[
                            { value: "en", label: "English" },
                            { value: "ur", label: "اردو (Urdu)" },
                          ]}
                          {...register("lang_pref")}
                        />
                      </div>
                      <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.75rem", lineHeight: 1.6, opacity: 0.8 }}>
                        This controls the language used in your therapy sessions and assessments.
                      </p>
                    </SectionCard>
                  </div>

                  {/* Security */}
                  <div ref={sectionRefs.security}>
                    <SectionCard id="security" icon={ShieldCheck} eyebrow="Security" title="Change Password">
                      <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                        Leave both fields empty to keep your current password unchanged.
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <StyledInput
                          label="New Password"
                          icon={Lock}
                          type="password"
                          error={errors.password?.message}
                          placeholder="Min 8 characters"
                          {...register("password")}
                        />
                        <StyledInput
                          label="Confirm Password"
                          icon={Lock}
                          type="password"
                          error={errors.confirm_password?.message}
                          placeholder="Repeat new password"
                          disabled={!password || password.length === 0}
                          {...register("confirm_password")}
                        />
                      </div>
                    </SectionCard>
                  </div>

                  {/* Save bar */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem",
                    padding: "1.25rem 1.625rem",
                    backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 18, border: "1px solid var(--border)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  }}>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard")}
                      style={{
                        ...sans, height: 42, padding: "0 1.25rem", borderRadius: 10,
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--muted-foreground)", fontSize: "0.875rem", fontWeight: 500,
                        cursor: "pointer", transition: "border-color 0.15s ease, color 0.15s ease",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--primary)"
                        e.currentTarget.style.color = "var(--primary)"
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--border)"
                        e.currentTarget.style.color = "var(--muted-foreground)"
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        ...sans, height: 42, padding: "0 1.5rem", borderRadius: 10,
                        border: "none",
                        background: saved
                          ? "linear-gradient(135deg, #325944, #5D8A6B)"
                          : "linear-gradient(135deg, #7a5535, #a67c52)",
                        color: "white", fontSize: "0.875rem", fontWeight: 600,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: "0.5rem",
                        boxShadow: "0 4px 14px rgba(166,124,82,0.3)",
                        opacity: isSubmitting ? 0.7 : 1,
                        transition: "opacity 0.15s ease, background 0.3s ease",
                      }}
                    >
                      {isSubmitting ? (
                        <><Loader2 size={15} className="animate-spin" /> Saving…</>
                      ) : saved ? (
                        <><CheckCircle2 size={15} /> Saved!</>
                      ) : (
                        <><Save size={15} /> Save Changes</>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
