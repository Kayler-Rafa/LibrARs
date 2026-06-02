import { useEffect, useRef, useState, useCallback } from 'react'

type FacingMode = 'user' | 'environment'

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isReady: boolean
  error: string | null
  facingMode: FacingMode
  toggleCamera: () => void
  /** Proporção real do vídeo da câmera (largura/altura), ex: 0.75 em retrato */
  aspectRatio: number
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>('user')
  const [aspectRatio, setAspectRatio] = useState(16 / 9)

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

  const handleVideoReady = useCallback(() => {
    setIsReady(true)
    const video = videoRef.current
    if (video && video.videoWidth && video.videoHeight) {
      setAspectRatio(video.videoWidth / video.videoHeight)
    }
  }, [])

  // Attach listeners when videoRef mounts. loadedmetadata garante videoWidth/Height.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.addEventListener('loadeddata', handleVideoReady)
    video.addEventListener('loadedmetadata', handleVideoReady)
    return () => {
      video.removeEventListener('loadeddata', handleVideoReady)
      video.removeEventListener('loadedmetadata', handleVideoReady)
    }
  }, [handleVideoReady])

  const toggleCamera = useCallback(() => {
    setFacingMode(m => (m === 'user' ? 'environment' : 'user'))
  }, [])

  return { videoRef, isReady, error, facingMode, toggleCamera, aspectRatio }
}
