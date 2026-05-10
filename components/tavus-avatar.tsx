"use client"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

export interface TavusAvatarHandle {
  sendEcho:  (text: string) => void
  interrupt: () => void
}

interface Props {
  conversationUrl:  string
  onSpeakingStart?: () => void
  onSpeakingEnd?:   () => void
  className?: string
  style?: React.CSSProperties
}

const TavusAvatar = forwardRef<TavusAvatarHandle, Props>(
  ({ conversationUrl, onSpeakingStart, onSpeakingEnd, className, style }, ref) => {
    const videoRef          = useRef<HTMLVideoElement>(null)
    const audioRef          = useRef<HTMLAudioElement>(null)
    const callRef           = useRef<any>(null)
    // Keep callbacks in refs so the stale closure inside useEffect always calls the latest version
    const onSpeakingStartRef = useRef(onSpeakingStart)
    const onSpeakingEndRef   = useRef(onSpeakingEnd)
    onSpeakingStartRef.current = onSpeakingStart
    onSpeakingEndRef.current   = onSpeakingEnd

    useImperativeHandle(ref, () => ({
      sendEcho: (text: string) => {
        callRef.current?.sendAppMessage(
          { message_type: "conversation", event_type: "conversation.echo", text },
          "*"
        )
      },
      interrupt: () => {
        callRef.current?.sendAppMessage(
          { message_type: "conversation", event_type: "conversation.interrupt" },
          "*"
        )
      },
    }))

    useEffect(() => {
      if (!conversationUrl) return
      let destroyed = false

      ;(async () => {
        const { default: DailyIframe } = await import("@daily-co/daily-js")
        if (destroyed) return

        const call = DailyIframe.createCallObject({
          audioSource: false,
          videoSource: false,
        })
        callRef.current = call

        call.on("track-started", (event: any) => {
          if (event.participant?.local) return
          if (event.track.kind === "video" && videoRef.current) {
            videoRef.current.srcObject = new MediaStream([event.track])
          }
          if (event.track.kind === "audio" && audioRef.current) {
            audioRef.current.srcObject = new MediaStream([event.track])
            audioRef.current.play().catch(() => {})
          }
        })

        // Tavus fires these as app-messages; don't filter on message_type — it may be absent
        call.on("app-message", (event: any) => {
          const evt = event?.data ?? event
          const event_type: string = evt?.event_type ?? ""
          console.log("[TavusAvatar] app-message", evt)
          if (event_type === "conversation.replica.started_talking") onSpeakingStartRef.current?.()
          if (event_type === "conversation.replica.stopped_talking")  onSpeakingEndRef.current?.()
        })

        await call.join({ url: conversationUrl })
      })()

      return () => {
        destroyed = true
        callRef.current?.leave().catch(() => {})
        callRef.current = null
      }
    }, [conversationUrl])

    return (
      <>
        <video ref={videoRef} autoPlay playsInline className={className} style={style} />
        <audio ref={audioRef} autoPlay style={{ display: "none" }} />
      </>
    )
  }
)
TavusAvatar.displayName = "TavusAvatar"
export default TavusAvatar
