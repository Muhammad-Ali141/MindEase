import { NextResponse } from "next/server"

const TAVUS_API = "https://tavusapi.com/v2"
const API_KEY   = process.env.TAVUS_API_KEY!
const REPLICA_ID = process.env.TAVUS_REPLICA_ID || "rfb0463909e3"

// Cache persona per server lifetime (avoids creating a new persona every session)
let cachedPersonaId: string | null = null

async function getOrCreatePersona(): Promise<string> {
  if (cachedPersonaId) return cachedPersonaId
  const res = await fetch(`${TAVUS_API}/personas`, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      persona_name: "MindEase Therapist",
      pipeline_mode: "echo", // MindEase drives LLM/TTS; Tavus only renders the avatar
    }),
  })
  if (!res.ok) throw new Error(`Persona create failed: ${await res.text()}`)
  const data = await res.json()
  cachedPersonaId = data.persona_id
  return data.persona_id
}

// POST /api/tavus — create a new conversation, returns { conversation_id, conversation_url }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const greeting: string = body.greeting || ""

    const persona_id = await getOrCreatePersona()

    const convRes = await fetch(`${TAVUS_API}/conversations`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        replica_id: REPLICA_ID,
        persona_id,
        conversation_name: "MindEase Session",
        custom_greeting: greeting,
      }),
    })
    if (!convRes.ok) throw new Error(`Conversation create failed: ${await convRes.text()}`)
    const conv = await convRes.json()

    return NextResponse.json({
      conversation_id: conv.conversation_id,
      conversation_url: conv.conversation_url,
    })
  } catch (err: any) {
    console.error("[/api/tavus POST]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/tavus — end a conversation
export async function DELETE(req: Request) {
  try {
    const { conversation_id } = await req.json()
    await fetch(`${TAVUS_API}/conversations/${conversation_id}/end`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
