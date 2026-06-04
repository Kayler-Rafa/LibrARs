export interface Landmark {
  x: number
  y: number
  z: number
}

export interface GestureEntry {
  id: string
  name: string
  samples: number[][]          // vetores 63-dim comprimidos (fallback estático)
  temporalVectors?: number[][] // vetores 315-dim por gravação (classificação temporal)
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
}

export interface SpeechState {
  transcript: string
  interimText: string
  isListening: boolean
  error: string | null
}

export type SyncStatus = 'local' | 'synced' | 'syncing' | 'error'
