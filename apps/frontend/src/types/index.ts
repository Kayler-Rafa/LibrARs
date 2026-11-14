export interface Landmark {
  x: number
  y: number
  z: number
}

// ── Referência corporal (Item 2) ──────────────────────────────────────────────

export interface PosePoint {
  x: number   // normalizado 0–1 pela largura do vídeo (como os pontos da mão)
  y: number   // normalizado 0–1 pela altura do vídeo
}

/** Resultado do rastreador de pose para um quadro. */
export interface PoseData {
  /** 7 pontos: nariz, olho esq., olho dir., boca esq., boca dir., ombro esq., ombro dir. — null sem pessoa */
  points: PosePoint[] | null
  /** pose válida: nariz e os dois ombros com visibilidade ≥ 0,5 */
  ok: boolean
  width: number    // largura do vídeo em pixels
  height: number   // altura do vídeo em pixels
}

/** O que é guardado por quadro em `body` (alinhado ao quadro de mesmo índice em `frames`). */
export interface BodyFrame {
  pose: number[][] | null      // 7 pontos (x, y) em pixels
  hand: number[][]             // pulso, ponta do indicador e centro da palma (x, y) em pixels
  features: number[] | null    // 10 features de corpo; null sem pose válida
  pose_ok: boolean
  size: [number, number]       // largura e altura do vídeo
}

export interface GestureEntry {
  id: string
  name: string
  samples: number[][]          // vetores 63-dim comprimidos (fallback estático)
  temporalVectors?: number[][] // vetores 252-dim por gravação (classificação temporal)
  samplesBody?: (number[] | null)[]   // corpo (10) de cada amostra de `samples`; null = sem pose
  temporalBody?: (number[] | null)[]  // corpo temporal (40) de cada vetor de `temporalVectors`
  sampleCount: number
  createdAt: string
  updatedAt: string
  isPublic?: boolean
  syncStatus?: 'synced' | 'syncing' | 'error'
}

export interface ClassificationResult {
  name: string
  confidence: number
  dist: number
  usedBody?: boolean   // o vizinho mais próximo foi comparado com forma + corpo
}

export interface SpeechState {
  transcript: string
  interimText: string
  isListening: boolean
  error: string | null
}

export type SyncStatus = 'local' | 'synced' | 'syncing' | 'error'
