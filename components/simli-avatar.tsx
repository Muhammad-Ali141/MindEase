"use client"
import { SimliClient, generateSimliSessionToken, generateIceServers } from "simli-client"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

export interface SimliAvatarHandle {
  sendAudio:               (pcm16: Uint8Array) => void
  clearBuffer:             () => void
  listenToMediastreamTrack:(track: MediaStreamTrack) => void
}

interface Props {
  className?: string
  style?: React.CSSProperties
}

const API_KEY  = process.env.NEXT_PUBLIC_SIMLI_API_KEY!
const FACE_ID  = process.env.NEXT_PUBLIC_SIMLI_FACE_ID || "b9e5fba3-071a-4e35-896e-211c4d6eaa7b"

const SimliAvatar = forwardRef<SimliAvatarHandle, Props>(({ className, style }, ref) => {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const audioRef  = useRef<HTMLAudioElement>(null)
  const clientRef = useRef<SimliClient | null>(null)

  useImperativeHandle(ref, () => ({
    sendAudio:                (pcm16) => clientRef.current?.sendAudioData(pcm16),
    clearBuffer:              ()      => clientRef.current?.ClearBuffer(),
    listenToMediastreamTrack: (track) => clientRef.current?.listenToMediastreamTrack(track),
  }))

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!videoRef.current || !audioRef.current) return

    let cancelled = false
    const videoEl = videoRef.current
    const audioEl = audioRef.current

    ;(async () => {
      try {
        const [{ session_token }, iceServers] = await Promise.all([
          generateSimliSessionToken({
            apiKey: API_KEY,
            config: {
              faceId:           FACE_ID,
              handleSilence:    true,
              maxSessionLength: 3600,
              maxIdleTime:      600,
            },
          }),
          generateIceServers(API_KEY),
        ])
        if (cancelled) return
        const client = new SimliClient(session_token, videoEl, audioEl, iceServers)
        clientRef.current = client
        await client.start()
      } catch (err) {
        if (!cancelled) console.error("[SimliAvatar] init failed:", err)
      }
    })()

    return () => {
      cancelled = true
      clientRef.current?.stop().catch(() => {})
      clientRef.current = null
    }
  }, [])

  return (
    <>
      <video ref={videoRef} autoPlay playsInline className={className} style={style} />
      {/* Simli's audio track is muted — TTS audio plays via new Audio() to preserve timing */}
      <audio ref={audioRef} autoPlay muted style={{ display: "none" }} />
    </>
  )
})
SimliAvatar.displayName = "SimliAvatar"
export default SimliAvatar
