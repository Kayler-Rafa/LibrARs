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
const SAMPLE_INTERVAL_MS = 100

const ALPHABET    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const COMMON_SIGNS = [
  'OLÁ', 'TCHAU', 'OBRIGADO', 'POR FAVOR', 'SIM', 'NÃO',
  'AJUDA', 'ÁGUA', 'COMER', 'BANHEIRO', 'NOME', 'SURDO',
  'EU', 'VOCÊ', 'NÓS', 'ELE', 'ELA',
  'BOM', 'RUIM', 'FELIZ', 'TRISTE',
  'HOJE', 'AMANHÃ', 'ONTEM',
]

// ── Qualidade da gravação ─────────────────────────────────────────────────────

type QualityLevel = 'great' | 'good' | 'fair' | 'poor'

interface RecordingQuality {
  level: QualityLevel
  message: string
  detail: string
}

/**
 * Mede a qualidade da gravação pelo jitter — média das acelerações
 * quadro a quadro normalizadas por dimensão. Funciona para sinais
 * estáticos (jitter baixo = mão firme) e dinâmicos (jitter baixo =
 * movimento suave e controlado).
 */
function computeRecordingQuality(samples: number[][]): RecordingQuality {
  const N = samples.length
  const DIMS = 63

  if (N < 3) {
    return { level: 'poor', message: 'Poucas amostras', detail: 'Grave por mais tempo para avaliar a qualidade.' }
  }

  // Velocidades: diferença entre frames consecutivos
  const velocities = samples.slice(1).map((frame, i) =>
    frame.map((v, d) => v - samples[i][d])
  )

  // Acelerações: diferença entre velocidades consecutivas
  const accelerations = velocities.slice(1).map((vel, i) =>
    vel.map((v, d) => v - velocities[i][d])
  )

  if (accelerations.length === 0) {
    return { level: 'good', message: 'Boa qualidade', detail: 'Gravação dentro do esperado.' }
  }

  // Jitter = magnitude média das acelerações, normalizada pelo nº de dimensões
  const jitter = accelerations.reduce((sum, acc) => {
    const mag = Math.sqrt(acc.reduce((s, v) => s + v * v, 0))
    return sum + mag / Math.sqrt(DIMS)
  }, 0) / accelerations.length

  // Penaliza amostras insuficientes — eleva o limiar mínimo para "great"
  const minSamplesForGreat = 30

  if (jitter < 0.008 && N >= minSamplesForGreat) {
    return {
      level: 'great',
      message: 'Ótima qualidade',
      detail: 'Mão firme e movimento controlado. Pode salvar com confiança.',
    }
  }
  if (jitter < 0.018) {
    return {
      level: 'good',
      message: 'Boa qualidade',
      detail: 'Pequenas variações detectadas, mas dentro do normal. Ok para salvar.',
    }
  }
  if (jitter < 0.035) {
    return {
      level: 'fair',
      message: 'Qualidade regular',
      detail: 'A mão teve movimentos bruscos em alguns momentos. Regravar melhora a precisão.',
    }
  }
  return {
    level: 'poor',
    message: 'Baixa qualidade',
    detail: 'A mão estava muito instável. Recomendamos regravar com movimentos mais suaves e controlados.',
  }
}

