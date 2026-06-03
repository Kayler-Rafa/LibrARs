import { useEffect, useRef, useState, useMemo } from 'react'
import { useGestureStore } from '@/stores/gestureStore'
import {
  normalizeLandmarks,
  landmarksToVector,
  knnClassify,
  temporalKnnClassify,
} from '@/lib/classifier'
import type { Landmark } from '@/types'

export interface HistoryEntry {
  gesture: string
  timestamp: string
}

export interface UseGestureClassifierReturn {
  currentGesture: string | null
  confidence: number
  isDetecting: boolean
  history: HistoryEntry[]
  currentPhrase: string
}

// Confirmação: quantos frames consecutivos (a ~30fps) para confirmar um gesto
const CONFIRM_FRAMES_TEMPORAL = 5    // ~167ms — o buffer já tem 1.5s de contexto
const CONFIRM_FRAMES_STATIC  = 18   // ~600ms — sem contexto temporal, exige mais frames
const COOLDOWN_MS    = 1800
const PHRASE_RESET_MS = 3000

// Buffer rolante: 15 amostras × 100ms = 1.5s de contexto temporal
const BUFFER_SIZE       = 15
const SAMPLE_INTERVAL_MS = 100

export function useGestureClassifier(landmarks: Landmark[] | null): UseGestureClassifierReturn {
  const ownGestures        = useGestureStore(s => s.gestures)
  const collectiveGestures = useGestureStore(s => s.collectiveGestures)

  const gestures = useMemo(
    () => [...ownGestures, ...collectiveGestures],
    [ownGestures, collectiveGestures]
  )

  // ── Buffer rolante de vetores normalizados (amostrado a 100ms) ──────────────
  const frameBufferRef    = useRef<number[][]>([])
  const lastSampleTimeRef = useRef<number>(0)

  // ── Estado de confirmação ───────────────────────────────────────────────────
  const candidateRef       = useRef<{ name: string; frames: number } | null>(null)
  const lastConfirmedRef   = useRef<string | null>(null)
  const lastConfirmTimeRef = useRef<number>(0)

  // ── Frase acumulada ─────────────────────────────────────────────────────────
  const phraseWordsRef  = useRef<string[]>([])
  const phraseTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [currentGesture, setCurrentGesture] = useState<string | null>(null)
  const [confidence, setConfidence]         = useState(0)
  const [isDetecting, setIsDetecting]       = useState(false)
  const [history, setHistory]               = useState<HistoryEntry[]>([])
  const [currentPhrase, setCurrentPhrase]   = useState('')

  useEffect(() => {
    if (!landmarks || landmarks.length !== 21 || gestures.length === 0) {
      frameBufferRef.current    = []
      candidateRef.current      = null
      lastConfirmedRef.current  = null
      lastConfirmTimeRef.current = 0
      setIsDetecting(false)
      setCurrentGesture(null)
      setConfidence(0)
      return
    }

    const now    = performance.now()
    const vector = landmarksToVector(normalizeLandmarks(landmarks))

    // Amostra o buffer a 100ms para coincidir com a taxa de gravação
    if (now - lastSampleTimeRef.current >= SAMPLE_INTERVAL_MS) {
      lastSampleTimeRef.current = now
      const buf = frameBufferRef.current
      frameBufferRef.current = buf.length >= BUFFER_SIZE
        ? [...buf.slice(1), vector]   // desliza a janela
        : [...buf, vector]
    }

    const buf = frameBufferRef.current
    const bufferReady = buf.length >= Math.ceil(BUFFER_SIZE * 0.7) // 70% cheio (~1s)

    // Tenta classificação temporal primeiro; cai no estático se não disponível
    const result = bufferReady
      ? (temporalKnnClassify(buf, gestures) ?? knnClassify(vector, gestures))
      : knnClassify(vector, gestures)

    const usingTemporal = bufferReady && result !== null &&
      gestures.some(g => g.temporalVectors && g.temporalVectors.length > 0)

    const confirmThreshold = usingTemporal ? CONFIRM_FRAMES_TEMPORAL : CONFIRM_FRAMES_STATIC

    if (!result) {
      candidateRef.current = null
      setIsDetecting(false)
      setConfidence(0)
      return
    }

    setIsDetecting(true)
    setConfidence(result.confidence)

    if (candidateRef.current?.name === result.name) {
      candidateRef.current.frames++
    } else {
      candidateRef.current = { name: result.name, frames: 1 }
    }

    const framesOk       = candidateRef.current.frames >= confirmThreshold
    const cooldownOk     = now - lastConfirmTimeRef.current > COOLDOWN_MS
    const differentFromLast = result.name !== lastConfirmedRef.current

    if (framesOk && (cooldownOk || differentFromLast)) {
      lastConfirmedRef.current   = result.name
      lastConfirmTimeRef.current = now

      const ts = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
      setCurrentGesture(result.name)
      setHistory(prev => [{ gesture: result.name, timestamp: ts }, ...prev].slice(0, 10))

      phraseWordsRef.current = [...phraseWordsRef.current, result.name]
      setCurrentPhrase(phraseWordsRef.current.join(' '))

      if (phraseTimerRef.current) clearTimeout(phraseTimerRef.current)
      phraseTimerRef.current = setTimeout(() => {
        phraseWordsRef.current = []
        setCurrentPhrase('')
        setCurrentGesture(null)
      }, PHRASE_RESET_MS)
    }
  }, [landmarks, gestures])

  useEffect(() => {
    return () => {
      if (phraseTimerRef.current) clearTimeout(phraseTimerRef.current)
    }
  }, [])

  return { currentGesture, confidence, isDetecting, history, currentPhrase }
}
