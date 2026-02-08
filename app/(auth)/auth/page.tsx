"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { apiLogin, apiRegister, apiCheckEmail, apiSendOtp, apiVerifyOtp } from "@/lib/api"
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

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { setAuth } = useAuth()
  const lang = useLanguage()
  const t = dict[lang]
  const isUrdu = lang === "ur"

  const initialMode = (searchParams.get("mode") === "signup" ? "signup" : "login") as "login" | "signup"
  const [mode, setMode] = useState<"login" | "signup">(initialMode)

  useEffect(() => {
    const m = searchParams.get("mode") === "signup" ? "signup" : "login"
    setMode(m)
  }, [searchParams])

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-[#0f1216]">
      {/* Top bar */}
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
          {/* Left panel */}
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
                />
              ) : (
                <SignInCTA key="signin-cta" t={t} isUrdu={isUrdu} onSwitch={() => setMode("login")} transition={transition} />
              )}
            </AnimatePresence>
          </div>

          {/* Right panel */}
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
                />
              ) : (
                <SignUpCTA key="signup-cta" t={t} isUrdu={isUrdu} onSwitch={() => setMode("signup")} transition={transition} />
              )}
            </AnimatePresence>
          </div>
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
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSwitch: () => void
  transition: object
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
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSwitch: () => void
  transition: object
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

function LoginForm({
  t,
  isUrdu,
  onSuccess,
  onSwitch,
  transition,
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSuccess: () => void
  onSwitch: () => void
  transition: object
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
}: {
  t: typeof dict.en
  isUrdu: boolean
  onSuccess: () => void
  onSwitch: () => void
  transition: object
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
