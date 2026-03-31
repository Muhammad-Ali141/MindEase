import {
  apiGetSessionById,
  type Session,
  type SessionPreview,
  type StoredChatMessage,
} from "./api"

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

function formatOneMessage(m: StoredChatMessage, index: number): string {
  const role =
    m.role === "user" ? "Client" : m.role === "assistant" ? "Assistant (AI)" : m.role
  const raw = (m.content ?? "").trim()
  const content = raw || "(no text in this turn)"
  let block = `${index + 1}. ${role}: ${content}`
  if (m.emotion_label) {
    const score =
      m.emotion_score != null && m.emotion_score !== undefined
        ? ` (score ${m.emotion_score})`
        : ""
    block += `\n   [Detected emotion: ${m.emotion_label}${score}]`
  }
  if (m.content_type && m.content_type !== "text") {
    block += `\n   [Content type: ${m.content_type}]`
  }
  return block
}

/**
 * Plain-text export suitable to share with a human clinician.
 * Section headers are in English for consistency in medical contexts.
 */
export function buildSessionsExportText(
  sessionsInOrder: Session[],
  previewsById: Map<string, SessionPreview>,
  displayName?: string | null
): string {
  const lines: string[] = []
  lines.push("MINDEASE — SESSION EXPORT (FOR PROFESSIONAL REVIEW)")
  lines.push("")
  lines.push(
    "This file was exported by the account holder from MindEase. It may include AI-generated summaries and"
  )
  lines.push(
    "chat or voice session text. It is not a medical record unless reviewed and adopted by a clinician."
  )
  lines.push("")
  lines.push(`Generated (UTC): ${new Date().toISOString()}`)
  if (displayName?.trim()) {
    lines.push(`Display name: ${displayName.trim()}`)
  }
  lines.push("")

  sessionsInOrder.forEach((session, si) => {
    const prev = previewsById.get(session.session_id)
    const hasVoice = Boolean(prev?.has_voice)
    const label = si + 1
    lines.push("=".repeat(72))
    lines.push(`SESSION ${label} OF ${sessionsInOrder.length}`)
    lines.push("=".repeat(72))
    lines.push(`Title: ${session.title || "—"}`)
    lines.push(`Type: ${hasVoice ? "Voice" : "Text"} chat`)
    lines.push(`Updated: ${session.updated_at || "—"}`)
    lines.push(`Session ID: ${session.session_id}`)
    lines.push(`Full transcript on file: ${session.has_full_transcript ? "yes" : "no (summary only)"}`)
    if (session.is_starred) lines.push("Starred by user: yes")
    lines.push("")
    lines.push("— Summary —")
    lines.push((session.summary || session.short_summary || "—").trim() || "—")
    lines.push("")
    if (session.resume_message?.trim()) {
      lines.push("— Resume / continuation note —")
      lines.push(session.resume_message.trim())
      lines.push("")
    }
    lines.push("— Transcript —")
    if (!session.has_full_transcript) {
      lines.push(
        "(Only a summary is stored for this session; line-by-line transcript is not available.)"
      )
    } else if (!session.messages?.length) {
      lines.push("(No message rows returned for this session.)")
    } else {
      if (hasVoice) {
        lines.push(
          "(Voice session: lines may be speech transcripts, captions, or mixed content as stored by the app.)"
        )
        lines.push("")
      }
      session.messages.forEach((m, i) => {
        lines.push(formatOneMessage(m, i))
        lines.push("")
      })
    }
    lines.push("")
  })

  lines.push("=".repeat(72))
  lines.push("END OF EXPORT")
  lines.push("")
  return lines.join("\n")
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportFilenameForSessions(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `MindEase-sessions-${y}-${m}-${day}.txt`
}

/** Single-session export filename (safe for common filesystems). */
export function exportFilenameForSingleSession(sessionId: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const short = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "session"
  return `MindEase-session-${y}-${m}-${day}-${short}.txt`
}

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

/**
 * Fetches full session payloads and downloads a single UTF-8 text file.
 * Preserves the order of `previews`. Failed fetches fall back to preview-only data.
 */
export async function exportPreviewsToTextFile(
  userId: string,
  previews: SessionPreview[],
  displayName?: string | null
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, previews)
  const text = buildSessionsExportText(sessionsOrdered, previewsById, displayName)
  downloadTextFile(exportFilenameForSessions(), text)
}

/**
 * Same as bulk export, but one session and a dedicated filename.
 */
export async function exportSinglePreviewToTextFile(
  userId: string,
  preview: SessionPreview,
  displayName?: string | null
): Promise<void> {
  const { sessionsOrdered, previewsById } = await fetchSessionsForExport(userId, [preview])
  const text = buildSessionsExportText(sessionsOrdered, previewsById, displayName)
  downloadTextFile(exportFilenameForSingleSession(preview.session_id), text)
}
