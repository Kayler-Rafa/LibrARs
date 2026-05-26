import { useEffect, useRef, useState, useCallback } from 'react'

type FacingMode = 'user' | 'environment'

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isReady: boolean
  error: string | null
  facingMode: FacingMode
  toggleCamera: () => void
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>('user')

  const startCamera = useCallback(async (mode: FacingMode) => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setIsReady(false)
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [facingMode, startCamera])

  const handleVideoReady = useCallback(() => setIsReady(true), [])

  // Attach onloadeddata listener when videoRef mounts
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.addEventListener('loadeddata', handleVideoReady)
    return () => video.removeEventListener('loadeddata', handleVideoReady)
  }, [handleVideoReady])

  const toggleCamera = useCallback(() => {
    setFacingMode(m => (m === 'user' ? 'environment' : 'user'))
  }, [])

  return { videoRef, isReady, error, facingMode, toggleCamera }
}
