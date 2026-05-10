import { NextResponse } from "next/server"

const DID_API = "https://api.d-id.com"
const AUTH    = `Basic ${process.env.DID_API_KEY!}`
const SRC_URL = process.env.DID_SOURCE_URL!

// POST /api/did — create a new D-ID stream, returns WebRTC offer
export async function POST() {
  try {
    const res  = await fetch(`${DID_API}/talks/streams`, {
      method:  "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body:    JSON.stringify({ source_url: SRC_URL }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error("[/api/did POST] stream create failed:", text)
      return NextResponse.json({ error: text }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error("[/api/did POST]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/did — close a D-ID stream
export async function DELETE(req: Request) {
  try {
    const { id, session_id } = await req.json()
    await fetch(`${DID_API}/talks/streams/${id}`, {
      method: "DELETE",
      headers: { Authorization: AUTH, "Content-Type": "application/json", Cookie: session_id },
      body: JSON.stringify({ session_id }),
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
