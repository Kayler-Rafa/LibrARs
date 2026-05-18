import { useState, useRef, useEffect, useCallback } from 'react'
import { normalizeLandmarks, landmarksToVector } from '@/lib/classifier'
import { useGestureStore } from '@/stores/gestureStore'
import type { Landmark } from '@/types'

interface GestureRecorderProps {
  landmarks: Landmark[] | null
  isHandDetected: boolean
}

const MIN_SAMPLES = 10
const MAX_SAMPLES = 150
const SAMPLE_INTERVAL_MS = 100 // ~10 amostras/s → 40 amostras em 4s

export function GestureRecorder({ landmarks, isHandDetected }: GestureRecorderProps) {
  const [name, setName] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [sampleCount, setSampleCount] = useState(0)
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null)

  const samplesRef = useRef<number[][]>([])
  const lastSampleTimeRef = useRef(0)

  const addGesture = useGestureStore(s => s.addGesture)

  // Coleta amostras a cada SAMPLE_INTERVAL_MS enquanto grava
  useEffect(() => {
    if (!isRecording || !landmarks || landmarks.length !== 21) return
    if (samplesRef.current.length >= MAX_SAMPLES) return

    const now = performance.now()
    if (now - lastSampleTimeRef.current < SAMPLE_INTERVAL_MS) return
    lastSampleTimeRef.current = now

    const vector = landmarksToVector(normalizeLandmarks(landmarks))
    samplesRef.current.push(vector)
    setSampleCount(samplesRef.current.length)
  }, [landmarks, isRecording])

  const startRecording = useCallback(() => {
    samplesRef.current = []
    setSampleCount(0)
    setFeedback(null)
    lastSampleTimeRef.current = 0
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(() => setIsRecording(false), [])

  const save = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed || samplesRef.current.length < MIN_SAMPLES) {
      setFeedback('error')
      return
    }
    addGesture(trimmed, [...samplesRef.current])
    setName('')
    setSampleCount(0)
    samplesRef.current = []
    setFeedback('saved')
    setTimeout(() => setFeedback(null), 2500)
  }, [name, addGesture])

  const progress = Math.min((sampleCount / 40) * 100, 100)
  const canRecord = name.trim().length > 0 && isHandDetected && !isRecording
  const canSave = !isRecording && sampleCount >= MIN_SAMPLES

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-gray-800 text-base">Gravar Novo Gesto</h2>

      {/* Nome */}
      <div>
        <label htmlFor="gesture-name" className="block text-sm font-medium text-gray-700 mb-1.5">
          Nome do gesto
        </label>
        <input
          id="gesture-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && canRecord && startRecording()}
          placeholder="Ex: OLÁ, OBRIGADO, ÁGUA…"
          disabled={isRecording}
          maxLength={30}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 uppercase placeholder:normal-case"
          aria-label="Nome do gesto a gravar"
        />
      </div>

      {/* Aviso: sem mão */}
      {!isHandDetected && !isRecording && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ✋ Mostre sua mão na câmera antes de gravar
        </p>
      )}

      {/* Status de gravação */}
      {isRecording && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-700">Gravando…</span>
            </div>
            <span className="text-sm font-mono text-gray-600">
              {sampleCount} / {MAX_SAMPLES}
            </span>
          </div>
          {/* Barra de progresso (meta: 40 amostras) */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={sampleCount}
              aria-valuemax={40}
              aria-label="Progresso de amostras"
            />
          </div>
          <p className="text-xs text-gray-400 text-center">
            {sampleCount < 40
              ? `${40 - sampleCount} amostras até o mínimo recomendado`
              : 'Bom! Pode parar ou continuar para mais precisão.'}
          </p>
        </div>
      )}

      {/* Amostras coletadas (pós-gravação) */}
      {!isRecording && sampleCount > 0 && feedback !== 'saved' && (
        <p className="text-sm text-gray-500 text-center">
          {sampleCount} amostras coletadas
          {sampleCount < MIN_SAMPLES && (
            <span className="text-red-500"> (mínimo: {MIN_SAMPLES})</span>
          )}
        </p>
      )}

      {/* Feedback */}
      {feedback === 'saved' && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
          ✓ Gesto &quot;{name || 'salvo'}&quot; adicionado à biblioteca!
        </p>
      )}
      {feedback === 'error' && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
          Mínimo de {MIN_SAMPLES} amostras necessário.
        </p>
      )}

      {/* Botões */}
      <div className="flex gap-2">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!canRecord}
            className="flex-1 bg-red-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Iniciar gravação de gesto"
          >
            ● Gravar
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            aria-label="Parar gravação"
          >
            ■ Parar
          </button>
        )}

        <button
          onClick={save}
          disabled={!canSave}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Salvar gesto gravado"
        >
          Salvar
        </button>
      </div>

      {sampleCount >= MAX_SAMPLES && (
        <p className="text-xs text-gray-400 text-center">
          Máximo de {MAX_SAMPLES} amostras atingido — pare e salve.
        </p>
      )}
    </div>
  )
}
