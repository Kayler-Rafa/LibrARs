import { useEffect, useRef, useState, useCallback } from 'react'
import type { Results } from '@/types/mediapipe'
import { getHandsInstance, sendFrame, handsReady } from '@/lib/mediapipe'
import type { Landmark } from '@/types'

export type Handedness = 'Left' | 'Right'

export interface UseHandTrackingReturn {
  landmarks: Landmark[] | null
  handedness: Handedness | null
  isHandDetected: boolean
  isModelReady: boolean
  fps: number
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isVideoReady: boolean
): UseHandTrackingReturn {
  const animFrameRef = useRef<number>(0)
  const processingRef = useRef(false)
  const lastFpsTimeRef = useRef(performance.now())
  const frameCountRef = useRef(0)

  const [landmarks, setLandmarks]     = useState<Landmark[] | null>(null)
  const [handedness, setHandedness]   = useState<Handedness | null>(null)
  const [isHandDetected, setIsHandDetected] = useState(false)
  const [isModelReady, setIsModelReady]     = useState(false)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    let cancelled = false

    const onResults = (results: Results) => {
      if (cancelled) return
      processingRef.current = false

      const lms = results.multiHandLandmarks?.[0]
      if (lms && lms.length > 0) {
        // ── Correção de aspect ratio ──────────────────────────────────────────
        // O MediaPipe entrega x e y como fracções das dimensões do vídeo (0–1).
        // Em Paisagem (16:9) um delta-x de 0.1 representa ~178px, mas em
        // Retrato (9:16) representa apenas ~56px — o mesmo gesto gera vetores
        // diferentes entre PC e mobile, quebrando o KNN cross-device.
        //
        // Solução: multiplicar x por (videoWidth / videoHeight) converte para
        // um espaço quadrado neutro (1:1) onde deltas-x e deltas-y têm a mesma
        // escala em píxeis físicos, independentemente da orientação do ecrã.
        // A nossa normalização pelo pulso actua depois, já em espaço consistente.
        const video = videoRef.current
        const vw = video?.videoWidth  ?? 0
        const vh = video?.videoHeight ?? 0
        const ar = (vw > 0 && vh > 0) ? vw / vh : 1.0

        const corrected: Landmark[] = ar === 1.0
          ? (lms as Landmark[])
          : (lms as Landmark[]).map(lm => ({ x: lm.x * ar, y: lm.y, z: lm.z }))

        setLandmarks(corrected)
        setIsHandDetected(true)
        const label = results.multiHandedness?.[0]?.label
        setHandedness((label === 'Left' || label === 'Right') ? label : null)
      } else {
        setLandmarks(null)
        setHandedness(null)
        setIsHandDetected(false)
      }

      frameCountRef.current++
      const now = performance.now()
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current)
        frameCountRef.current = 0
        lastFpsTimeRef.current = now
      }
    }

    getHandsInstance(onResults).then(() => {
      if (!cancelled) setIsModelReady(true)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animFrameRef.current)
      // Não fecha o singleton — apenas para o loop deste mount
    }
  }, [])

  const detect = useCallback(async () => {
    const video = videoRef.current

    if (video && !processingRef.current && video.readyState >= 2 && handsReady()) {
      processingRef.current = true
      await sendFrame(video)
    }

    animFrameRef.current = requestAnimationFrame(detect)
  }, [videoRef])

  useEffect(() => {
    if (!isVideoReady || !isModelReady) return
    lastFpsTimeRef.current = performance.now()
    animFrameRef.current = requestAnimationFrame(detect)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isVideoReady, isModelReady, detect])

  return { landmarks, handedness, isHandDetected, isModelReady, fps }
}