const QUALITY_STYLE: Record<QualityLevel, { bg: string; border: string; text: string; icon: string }> = {
  great: { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-800', icon: '🟢' },
  good:  { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700', icon: '🟡' },
  fair:  { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-800', icon: '🟠' },
  poor:  { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-800',   icon: '🔴' },
}

// ── Componente ────────────────────────────────────────────────────────────────

export function GestureRecorder({ landmarks, isHandDetected }: GestureRecorderProps) {
  const [name, setName]             = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [sampleCount, setSampleCount] = useState(0)
  const [feedback, setFeedback]     = useState<'saved' | 'error' | 'saving' | 'sync-error' | null>(null)
  const [quickTab, setQuickTab]     = useState<'alphabet' | 'signs'>('alphabet')
  const [quality, setQuality]       = useState<RecordingQuality | null>(null)

  const samplesRef        = useRef<number[][]>([])
  const lastSampleTimeRef = useRef(0)

  const addGesture = useGestureStore(s => s.addGesture)

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
    setQuality(null)
    lastSampleTimeRef.current = 0
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    if (samplesRef.current.length >= MIN_SAMPLES) {
      setQuality(computeRecordingQuality(samplesRef.current))
    }
  }, [])

  const save = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || samplesRef.current.length < MIN_SAMPLES) {
      setFeedback('error')
      return
    }
    const captured = [...samplesRef.current]
    setName('')
    setSampleCount(0)
    samplesRef.current = []
    setQuality(null)
    setFeedback('saving')
    try {
      await addGesture(trimmed, captured)
      setFeedback('saved')
      setTimeout(() => setFeedback(null), 3000)
    } catch {
      setFeedback('sync-error')
      setTimeout(() => setFeedback(null), 6000)
    }
  }, [name, addGesture])

  const selectQuick = (label: string) => {
    if (!isRecording) setName(label)
  }

  const progress = Math.min((sampleCount / 40) * 100, 100)
  const canRecord = name.trim().length > 0 && isHandDetected && !isRecording
  const canSave   = !isRecording && sampleCount >= MIN_SAMPLES && feedback !== 'saving'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-gray-800 text-base">Gravar Novo Gesto</h2>

      {/* Seleção rápida */}
      <div>
        <div className="flex gap-1 mb-2 bg-gray-100 p-1 rounded-lg">
          {(['alphabet', 'signs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setQuickTab(tab)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                quickTab === tab ? 'bg-white shadow text-[#1B3A6B]' : 'text-gray-500'
              }`}
            >
              {tab === 'alphabet' ? 'Alfabeto (A–Z)' : 'Sinais comuns'}
            </button>
          ))}
        </div>

        {quickTab === 'alphabet' ? (
          <div className="flex flex-wrap gap-1.5">
            {ALPHABET.map(letter => (
              <button
                key={letter}
                onClick={() => selectQuick(letter)}
                disabled={isRecording}
                className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                  name === letter
                    ? 'bg-[#2E75B6] text-white border-[#2E75B6]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#2E75B6] hover:text-[#2E75B6]'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {COMMON_SIGNS.map(sign => (
              <button
                key={sign}
                onClick={() => selectQuick(sign)}
                disabled={isRecording}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${
                  name === sign
                    ? 'bg-[#2E75B6] text-white border-[#2E75B6]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#2E75B6] hover:text-[#2E75B6]'
                }`}
              >
                {sign}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-1.5">Clique para selecionar ou digite abaixo</p>
      </div>

      {/* Nome manual */}
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
          placeholder="Selecione acima ou digite…"
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
              <span className="text-sm font-medium text-red-700">Gravando — <strong>{name}</strong></span>
            </div>
            <span className="text-sm font-mono text-gray-600">{sampleCount} / {MAX_SAMPLES}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={sampleCount}
              aria-valuemax={40}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">
            {sampleCount < 40
              ? `${40 - sampleCount} amostras até o mínimo recomendado`
              : 'Bom! Pode parar ou continuar para mais precisão.'}
          </p>
        </div>
      )}

      {/* Amostras coletadas (pós-gravação, sem qualidade ainda) */}
      {!isRecording && sampleCount > 0 && !quality && feedback !== 'saved' && (
        <p className="text-sm text-gray-500 text-center">
          {sampleCount} amostras coletadas
          {sampleCount < MIN_SAMPLES && (
            <span className="text-red-500"> (mínimo: {MIN_SAMPLES})</span>
          )}
        </p>
      )}

      {/* Indicador de qualidade */}
      {quality && !isRecording && feedback !== 'saved' && (() => {
        const s = QUALITY_STYLE[quality.level]
        return (
          <div className={`rounded-xl border p-4 ${s.bg} ${s.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{s.icon}</span>
              <span className={`text-sm font-bold ${s.text}`}>{quality.message}</span>
              <span className="text-xs text-gray-400 ml-auto">{sampleCount} amostras</span>
            </div>
            <p className={`text-xs leading-relaxed ${s.text} opacity-90`}>{quality.detail}</p>

            {(quality.level === 'fair' || quality.level === 'poor') && (
              <button
                onClick={startRecording}
                disabled={!isHandDetected}
                className="mt-3 w-full text-xs font-semibold py-2 rounded-lg border border-current opacity-80 hover:opacity-100 transition-opacity disabled:opacity-40"
              >
                ↺ Regravar gesto
              </button>
            )}
          </div>
        )
      })()}

      {/* Feedback de salvamento */}
      {feedback === 'saving' && (
        <p className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
          Enviando para o servidor...
        </p>
      )}
      {feedback === 'saved' && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
          ✓ Gesto salvo e sincronizado com o banco!
        </p>
      )}
      {feedback === 'sync-error' && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
          ⚠️ Salvo localmente, mas falhou ao enviar ao servidor. Verifique a conexão — tente novamente pela Biblioteca.
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
          >
            ● Gravar
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            ■ Parar
          </button>
        )}

        <button
          onClick={save}
          disabled={!canSave}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Salvar
        </button>
      </div>

      {sampleCount >= MAX_SAMPLES && (
        <p className="text-xs text-gray-400 text-center">
          Máximo de {MAX_SAMPLES} amostras — pare e salve.
        </p>
      )}
    </div>
  )
}
