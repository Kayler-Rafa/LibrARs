import { useState, useCallback } from 'react'
import { CameraFeed } from '@/components/camera/CameraFeed'
import { GestureRecorder } from '@/components/gestures/GestureRecorder'
import { GestureLibrary } from '@/components/gestures/GestureLibrary'
import type { Landmark } from '@/types'
import type { Handedness } from '@/hooks/useHandTracking'

export default function Train() {
  const [landmarks, setLandmarks]     = useState<Landmark[] | null>(null)
  const [isHandDetected, setIsHandDetected] = useState(false)
  const [handedness, setHandedness]   = useState<Handedness | null>(null)

  const handleLandmarks = useCallback(
    (lms: Landmark[] | null, detected: boolean, hnd: Handedness | null) => {
      setLandmarks(lms)
      setIsHandDetected(detected)
      setHandedness(hnd)
    },
    []
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Treinar Gestos</h1>
        <p className="text-sm text-gray-500">
          Grave gestos de Libras para o classificador aprender
        </p>
      </div>

      <CameraFeed onLandmarks={handleLandmarks} />

      <GestureRecorder landmarks={landmarks} isHandDetected={isHandDetected} handedness={handedness} />

      <GestureLibrary />
    </div>
  )
}
