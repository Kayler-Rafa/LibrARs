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
        setLandmarks(lms as Landmark[])
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
