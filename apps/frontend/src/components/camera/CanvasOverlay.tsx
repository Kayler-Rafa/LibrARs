import { useEffect, useRef } from 'react'
import type { Landmark, PoseData } from '@/types'

// HAND_CONNECTIONS é global via CDN — veja index.html + src/types/mediapipe.d.ts

interface CanvasOverlayProps {
  landmarks: Landmark[] | null
  /** Item 2: pose (rosto + ombros) — orienta o enquadramento */
  pose?: PoseData | null
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

/**
 * Referência corporal (Item 2): linha dos ombros, linhas do nariz aos ombros e
 * pontos de olhos e boca. Ciano quando a pose é válida; âmbar tracejado quando
 * nariz ou ombros não estão bem visíveis.
 */
function drawPose(
  ctx: CanvasRenderingContext2D,
  pose: PoseData,
  w: number,
  h: number,
  mirrored: boolean
) {
  if (!pose.points) return
  const pt = (i: number): [number, number] => [
    (mirrored ? 1 - pose.points![i].x : pose.points![i].x) * w,
    pose.points![i].y * h,
  ]
  const [nose, eyeL, eyeR, mouthL, mouthR, shoulderL, shoulderR] = [0, 1, 2, 3, 4, 5, 6].map(pt)
  const color = pose.ok ? '#22d3ee' : '#fbbf24'

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.setLineDash(pose.ok ? [] : [8, 6])
  ctx.globalAlpha = 0.9

  // Linha dos ombros
  ctx.beginPath()
  ctx.moveTo(...shoulderL)
  ctx.lineTo(...shoulderR)
  ctx.stroke()

  // Nariz → cada ombro
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.6
  for (const s of [shoulderL, shoulderR]) {
    ctx.beginPath()
    ctx.moveTo(...nose)
    ctx.lineTo(...s)
    ctx.stroke()
  }

  // Pontos: ombros e nariz (maiores), olhos e boca
  ctx.setLineDash([])
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  const dot = ([x, y]: [number, number], r: number) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  dot(shoulderL, 6); dot(shoulderR, 6); dot(nose, 5)
  dot(eyeL, 3.5); dot(eyeR, 3.5); dot(mouthL, 3.5); dot(mouthR, 3.5)
  ctx.restore()
}

export function CanvasOverlay({ landmarks, pose = null, mirrored = true }: CanvasOverlayProps) {
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
    if (pose) drawPose(ctx, pose, w, h, mirrored)   // por baixo da mão
    if (landmarks && landmarks.length === 21) {
      drawSkeleton(ctx, landmarks, w, h, mirrored)
    }
  }, [landmarks, pose, mirrored])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}
