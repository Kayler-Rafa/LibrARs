import { useEffect, useRef, useState, useCallback } from 'react'
import type { Results } from '@/types/mediapipe'
import { getHandsInstance, sendFrame, handsReady } from '@/lib/mediapipe'
import { initPose, poseReady, detectPose } from '@/lib/pose'
import type { Landmark, PoseData } from '@/types'

// Item 2: a pose roda a cada 2 quadros processados; o último resultado é reaproveitado
const POSE_EVERY_N_FRAMES = 2

export type Handedness = 'Left' | 'Right'

export interface UseHandTrackingReturn {
  landmarks: Landmark[] | null
  handedness: Handedness | null
  isHandDetected: boolean
  isModelReady: boolean
  fps: number
  /** Pose do quadro (rosto + ombros). null enquanto o rastreador de corpo não está disponível. */
  pose: PoseData | null
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isVideoReady: boolean
): UseHandTrackingReturn {
  const animFrameRef = useRef<number>(0)
  const processingRef = useRef(false)
  const lastFpsTimeRef = useRef(performance.now())
  const frameCountRef = useRef(0)
  const frameIndexRef = useRef(0)
  const poseRef = useRef<PoseData | null>(null)

  const [landmarks, setLandmarks]     = useState<Landmark[] | null>(null)
  const [handedness, setHandedness]   = useState<Handedness | null>(null)
  const [isHandDetected, setIsHandDetected] = useState(false)
  const [isModelReady, setIsModelReady]     = useState(false)
  const [fps, setFps] = useState(0)
  const [pose, setPose] = useState<PoseData | null>(null)

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
      // Publica a pose junto com a mão (mesma renderização). Se a pose não rodou
      // neste quadro, o objeto é o mesmo e o React não renderiza de novo.
      setPose(poseRef.current)

      frameCountRef.current++
      const now = performance.now()
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current)
        frameCountRef.current = 0
        lastFpsTimeRef.current = now
      }
    }

    const handsLoaded = getHandsInstance(onResults)
    handsLoaded.then(() => {
      if (!cancelled) setIsModelReady(true)
    })
    // A pose só carrega DEPOIS do rastreador de mãos (ver lib/pose.ts: as duas
    // bibliotecas disputam uma variável global). Se falhar, o app segue só com a mão.
    void initPose(handsLoaded)

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
      // Pose antes da mão, para os dois resultados chegarem juntos ao onResults
      if (poseReady() && frameIndexRef.current++ % POSE_EVERY_N_FRAMES === 0) {
        poseRef.current = detectPose(video)
      }
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

  return { landmarks, handedness, isHandDetected, isModelReady, fps, pose }
}
