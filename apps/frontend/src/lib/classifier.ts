import type { Landmark, GestureEntry, ClassificationResult } from '@/types'

const POSE_DIM = 63
const TEMPORAL_DIM = 252 // POSE_DIM × 4

// ── Normalização de landmarks ─────────────────────────────────────────────────

export function normalizeLandmarks(landmarks: Landmark[]): Landmark[] {
  const wrist = landmarks[0]
  const middleMCP = landmarks[9]

  const scale =
    Math.sqrt(
      (middleMCP.x - wrist.x) ** 2 +
        (middleMCP.y - wrist.y) ** 2 +
        (middleMCP.z - wrist.z) ** 2
    ) || 1

  return landmarks.map(lm => ({
    x: (lm.x - wrist.x) / scale,
    y: (lm.y - wrist.y) / scale,
    z: (lm.z - wrist.z) / scale,
  }))
}

export function landmarksToVector(landmarks: Landmark[]): number[] {
  return landmarks.flatMap(lm => [lm.x, lm.y, lm.z])
}

// ── Distância euclidiana ──────────────────────────────────────────────────────

function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

// ── Extração de features temporais ───────────────────────────────────────────

/**
 * Converte um buffer de N frames (cada 63-dim) em um vetor temporal de 252 dims:
 *   mean_pose (63)     — forma média da mão durante o gesto
 *   std_pose (63)      — variância por dimensão (≈0 em sinais estáticos)
 *   mean_velocity (63) — direção média do movimento frame a frame
 *   displacement (63)  — deslocamento líquido (último − primeiro frame)
 *
 * Funciona para sinais estáticos (velocidade≈0) e dinâmicos (velocidade>0),
 * permitindo um único KNN reconhecer ambos os tipos.
 */
export function extractTemporalFeatures(buffer: number[][]): number[] {
  const N = buffer.length
  if (N === 0) return new Array(TEMPORAL_DIM).fill(0)

  const meanPose = new Array(POSE_DIM).fill(0)
  for (const frame of buffer)
    for (let i = 0; i < POSE_DIM; i++) meanPose[i] += frame[i] / N

  const stdPose = new Array(POSE_DIM).fill(0)
  for (const frame of buffer)
    for (let i = 0; i < POSE_DIM; i++) stdPose[i] += (frame[i] - meanPose[i]) ** 2 / N
  for (let i = 0; i < POSE_DIM; i++) stdPose[i] = Math.sqrt(stdPose[i])

  const meanVelocity = new Array(POSE_DIM).fill(0)
  if (N >= 2) {
    for (let f = 1; f < N; f++)
      for (let i = 0; i < POSE_DIM; i++)
        meanVelocity[i] += (buffer[f][i] - buffer[f - 1][i]) / (N - 1)
  }

  const displacement = buffer[N - 1].map((v, i) => v - buffer[0][i])

  return [...meanPose, ...stdPose, ...meanVelocity, ...displacement]
}

// ── Classificador KNN estático (frame único, fallback) ────────────────────────

export function knnClassify(
  vector: number[],
  gestures: GestureEntry[],
  k = 5,
  voteThreshold = 0.6,
  distThreshold = 1.5  // amplo o suficiente para variação entre pessoas diferentes
): ClassificationResult | null {
  if (gestures.length === 0) return null

  const neighbors: { dist: number; name: string }[] = []

  for (const gesture of gestures) {
    for (const sample of gesture.samples) {
      neighbors.push({ dist: euclidean(vector, sample), name: gesture.name })
    }
  }

  neighbors.sort((a, b) => a.dist - b.dist)
  if (neighbors[0].dist > distThreshold) return null

  const kNearest = neighbors.slice(0, k)
  const votes: Record<string, { count: number; totalDist: number }> = {}
  for (const n of kNearest) {
    if (!votes[n.name]) votes[n.name] = { count: 0, totalDist: 0 }
    votes[n.name].count++
    votes[n.name].totalDist += n.dist
  }

  let winner = ''
  let maxVotes = 0
  for (const [name, { count }] of Object.entries(votes)) {
    if (count > maxVotes) { maxVotes = count; winner = name }
  }

  const confidence = maxVotes / k
  if (confidence < voteThreshold) return null

  return { name: winner, confidence, dist: votes[winner].totalDist / votes[winner].count }
}

// ── Classificador KNN temporal (buffer de frames) ─────────────────────────────

/**
 * Classifica um buffer de N frames contra a biblioteca usando features temporais (252-dim).
 * Usa apenas gestos que têm `temporalVectors`. Retorna null se nenhum gesto qualificar.
 */
export function temporalKnnClassify(
  buffer: number[][],
  gestures: GestureEntry[],
  k = 5,
  voteThreshold = 0.6,
  distThreshold = 3.5  // amplo o suficiente para variação entre pessoas diferentes
): ClassificationResult | null {
  const withTemporal = gestures.filter(g => g.temporalVectors && g.temporalVectors.length > 0)
  if (withTemporal.length === 0) return null

  const query = extractTemporalFeatures(buffer)
  const neighbors: { dist: number; name: string }[] = []

  for (const gesture of withTemporal) {
    for (const tvec of gesture.temporalVectors!) {
      neighbors.push({ dist: euclidean(query, tvec), name: gesture.name })
    }
  }

  neighbors.sort((a, b) => a.dist - b.dist)
  if (neighbors[0].dist > distThreshold) return null

  const kNearest = neighbors.slice(0, k)
  const votes: Record<string, { count: number; totalDist: number }> = {}
  for (const n of kNearest) {
    if (!votes[n.name]) votes[n.name] = { count: 0, totalDist: 0 }
    votes[n.name].count++
    votes[n.name].totalDist += n.dist
  }

  let winner = ''
  let maxVotes = 0
  for (const [name, { count }] of Object.entries(votes)) {
    if (count > maxVotes) { maxVotes = count; winner = name }
  }

  const confidence = maxVotes / k
  if (confidence < voteThreshold) return null

  return { name: winner, confidence, dist: votes[winner].totalDist / votes[winner].count }
}
