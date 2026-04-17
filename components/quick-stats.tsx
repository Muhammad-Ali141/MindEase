"use client"

import { TrendingUp, Calendar, Award, TrendingDown, Minus, Info, Flame } from "lucide-react"
import { useDashboardData } from "@/context/DashboardDataContext"
import { type MoodTrendData } from "@/lib/api"
import { useProfileDict, useProfileLanguage } from "@/lib/i18n"

const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }
const sans  = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }

export function QuickStats() {
  const t = useProfileDict()
  const lang = useProfileLanguage()
  const isUr = lang === "ur"
  const urNum = (n: number | string) =>
    isUr ? String(n).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[+c]) : String(n)
  const { loading, sessionCount, moodTrend, streak } = useDashboardData()

  // ── Mood chart ──────────────────────────────────────────────────────────────
  const MoodChart = ({ data }: { data: MoodTrendData[] }) => {
    if (data.length === 0) {
      return (
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{t.noDataYet}</p>
        </div>
      )
    }

    const display = data.slice(-7)
    const max = Math.max(...display.map(d => d.score), 1)
    const min = Math.min(...display.map(d => d.score), 0)
    const range = max - min || 1
    const W = 280, H = 68, P = 10, cW = W - P * 2, cH = H - P * 2

    const pts = display.map((item, i) => ({
      x: P + (i / (display.length - 1 || 1)) * cW,
      y: P + cH - ((item.score - min) / range) * cH,
      ...item,
    }))

    // Smooth cubic bezier path
    const linePath = pts.length > 1
      ? pts.map((p, i) => {
          if (i === 0) return `M ${p.x} ${p.y}`
          const prev = pts[i - 1]
          const cpx = (prev.x + p.x) / 2
          return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
        }).join(" ")
      : ""

    const areaPath = linePath && pts.length > 1
      ? `${linePath} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`
      : ""

    const trend = data.length >= 2
      ? data[data.length - 1].score < data[data.length - 2].score ? "improved"
        : data[data.length - 1].score > data[data.length - 2].score ? "worsened"
        : "stable"
      : "insufficient_data"

    const singleSeverity = display.length === 1 ? display[0].severity : null
    const lineColor = trend === "improved" ? "#5D8A6B" : trend === "worsened" ? "#b54a35" : "#a67c52"

    return (
      <div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map(v => (
            <line key={v}
              x1={P} y1={P + cH - v * cH} x2={W - P} y2={P + cH - v * cH}
              stroke="var(--border)" strokeWidth="0.75" opacity="0.5"
            />
          ))}
          {areaPath && (
            <path d={areaPath} fill="url(#areaGrad)" />
          )}
          {linePath && (
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {pts.map((p, i) => {
            const dotColor = p.trend === "improved" ? "#5D8A6B" : p.trend === "worsened" ? "#b54a35" : "#a67c52"
            return (
              <circle key={i} cx={p.x} cy={p.y} r="3.5"
                fill={dotColor} stroke="var(--card)" strokeWidth="1.5"
              />
            )
          })}
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.5rem" }}>
          {trend === "improved"  && <><TrendingUp  size={11} color="#5D8A6B" /><span style={{ ...sans, fontSize: "0.6875rem", color: "#5D8A6B", fontWeight: 600 }}>{t.improving}</span></>}
          {trend === "worsened"  && <><TrendingDown size={11} color="#b54a35" /><span style={{ ...sans, fontSize: "0.6875rem", color: "#b54a35", fontWeight: 600 }}>{t.declining}</span></>}
          {trend === "stable"    && <><Minus        size={11} color="var(--muted-foreground)" /><span style={{ ...sans, fontSize: "0.6875rem", color: "var(--muted-foreground)", fontWeight: 600 }}>{t.stable}</span></>}
          {trend === "insufficient_data" && singleSeverity && (
            <><Info size={11} color="var(--primary)" /><span style={{ ...sans, fontSize: "0.6875rem", color: "var(--primary)", fontWeight: 600 }}>{singleSeverity.charAt(0).toUpperCase() + singleSeverity.slice(1)}</span></>
          )}
        </div>
      </div>
    )
  }

  // ── Card shell ───────────────────────────────────────────────────────────────
  const Card = ({ tourTarget, children }: { tourTarget: string; children: React.ReactNode }) => (
    <div
      data-tour-target={tourTarget}
      style={{
        backgroundColor: "var(--card)",
        borderRadius: 16, padding: "1.25rem 1.375rem",
        border: "1px solid var(--border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  )

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p style={{ ...sans, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: "0.75rem" }}>
      {children}
    </p>
  )

  const BigNum = ({ n }: { n: number | null }) => (
    <span style={{ ...serif, fontSize: "2.75rem", fontWeight: 400, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1 }}>
      {loading ? "–" : urNum(n ?? 0)}
    </span>
  )

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.125rem" }}>

      {/* Sessions */}
      <Card tourTarget="sessions-completed">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <Label>{t.sessionsCount}</Label>
          <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calendar size={14} color="var(--primary)" />
          </div>
        </div>
        <BigNum n={sessionCount} />
        <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.375rem" }}>
          {loading ? "" : sessionCount && sessionCount > 0
            ? sessionCount === 1 ? t.sessionCompleted : `${urNum(sessionCount)} ${t.sessionsCompleted}`
            : t.startFirstSession}
        </p>
      </Card>

      {/* Mood trend */}
      <Card tourTarget="mood-trend">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <Label>{t.moodTrend}</Label>
          <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: "color-mix(in srgb, var(--sage) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={14} color="var(--sage)" />
          </div>
        </div>
        {loading
          ? <div style={{ height: 64, display: "flex", alignItems: "center" }}><p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{t.loading}</p></div>
          : <MoodChart data={moodTrend} />
        }
        {!loading && (
          <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
            {moodTrend.length > 0
              ? moodTrend.length === 1 ? t.assessmentTrackedOne : `${urNum(moodTrend.length)} ${t.assessmentsTracked}`
              : t.completeScreeningToStart}
          </p>
        )}
      </Card>

      {/* Streak */}
      <Card tourTarget="current-streak">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <Label>{t.streak}</Label>
          <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Flame size={14} color="#f59e0b" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
          <BigNum n={streak?.current ?? null} />
          {!loading && streak && streak.current > 0 && (
            <span style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
              {streak.current === 1 ? t.day : t.days}
            </span>
          )}
        </div>
        <p style={{ ...sans, fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.375rem" }}>
          {loading ? ""
            : streak && streak.current > 0 ? `${urNum(streak.current)} ${streak.current === 1 ? t.day : t.days} ${t.inARow}`
            : streak && streak.longest > 0 ? `${t.bestStreak}: ${urNum(streak.longest)} ${streak.longest === 1 ? t.day : t.days}`
            : t.startDailyCheckin}
        </p>
      </Card>

    </div>
  )
}
