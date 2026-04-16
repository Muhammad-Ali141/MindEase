import type { jsPDF } from "jspdf"

import {
  apiGetSessionById,
  type Session,
  type SessionPreview,
  type StoredChatMessage,
} from "./api"

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function minimalSessionFromPreview(p: SessionPreview): Session {
  return {
    session_id: p.session_id,
    title: p.title,
    messages: [],
    summary: p.summary || "",
    short_summary: p.short_summary || "",
    resume_message: p.resume_message,
    state: p.state,
    is_starred: p.is_starred,
    has_full_transcript: p.has_full_transcript,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

function speakerLabel(role: StoredChatMessage["role"], isUrdu = false): string {
  if (role === "user") return isUrdu ? "Aap" : "You"
  if (role === "assistant") return isUrdu ? "Therapist" : "Therapist"
  return role || "System"
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function formatTimestamp(iso: string | undefined | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  // Local time, 12-hour with AM/PM
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}, ${hours}:${minutes} ${ampm}`
}

// ── Urdu session detection ──────────────────────────────────────────────────
// We detect Urdu (Roman Urdu) sessions by checking the summary/title for known
// Roman Urdu reflection headings.
const URDU_REFLECTION_HEADINGS = [
  "Aaj Hum Ne Kya Baat Ki",
  "Aap Kaisa Mehsoos Kar Rahe The",
  "Kya Samne Aaya",
  "Hum Ne Mil Kar Kya Socha",
  "Aap Ka Radd-e-amal",
  "Aagay Ka Raasta",
]

const EN_REFLECTION_HEADINGS = [
  "What We Talked About",
  "How You Were Feeling",
  "What Came Up",
  "What We Explored Together",
  "How You Responded",
  "Looking Ahead",
]

/** All headings that should be rendered bold in the reflection block. */
const ALL_REFLECTION_HEADINGS = [...EN_REFLECTION_HEADINGS, ...URDU_REFLECTION_HEADINGS]

function isUrduSession(session: Session): boolean {
  const text = `${session.title || ""} ${session.summary || ""} ${session.short_summary || ""}`
  return URDU_REFLECTION_HEADINGS.some(h => text.includes(h))
}

// ── Roman Urdu label maps for PDF ───────────────────────────────────────────
type LabelSet = {
  sessionReport: string
  reportOverview: string
  account: string
  generated: string
  sessionsIncluded: string
  disclaimer: string
  session: string
  of: string
  voiceChat: string
  textChat: string
  starred: string
  fullTranscript: string
  summaryOnly: string
  created: string
  lastUpdate: string
  reflection: string
  pickUpNote: string
  transcript: string
  noReflection: string
  transcriptNotAvailable: string
  noMessages: string
  voiceNote: string
  endOfReport: string
  transcriptNotIncluded: string
}

const LABELS_EN: LabelSet = {
  sessionReport: "Session Report",
  reportOverview: "Report Overview",
  account: "Account",
  generated: "Generated",
  sessionsIncluded: "Sessions included",
  disclaimer: "This report was exported by the account holder from MindEase. It contains AI-generated reflections and chat or voice session text. This is NOT a medical, clinical, or diagnostic report. It does not constitute a professional mental health assessment, diagnosis, or treatment recommendation. The content should not be used as a substitute for professional medical advice. If shared with a clinician, it should be treated as supplementary self-reported information only.",
  session: "SESSION",
  of: "OF",
  voiceChat: "Voice chat",
  textChat: "Text chat",
  starred: "Starred",
  fullTranscript: "Full transcript",
  summaryOnly: "Summary only",
  created: "Created",
  lastUpdate: "Last update",
  reflection: "Reflection",
  pickUpNote: "Pick-up Note",
  transcript: "Transcript",
  noReflection: "No reflection available for this session.",
  transcriptNotAvailable: "Only a summary is stored for this session; line-by-line transcript is not available.",
  noMessages: "No message rows returned for this session.",
  voiceNote: "Voice session — lines may be speech transcripts or captions.",
  endOfReport: "END OF REPORT",
  transcriptNotIncluded: "Transcript was not included in this export.",
}

const LABELS_UR: LabelSet = {
  sessionReport: "Session Report",
  reportOverview: "Report Ka Khulasa",
  account: "Account",
  generated: "Tayyar Kiya Gaya",
  sessionsIncluded: "Sessions shamil hain",
  disclaimer: "Yeh report MindEase se account holder ne export ki hai. Is mein AI ki madad se tayyar ki gayi sochein aur chat ya voice session ka text shamil hai. Yeh koi medical, clinical, ya diagnostic report NAHI hai. Yeh kisi professional mental health assessment, diagnosis, ya treatment ki sifarish nahi hai. Is report ko professional medical mashwere ki jagah istemal na karein. Agar kisi clinician ko dikhaein, to yeh sirf izafi khud-bayaan ki gayi maloomat samjhi jaaye.",
  session: "SESSION",
  of: "MEIN SE",
  voiceChat: "Voice chat",
  textChat: "Text chat",
  starred: "Starred",
  fullTranscript: "Mukammal transcript",
  summaryOnly: "Sirf khulasa",
  created: "Shuru kiya",
  lastUpdate: "Aakhri tabdeeli",
  reflection: "Sochein",
  pickUpNote: "Aagay Ki Baat",
  transcript: "Guftagu",
  noReflection: "Is session ke liye koi soch dastiyaab nahi.",
  transcriptNotAvailable: "Is session ka sirf khulasa mahfooz hai; mukammal guftagu dastiyaab nahi.",
  noMessages: "Is session ke liye koi paighaam nahi mila.",
  voiceNote: "Voice session — lines transcripts ya captions ho sakti hain.",
  endOfReport: "REPORT KHATAM",
  transcriptNotIncluded: "Guftagu is export mein shamil nahi ki gayi.",
}

function labelsFor(isUrdu: boolean) {
  return isUrdu ? LABELS_UR : LABELS_EN
}

// ── Logo loader (converts public/logo.png to a data URL for jsPDF) ──────────
let _logoDataUrl: string | null = null

async function loadLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl
  try {
    const res = await fetch("/logo.png")
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        _logoDataUrl = reader.result as string
        resolve(_logoDataUrl)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Plain-text report (human-friendly, for sharing with a clinician)
// ──────────────────────────────────────────────────────────────────────────────

function formatOneMessage(m: StoredChatMessage, index: number, isUrdu = false): string {
  const role = speakerLabel(m.role, isUrdu)
  const raw = (m.content ?? "").trim()
  const content = raw || "(no text in this turn)"
  let block = `${String(index + 1).padStart(2, " ")}. ${role}:\n    ${content.replace(/\n/g, "\n    ")}`
  if (m.emotion_label) {
    block += `\n    [Detected emotion: ${m.emotion_label}]`
  }
  if (m.content_type && m.content_type !== "text") {
    block += `\n    [Content type: ${m.content_type}]`
  }
  return block
}

export function buildSessionsExportText(
  sessionsInOrder: Session[],
  previewsById: Map<string, SessionPreview>,
  displayName?: string | null,
  includeTranscript = true
): string {
  const RULE = "=".repeat(78)
  const THIN = "-".repeat(78)
  const lines: string[] = []

  lines.push(RULE)
  lines.push("  MINDEASE  —  SESSION REPORT")
  lines.push("  A personal record of your therapy conversations.")
  lines.push(RULE)
  lines.push("")
  lines.push(`  Generated : ${formatTimestamp(new Date().toISOString())}`)
  if (displayName?.trim()) lines.push(`  Account   : ${displayName.trim()}`)
  lines.push(`  Sessions  : ${sessionsInOrder.length}`)
  lines.push("")
  lines.push("  DISCLAIMER: This report was exported by the account holder from MindEase.")
  lines.push("  It contains AI-generated reflections and chat or voice session text. This")
  lines.push("  is NOT a medical, clinical, or diagnostic report. It does not constitute a")
  lines.push("  professional mental health assessment, diagnosis, or treatment recommendation.")
  lines.push("  The content should not be used as a substitute for professional medical advice.")
  lines.push("  If shared with a clinician, it should be treated as supplementary self-reported")
  lines.push("  information only.")
  lines.push("")

  sessionsInOrder.forEach((session, si) => {
    const prev = previewsById.get(session.session_id)
    const hasVoice = Boolean(prev?.has_voice)
    lines.push(RULE)
    lines.push(`  SESSION ${si + 1} OF ${sessionsInOrder.length}  |  ${session.title || "Untitled"}`)
    lines.push(RULE)
    lines.push(`  Type        : ${hasVoice ? "Voice" : "Text"} chat`)
    lines.push(`  Created     : ${formatTimestamp(session.created_at)}`)
    lines.push(`  Last update : ${formatTimestamp(session.updated_at)}`)
    lines.push(`  Starred     : ${session.is_starred ? "Yes" : "No"}`)
    lines.push(`  Transcript  : ${session.has_full_transcript ? "Full transcript on file" : "Summary only"}`)
    lines.push("")

    const summary = (session.summary || session.short_summary || "").trim()
    lines.push(THIN)
    lines.push("  REFLECTION")
    lines.push(THIN)
    if (summary) {
      summary.split(/\n/).forEach(l => lines.push("  " + l))
    } else {
      lines.push("  (No reflection available for this session.)")
    }
    lines.push("")

    if (session.resume_message?.trim()) {
      lines.push(THIN)
      lines.push("  PICK-UP NOTE")
      lines.push(THIN)
      session.resume_message
        .trim()
        .split(/\n/)
        .forEach(l => lines.push("  " + l))
      lines.push("")
    }

    if (!includeTranscript) {
      lines.push(THIN)
      lines.push("  TRANSCRIPT")
      lines.push(THIN)
      lines.push("  (Transcript was not included in this export.)")
      lines.push("")
    } else {
      lines.push(THIN)
      lines.push("  TRANSCRIPT")
      lines.push(THIN)
      if (!session.has_full_transcript) {
        lines.push("  (Only a summary is stored for this session; line-by-line transcript")
        lines.push("  is not available.)")
      } else if (!session.messages?.length) {
        lines.push("  (No message rows returned for this session.)")
      } else {
        const urdu = isUrduSession(session)
        if (hasVoice) {
          lines.push("  (Voice session: lines may be speech transcripts or captions.)")
          lines.push("")
        }
        session.messages.forEach((m, i) => {
          lines.push(formatOneMessage(m, i, urdu))
          lines.push("")
        })
      }
      lines.push("")
    }
  })

  lines.push(RULE)
  lines.push("  END OF REPORT")
  lines.push(RULE)
  lines.push("")
  return lines.join("\n")
}

// ──────────────────────────────────────────────────────────────────────────────
// CSV report (spreadsheet-friendly, RFC 4180, UTF-8 BOM for Excel)
// ──────────────────────────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  if (value == null) return ""
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(",")
}

const CSV_COLUMNS = [
  "Session #",
  "Session ID",
  "Title",
  "Session Type",
  "Starred",
  "Created",
  "Last Update",
  "Transcript Available",
  "Reflection",
  "Pick-up Note",
  "Turn #",
  "Speaker",
  "Content Type",
  "Detected Emotion",
  "Message",
] as const

export function buildSessionsExportCsv(
  sessionsInOrder: Session[],
  previewsById: Map<string, SessionPreview>,
  displayName?: string | null,
  includeTranscript = true
): string {
  const lines: string[] = []

  // Metadata header block (human-readable; parsers can skip until blank row)
  lines.push(csvRow(["MindEase Session Report"]))
  lines.push(csvRow(["Generated", formatTimestamp(new Date().toISOString())]))
  if (displayName?.trim()) lines.push(csvRow(["Account", displayName.trim()]))
  lines.push(csvRow(["Sessions included", sessionsInOrder.length]))
  lines.push(csvRow([
    "Disclaimer",
    "Exported by the account holder. Contains AI-generated reflections and chat/voice text. This is NOT a medical, clinical, or diagnostic report and should not substitute professional advice.",
  ]))
  lines.push("") // blank row separating metadata from tabular data

  // Column header row
  lines.push(csvRow([...CSV_COLUMNS]))

  sessionsInOrder.forEach((session, si) => {
    const prev = previewsById.get(session.session_id)
    const hasVoice = Boolean(prev?.has_voice)
    const sessionFields = [
      si + 1,
      session.session_id,
      session.title || "Untitled",
      hasVoice ? "Voice" : "Text",
      session.is_starred ? "Yes" : "No",
      formatTimestamp(session.created_at),
      formatTimestamp(session.updated_at),
      session.has_full_transcript ? "Yes" : "No",
      (session.summary || session.short_summary || "").trim(),
      (session.resume_message || "").trim(),
    ]

    if (!includeTranscript) {
      lines.push(
        csvRow([
          ...sessionFields,
          "", "", "", "",
          "(Transcript not included in this export.)",
        ])
      )
      return
    }

    const messages = session.has_full_transcript ? session.messages || [] : []

    if (messages.length === 0) {
      lines.push(
        csvRow([
          ...sessionFields,
          "", "", "", "",
          session.has_full_transcript
            ? "(No messages on file for this session.)"
            : "(Summary only; transcript not retained.)",
        ])
      )
    } else {
      messages.forEach((m, i) => {
        lines.push(
          csvRow([
            ...sessionFields,
            i + 1,
            speakerLabel(m.role),
            m.content_type || "text",
            m.emotion_label || "",
            (m.content ?? "").trim(),
          ])
        )
      })
    }
  })

  // UTF-8 BOM so Excel opens the file with correct encoding.
  return "\uFEFF" + lines.join("\r\n") + "\r\n"
}

// ──────────────────────────────────────────────────────────────────────────────
// PDF report (styled, paginated, spreadsheet-free)
// ──────────────────────────────────────────────────────────────────────────────

// Brand + layout constants
const PDF_PAGE_W = 210 // A4 mm
const PDF_PAGE_H = 297
const PDF_MARGIN_X = 18
const PDF_MARGIN_TOP = 20
const PDF_MARGIN_BOTTOM = 18
const PDF_CONTENT_W = PDF_PAGE_W - PDF_MARGIN_X * 2

// Clay primary + sage secondary, matching the app palette.
const COLOR_PRIMARY: [number, number, number] = [166, 124, 82]
const COLOR_SAGE: [number, number, number] = [93, 138, 107]
const COLOR_INK: [number, number, number] = [36, 32, 28]
const COLOR_MUTED: [number, number, number] = [120, 114, 107]
const COLOR_SOFT_BG: [number, number, number] = [247, 243, 238]
const COLOR_DIVIDER: [number, number, number] = [218, 208, 196]

type PdfState = {
  doc: jsPDF
  y: number
  pageNumber: number
  footerLabel: string
}

async function newPdf(footerLabel: string): Promise<PdfState> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true })
  return { doc, y: PDF_MARGIN_TOP, pageNumber: 1, footerLabel }
}

/** Splits reflection text into segments, marking known headings for bold rendering. */
function parseReflectionSegments(text: string): Array<{ text: string; bold: boolean }> {
  const segments: Array<{ text: string; bold: boolean }> = []
  // Build a regex that matches any known heading (case-insensitive, with optional trailing colon)
  const escaped = ALL_REFLECTION_HEADINGS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const headingRe = new RegExp(`(${escaped.join("|")})\\s*:?`, "gi")
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = headingRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ text: text.slice(lastIdx, match.index), bold: false })
    }
    segments.push({ text: match[0], bold: true })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx), bold: false })
  }
  if (segments.length === 0) {
    segments.push({ text, bold: false })
  }
  return segments
}

function drawFooter(state: PdfState) {
  const { doc, pageNumber, footerLabel } = state
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(footerLabel, PDF_MARGIN_X, PDF_PAGE_H - 9)
  doc.text(
    `Page ${pageNumber}`,
    PDF_PAGE_W - PDF_MARGIN_X,
    PDF_PAGE_H - 9,
    { align: "right" }
  )
  doc.setDrawColor(...COLOR_DIVIDER)
  doc.setLineWidth(0.2)
  doc.line(PDF_MARGIN_X, PDF_PAGE_H - 12, PDF_PAGE_W - PDF_MARGIN_X, PDF_PAGE_H - 12)
}

function ensureSpace(state: PdfState, needed: number) {
  if (state.y + needed > PDF_PAGE_H - PDF_MARGIN_BOTTOM) {
    drawFooter(state)
    state.doc.addPage()
    state.pageNumber += 1
    state.y = PDF_MARGIN_TOP
  }
}

function drawTextBlock(
  state: PdfState,
  text: string,
  opts: {
    size?: number
    weight?: "normal" | "bold"
    color?: [number, number, number]
    lineHeight?: number
    indent?: number
    width?: number
  } = {}
) {
  const {
    size = 10,
    weight = "normal",
    color = COLOR_INK,
    lineHeight = 1.45,
    indent = 0,
    width = PDF_CONTENT_W - indent,
  } = opts
  const { doc } = state
  const applyStyle = () => {
    doc.setFont("helvetica", weight)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
  }
  applyStyle()
  const lh = (size * 0.3528) * lineHeight // pt→mm
  const wrappedLines: string[] = doc.splitTextToSize(text, width)
  for (const line of wrappedLines) {
    const pageBefore = state.pageNumber
    ensureSpace(state, lh)
    // If ensureSpace caused a page break, drawFooter mutated the font state —
    // re-apply our styling before drawing the next line.
    if (state.pageNumber !== pageBefore) applyStyle()
    doc.text(line, PDF_MARGIN_X + indent, state.y + size * 0.3528)
    state.y += lh
  }
}

function drawDivider(state: PdfState, gapTop = 3, gapBottom = 3) {
  ensureSpace(state, gapTop + gapBottom + 0.5)
  state.y += gapTop
  state.doc.setDrawColor(...COLOR_DIVIDER)
  state.doc.setLineWidth(0.25)
  state.doc.line(PDF_MARGIN_X, state.y, PDF_PAGE_W - PDF_MARGIN_X, state.y)
  state.y += gapBottom
}

function drawSectionLabel(state: PdfState, label: string) {
  ensureSpace(state, 8)
  const { doc } = state
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_PRIMARY)
  doc.text(label.toUpperCase(), PDF_MARGIN_X, state.y + 3)
  state.y += 5
  doc.setDrawColor(...COLOR_PRIMARY)
  doc.setLineWidth(0.35)
  doc.line(PDF_MARGIN_X, state.y, PDF_MARGIN_X + 14, state.y)
  state.y += 3
}

function drawKeyValue(state: PdfState, key: string, value: string) {
  ensureSpace(state, 5)
  const { doc } = state
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(key, PDF_MARGIN_X, state.y + 3)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLOR_INK)
  const lines = doc.splitTextToSize(value || "—", PDF_CONTENT_W - 38)
  lines.forEach((line: string, i: number) => {
    if (i > 0) {
      state.y += 4.2
      ensureSpace(state, 4.2)
    }
    doc.text(line, PDF_MARGIN_X + 38, state.y + 3)
  })
  state.y += 5.5
}

function drawMessageBubble(
  state: PdfState,
  index: number,
  message: StoredChatMessage,
  isUrdu = false
) {
  const { doc } = state
  const speaker = speakerLabel(message.role, isUrdu)
  const isUser = message.role === "user"
  const accent: [number, number, number] = isUser ? COLOR_PRIMARY : COLOR_SAGE
  const text = (message.content ?? "").trim() || "(no text in this turn)"

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const lines = doc.splitTextToSize(text, PDF_CONTENT_W - 6)
  const bodyHeight = lines.length * 4.6
  const metaExtras: string[] = []
  if (message.emotion_label) {
    metaExtras.push(`Emotion: ${message.emotion_label}`)
  }
  if (message.content_type && message.content_type !== "text") {
    metaExtras.push(`Content: ${message.content_type}`)
  }
  const metaHeight = metaExtras.length ? 4.2 : 0
  const totalHeight = 6 + bodyHeight + metaHeight + 3

  ensureSpace(state, totalHeight + 2)

  // Left accent bar
  doc.setFillColor(...accent)
  doc.rect(PDF_MARGIN_X, state.y, 1.2, totalHeight - 2, "F")

  // Soft background
  doc.setFillColor(...COLOR_SOFT_BG)
  doc.roundedRect(
    PDF_MARGIN_X + 2,
    state.y,
    PDF_CONTENT_W - 2,
    totalHeight - 2,
    1.4,
    1.4,
    "F"
  )

  // Speaker label
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...accent)
  doc.text(`${String(index + 1).padStart(2, "0")} · ${speaker}`, PDF_MARGIN_X + 5, state.y + 4.6)

  // Body
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...COLOR_INK)
  let cursor = state.y + 9
  for (const line of lines) {
    doc.text(line, PDF_MARGIN_X + 5, cursor)
    cursor += 4.6
  }

  if (metaExtras.length) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(metaExtras.join("  ·  "), PDF_MARGIN_X + 5, cursor + 0.5)
  }

  state.y += totalHeight
}

function drawCoverHeader(
  state: PdfState,
  displayName: string | null,
  sessionCount: number,
  logoDataUrl: string | null,
  isUrdu: boolean
) {
  const { doc } = state
  const L = labelsFor(isUrdu)

  // Top clay band
  doc.setFillColor(...COLOR_PRIMARY)
  doc.rect(0, 0, PDF_PAGE_W, 34, "F")

  // Logo in the header band
  let textStartX = PDF_MARGIN_X
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", PDF_MARGIN_X, 5, 24, 24)
      textStartX = PDF_MARGIN_X + 28
    } catch {
      // logo failed to embed, just use text
    }
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text("MindEase", textStartX, 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(245, 238, 230)
  doc.text(L.sessionReport, textStartX, 23)

  doc.setFontSize(8.5)
  doc.setTextColor(250, 244, 237)
  doc.text(
    `${formatTimestamp(new Date().toISOString())}`,
    PDF_PAGE_W - PDF_MARGIN_X,
    16,
    { align: "right" }
  )
  doc.text(
    `${sessionCount} session${sessionCount === 1 ? "" : "s"}`,
    PDF_PAGE_W - PDF_MARGIN_X,
    22,
    { align: "right" }
  )

  state.y = 44

  drawSectionLabel(state, L.reportOverview)
  drawKeyValue(state, L.account, displayName?.trim() || "—")
  drawKeyValue(state, L.generated, formatTimestamp(new Date().toISOString()))
  drawKeyValue(state, L.sessionsIncluded, String(sessionCount))

  state.y += 2
  drawTextBlock(
    state,
    L.disclaimer,
    { size: 9, color: COLOR_MUTED, lineHeight: 1.5 }
  )
  state.y += 2
  drawDivider(state, 3, 4)
}

function drawSessionHeader(
  state: PdfState,
  session: Session,
  preview: SessionPreview | undefined,
  index: number,
  total: number,
  isUrdu: boolean
) {
  const { doc } = state
  const L = labelsFor(isUrdu)
  const hasVoice = Boolean(preview?.has_voice)
  ensureSpace(state, 28)

  // Clay left rule + title block
  doc.setFillColor(...COLOR_PRIMARY)
  doc.rect(PDF_MARGIN_X, state.y, 1.8, 22, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_PRIMARY)
  doc.text(
    `${L.session} ${index + 1} ${L.of} ${total}`,
    PDF_MARGIN_X + 5,
    state.y + 5
  )

  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.setTextColor(...COLOR_INK)
  const titleLines = doc.splitTextToSize(
    session.title || "Untitled session",
    PDF_CONTENT_W - 10
  )
  doc.text(titleLines[0] || "Untitled session", PDF_MARGIN_X + 5, state.y + 12)

  // Tag row (type, starred)
  const tags: string[] = []
  tags.push(hasVoice ? L.voiceChat : L.textChat)
  if (session.is_starred) tags.push(L.starred)
  tags.push(session.has_full_transcript ? L.fullTranscript : L.summaryOnly)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(tags.join("   ·   "), PDF_MARGIN_X + 5, state.y + 19)

  state.y += 26

  // Metadata grid (no session ID)
  drawKeyValue(state, L.created, formatTimestamp(session.created_at))
  drawKeyValue(state, L.lastUpdate, formatTimestamp(session.updated_at))
  drawDivider(state, 3, 4)
}

/**
 * Draws reflection text with bold headings for known section titles.
 * Falls back to plain drawTextBlock if no headings are found.
 */
function drawReflectionBlock(state: PdfState, reflection: string) {
  const segments = parseReflectionSegments(reflection)
  for (const seg of segments) {
    if (!seg.text.trim()) continue
    drawTextBlock(state, seg.text.trim(), {
      size: 10.5,
      lineHeight: 1.55,
      weight: seg.bold ? "bold" : "normal",
      color: seg.bold ? COLOR_PRIMARY : COLOR_INK,
    })
  }
}

export async function buildSessionsExportPdf(
  sessionsInOrder: Session[],
  previewsById: Map<string, SessionPreview>,
  displayName?: string | null,
  includeTranscript = true
): Promise<Blob> {
  const footerLabel = displayName?.trim()
    ? `MindEase · Session Report · ${displayName.trim()}`
    : "MindEase · Session Report"
  const state = await newPdf(footerLabel)

  // Preload logo
  const logoDataUrl = await loadLogoDataUrl()

  // Detect if the majority of sessions are Urdu to set the overall report language
  const urduCount = sessionsInOrder.filter(s => isUrduSession(s)).length
  const reportIsUrdu = urduCount > sessionsInOrder.length / 2

  drawCoverHeader(state, displayName ?? null, sessionsInOrder.length, logoDataUrl, reportIsUrdu)
  const L = labelsFor(reportIsUrdu)

  sessionsInOrder.forEach((session, si) => {
    // Per-session Urdu detection (for reflection headings + speaker labels)
    const sessionUrdu = isUrduSession(session)
    const SL = labelsFor(sessionUrdu)

    if (si > 0) {
      drawFooter(state)
      state.doc.addPage()
      state.pageNumber += 1
      state.y = PDF_MARGIN_TOP
    }
    drawSessionHeader(state, session, previewsById.get(session.session_id), si, sessionsInOrder.length, sessionUrdu)

    drawSectionLabel(state, SL.reflection)
    const reflection = (session.summary || session.short_summary || "").trim()
    if (reflection) {
      drawReflectionBlock(state, reflection)
    } else {
      drawTextBlock(state, SL.noReflection, {
        size: 10,
        color: COLOR_MUTED,
      })
    }
    state.y += 2

    if (session.resume_message?.trim()) {
      drawDivider(state, 2, 3)
      drawSectionLabel(state, SL.pickUpNote)
      drawTextBlock(state, session.resume_message.trim(), {
        size: 10.5,
        lineHeight: 1.55,
      })
      state.y += 2
    }

    drawDivider(state, 2, 3)
    drawSectionLabel(state, SL.transcript)

    if (!includeTranscript) {
      drawTextBlock(state, SL.transcriptNotIncluded, {
        size: 9.5,
        color: COLOR_MUTED,
      })
    } else if (!session.has_full_transcript) {
      drawTextBlock(state, SL.transcriptNotAvailable, {
        size: 9.5,
        color: COLOR_MUTED,
      })
    } else if (!session.messages?.length) {
      drawTextBlock(state, SL.noMessages, {
        size: 9.5,
        color: COLOR_MUTED,
      })
    } else {
      const hasVoice = Boolean(previewsById.get(session.session_id)?.has_voice)
      if (hasVoice) {
        drawTextBlock(state, SL.voiceNote, { size: 9, color: COLOR_MUTED })
        state.y += 1
      }
      session.messages.forEach((m, i) => {
        drawMessageBubble(state, i, m, sessionUrdu)
        state.y += 1.5
      })
    }
  })

  drawFooter(state)
  return state.doc.output("blob")
}

// ──────────────────────────────────────────────────────────────────────────────
// Download helpers
// ──────────────────────────────────────────────────────────────────────────────

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadTextFile(filename: string, text: string): void {
  triggerDownload(filename, new Blob([text], { type: "text/plain;charset=utf-8" }))
}

export function downloadCsvFile(filename: string, csv: string): void {
  triggerDownload(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }))
}

export function downloadPdfBlob(filename: string, blob: Blob): void {
  triggerDownload(filename, blob)
}

function dateStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Turn a session title into a safe filename fragment. */
function slugifyTitle(title: string | undefined | null, fallback = "Session"): string {
  const raw = (title || "").trim()
  if (!raw) return fallback
  // Replace any char that isn't alphanumeric/space/dash/underscore with space, then collapse.
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-")
  // Keep it reasonable; OSes handle longer but be kind to Windows path limits.
  const capped = cleaned.slice(0, 60)
  return capped || fallback
}

export function exportFilenameForSessions(
  ext: "txt" | "csv" | "pdf" = "pdf",
  count?: number
): string {
  const n = count ?? 0
  if (n > 0) {
    return `MindEase-${n}-Sessions-${dateStamp()}.${ext}`
  }
  return `MindEase-Sessions-${dateStamp()}.${ext}`
}

export function exportFilenameForSingleSession(
  sessionIdOrTitle: string,
  ext: "txt" | "csv" | "pdf" = "pdf",
  title?: string
): string {
  const slug = slugifyTitle(title ?? sessionIdOrTitle)
  return `MindEase-${slug}-${dateStamp()}.${ext}`
}

// ──────────────────────────────────────────────────────────────────────────────
// Public export entry points
// ──────────────────────────────────────────────────────────────────────────────

async function fetchSessionsForExport(
  userId: string,
  previews: SessionPreview[]
): Promise<{ sessionsOrdered: Session[]; previewsById: Map<string, SessionPreview> }> {
  if (previews.length === 0) {
    throw new Error("NO_SESSIONS")
  }

  const previewsById = new Map(previews.map(p => [p.session_id, p]))

  const settled = await Promise.allSettled(
    previews.map(p => apiGetSessionById(userId, p.session_id))
  )

  const sessionsOrdered: Session[] = previews.map((p, i) => {
    const r = settled[i]
    if (r.status === "fulfilled") return r.value.session
    return minimalSessionFromPreview(p)
  })

  return { sessionsOrdered, previewsById }
}

/** PDF bulk export (default format — styled report). */
export async function exportPreviewsToPdfFile(
  userId: string,
  previews: SessionPreview[],
  displayName?: string | null,
  includeTranscript = true
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, previews)
  const blob = await buildSessionsExportPdf(sessionsOrdered, previewsById, displayName, includeTranscript)
  downloadPdfBlob(exportFilenameForSessions("pdf", previews.length), blob)
}

/** PDF single-session export. */
export async function exportSinglePreviewToPdfFile(
  userId: string,
  preview: SessionPreview,
  displayName?: string | null,
  includeTranscript = true
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, [preview])
  const blob = await buildSessionsExportPdf(sessionsOrdered, previewsById, displayName, includeTranscript)
  downloadPdfBlob(exportFilenameForSingleSession(preview.session_id, "pdf", preview.title), blob)
}

/** CSV bulk export (spreadsheet-friendly). */
export async function exportPreviewsToCsvFile(
  userId: string,
  previews: SessionPreview[],
  displayName?: string | null,
  includeTranscript = true
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, previews)
  const csv = buildSessionsExportCsv(sessionsOrdered, previewsById, displayName, includeTranscript)
  downloadCsvFile(exportFilenameForSessions("csv", previews.length), csv)
}

/** CSV single-session export. */
export async function exportSinglePreviewToCsvFile(
  userId: string,
  preview: SessionPreview,
  displayName?: string | null,
  includeTranscript = true
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, [preview])
  const csv = buildSessionsExportCsv(sessionsOrdered, previewsById, displayName, includeTranscript)
  downloadCsvFile(exportFilenameForSingleSession(preview.session_id, "csv", preview.title), csv)
}

/** Plain-text bulk export (preserved for human-readable sharing). */
export async function exportPreviewsToTextFile(
  userId: string,
  previews: SessionPreview[],
  displayName?: string | null,
  includeTranscript = true
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, previews)
  const text = buildSessionsExportText(sessionsOrdered, previewsById, displayName, includeTranscript)
  downloadTextFile(exportFilenameForSessions("txt", previews.length), text)
}

/** Plain-text single-session export. */
export async function exportSinglePreviewToTextFile(
  userId: string,
  preview: SessionPreview,
  displayName?: string | null,
  includeTranscript = true
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, [preview])
  const text = buildSessionsExportText(sessionsOrdered, previewsById, displayName, includeTranscript)
  downloadTextFile(exportFilenameForSingleSession(preview.session_id, "txt", preview.title), text)
}

/** Check whether any of the given previews have transcripts available. */
export function anyTranscriptsAvailable(previews: SessionPreview[]): boolean {
  return previews.some(p => p.has_full_transcript)
}
