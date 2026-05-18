import { useEffect } from 'react'
import { useCamera } from '@/hooks/useCamera'
import { useHandTracking } from '@/hooks/useHandTracking'
import { CanvasOverlay } from './CanvasOverlay'
import type { Landmark } from '@/types'

interface CameraFeedProps {
  onLandmarks?: (landmarks: Landmark[] | null, isHandDetected: boolean) => void
  /** Conteúdo renderizado dentro do container do vídeo (ex: ARDisplay) */
  children?: React.ReactNode
}

function StatusBadge({
  active,
  label,
  color,
}: {
  active: boolean
  label: string
  color: 'green' | 'yellow' | 'gray' | 'blue'
}) {
  const colors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    gray: 'bg-gray-400',
    blue: 'bg-blue-500',
  }
  return (
    <span
      className="flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm"
      role="status"
      aria-label={label}
    >
      <span
        className={`w-2 h-2 rounded-full ${active ? colors[color] : 'bg-gray-500'} ${active ? 'animate-pulse' : ''}`}
      />
      {label}
    </span>
  )
}

export function CameraFeed({ onLandmarks, children }: CameraFeedProps) {
  const { videoRef, isReady, error, facingMode, toggleCamera } = useCamera()
  const { landmarks, isHandDetected, isModelReady, fps } = useHandTracking(videoRef, isReady)

  const mirrored = facingMode === 'user'

  useEffect(() => {
    onLandmarks?.(landmarks, isHandDetected)
  }, [landmarks, isHandDetected, onLandmarks])

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
          role="alert"
        >
          <strong>Erro de câmera:</strong> {error}
        </div>
      )}

      <div className="relative bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
          aria-label="Feed da câmera"
        />

        <CanvasOverlay landmarks={landmarks} mirrored={mirrored} />

        {/* Slot para overlays externos (ex: ARDisplay) */}
        {children}

        {isReady && !isModelReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-white text-center">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Carregando modelo de IA...</p>
              <p className="text-xs text-white/60 mt-1">Primeira vez pode demorar ~10s</p>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <StatusBadge
            active={isReady}
            label={isReady ? 'Câmera ativa' : 'Iniciando câmera…'}
            color="green"
          />
          {isReady && (
            <StatusBadge
              active={isModelReady}
              label={isModelReady ? 'IA pronta' : 'Carregando IA…'}
              color="blue"
            />
          )}
          {isModelReady && (
            <StatusBadge
              active={isHandDetected}
              label={isHandDetected ? 'Mão detectada' : 'Nenhuma mão'}
              color={isHandDetected ? 'green' : 'gray'}
            />
          )}
        </div>

        {isModelReady && (
          <div className="absolute top-3 right-3 bg-black/60 text-white/70 text-xs px-2 py-1 rounded-full backdrop-blur-sm font-mono">
            {fps} fps
          </div>
        )}

        <button
          onClick={toggleCamera}
          className="absolute bottom-3 right-3 bg-black/60 text-white p-2.5 rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm"
          aria-label={`Alternar para câmera ${facingMode === 'user' ? 'traseira' : 'frontal'}`}
          title="Trocar câmera"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {isHandDetected && (
        <p className="text-center text-sm text-green-600 font-medium">
          ✋ Mão detectada
        </p>
      )}
    </div>
  )
}
