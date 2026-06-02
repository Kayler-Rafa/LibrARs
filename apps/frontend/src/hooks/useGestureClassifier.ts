import { useEffect, useRef, useState, useMemo } from 'react'
import { useGestureStore } from '@/stores/gestureStore'
import { normalizeLandmarks, landmarksToVector, knnClassify } from '@/lib/classifier'
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

const CONFIRM_FRAMES = 18      // frames consecutivos para confirmar gesto (~0.6s a 30fps)
const COOLDOWN_MS = 1800       // intervalo mínimo entre confirmações
const PHRASE_RESET_MS = 3000   // sem novo gesto após Xs → frase encerrada

export function useGestureClassifier(landmarks: Landmark[] | null): UseGestureClassifierReturn {
  const ownGestures = useGestureStore(s => s.gestures)
  const collectiveGestures = useGestureStore(s => s.collectiveGestures)

  // Combina gestos próprios + base coletiva (de todos os participantes).
  // useMemo evita recriar o array a cada frame.
  const gestures = useMemo(
    () => [...ownGestures, ...collectiveGestures],
    [ownGestures, collectiveGestures]
  )

  const candidateRef = useRef<{ name: string; frames: number } | null>(null)
  const lastConfirmedRef = useRef<string | null>(null)
  const lastConfirmTimeRef = useRef<number>(0)
  const phraseWordsRef = useRef<string[]>([])
  const phraseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [currentGesture, setCurrentGesture] = useState<string | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [isDetecting, setIsDetecting] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [currentPhrase, setCurrentPhrase] = useState('')

  useEffect(() => {
    if (!landmarks || landmarks.length !== 21 || gestures.length === 0) {
      // Mão saiu do frame — zera tudo para não herdar estado anterior
      candidateRef.current = null
      lastConfirmedRef.current = null
      lastConfirmTimeRef.current = 0
      setIsDetecting(false)
      setCurrentGesture(null)
      setConfidence(0)
      return
    }

    const vector = landmarksToVector(normalizeLandmarks(landmarks))
    const result = knnClassify(vector, gestures)

    if (!result) {
      candidateRef.current = null
      setIsDetecting(false)
      setConfidence(0)
      return
    }

    setIsDetecting(true)
    setConfidence(result.confidence)

    // Acumula frames consecutivos do mesmo gesto
    if (candidateRef.current?.name === result.name) {
      candidateRef.current.frames++
    } else {
      candidateRef.current = { name: result.name, frames: 1 }
    }

    const now = performance.now()
    const framesOk = candidateRef.current.frames >= CONFIRM_FRAMES
    const cooldownOk = now - lastConfirmTimeRef.current > COOLDOWN_MS
    const differentFromLast = result.name !== lastConfirmedRef.current

    if (framesOk && (cooldownOk || differentFromLast)) {
      lastConfirmedRef.current = result.name
      lastConfirmTimeRef.current = now

      const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setCurrentGesture(result.name)
      setHistory(prev => [{ gesture: result.name, timestamp: ts }, ...prev].slice(0, 10))

      // Modo frase: acumula palavras e reinicia timer de 3s
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

  // Limpa o timer ao desmontar
  useEffect(() => {
    return () => {
      if (phraseTimerRef.current) clearTimeout(phraseTimerRef.current)
    }
  }, [])

  return { currentGesture, confidence, isDetecting, history, currentPhrase }
}
