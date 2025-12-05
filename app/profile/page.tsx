"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AuthGuard } from "@/components/AuthGuard"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useAuth } from "@/context/AuthContext"
import { apiGetUserProfile, apiUpdateUserProfile } from "@/lib/api"
import { ArrowLeft, Loader2, User, Mail, Calendar, Languages, Lock, Edit2, Save, X, MapPin } from "lucide-react"

const majorCitySuggestions = ["Islamabad", "Lahore", "Karachi", "Multan", "Peshawar", "Faisalabad"]

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100, "First name must be less than 100 characters"),
  last_name: z.string().max(100, "Last name must be less than 100 characters").optional().or(z.literal("")),
  email: z.string().email("Invalid email address"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Please select a gender" }),
  lang_pref: z.enum(["en", "ur"], { required_error: "Please select a language" }),
  city: z.string().min(1, "City is required").max(100, "City must be less than 100 characters"),
  nearest_major_city: z.string().min(1, "Nearest major city is required").max(100, "Nearest major city must be less than 100 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
  confirm_password: z.string().optional(),
}).refine((data) => {
  // If password is provided, confirm_password must match
  if (data.password && data.password.length > 0) {
    return data.password === data.confirm_password
  }
  return true
}, {
  message: "Passwords do not match",
  path: ["confirm_password"],
})

