"use client"

import { Check, X } from "lucide-react"
import { dict, useLanguage } from "@/lib/i18n"

interface PasswordStrengthIndicatorProps {
  password: string
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const lang = useLanguage()
  const t = dict[lang]

  // Password validation checks
  const hasValidLength = password.length >= 8 && password.length <= 16
  const hasNumbers = /[0-9]/.test(password)
  const hasLetters = /[a-zA-Z]/.test(password)
  const hasSpecialChars = /[^a-zA-Z0-9]/.test(password)

  const requirements = [
    {
      label: t.passwordLength,
      isValid: hasValidLength,
      progress: Math.min((password.length / 8) * 100, 100),
    },
    {
      label: t.passwordNumbers,
      isValid: hasNumbers,
      progress: hasNumbers ? 100 : 0,
    },
    {
      label: t.passwordLetters,
      isValid: hasLetters,
      progress: hasLetters ? 100 : 0,
    },
    {
      label: t.passwordSpecial,
      isValid: hasSpecialChars,
      progress: hasSpecialChars ? 100 : 0,
    },
  ]

  const validCount = requirements.filter(r => r.isValid).length
  const strengthPercentage = (validCount / requirements.length) * 100

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-muted bg-gradient-to-br from-muted/20 to-muted/40 p-4 shadow-sm">
      <div className="space-y-2">
        <div className="text-sm font-semibold text-foreground">
          Password Requirements
        </div>
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Password Strength</span>
              <span>{Math.round(strengthPercentage)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/30">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  strengthPercentage === 100 
                    ? 'bg-green-500' 
                    : strengthPercentage >= 75 
                    ? 'bg-yellow-500' 
                    : strengthPercentage >= 50 
                    ? 'bg-orange-500' 
                    : 'bg-red-500'
                }`}
                style={{ width: `${strengthPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-300 ${
              req.isValid 
                ? 'border-green-500 bg-green-50 shadow-sm' 
                : 'border-muted-foreground/30 bg-muted/50'
            }`}>
              {req.isValid ? (
                <Check className="h-3.5 w-3.5 text-green-600 animate-in fade-in-0 zoom-in-50 duration-200" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground/60" />
              )}
            </div>
            <div className="flex-1">
              <span className={`text-sm font-medium transition-colors duration-300 ${
                req.isValid 
                  ? "text-green-700 dark:text-green-400" 
                  : "text-muted-foreground"
              }`}>
                {req.label}
              </span>
              {req.label === t.passwordLength && password.length > 0 && (
                <div className="mt-1 h-1 w-full rounded-full bg-muted/30">
                  <div 
                    className={`h-1 rounded-full transition-all duration-500 ${
                      req.isValid ? 'bg-green-500' : 'bg-orange-400'
                    }`}
                    style={{ width: `${Math.min(req.progress, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {password.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {requirements.filter(r => r.isValid).length} of {requirements.length} requirements met
        </div>
      )}
    </div>
  )
}
