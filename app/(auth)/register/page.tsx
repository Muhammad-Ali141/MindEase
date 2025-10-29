"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { apiRegister } from "@/lib/api"
import { dict, useLanguage } from "@/lib/i18n"
import { FormError } from "@/components/FormError"
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator"

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
      // 🟢 Added fields
      first_name: z.string().min(1, "First name is required"),
      last_name: z.string().min(1, "Last name is required"),
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

  const schema = createSchema(t)
  type FormValues = z.infer<typeof schema>

  const {
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  })

  const watchedPassword = watch("password", "")

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    console.log("Submitting registration with values:", values); // 🔹 debug log
    try {
      const response = await apiRegister(values);
      console.log("User registered:", response); // 🔹 debug log
      toast({ title: "Account created successfully!" });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Registration error:", error); // 🔹 debug log
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isUrdu = lang === "ur"

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
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email?.message && <FormError message={errors.email.message} />}
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
              <PasswordStrengthIndicator password={watchedPassword} />
              {errors.password?.message && <FormError message={errors.password.message} />}
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
              <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
              {errors.confirmPassword?.message && <FormError message={errors.confirmPassword.message} />}
            </div>

            {/* 🟢 First Name */}
            <div className="grid gap-2">
              <Label htmlFor="first_name">{isUrdu ? "پہلا نام" : "First Name"}</Label>
              <Input id="first_name" type="text" {...register("first_name")} />
              {errors.first_name?.message && <FormError message={errors.first_name.message} />}
            </div>

            {/* 🟢 Last Name */}
            <div className="grid gap-2">
              <Label htmlFor="last_name">{isUrdu ? "آخری نام" : "Last Name"}</Label>
              <Input id="last_name" type="text" {...register("last_name")} />
              {errors.last_name?.message && <FormError message={errors.last_name.message} />}
            </div>

            {/* Date of Birth */}
            <div className="grid gap-2">
              <Label htmlFor="dob">{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</Label>
              <Input id="dob" type="date" {...register("dob")} />
              {errors.dob?.message && <FormError message={errors.dob.message} />}
            </div>

            {/* Gender */}
            <div className="grid gap-2">
              <Label htmlFor="gender">{isUrdu ? "صنف" : "Gender"}</Label>
              <select id="gender" {...register("gender")} className="h-11 rounded-lg border-muted bg-background/60">
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
              <select id="preferred_language" {...register("preferred_language")} className="h-11 rounded-lg border-muted bg-background/60">
                <option value="">{isUrdu ? "زبان منتخب کریں" : "Select language"}</option>
                <option value="en">{isUrdu ? "انگریزی" : "English"}</option>
                <option value="ur">{isUrdu ? "اردو" : "Urdu"}</option>
              </select>
              {errors.preferred_language?.message && <FormError message={errors.preferred_language.message} />}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700"
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
