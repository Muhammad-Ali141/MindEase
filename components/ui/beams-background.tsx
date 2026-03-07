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

function createBeam(width: number, height: number): Beam {
  // Mix of clay amber (hue ~22-44) and sage green (hue ~130-145)
  const isSage = Math.random() > 0.65
  const angle = -35 + Math.random() * 10
  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 25 + Math.random() * 55,
    length: height * 2.5,
    angle,
    speed: 0.35 + Math.random() * 0.7,
    opacity: 0.055 + Math.random() * 0.09,
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

  const opacityMap = { subtle: 0.65, medium: 0.85, strong: 1.1 }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
      beamsRef.current = Array.from({ length: 28 }, () =>
        createBeam(window.innerWidth, window.innerHeight)
      )
    }

    updateCanvasSize()
    window.addEventListener("resize", updateCanvasSize)

    function resetBeam(beam: Beam, index: number) {
      if (!canvas) return beam
      const col = index % 4
      const spacing = window.innerWidth / 4
      beam.y = window.innerHeight + 100
      beam.x = col * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.6
      beam.width = 80 + Math.random() * 80
      beam.speed = 0.3 + Math.random() * 0.5
      const isSage = Math.random() > 0.65
      beam.hue = isSage ? 130 + Math.random() * 16 : 22 + Math.random() * 22
      beam.opacity = 0.055 + Math.random() * 0.085
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
      const l = isDark ? 70 : 58

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

    function animate() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.filter = "blur(32px)"

      beamsRef.current.forEach((beam, i) => {
        beam.y -= beam.speed
        beam.pulse += beam.pulseSpeed
        if (beam.y + beam.length < -100) resetBeam(beam, i)
        drawBeam(ctx, beam)
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", updateCanvasSize)
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [intensity, isDark])

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none", className)}
      style={{ filter: "blur(12px)" }}
    />
  )
}
