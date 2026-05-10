import { NextResponse } from "next/server"

const DID_API = "https://api.d-id.com"
const AUTH    = `Basic ${process.env.DID_API_KEY!}`

export async function POST(req: Request) {
  try {
    const { id, candidate, sdpMid, sdpMLineIndex, session_id } = await req.json()
    const res = await fetch(`${DID_API}/talks/streams/${id}/ice`, {
      method:  "POST",
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/json",
        Cookie: session_id,
      },
      body: JSON.stringify({ candidate, sdpMid, sdpMLineIndex, session_id }),
    })
    const text = await res.text()
    return NextResponse.json(res.ok ? { ok: true } : { error: text }, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
