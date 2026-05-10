import { NextResponse } from "next/server"

const DID_API = "https://api.d-id.com"
const AUTH    = `Basic ${process.env.DID_API_KEY!}`

export async function POST(req: Request) {
  try {
    const { id, audio_base64, session_id } = await req.json()
    const res = await fetch(`${DID_API}/talks/streams/${id}`, {
      method:  "POST",
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/json",
        Cookie: session_id,
      },
      body: JSON.stringify({
        script:     { type: "audio", audio_url: `data:audio/mp3;base64,${audio_base64}` },
        config:     { fluent: true, pad_audio: 0.0 },
        session_id,
      }),
    })
    const text = await res.text()
    return NextResponse.json(res.ok ? { ok: true } : { error: text }, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
