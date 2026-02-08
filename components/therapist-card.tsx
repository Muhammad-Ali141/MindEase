"use client"

import { MapPin, Globe, ExternalLink } from "lucide-react"
import type { TherapistListItem } from "@/lib/api"

type TherapistCardProps = {
  therapist: TherapistListItem
  match?: "exact_city" | "nearest_region" | "other"
  compact?: boolean
}

export function TherapistCard({ therapist: t, match, compact = false }: TherapistCardProps) {
  const profileUrl = t.website || t.profile_url
  const isNear = match && match !== "other"

  if (compact) {
    return (
      <div className="group rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800/50 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{t.name}</h3>
              {isNear && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0">
                  <MapPin size={10} />
                  Near you
                </span>
              )}
            </div>
            {t.credentials && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{t.credentials}</p>
            )}
            {(t.city || t.region) && (
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1">
                <MapPin size={12} className="shrink-0 text-gray-400" />
                <span className="truncate">{[t.city, t.region].filter(Boolean).join(", ")}</span>
              </p>
            )}
          </div>
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <Globe size={14} />
              <span className="hidden sm:inline">Profile</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <article className="group rounded-2xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 overflow-hidden shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800/50 transition-all">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.name}</h2>
              {isNear && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <MapPin size={12} />
                  In your area
                </span>
              )}
            </div>
            {t.credentials && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t.credentials}</p>
            )}
            {t.specialty && (
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-2 line-clamp-2">{t.specialty}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {(t.city || t.region) && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                  <MapPin size={12} />
                  {[t.city, t.region].filter(Boolean).join(", ")}
                </span>
              )}
              {t.languages && t.languages.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/80 px-2.5 py-1 rounded-lg">
                  {t.languages.slice(0, 3).join(" · ")}
                  {t.languages.length > 3 ? " …" : ""}
                </span>
              )}
              {t.service_type && t.service_type.length > 0 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg">
                  {t.service_type.join(" & ")}
                </span>
              )}
            </div>
            {t.address && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-1">{t.address}</p>
            )}
          </div>
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 transition"
            >
              <Globe size={16} />
              View profile
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
