"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import { useUser, useSignIn, useClerk } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { apiLogin, apiRegister, apiCheckEmail, apiSendOtp, apiVerifyOtp, apiLoginOauth, apiRegisterOauth } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { dict, useLanguage } from "@/lib/i18n"
import { FormError } from "@/components/FormError"
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator"
import { Heart, Loader2, Mail, Lock, CheckCircle2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/LanguageToggle"

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

const createRegisterSchema = (t: typeof dict.en) =>
  z
    .object({
      email: z.string().min(1, "Email is required").email("Invalid email"),
      password: z
        .string()
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
    })
    .refine((data) => data.password === data.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] })

type LoginFormValues = z.infer<typeof loginSchema>

const majorCitySuggestions = [
  { value: "Islamabad", labelUr: "اسلام آباد" },
  { value: "Lahore", labelUr: "لاہور" },
  { value: "Karachi", labelUr: "کراچی" },
  { value: "Multan", labelUr: "ملتان" },
  { value: "Peshawar", labelUr: "پشاور" },
  { value: "Faisalabad", labelUr: "فیصل آباد" },
]

const transition = { type: "tween", duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }

type GoogleUser = { email: string; firstName: string; lastName: string }

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

  const initialMode = (searchParams.get("mode") === "signup" ? "signup" : "login") as "login" | "signup"
  const [mode, setMode] = useState<"login" | "signup">(initialMode)

  // Google (Clerk) flow: after OTP verify user fills profile
  const [googleFlow, setGoogleFlow] = useState<"idle" | "otp" | "profile">("idle")
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null)
  const [googleOtpSent, setGoogleOtpSent] = useState(false)
  const [googleOtpVerified, setGoogleOtpVerified] = useState(false)
  const [googleOtpCode, setGoogleOtpCode] = useState("")
  const [sendingGoogleOtp, setSendingGoogleOtp] = useState(false)
  const [verifyingGoogleOtp, setVerifyingGoogleOtp] = useState(false)
  const clerkSyncedRef = useRef(false)

  useEffect(() => {
    const m = searchParams.get("mode") === "signup" ? "signup" : "login"
    setMode(m)
  }, [searchParams])

  // When Clerk user is signed in (e.g. after Google redirect), sync with backend
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !clerkUser || clerkSyncedRef.current) return
    const email = clerkUser.primaryEmailAddress?.emailAddress
    if (!email) return
    clerkSyncedRef.current = true
    const firstName = clerkUser.firstName || ""
    const lastName = clerkUser.lastName || ""
    apiLoginOauth(email)
      .then((res) => {
        setAuth({
          token: res.user_id.toString(),
          user: {
            id: res.user_id.toString(),
            email: res.email,
            first_name: res.first_name,
            last_name: res.last_name || "",
            gender: res.gender,
            city: res.city,
            nearest_major_city: res.nearest_major_city,
            dashboard_tour_seen: res.dashboard_tour_seen ?? false,
          },
        })
        router.push("/dashboard")
      })
      .catch((err) => {
        if (err?.message === "USER_NOT_FOUND") {
          setGoogleUser({ email, firstName, lastName })
          setGoogleFlow("otp")
          setSendingGoogleOtp(true)
          apiSendOtp(email)
            .then(() => {
              setGoogleOtpSent(true)
              toast({ title: t.otpSentSuccess, variant: "default" })
            })
            .catch((e) => toast({ title: "Failed to send OTP", description: e?.message, variant: "destructive" }))
            .finally(() => setSendingGoogleOtp(false))
        }
      })
  }, [clerkLoaded, isSignedIn, clerkUser, setAuth, router, toast, t.otpSentSuccess])

  const handleSignInWithGoogle = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    signIn?.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: `${origin}/auth/callback`,
      redirectUrlComplete: `${origin}/auth`,
    })
  }

  const handleGoogleOtpVerify = async () => {
    if (!googleUser || !googleOtpCode || googleOtpCode.length !== 6) {
      toast({ title: t.invalidOtp, variant: "destructive" })
      return
    }
    setVerifyingGoogleOtp(true)
    try {
      await apiVerifyOtp(googleUser.email, googleOtpCode)
      setGoogleOtpVerified(true)
      setGoogleFlow("profile")
      toast({ title: t.otpVerifySuccess, variant: "default" })
    } catch {
      toast({ title: t.invalidOtp, variant: "destructive" })
    } finally {
      setVerifyingGoogleOtp(false)
    }
  }

  const showGoogleFlow = googleFlow !== "idle" && googleUser

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-[#0f1216]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-transparent">
        <Link href="/" className="flex items-center gap-2 text-slate-900 dark:text-slate-200 hover:opacity-90 transition-opacity">
          <Heart className="h-5 w-5 text-[#4a6a85] dark:text-[#7b9cb8]" />
          <span className="font-semibold text-lg">MindEase</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl min-h-[32rem] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] bg-white dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700/60 grid grid-cols-1 lg:grid-cols-2">
          {showGoogleFlow ? (
            <div className="col-span-1 lg:col-span-2 flex flex-col justify-center p-8 sm:p-10 bg-white dark:bg-slate-900/95">
              <AnimatePresence mode="wait">
                {googleFlow === "otp" && (
                  <GoogleOtpStep
                    key="google-otp"
                    email={googleUser!.email}
                    otpCode={googleOtpCode}
                    setOtpCode={setGoogleOtpCode}
                    sendingOtp={sendingGoogleOtp}
                    verifyingOtp={verifyingGoogleOtp}
                    otpSent={googleOtpSent}
                    onVerify={handleGoogleOtpVerify}
                    onBack={() => {
                      setGoogleFlow("idle"); setGoogleUser(null); setGoogleOtpSent(false); setGoogleOtpCode(""); clerkSyncedRef.current = false
                      signOut?.({ redirectUrl: "/auth" })
                    }}
                    t={t}
                    isUrdu={isUrdu}
                    transition={transition}
                  />
                )}
                {googleFlow === "profile" && googleUser && (
                  <GoogleCompleteProfileForm
                    key="google-profile"
                    googleUser={googleUser}
                    t={t}
                    isUrdu={isUrdu}
                    onSuccess={(res) => {
                      setAuth({
                        token: res.user_id.toString(),
                        user: {
                          id: res.user_id.toString(),
                          email: res.email,
                          first_name: res.first_name,
                          last_name: res.last_name || "",
                          gender: res.gender,
                          city: res.city,
                          nearest_major_city: res.nearest_major_city,
                          dashboard_tour_seen: res.dashboard_tour_seen ?? false,
                        },
                      })
                      router.push("/dashboard")
                    }}
                    transition={transition}
                  />
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-center p-8 sm:p-10 bg-white dark:bg-slate-900/95">
                <AnimatePresence mode="wait">
                  {mode === "login" ? (
                    <LoginForm
                      key="login"
                      t={t}
                      isUrdu={isUrdu}
                      onSuccess={() => router.push("/dashboard")}
                      onSwitch={() => setMode("signup")}
                      transition={transition}
                      onSignInWithGoogle={handleSignInWithGoogle}
                    />
                  ) : (
                    <SignInCTA key="signin-cta" t={t} isUrdu={isUrdu} onSwitch={() => setMode("login")} transition={transition} onSignInWithGoogle={handleSignInWithGoogle} />
                  )}
                </AnimatePresence>
              </div>
              <div className="flex flex-col justify-center p-8 sm:p-10 bg-slate-100 dark:bg-slate-800/80">
                <AnimatePresence mode="wait">
                  {mode === "signup" ? (
                    <RegisterForm
                      key="register"
                      t={t}
                      isUrdu={isUrdu}
                      onSuccess={() => setMode("login")}
                      onSwitch={() => setMode("login")}
                      transition={transition}
                      onSignUpWithGoogle={handleSignInWithGoogle}
                    />
                  ) : (
                    <SignUpCTA key="signup-cta" t={t} isUrdu={isUrdu} onSwitch={() => setMode("signup")} transition={transition} onSignUpWithGoogle={handleSignInWithGoogle} />
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function SignInCTA({
  t,
  isUrdu,
  onSwitch,
  transition,
  onSignInWithGoogle,
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSwitch: () => void
  transition: object
  onSignInWithGoogle?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={transition}
      dir={isUrdu ? "rtl" : "ltr"}
      className="text-center"
    >
      <h2 className="text-xl font-medium text-slate-900 dark:text-slate-200 mb-2">{isUrdu ? "پھر سے خوش آمدید" : "Welcome back"}</h2>
      <p className="text-slate-700 dark:text-slate-400 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
        {isUrdu ? "اپنے اکاؤنٹ میں سائن ان کریں اور اپنی ذہنی صحت کے سفر کو جاری رکھیں۔" : "Sign in to your account and continue your wellness journey."}
      </p>
      {onSignInWithGoogle && (
        <Button type="button" variant="outline" onClick={onSignInWithGoogle} className="w-full rounded-xl mb-3 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-300">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {isUrdu ? "گوگل کے ساتھ سائن ان کریں" : "Sign in with Google"}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onSwitch}
        className="rounded-xl border-2 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-300"
      >
        {t.login}
      </Button>
    </motion.div>
  )
}

function SignUpCTA({
  t,
  isUrdu,
  onSwitch,
  transition,
  onSignUpWithGoogle,
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSwitch: () => void
  transition: object
  onSignUpWithGoogle?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={transition}
      dir={isUrdu ? "rtl" : "ltr"}
      className="text-center"
    >
      <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-2">{isUrdu ? "ہیلو! اپنا سفر یہاں سے شروع کریں" : "Hey there!"}</h2>
      <p className="text-slate-700 dark:text-slate-400 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
        {isUrdu ? "آج ہی اکاؤنٹ بنائیں اور اپنی ذہنی صحت کی دیکھ بھال کا آغاز کریں۔" : "Begin your journey by creating an account with us today."}
      </p>
      {onSignUpWithGoogle && (
        <Button type="button" variant="outline" onClick={onSignUpWithGoogle} className="w-full rounded-xl mb-3 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-300 bg-white dark:bg-slate-800">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {isUrdu ? "گوگل کے ساتھ سائن اپ کریں" : "Sign up with Google"}
        </Button>
      )}
      <Button
        type="button"
        onClick={onSwitch}
        className="rounded-xl bg-[#4a6a85] hover:bg-[#3d5a73] dark:bg-[#6b8cad] dark:hover:bg-[#5a7a9a] text-white border-0 shadow-sm transition-colors duration-300"
      >
        {t.register}
      </Button>
    </motion.div>
  )
}

function GoogleOtpStep({
  email,
  otpCode,
  setOtpCode,
  sendingOtp,
  verifyingOtp,
  otpSent,
  onVerify,
  onBack,
  t,
  isUrdu,
  transition,
}: {
  email: string
  otpCode: string
  setOtpCode: (s: string) => void
  sendingOtp: boolean
  verifyingOtp: boolean
  otpSent: boolean
  onVerify: () => void
  onBack: () => void
  t: typeof dict.en
  isUrdu: boolean
  transition: object
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={transition}
      dir={isUrdu ? "rtl" : "ltr"}
      className="max-w-sm mx-auto"
    >
      <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">{isUrdu ? "ای میل کی تصدیق کریں" : "Verify your email"}</h2>
      <p className="text-sm text-slate-700 dark:text-slate-400 mb-4">
        {isUrdu ? "ہم نے ایک کوڈ بھیج دیا ہے " : "We sent a code to "}<span className="font-medium">{email}</span>
      </p>
      <div className="space-y-2">
        <Label className="text-slate-800 dark:text-slate-300">{t.enterOtp}</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="000000"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            className="rounded-xl text-center tracking-widest font-mono border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100"
          />
          <Button type="button" size="sm" onClick={onVerify} disabled={verifyingOtp || otpCode.length !== 6} className="rounded-xl">
            {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">{t.verifyOtp}</span>
          </Button>
        </div>
      </div>
      {sendingOtp && !otpSent && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{isUrdu ? "بھیج رہے ہیں…" : "Sending…"}</p>}
      <Button type="button" variant="ghost" className="mt-4 text-slate-600 dark:text-slate-400" onClick={onBack}>
        {isUrdu ? "ای میل سے واپس جائیں" : "Back to email sign in"}
      </Button>
    </motion.div>
  )
}

const googleProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  city: z.string().min(1, "City is required"),
  nearest_major_city: z.string().min(1, "Nearest major city is required").max(100, "Must be less than 100 characters"),
  dob: z.string().nonempty("Date of birth is required"),
  gender: z.string().nonempty("Gender is required"),
  preferred_language: z.string().nonempty("Preferred language is required"),
})

function GoogleCompleteProfileForm({
  googleUser,
  t,
  isUrdu,
  onSuccess,
  transition,
}: {
  googleUser: GoogleUser
  t: typeof dict.en
  isUrdu: boolean
  onSuccess: (res: { user_id: number; email: string; first_name: string; last_name: string; gender: string; city: string; nearest_major_city: string; dashboard_tour_seen: boolean }) => void
  transition: object
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
      const res = await apiRegisterOauth({
        email: googleUser.email,
        first_name: values.first_name,
        last_name: values.last_name,
        city: values.city,
        nearest_major_city: values.nearest_major_city,
        dob: values.dob,
        gender: values.gender,
        preferred_language: values.preferred_language,
      })
      onSuccess(res)
    } catch (e: any) {
      toast({ title: "Registration failed", description: e?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={transition}
      dir={isUrdu ? "rtl" : "ltr"}
      className="max-h-[70vh] overflow-y-auto pr-1 max-w-lg mx-auto"
    >
      <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">{isUrdu ? "اپنا پروفائل مکمل کریں" : "Complete your profile"}</h2>
      <p className="text-sm text-slate-700 dark:text-slate-400 mb-4">{googleUser.email}</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "پہلا نام" : "First Name"}</Label>
            <Input className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("first_name")} />
            {errors.first_name?.message && <FormError message={errors.first_name.message} />}
          </div>
          <div className="space-y-1">
            <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "آخری نام" : "Last Name"}</Label>
            <Input className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("last_name")} />
            {errors.last_name?.message && <FormError message={errors.last_name.message} />}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-800 dark:text-slate-300">{t.city}</Label>
          <Input className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("city")} />
          {errors.city?.message && <FormError message={errors.city.message} />}
        </div>
        <div className="space-y-1">
          <Label className="text-slate-800 dark:text-slate-300">{t.nearestMajorCity}</Label>
          <Input list="major-city-google" placeholder={t.selectNearestMajorCity} className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("nearest_major_city")} />
          <datalist id="major-city-google">
            {majorCitySuggestions.map((c) => (
              <option key={c.value} value={c.value}>{isUrdu ? c.labelUr : c.value}</option>
            ))}
          </datalist>
          {errors.nearest_major_city?.message && <FormError message={errors.nearest_major_city.message} />}
        </div>
        <div className="space-y-1">
          <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</Label>
          <Input type="date" className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("dob")} />
          {errors.dob?.message && <FormError message={errors.dob.message} />}
        </div>
        <div className="space-y-1">
          <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "صنف" : "Gender"}</Label>
          <select {...register("gender")} className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-100">
            <option value="">{isUrdu ? "جنس منتخب کریں" : "Select"}</option>
            <option value="Male">{isUrdu ? "مرد" : "Male"}</option>
            <option value="Female">{isUrdu ? "عورت" : "Female"}</option>
            <option value="Other">{isUrdu ? "دیگر" : "Other"}</option>
          </select>
          {errors.gender?.message && <FormError message={errors.gender.message} />}
        </div>
        <div className="space-y-1">
          <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "ترجیحی زبان" : "Preferred Language"}</Label>
          <select {...register("preferred_language")} className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-100">
            <option value="">{isUrdu ? "زبان منتخب کریں" : "Select"}</option>
            <option value="en">{isUrdu ? "انگریزی" : "English"}</option>
            <option value="ur">{isUrdu ? "اردو" : "Urdu"}</option>
          </select>
          {errors.preferred_language?.message && <FormError message={errors.preferred_language.message} />}
        </div>
        <Button type="submit" disabled={loading} className="w-full rounded-xl bg-[#4a6a85] hover:bg-[#3d5a73] dark:bg-[#6b8cad] text-white h-11">
          {loading ? (isUrdu ? "محفوظ ہو رہا ہے…" : "Saving…") : (isUrdu ? "شروع کریں" : "Get started")}
        </Button>
      </form>
    </motion.div>
  )
}

