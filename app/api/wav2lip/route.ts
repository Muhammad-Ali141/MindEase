import { NextResponse } from "next/server"

const W2L_URL = process.env.WAV2LIP_URL ?? "http://127.0.0.1:8002"

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const res  = await fetch(`${W2L_URL}/wav2lip`, { method: "POST", body: form })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }
    const buf = await res.arrayBuffer()
    return new Response(buf, { headers: { "Content-Type": "video/mp4" } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
