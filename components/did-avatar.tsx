"use client"
import { forwardRef, useImperativeHandle, useRef, useState } from "react"

export interface DIDAvatarHandle {
  // Send full concatenated audio → wav2lip generates one continuous video → plays with audio
  // Returns promise that resolves when video finishes (or null on failure → caller plays TTS audio)
  sendAudio: (blob: Blob) => Promise<void>
  interrupt: () => void
}

interface Props {
  onSpeakingStart?: () => void
  onSpeakingEnd?:   () => void
  className?: string
  style?: React.CSSProperties
}

const DIDAvatar = forwardRef<DIDAvatarHandle, Props>(
  ({ onSpeakingStart, onSpeakingEnd, className, style }, ref) => {
    const videoRef   = useRef<HTMLVideoElement>(null)
    const onStartRef = useRef(onSpeakingStart)
    const onEndRef   = useRef(onSpeakingEnd)
    const [speaking, setSpeaking] = useState(false)
    onStartRef.current = onSpeakingStart
    onEndRef.current   = onSpeakingEnd

    useImperativeHandle(ref, () => ({
      sendAudio: async (blob: Blob) => {
        const form = new FormData()
        form.append("audio", blob, "audio.mp3")
        const res = await fetch("/api/wav2lip", { method: "POST", body: form })
        if (!res.ok) throw new Error("wav2lip failed")

        const buf = await res.arrayBuffer()
        const url = URL.createObjectURL(new Blob([buf], { type: "video/mp4" }))
        const vid = videoRef.current
        if (!vid) { URL.revokeObjectURL(url); return }

        vid.src   = url
        vid.muted = false
        vid.load()

        await new Promise<void>(resolve => {
          const done = () => { vid.oncanplay = null; vid.onerror = null; resolve() }
          vid.oncanplay = done; vid.onerror = done; setTimeout(done, 8000)
        })

        await new Promise<void>(resolve => {
          const cleanup = () => {
            setSpeaking(false); onEndRef.current?.()
            URL.revokeObjectURL(url)
            if (vid.src === url) vid.src = ""
            resolve()
          }
          vid.onplay  = () => { setSpeaking(true); onStartRef.current?.() }
          vid.onended = cleanup
          vid.onerror = cleanup
          vid.play().catch(cleanup)
        })
      },

      interrupt: () => {
        const vid = videoRef.current
        if (vid) { vid.pause(); vid.src = "" }
        setSpeaking(false)
      },
    }))

    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {!speaking && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/avatar.jpg"
            alt="Therapist"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }}
          />
        )}
        <video
          ref={videoRef}
          playsInline
          className={className}
          style={{ objectPosition: "center 20%", ...style, opacity: speaking ? 1 : 0, transition: "opacity 0.15s ease" }}
        />
      </div>
    )
  }
)
DIDAvatar.displayName = "DIDAvatar"
export default DIDAvatar