function LoginForm({
  t,
  isUrdu,
  onSuccess,
  onSwitch,
  transition,
  onSignInWithGoogle,
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSuccess: () => void
  onSwitch: () => void
  transition: object
  onSignInWithGoogle?: () => void
}) {
  const { toast } = useToast()
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const { handleSubmit, register, formState: { errors }, setError } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  })

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true)
    setLoginError(null)
    try {
      const res = await apiLogin(values)
      const userData = {
        id: res.user_id.toString(),
        email: res.email,
        first_name: res.first_name,
        last_name: res.last_name || "",
        gender: res.gender || "Other",
        city: res.city || "",
        nearest_major_city: res.nearest_major_city || "",
        dashboard_tour_seen: Boolean(res.dashboard_tour_seen),
      }
      setAuth({ token: res.user_id.toString(), user: userData })
      toast({ title: "Login successful!" })
      onSuccess()
    } catch {
      setLoginError(isUrdu ? "ایمیل یا پاس ورڈ غلط ہیں" : "Invalid email or password")
      setError("email", { type: "manual" })
      setError("password", { type: "manual" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={transition}
      dir={isUrdu ? "rtl" : "ltr"}
    >
      <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">{t.loginTitle}</h1>
      <p className="text-sm text-slate-700 dark:text-slate-400 mb-6">{isUrdu ? "اپنے اکاؤنٹ تک محفوظ رسائی حاصل کریں" : "Access your account securely"}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {loginError && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-300">
            {loginError}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="auth-email" className="text-slate-800 dark:text-slate-300">{t.email}</Label>
          <Input id="auth-email" type="email" autoComplete="email" className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400" {...register("email")} />
          {errors.email?.message && <FormError message={errors.email.message} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="auth-password" className="text-slate-800 dark:text-slate-300">{t.password}</Label>
          <Input id="auth-password" type="password" autoComplete="current-password" className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400" {...register("password")} />
          {errors.password?.message && <FormError message={errors.password.message} />}
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#4a6a85] hover:bg-[#3d5a73] dark:bg-[#6b8cad] dark:hover:bg-[#5a7a9a] text-white h-11 shadow-sm transition-colors duration-300"
        >
          {loading ? (isUrdu ? "لاگ اِن ہو رہا ہے…" : "Logging in…") : t.login}
        </Button>
        {onSignInWithGoogle && (
          <Button type="button" variant="outline" onClick={onSignInWithGoogle} className="w-full rounded-xl mt-3 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-300">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {isUrdu ? "گوگل کے ساتھ سائن ان کریں" : "Sign in with Google"}
          </Button>
        )}
      </form>

      <p className="mt-5 text-sm text-slate-700 dark:text-slate-400">
        {t.toLogin} <button type="button" onClick={onSwitch} className="font-medium text-[#4a6a85] dark:text-[#7b9cb8] hover:underline">{t.toRegister}</button>
      </p>
    </motion.div>
  )
}

function RegisterForm({
  t,
  isUrdu,
  onSuccess,
  onSwitch,
  transition,
  onSignUpWithGoogle,
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSuccess: () => void
  onSwitch: () => void
  transition: object
  onSignUpWithGoogle?: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpCode, setOtpCode] = useState("")

  const schema = createRegisterSchema(t)
  type FormValues = z.infer<typeof schema>

  const { handleSubmit, register, watch, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  })

  const watchedPassword = watch("password", "")
  const watchedEmail = watch("email", "")

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (watchedEmail && emailRegex.test(watchedEmail)) {
        setCheckingEmail(true)
        apiCheckEmail(watchedEmail)
          .then((result: { exists: boolean }) => {
            setEmailExists(result.exists)
            if (result.exists) setError("email", { type: "manual", message: "This email is already registered." })
            else setError("email", { type: "manual", message: "" })
          })
          .catch(() => {})
          .finally(() => setCheckingEmail(false))
      } else setEmailExists(false)
    }, 800)
    return () => clearTimeout(timeoutId)
  }, [watchedEmail, setError])

  const handleSendOtp = async () => {
    if (!watchedEmail) {
      toast({ title: "Email Required", description: "Please enter your email first", variant: "destructive" })
      return
    }
    setSendingOtp(true)
    try {
      await apiSendOtp(watchedEmail)
      setOtpSent(true)
      toast({ title: t.otpSentSuccess, variant: "default" })
    } catch (error: any) {
      toast({ title: "Failed to send OTP", description: error.message, variant: "destructive" })
    } finally {
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({ title: t.invalidOtp, variant: "destructive" })
      return
    }
    setVerifyingOtp(true)
    try {
      await apiVerifyOtp(watchedEmail, otpCode)
      setOtpVerified(true)
      toast({ title: t.otpVerifySuccess, variant: "default" })
    } catch {
      toast({ title: t.invalidOtp, variant: "destructive" })
    } finally {
      setVerifyingOtp(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    if (!otpVerified) {
      toast({ title: t.verifyEmailFirst, variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      await apiRegister(values)
      toast({ title: "Account created successfully!" })
      onSuccess()
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={transition}
      dir={isUrdu ? "rtl" : "ltr"}
      className="max-h-[70vh] overflow-y-auto pr-1"
    >
      <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">{t.registerTitle}</h1>
      <p className="text-sm text-slate-700 dark:text-slate-400 mb-4">{isUrdu ? "نیا اکاؤنٹ بنائیں اور آغاز کریں" : "Create a new account to get started"}</p>

      {onSignUpWithGoogle && (
        <Button type="button" variant="outline" onClick={onSignUpWithGoogle} className="w-full rounded-xl mb-4 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-300">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {isUrdu ? "گوگل کے ساتھ سائن اپ کریں" : "Sign up with Google"}
        </Button>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1">
          <Label className="text-slate-800 dark:text-slate-300">{t.email}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="email"
                autoComplete="email"
                className={`rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 ${emailExists ? "border-red-500" : ""}`}
                {...register("email")}
                disabled={otpSent && otpVerified}
              />
              {checkingEmail && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-600 dark:text-slate-400" />}
              {emailExists && !checkingEmail && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-sm">!</span>}
              {otpVerified && !emailExists && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleSendOtp} disabled={sendingOtp || checkingEmail || emailExists || otpVerified || !watchedEmail} className="rounded-xl whitespace-nowrap border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200">
              {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : otpSent ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : <Mail className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">{otpSent ? t.otpSent : t.sendOtp}</span>
            </Button>
          </div>
          {errors.email?.message && <FormError message={errors.email.message} />}
        </div>

        {otpSent && !otpVerified && (
          <div className="space-y-1">
            <Label className="text-slate-800 dark:text-slate-300">{t.enterOtp}</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="rounded-xl text-center tracking-widest font-mono border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100"
              />
              <Button type="button" size="sm" onClick={handleVerifyOtp} disabled={verifyingOtp || otpCode.length !== 6} className="rounded-xl border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200">
                {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">{t.verifyOtp}</span>
              </Button>
            </div>
          </div>
        )}

        {otpVerified && (
          <>
            <div className="space-y-1">
              <Label className="text-slate-800 dark:text-slate-300">{t.password}</Label>
              <Input type="password" autoComplete="new-password" className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("password")} />
              <PasswordStrengthIndicator password={watchedPassword} />
              {errors.password?.message && <FormError message={errors.password.message} />}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-800 dark:text-slate-300">{t.confirmPassword}</Label>
              <Input type="password" className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("confirmPassword")} />
              {errors.confirmPassword?.message && <FormError message={errors.confirmPassword.message} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "پہلا نام" : "First Name"}</Label>
                <Input className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("first_name")} />
                {errors.first_name?.message && <FormError message={errors.first_name.message} />}
              </div>
              <div className="space-y-1">
                <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "آخری نام" : "Last Name"}</Label>
                <Input className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("last_name")} />
                {errors.last_name?.message && <FormError message={errors.last_name.message} />}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-800 dark:text-slate-300">{t.city}</Label>
              <Input className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("city")} />
              {errors.city?.message && <FormError message={errors.city.message} />}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-800 dark:text-slate-300">{t.nearestMajorCity}</Label>
              <Input list="major-city-auth" placeholder={t.selectNearestMajorCity} className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400" {...register("nearest_major_city")} />
              <datalist id="major-city-auth">
                {majorCitySuggestions.map((c) => (
                  <option key={c.value} value={c.value}>{isUrdu ? c.labelUr : c.value}</option>
                ))}
              </datalist>
              {errors.nearest_major_city?.message && <FormError message={errors.nearest_major_city.message} />}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</Label>
              <Input type="date" className="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-900 dark:text-slate-100" {...register("dob")} />
              {errors.dob?.message && <FormError message={errors.dob.message} />}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "صنف" : "Gender"}</Label>
              <select {...register("gender")} className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-100">
                <option value="">{isUrdu ? "جنس منتخب کریں" : "Select"}</option>
                <option value="Male">{isUrdu ? "مرد" : "Male"}</option>
                <option value="Female">{isUrdu ? "عورت" : "Female"}</option>
                <option value="Other">{isUrdu ? "دیگر" : "Other"}</option>
              </select>
              {errors.gender?.message && <FormError message={errors.gender.message} />}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-800 dark:text-slate-300">{isUrdu ? "ترجیحی زبان" : "Preferred Language"}</Label>
              <select {...register("preferred_language")} className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-100">
                <option value="">{isUrdu ? "زبان منتخب کریں" : "Select"}</option>
                <option value="en">{isUrdu ? "انگریزی" : "English"}</option>
                <option value="ur">{isUrdu ? "اردو" : "Urdu"}</option>
              </select>
              {errors.preferred_language?.message && <FormError message={errors.preferred_language.message} />}
            </div>
          </>
        )}

        <Button
          type="submit"
          disabled={loading || !otpVerified}
          className="w-full rounded-xl bg-[#4a6a85] hover:bg-[#3d5a73] dark:bg-[#6b8cad] dark:hover:bg-[#5a7a9a] text-white h-11 shadow-sm transition-colors duration-300"
        >
          {loading ? (isUrdu ? "رجسٹریشن ہو رہی ہے…" : "Registering…") : t.register}
        </Button>
      </form>

      <p className="mt-4 text-sm text-slate-700 dark:text-slate-400">
        {t.toLogin} <button type="button" onClick={onSwitch} className="font-medium text-[#4a6a85] dark:text-[#7b9cb8] hover:underline">{t.login}</button>
      </p>
    </motion.div>
  )
}
