"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { AuthGuard } from "@/components/AuthGuard"
import { useAuth } from "@/context/AuthContext"
import { apiGetMe, apiUpdateMe } from "@/lib/api"
import { dict, useLanguage } from "@/lib/i18n"
import { FormError } from "@/components/FormError"
import { FormSuccess } from "@/components/FormSuccess"

const profileSchema = z.object({
  display_name: z
    .string()
    .min(2, "Display name must be 2-40 characters")
    .max(40, "Display name must be 2-40 characters"),
  preferred_language: z.enum(["en", "ur"], { required_error: "Select a language" }),
})

type ProfileValues = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const { token, setAuth } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const lang = useLanguage()
  const t = dict[lang]

  const fetcher = useMemo(() => (key: string) => apiGetMe(token as string), [token])

  const { data, isLoading, mutate } = useSWR(token ? "/v1/me" : null, fetcher)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
  })

  useEffect(() => {
    if (data) {
      reset({
        display_name: data.profile.display_name,
        preferred_language: data.profile.preferred_language as "en" | "ur",
      })
    }
  }, [data, reset])

  const onSubmit = async (values: ProfileValues) => {
    if (!token) return
    const updated = await apiUpdateMe(token, {
      display_name: values.display_name,
      preferred_language: values.preferred_language,
    })
    await mutate(updated, { revalidate: false })
    toast({ title: t.successSaved })
  }

  const logout = () => {
    setAuth({ token: null, user: null })
    router.push("/login")
  }

  const isUrdu = lang === "ur"

  return (
    <AuthGuard>
      <main className="flex w-full justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-balance text-center text-xl">Profile</CardTitle>
          </CardHeader>
          <CardContent dir={isUrdu ? "rtl" : "ltr"} className={isUrdu ? "text-right" : ""}>
            {isLoading && <FormSuccess message={lang === "ur" ? "لوڈ ہو رہا ہے…" : "Loading…"} />}
            {data && (
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="display_name">{t.displayName}</Label>
                  <Input id="display_name" {...register("display_name")} />
                  {errors.display_name?.message && <FormError message={errors.display_name.message} />}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="preferred_language">{t.preferredLanguage}</Label>
                  <Select
                    onValueChange={(v: "en" | "ur") => setValue("preferred_language", v, { shouldValidate: true })}
                  >
                    <SelectTrigger id="preferred_language">
                      <SelectValue placeholder={t.preferredLanguage} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ur">اردو</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.preferred_language?.message && <FormError message={errors.preferred_language.message} />}
                </div>

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (lang === "ur" ? "محفوظ کیا جا رہا ہے…" : "Saving…") : t.save}
                  </Button>
                  <Button type="button" variant="secondary" onClick={logout}>
                    {t.logout}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </AuthGuard>
  )
}
