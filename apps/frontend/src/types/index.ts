export interface Landmark {
  x: number
  y: number
  z: number
}

export interface GestureEntry {
  id: string
  name: string
  samples: number[][] // array de vetores 63-dim
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
