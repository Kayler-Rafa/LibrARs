import { useEffect, useRef } from 'react'
import type { Landmark } from '@/types'

// HAND_CONNECTIONS é global via CDN — veja index.html + src/types/mediapipe.d.ts

interface CanvasOverlayProps {
  landmarks: Landmark[] | null
  mirrored?: boolean
}

// Cores por grupo de dedo
const FINGER_COLORS: Record<number, string> = {
  0: '#ff6b6b',
  1: '#ffd93d', 2: '#ffd93d', 3: '#ffd93d', 4: '#ffd93d',
  5: '#6bcb77', 6: '#6bcb77', 7: '#6bcb77', 8: '#6bcb77',
  9: '#4d96ff', 10: '#4d96ff', 11: '#4d96ff', 12: '#4d96ff',
  13: '#ff6b9d', 14: '#ff6b9d', 15: '#ff6b9d', 16: '#ff6b9d',
  17: '#c77dff', 18: '#c77dff', 19: '#c77dff', 20: '#c77dff',
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  w: number,
  h: number,
  mirrored: boolean
) {
  const px = (x: number) => (mirrored ? 1 - x : x) * w
  const py = (y: number) => y * h

  const connections = HAND_CONNECTIONS as ReadonlyArray<[number, number]>

  ctx.lineWidth = 2.5
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  for (const [a, b] of connections) {
    ctx.beginPath()
    ctx.moveTo(px(landmarks[a].x), py(landmarks[a].y))
    ctx.lineTo(px(landmarks[b].x), py(landmarks[b].y))
    ctx.stroke()
  }

  for (let i = 0; i < landmarks.length; i++) {
    const x = px(landmarks[i].x)
    const y = py(landmarks[i].y)
    ctx.beginPath()
    ctx.arc(x, y, i === 0 ? 7 : 4, 0, Math.PI * 2)
    ctx.fillStyle = FINGER_COLORS[i] ?? '#00c8ff'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

export function CanvasOverlay({ landmarks, mirrored = true }: CanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w
    canvas.height = h

    ctx.clearRect(0, 0, w, h)
    if (landmarks && landmarks.length === 21) {
      drawSkeleton(ctx, landmarks, w, h, mirrored)
    }
  }, [landmarks, mirrored])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}
