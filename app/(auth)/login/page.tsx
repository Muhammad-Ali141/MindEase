"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { apiLogin } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { dict, useLanguage } from "@/lib/i18n"
import { FormError } from "@/components/FormError"

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { setAuth, token } = useAuth()
  const lang = useLanguage()
  const t = dict[lang]
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null) // <-- track login error

  const {
    handleSubmit,
    register,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  })

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    setLoginError(null) // clear previous error
    try {
      const res = await apiLogin(values)
      // Store user data with name information
      const userData = {
        id: res.user_id.toString(),
        email: res.email,
        first_name: res.first_name,
        last_name: res.last_name || "",
        gender: res.gender || "Other",
        city: res.city || "",
        nearest_major_city: res.nearest_major_city || "",
      }
      setAuth({ token: res.user_id.toString(), user: userData })
      toast({ title: "Login successful!" })
      router.push("/dashboard")
    } catch (e: any) {
      // Show error in red box
      setLoginError(lang === "ur" ? "ایمیل یا پاس ورڈ غلط ہیں" : "Invalid email or password")
      // Optionally, mark both fields as invalid
      setError("email", { type: "manual" })
      setError("password", { type: "manual" })
    } finally {
      setLoading(false)
    }
  }

  const isUrdu = lang === "ur"

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-indigo-200/50 to-transparent dark:from-indigo-900/30" />

      <Card className="w-full max-w-md border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="pb-2 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4" />
            </svg>
          </div>
          <CardTitle className="text-balance text-center text-2xl font-bold tracking-tight">
            {t.loginTitle}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {isUrdu ? "اپنے اکاؤنٹ تک محفوظ رسائی حاصل کریں" : "Access your account securely"}
          </p>
        </CardHeader>

        <CardContent dir={isUrdu ? "rtl" : "ltr"} className={`pt-4 ${isUrdu ? "text-right" : ""}`}>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            {/* Login error box */}
            {loginError && (
              <div className="rounded-md bg-red-100 border border-red-400 px-3 py-2 text-red-700 text-sm">
                {loginError}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email?.type === "manual" && <FormError message="" />} {/* red highlight */}
              {errors.email?.message && <FormError message={errors.email.message} />}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
              {errors.password?.type === "manual" && <FormError message="" />} {/* red highlight */}
              {errors.password?.message && <FormError message={errors.password.message} />}
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700">
              {loading ? (isUrdu ? "لاگ اِن ہو رہا ہے…" : "Logging in…") : t.login}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <span>{t.toLogin} {t.or} </span>
            <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">{t.toRegister}</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
