import { useEffect, useRef, useState, useMemo } from 'react'
import { useGestureStore } from '@/stores/gestureStore'
import {
  normalizeLandmarks,
  landmarksToVector,
  knnClassify,
  temporalKnnClassify,
} from '@/lib/classifier'
import {
  computeBodyFeatures,
  bodyTemporal,
  BODY_WEIGHT,
  POSE_WINDOW,
  POSE_WINDOW_MIN_RATIO,
} from '@/lib/body'
import type { Landmark, PoseData } from '@/types'

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
  /** Item 2: o classificador está comparando forma + corpo (configuração B) */
  bodyActive: boolean
  /** Peso w do corpo na distância (0 quando só a forma é usada) */
  bodyWeight: number
  /** Fração dos últimos 30 quadros com pose válida; null sem rastreador de corpo */
  poseOkRatio: number | null
  /** true quando menos de metade dos últimos 30 quadros tem pose válida */
  poseWarning: boolean
}

// Confirmação baseada em tempo — agnóstica ao FPS do dispositivo (mobile ~2–10fps, desktop ~30fps)
const CONFIRM_MS_TEMPORAL = 200    // 200ms — buffer temporal já fornece contexto robusto
const CONFIRM_MS_STATIC   = 600    // 600ms — sem contexto temporal, exige mais tempo
const COOLDOWN_MS    = 1800
const PHRASE_RESET_MS = 3000

// Buffer rolante: 15 amostras × 100ms = 1.5s de contexto temporal
const BUFFER_SIZE       = 15
const SAMPLE_INTERVAL_MS = 100

export function useGestureClassifier(
  landmarks: Landmark[] | null,
  pose: PoseData | null = null
): UseGestureClassifierReturn {
  const ownGestures        = useGestureStore(s => s.gestures)
  const collectiveGestures = useGestureStore(s => s.collectiveGestures)

  const gestures = useMemo(
    () => [...ownGestures, ...collectiveGestures],
    [ownGestures, collectiveGestures]
  )

  // Item 2: o corpo só entra na distância se a biblioteca tiver vetores de corpo
  const bodyActive = useMemo(
    () => BODY_WEIGHT > 0 && gestures.some(g =>
      g.samplesBody?.some(b => b !== null) || g.temporalBody?.some(b => b !== null)),
    [gestures]
  )
  const bodyWeight = bodyActive ? BODY_WEIGHT : 0

  // Corpo: buffer paralelo ao de forma + janela dos últimos quadros com/sem pose
  const bodyBufferRef  = useRef<(number[] | null)[]>([])
  const poseWindowRef  = useRef<boolean[]>([])
  const [poseOkRatio, setPoseOkRatio] = useState<number | null>(null)
  const [poseWarning, setPoseWarning] = useState(false)

  // ── Buffer rolante de vetores normalizados (amostrado a 100ms) ──────────────
  const frameBufferRef    = useRef<number[][]>([])
  const lastSampleTimeRef = useRef<number>(0)

  // ── Estado de confirmação ───────────────────────────────────────────────────
  const candidateRef       = useRef<{ name: string; firstSeen: number } | null>(null)
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
    // Janela de enquadramento (só conta quando o rastreador de corpo está disponível)
    if (pose) {
      const win = poseWindowRef.current
      win.push(pose.ok)
      if (win.length > POSE_WINDOW) win.shift()
      const ratio = win.filter(Boolean).length / win.length
      setPoseOkRatio(Math.round(ratio * 100) / 100)
      // espera meia janela antes de avisar, para não piscar ao abrir a câmera
      setPoseWarning(win.length >= POSE_WINDOW / 2 && ratio < POSE_WINDOW_MIN_RATIO)
    }

    if (!landmarks || landmarks.length !== 21 || gestures.length === 0) {
      frameBufferRef.current    = []
      bodyBufferRef.current     = []
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
    const body   = bodyActive ? computeBodyFeatures(landmarks, pose) : null

    // Amostra o buffer a 100ms para coincidir com a taxa de gravação
    if (now - lastSampleTimeRef.current >= SAMPLE_INTERVAL_MS) {
      lastSampleTimeRef.current = now
      const buf = frameBufferRef.current
      frameBufferRef.current = buf.length >= BUFFER_SIZE
        ? [...buf.slice(1), vector]   // desliza a janela
        : [...buf, vector]
      const bbuf = bodyBufferRef.current
      bodyBufferRef.current = bbuf.length >= BUFFER_SIZE
        ? [...bbuf.slice(1), body]
        : [...bbuf, body]
    }

    const buf = frameBufferRef.current
    const bufferReady = buf.length >= Math.ceil(BUFFER_SIZE * 0.7) // 70% cheio (~1s)

    // Tenta classificação temporal primeiro; cai no estático se não disponível
    // Com corpo: D = √(Dforma² + w·Dcorpo²); sem pose válida num dos lados, só a forma
    const opts = { bodyWeight }
    const result = bufferReady
      ? (temporalKnnClassify(buf, gestures, opts, bodyActive ? bodyTemporal(bodyBufferRef.current) : null)
          ?? knnClassify(vector, gestures, opts, body))
      : knnClassify(vector, gestures, opts, body)

    const usingTemporal = bufferReady && result !== null &&
      gestures.some(g => g.temporalVectors && g.temporalVectors.length > 0)

    const confirmMs = usingTemporal ? CONFIRM_MS_TEMPORAL : CONFIRM_MS_STATIC

    if (!result) {
      candidateRef.current = null
      setIsDetecting(false)
      setConfidence(0)
      return
    }

    setIsDetecting(true)
    setConfidence(result.confidence)

    if (candidateRef.current?.name !== result.name) {
      candidateRef.current = { name: result.name, firstSeen: now }
    }

    const holdDuration      = now - candidateRef.current!.firstSeen
    const durationOk        = holdDuration >= confirmMs
    const cooldownOk        = now - lastConfirmTimeRef.current > COOLDOWN_MS
    const differentFromLast = result.name !== lastConfirmedRef.current

    if (durationOk && (cooldownOk || differentFromLast)) {
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
  }, [landmarks, pose, gestures, bodyActive, bodyWeight])

  useEffect(() => {
    return () => {
      if (phraseTimerRef.current) clearTimeout(phraseTimerRef.current)
    }
  }, [])

  return {
    currentGesture, confidence, isDetecting, history, currentPhrase,
    bodyActive, bodyWeight, poseOkRatio, poseWarning,
  }
}
