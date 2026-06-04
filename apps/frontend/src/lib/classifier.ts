import type { Landmark, GestureEntry, ClassificationResult } from '@/types'

const POSE_DIM = 63
const TEMPORAL_DIM = 315 // POSE_DIM × 5

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

// O eixo z do MediaPipe é estimado por depth e varia muito entre pessoas/dispositivos.
// Nos vetores de 63-dim (x,y,z intercalados) e 315-dim (5 blocos de 63), o z está
// em todo índice i onde i%3===2. Peso 0.5 reduz o impacto do z sem quebrar os dados gravados.
function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] - b[i]) ** 2
    sum += (i % 3 === 2) ? d * 0.25 : d  // z com peso √0.25 = 0.5
  }
  return Math.sqrt(sum)
}

// ── Extração de features temporais ───────────────────────────────────────────

/**
 * Converte um buffer de N frames (cada 63-dim) em um vetor temporal de 315 dims:
 *   mean_pose (63)     — forma média da mão durante o gesto
 *   std_pose (63)      — variância por dimensão (≈0 em sinais estáticos)
 *   mean_velocity (63) — direção média do movimento frame a frame
 *   displacement (63)  — deslocamento líquido (último − primeiro frame)
 *   path_length (63)   — distância acumulada por dimensão (Σ|Δf|)
 *
 * path_length resolve o "cancelamento": movimentos circulares ou de ida-e-volta
 * têm displacement≈0 e mean_velocity≈0, mas path_length > 0, tornando-os
 * distinguíveis de sinais estáticos que também têm displacement≈0.
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
  const pathLength   = new Array(POSE_DIM).fill(0)
  if (N >= 2) {
    for (let f = 1; f < N; f++)
      for (let i = 0; i < POSE_DIM; i++) {
        const delta = buffer[f][i] - buffer[f - 1][i]
        meanVelocity[i] += delta / (N - 1)
        pathLength[i]   += Math.abs(delta)
      }
  }

  const displacement = buffer[N - 1].map((v, i) => v - buffer[0][i])

  return [...meanPose, ...stdPose, ...meanVelocity, ...displacement, ...pathLength]
}

// ── Votação KNN com pesos por distância inversa ───────────────────────────────

/**
 * Aplica votação ponderada por 1/(d² + ε) sobre os k vizinhos mais próximos.
 * Retorna { winner, confidence, runnerUpConf, avgWinnerDist } ou null se vazio.
 *
 * Usar peso inverso ao quadrado (em vez de voto simples) faz com que vizinhos
 * muito próximos dominem: um vizinho a d=0.1 vale ~100× mais que um a d=1.0.
 * Isso elimina falsos positivos causados por classe rival com muitos vizinhos
 * distantes superando uma classe com poucos vizinhos muito próximos.
 */
function inverseDistanceVote(
  neighbors: { dist: number; name: string }[],
  k: number
): { winner: string; confidence: number; runnerUpConf: number; avgWinnerDist: number } | null {
  if (neighbors.length === 0) return null

  const kNearest = neighbors.slice(0, k)
  const weights: Record<string, number> = {}

  for (const n of kNearest) {
    const w = 1.0 / (n.dist ** 2 + 1e-6)
    weights[n.name] = (weights[n.name] ?? 0) + w
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1])

  const winner = sorted[0][0]
  const confidence = sorted[0][1] / total
  const runnerUpConf = sorted[1] ? sorted[1][1] / total : 0

  const winnerNeighbors = kNearest.filter(n => n.name === winner)
  const avgWinnerDist = winnerNeighbors.reduce((s, n) => s + n.dist, 0) / winnerNeighbors.length

  return { winner, confidence, runnerUpConf, avgWinnerDist }
}

// ── Classificador KNN estático (frame único, fallback) ────────────────────────

export function knnClassify(
  vector: number[],
  gestures: GestureEntry[],
  k = 5,
  confidenceThreshold = 0.6,
  distThreshold = 1.2,   // z-damped: equivale a ~1.5 sem amortecimento
  marginThreshold = 0.25 // gap mínimo entre 1º e 2º colocado — rejeita casos ambíguos
): ClassificationResult | null {
  if (gestures.length === 0) return null

  const neighbors: { dist: number; name: string }[] = []
  for (const gesture of gestures)
    for (const sample of gesture.samples)
      neighbors.push({ dist: euclidean(vector, sample), name: gesture.name })

  neighbors.sort((a, b) => a.dist - b.dist)
  if (neighbors[0].dist > distThreshold) return null

  const result = inverseDistanceVote(neighbors, k)
  if (!result) return null

  const { winner, confidence, runnerUpConf, avgWinnerDist } = result
  const margin = confidence - runnerUpConf

  if (confidence < confidenceThreshold) return null
  if (margin < marginThreshold) return null

  return { name: winner, confidence, dist: avgWinnerDist }
}

// ── Classificador KNN temporal (buffer de frames) ─────────────────────────────

/**
 * Classifica um buffer de N frames contra a biblioteca usando features temporais (315-dim).
 * Usa apenas gestos que têm `temporalVectors`. Retorna null se nenhum gesto qualificar.
 */
export function temporalKnnClassify(
  buffer: number[][],
  gestures: GestureEntry[],
  k = 5,
  confidenceThreshold = 0.6,
  distThreshold = 3.5,   // amplo o suficiente para variação entre pessoas diferentes
  marginThreshold = 0.25 // gap mínimo entre 1º e 2º colocado — rejeita casos ambíguos
): ClassificationResult | null {
  const withTemporal = gestures.filter(g => g.temporalVectors && g.temporalVectors.length > 0)
  if (withTemporal.length === 0) return null

  const query = extractTemporalFeatures(buffer)
  const neighbors: { dist: number; name: string }[] = []

  for (const gesture of withTemporal)
    for (const tvec of gesture.temporalVectors!)
      neighbors.push({ dist: euclidean(query, tvec), name: gesture.name })

  neighbors.sort((a, b) => a.dist - b.dist)
  if (neighbors[0].dist > distThreshold) return null

  const result = inverseDistanceVote(neighbors, k)
  if (!result) return null

  const { winner, confidence, runnerUpConf, avgWinnerDist } = result
  const margin = confidence - runnerUpConf

  if (confidence < confidenceThreshold) return null
  if (margin < marginThreshold) return null

  return { name: winner, confidence, dist: avgWinnerDist }
}
