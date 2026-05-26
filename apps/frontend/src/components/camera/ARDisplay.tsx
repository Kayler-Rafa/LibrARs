interface ARDisplayProps {
  gesture: string | null
  confidence: number
  isDetecting: boolean
}

function confidenceColor(c: number) {
  if (c >= 0.7) return { bar: 'bg-green-500', text: 'text-green-400' }
  if (c >= 0.45) return { bar: 'bg-yellow-400', text: 'text-yellow-300' }
  return { bar: 'bg-red-500', text: 'text-red-400' }
}

export function ARDisplay({ gesture, confidence, isDetecting }: ARDisplayProps) {
  if (!gesture && !isDetecting) return null

  const { bar, text } = confidenceColor(confidence)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-10">
      {gesture && (
        <div key={gesture} className="animate-fade-in-scale flex flex-col items-center gap-2">
          {/* Texto principal AR */}
          <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-4 border border-white/10 shadow-2xl">
            <p className="text-white text-4xl font-black tracking-widest drop-shadow-lg">
              {gesture}
            </p>
          </div>

          {/* Barra de confiança */}
          <div className="flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5 backdrop-blur-sm">
            <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full ${bar} transition-all duration-300`}
                style={{ width: `${Math.round(confidence * 100)}%` }}
                role="meter"
                aria-valuenow={Math.round(confidence * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Confiança: ${Math.round(confidence * 100)}%`}
              />
            </div>
            <span className={`text-xs font-mono font-semibold ${text}`}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Indicador de detecção sem gesto confirmado */}
      {isDetecting && !gesture && (
        <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-1.5 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-white/70 text-xs">Analisando…</span>
        </div>
      )}
    </div>
  )
}
