"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface BeamsBackgroundProps {
  className?: string
  isDark?: boolean
  intensity?: "subtle" | "medium" | "strong"
}

interface Beam {
  x: number
  y: number
  width: number
  length: number
  angle: number
  speed: number
  opacity: number
  hue: number
  saturation: number
  pulse: number
  pulseSpeed: number
}

const BEAM_COUNT = 20

function createBeam(width: number, height: number): Beam {
  // Mix of clay amber (hue ~22-44) and sage green (hue ~130-145)
  const isSage = Math.random() > 0.65
  const angle = -35 + Math.random() * 10
  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 30 + Math.random() * 60,
    length: height * 2.2,
    angle,
    speed: 0.3 + Math.random() * 0.6,
    opacity: 0.08 + Math.random() * 0.10,
    hue: isSage ? 130 + Math.random() * 16 : 22 + Math.random() * 22,
    saturation: 55 + Math.random() * 20,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.012 + Math.random() * 0.022,
  }
}

export function BeamsBackground({
  className,
  isDark = false,
  intensity = "medium",
}: BeamsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beamsRef = useRef<Beam[]>([])
  const animationFrameRef = useRef<number>(0)

  const opacityMap = { subtle: 0.7, medium: 0.9, strong: 1.15 }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
      // Single blur source — only on the canvas context, no CSS filter
      ctx.filter = "blur(35px)"
      beamsRef.current = Array.from({ length: BEAM_COUNT }, () =>
        createBeam(window.innerWidth, window.innerHeight)
      )
    }

    updateCanvasSize()
    window.addEventListener("resize", updateCanvasSize)

    function resetBeam(beam: Beam, index: number) {
      if (!canvas) return beam
      const col = index % 5
      const spacing = window.innerWidth / 5
      beam.y = window.innerHeight + 100
      beam.x = col * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.6
      beam.width = 30 + Math.random() * 60
      beam.speed = 0.3 + Math.random() * 0.6
      const isSage = Math.random() > 0.65
      beam.hue = isSage ? 130 + Math.random() * 16 : 22 + Math.random() * 22
      beam.opacity = 0.08 + Math.random() * 0.10
      return beam
    }

    function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
      ctx.save()
      ctx.translate(beam.x, beam.y)
      ctx.rotate((beam.angle * Math.PI) / 180)

      const darkBoost = isDark ? 1.5 : 1.0
      const pulsingOpacity =
        beam.opacity *
        (0.8 + Math.sin(beam.pulse) * 0.2) *
        opacityMap[intensity] *
        darkBoost

      const g = ctx.createLinearGradient(0, 0, 0, beam.length)
      const h = beam.hue
      const s = beam.saturation
      const l = isDark ? 68 : 56

      g.addColorStop(0,   `hsla(${h}, ${s}%, ${l}%, 0)`)
      g.addColorStop(0.1, `hsla(${h}, ${s}%, ${l}%, ${pulsingOpacity * 0.5})`)
      g.addColorStop(0.4, `hsla(${h}, ${s}%, ${l}%, ${pulsingOpacity})`)
      g.addColorStop(0.6, `hsla(${h}, ${s}%, ${l}%, ${pulsingOpacity})`)
      g.addColorStop(0.9, `hsla(${h}, ${s}%, ${l}%, ${pulsingOpacity * 0.5})`)
      g.addColorStop(1,   `hsla(${h}, ${s}%, ${l}%, 0)`)

      ctx.fillStyle = g
      ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length)
      ctx.restore()
    }

    let lastTime = 0
    const TARGET_FPS = 30
    const FRAME_INTERVAL = 1000 / TARGET_FPS

    function animate(time: number) {
      if (!canvas || !ctx) return
      animationFrameRef.current = requestAnimationFrame(animate)

      // Throttle to ~30fps — halves GPU work
      if (time - lastTime < FRAME_INTERVAL) return
      lastTime = time

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      beamsRef.current.forEach((beam, i) => {
        beam.y -= beam.speed
        beam.pulse += beam.pulseSpeed
        if (beam.y + beam.length < -100) resetBeam(beam, i)
        drawBeam(ctx, beam)
      })
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener("resize", updateCanvasSize)
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [intensity, isDark])

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none beams-canvas", className)}
    />
  )
}
