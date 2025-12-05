"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { apiRegister, apiCheckEmail, apiSendOtp, apiVerifyOtp } from "@/lib/api"
import { dict, useLanguage } from "@/lib/i18n"
import { FormError } from "@/components/FormError"
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, CheckCircle2, Loader2 } from "lucide-react"

const createSchema = (t: any) =>
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
      nearest_major_city: z
        .string()
        .min(1, "Nearest major city is required")
        .max(100, "Nearest major city must be less than 100 characters"),
      dob: z.string().nonempty("Date of birth is required"),
      gender: z.string().nonempty("Gender is required"),
      preferred_language: z.string().nonempty("Preferred language is required"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords must match",
      path: ["confirmPassword"],
    })

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const lang = useLanguage()
  const t = dict[lang]
  const [loading, setLoading] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpCode, setOtpCode] = useState("")

  const schema = createSchema(t)
  type FormValues = z.infer<typeof schema>
  const majorCitySuggestions = [
    { value: "Islamabad", labelUr: "اسلام آباد" },
    { value: "Lahore", labelUr: "لاہور" },
    { value: "Karachi", labelUr: "کراچی" },
    { value: "Multan", labelUr: "ملتان" },
    { value: "Peshawar", labelUr: "پشاور" },
    { value: "Faisalabad", labelUr: "فیصل آباد" },
  ]

  const {
    handleSubmit,
    register,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  })

  const watchedPassword = watch("password", "")
  const watchedEmail = watch("email", "")
  
  const isUrdu = lang === "ur"

  // Debounced email check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (watchedEmail && emailRegex.test(watchedEmail)) {
        setCheckingEmail(true);
        apiCheckEmail(watchedEmail)
          .then((result: { exists: boolean; email: string }) => {
            setEmailExists(result.exists);
            if (result.exists) {
              setError("email", {
                type: "manual",
                message: "This email is already registered. Please login instead.",
              });
              toast({
                title: isUrdu ? "یہ ای میل پہلے سے رجسٹر ہے" : "Email Already Exists",
                description: isUrdu 
                  ? "یہ ای میل پہلے سے استعمال ہو رہی ہے۔ براہ کرم لاگ اِن کریں۔" 
                  : "This email is already registered. Please login instead.",
                variant: "destructive",
              });
            } else {
              setError("email", { type: "manual", message: "" });
            }
          })
          .catch((error: any) => {
            console.error("Error checking email:", error);
          })
          .finally(() => {
            setCheckingEmail(false);
          });
      } else {
        setEmailExists(false);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [watchedEmail, setError, toast, isUrdu]);

  const handleSendOtp = async () => {
    if (!watchedEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your email first",
        variant: "destructive",
      });
      return;
    }

    setSendingOtp(true);
    try {
      await apiSendOtp(watchedEmail);
      setOtpSent(true);
      toast({
        title: t.otpSentSuccess,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Failed to send OTP",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: t.invalidOtp,
        description: "Please enter a valid 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOtp(true);
    try {
      await apiVerifyOtp(watchedEmail, otpCode);
      setOtpVerified(true);
      toast({
        title: t.otpVerifySuccess,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: t.invalidOtp,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!otpVerified) {
      toast({
        title: t.verifyEmailFirst,
        description: isUrdu ? "پہلے اپنا ای میل تصدیق کریں" : "Please verify your email before registering",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRegister(values);
      toast({ title: "Account created successfully!" });
      router.push("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-emerald-50 via-teal-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-teal-200/40 to-transparent dark:from-teal-900/30" />

      <Card className="w-full max-w-md border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="pb-2 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 14a4 4 0 10-8 0v1a4 4 0 004 4m6-10h3m-3 0h-3M12 14a4 4 0 00-4 4" />
            </svg>
          </div>
          <CardTitle className="text-balance text-center text-2xl font-bold tracking-tight">
            {t.registerTitle}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {isUrdu ? "نیا اکاؤنٹ بنائیں اور آغاز کریں" : "Create a new account to get started"}
          </p>
        </CardHeader>

        <CardContent dir={isUrdu ? "rtl" : "ltr"} className={`pt-4 ${isUrdu ? "text-right" : ""}`}>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            {/* Email with OTP */}
            <div className="grid gap-2">
              <Label htmlFor="email">{t.email}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    id="email" 
                    type="email" 
                    autoComplete="email" 
                    {...register("email")}
                    className={emailExists ? "border-red-500 pr-10" : ""}
                    disabled={otpSent && otpVerified}
                  />
                  {checkingEmail && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  {emailExists && !checkingEmail && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  )}
                  {otpVerified && !emailExists && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || checkingEmail || emailExists || otpVerified || !watchedEmail}
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  {sendingOtp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : otpSent ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">{otpSent ? t.otpSent : t.sendOtp}</span>
                </Button>
              </div>
              {errors.email?.message && <FormError message={errors.email.message} />}
              {emailExists && !checkingEmail && (
                <div className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <Link href="/login" className="underline font-semibold hover:text-red-700">
                    {isUrdu ? "لاگ اِن کریں" : "Go to Login"}
                  </Link>
                </div>
              )}
            </div>

            {/* OTP Input Section */}
            <AnimatePresence>
              {otpSent && !otpVerified && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid gap-2 overflow-hidden"
                >
                  <Label htmlFor="otp">{t.enterOtp}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="otp"
                      type="text"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                    <Button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || otpCode.length !== 6}
                      className="whitespace-nowrap"
                    >
                      {verifyingOtp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">{t.verifyOtp}</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isUrdu ? "او ٹی پی کی میعاد 5 منٹ میں ختم ہو جائے گی" : "OTP expires in 5 minutes"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success Message */}
            <AnimatePresence>
              {otpVerified && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                    {t.emailVerified}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} disabled={!otpVerified} />
              <PasswordStrengthIndicator password={watchedPassword} />
              {errors.password?.message && <FormError message={errors.password.message} />}
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
              <Input id="confirmPassword" type="password" {...register("confirmPassword")} disabled={!otpVerified} />
              {errors.confirmPassword?.message && <FormError message={errors.confirmPassword.message} />}
            </div>

            {/* First Name */}
            <div className="grid gap-2">
              <Label htmlFor="first_name">{isUrdu ? "پہلا نام" : "First Name"}</Label>
              <Input id="first_name" type="text" {...register("first_name")} disabled={!otpVerified} />
              {errors.first_name?.message && <FormError message={errors.first_name.message} />}
            </div>

            {/* Last Name */}
            <div className="grid gap-2">
              <Label htmlFor="last_name">{isUrdu ? "آخری نام" : "Last Name"}</Label>
              <Input id="last_name" type="text" {...register("last_name")} disabled={!otpVerified} />
              {errors.last_name?.message && <FormError message={errors.last_name.message} />}
            </div>

            {/* City */}
            <div className="grid gap-2">
              <Label htmlFor="city">{isUrdu ? t.city : t.city}</Label>
              <Input id="city" type="text" {...register("city")} disabled={!otpVerified} />
              {errors.city?.message && <FormError message={errors.city.message} />}
            </div>

            {/* Nearest Major City */}
            <div className="grid gap-2">
              <Label htmlFor="nearest_major_city">{isUrdu ? t.nearestMajorCity : t.nearestMajorCity}</Label>
              <Input
                id="nearest_major_city"
                list="major-city-suggestions"
                placeholder={isUrdu ? t.selectNearestMajorCity : t.selectNearestMajorCity}
                {...register("nearest_major_city")}
                disabled={!otpVerified}
              />
              <datalist id="major-city-suggestions">
                {majorCitySuggestions.map((cityOption) => (
                  <option key={cityOption.value} value={cityOption.value}>
                    {isUrdu ? cityOption.labelUr : cityOption.value}
                  </option>
                ))}
              </datalist>
              {errors.nearest_major_city?.message && <FormError message={errors.nearest_major_city.message} />}
            </div>

            {/* Date of Birth */}
            <div className="grid gap-2">
              <Label htmlFor="dob">{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</Label>
              <Input id="dob" type="date" {...register("dob")} disabled={!otpVerified} />
              {errors.dob?.message && <FormError message={errors.dob.message} />}
            </div>

            {/* Gender */}
            <div className="grid gap-2">
              <Label htmlFor="gender">{isUrdu ? "صنف" : "Gender"}</Label>
              <select id="gender" {...register("gender")} className="h-11 rounded-lg border-muted bg-background/60" disabled={!otpVerified}>
                <option value="">{isUrdu ? "جنس منتخب کریں" : "Select gender"}</option>
                <option value="Male">{isUrdu ? "مرد" : "Male"}</option>
                <option value="Female">{isUrdu ? "عورت" : "Female"}</option>
                <option value="Other">{isUrdu ? "دیگر" : "Other"}</option>
              </select>
              {errors.gender?.message && <FormError message={errors.gender.message} />}
            </div>

            {/* Preferred Language */}
            <div className="grid gap-2">
              <Label htmlFor="preferred_language">{isUrdu ? "ترجیحی زبان" : "Preferred Language"}</Label>
              <select id="preferred_language" {...register("preferred_language")} className="h-11 rounded-lg border-muted bg-background/60" disabled={!otpVerified}>
                <option value="">{isUrdu ? "زبان منتخب کریں" : "Select language"}</option>
                <option value="en">{isUrdu ? "انگریزی" : "English"}</option>
                <option value="ur">{isUrdu ? "اردو" : "Urdu"}</option>
              </select>
              {errors.preferred_language?.message && <FormError message={errors.preferred_language.message} />}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !otpVerified}
              className="h-11 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isUrdu ? "رجسٹریشن ہو رہی ہے…" : "Registering…") : t.register}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <span>
              {t.toLogin} {t.or}{" "}
            </span>
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t.login}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