type ProfileValues = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const router = useRouter()
  const { user, token, setAuth } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<any>(null)
  const [editingField, setEditingField] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
  })

  const password = watch("password")

  useEffect(() => {
    if (user?.id && token) {
      loadProfile()
    }
  }, [user?.id, token])

  const loadProfile = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      const data = await apiGetUserProfile(user.id)
      setProfileData(data)
      
      // Format date for input (YYYY-MM-DD)
      const dobFormatted = data.dob ? data.dob.split('T')[0] : ''
      
      reset({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        dob: dobFormatted,
        gender: (data.gender as "Male" | "Female" | "Other") || "Other",
        lang_pref: (data.lang_pref as "en" | "ur") || "en",
        city: data.city || "",
        nearest_major_city: data.nearest_major_city || "",
        password: "",
        confirm_password: "",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load profile",
        variant: "destructive",
      })
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
        email: values.email,
        dob: values.dob,
        gender: values.gender,
        lang_pref: values.lang_pref,
        city: values.city,
        nearest_major_city: values.nearest_major_city,
      }
      
      // Only include password if it was provided
      if (values.password && values.password.length > 0) {
        updateData.password = values.password
      }
      
      const updated = await apiUpdateUserProfile(user.id, updateData)
      
      // Update auth context with new user data
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
      
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      })
      
      // Clear password fields and reset editing
      setValue("password", "")
      setValue("confirm_password", "")
      setEditingField(null)
      
      // Reload profile to get updated data
      await loadProfile()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="fixed inset-0 flex h-screen w-screen bg-gray-50 dark:bg-slate-900 z-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  const ProfileField = ({ 
    label, 
    value, 
    fieldName, 
    icon: Icon, 
    children 
  }: { 
    label: string
    value: string
    fieldName: string
    icon: any
    children: React.ReactNode
  }) => {
    const isEditing = editingField === fieldName
    
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg transition group">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                {label}
              </Label>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => setEditingField(fieldName)}
              className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition opacity-0 group-hover:opacity-100"
            >
              <Edit2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-3 mt-4">
            {children}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingField(null)
                  loadProfile()
                }}
                disabled={isSubmitting}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-lg text-gray-900 dark:text-white font-semibold mt-2">
            {value || <span className="text-gray-400 dark:text-gray-500 italic font-normal">Not set</span>}
          </p>
        )}
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="fixed inset-0 flex h-screen w-screen bg-gray-50 dark:bg-slate-900 z-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-5xl mx-auto">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="ghost"
                className="mb-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>

              {/* Profile Header */}
              <div className="bg-gradient-to-br from-purple-500 via-blue-500 to-pink-500 rounded-2xl p-8 mb-6 text-white shadow-xl">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center">
                    <User className="h-12 w-12 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold mb-2">
                      {profileData?.first_name || "User"} {profileData?.last_name || ""}
                    </h1>
                    <p className="text-white/90 text-lg">{profileData?.email || ""}</p>
                    <p className="text-white/70 text-sm mt-1">
                      Member since {profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <ProfileField
                      label="City"
                      value={watch("city") || ""}
                      fieldName="city"
                      icon={MapPin}
                    >
                      <Input
                        {...register("city")}
                        className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                        placeholder="Enter your city"
                        autoFocus
                      />
                      {errors.city && (
                        <p className="text-sm text-red-500">{errors.city.message}</p>
                      )}
                    </ProfileField>

                    <ProfileField
                      label="Nearest Major City"
                      value={watch("nearest_major_city") || ""}
                      fieldName="nearest_major_city"
                      icon={MapPin}
                    >
                      <Input
                        list="profile-major-city-suggestions"
                        {...register("nearest_major_city")}
                        className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                        placeholder="Enter nearest major city"
                        autoFocus
                      />
                      <datalist id="profile-major-city-suggestions">
                        {majorCitySuggestions.map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                      {errors.nearest_major_city && (
                        <p className="text-sm text-red-500">{errors.nearest_major_city.message}</p>
                      )}
                    </ProfileField>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Personal Information
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <ProfileField
                      label="First Name"
                      value={watch("first_name") || ""}
                      fieldName="first_name"
                      icon={User}
                    >
                      <Input
                        {...register("first_name")}
                        className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                        placeholder="Enter your first name"
                        autoFocus
                      />
                      {errors.first_name && (
                        <p className="text-sm text-red-500">{errors.first_name.message}</p>
                      )}
                    </ProfileField>

                    <ProfileField
                      label="Last Name"
                      value={watch("last_name") || ""}
                      fieldName="last_name"
                      icon={User}
                    >
                      <Input
                        {...register("last_name")}
                        className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                        placeholder="Enter your last name"
                      />
                      {errors.last_name && (
                        <p className="text-sm text-red-500">{errors.last_name.message}</p>
                      )}
                    </ProfileField>
                  </div>

                  <ProfileField
                    label="Email Address"
                    value={watch("email") || ""}
                    fieldName="email"
                    icon={Mail}
                  >
                    <Input
                      type="email"
                      {...register("email")}
                      className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                      placeholder="your.email@example.com"
                      autoFocus
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </ProfileField>

                  <div className="grid grid-cols-2 gap-4">
                    <ProfileField
                      label="Date of Birth"
                      value={watch("dob") ? new Date(watch("dob") + "T00:00:00").toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ""}
                      fieldName="dob"
                      icon={Calendar}
                    >
                      <Input
                        type="date"
                        {...register("dob")}
                        className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                        autoFocus
                      />
                      {errors.dob && (
                        <p className="text-sm text-red-500">{errors.dob.message}</p>
                      )}
                    </ProfileField>

                    <ProfileField
                      label="Gender"
                      value={watch("gender") || ""}
                      fieldName="gender"
                      icon={User}
                    >
                      <Select
                        onValueChange={(value: "Male" | "Female" | "Other") => 
                          setValue("gender", value, { shouldValidate: true })
                        }
                        defaultValue={watch("gender") || "Other"}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.gender && (
                        <p className="text-sm text-red-500">{errors.gender.message}</p>
                      )}
                    </ProfileField>
                  </div>
                </div>

                {/* Preferences */}
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Preferences
                  </h2>
                  
                  <ProfileField
                    label="Preferred Language"
                    value={watch("lang_pref") === "en" ? "English" : watch("lang_pref") === "ur" ? "اردو (Urdu)" : ""}
                    fieldName="lang_pref"
                    icon={Languages}
                  >
                    <Select
                      onValueChange={(value: "en" | "ur") => 
                        setValue("lang_pref", value, { shouldValidate: true })
                      }
                      defaultValue={watch("lang_pref") || "en"}
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ur">اردو (Urdu)</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.lang_pref && (
                      <p className="text-sm text-red-500">{errors.lang_pref.message}</p>
                    )}
                  </ProfileField>
                </div>

                {/* Security */}
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Security
                  </h2>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <Lock className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Change Password
                        </Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Leave blank if you don't want to change your password
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Input
                          type="password"
                          {...register("password")}
                          className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                          placeholder="New password (min 8 characters)"
                        />
                        {errors.password && (
                          <p className="text-sm text-red-500">{errors.password.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Input
                          type="password"
                          {...register("confirm_password")}
                          className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                          placeholder="Confirm new password"
                          disabled={!password || password.length === 0}
                        />
                        {errors.confirm_password && (
                          <p className="text-sm text-red-500">{errors.confirm_password.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashboard")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save All Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
