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

// O eixo z do MediaPipe é estimado por depth e varia muito entre pessoas/dispositivos.
// Nos vetores de 63-dim (x,y,z intercalados) e 252-dim (4 blocos de 63), o z está
// em todo índice i onde i%3===2. Peso 0.5 reduz o impacto do z sem quebrar os dados gravados.
function euclidean(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) {
    const d = (a[i] - b[i]) ** 2
    sum += (i % 3 === 2) ? d * 0.25 : d  // z com peso √0.25 = 0.5
  }
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

// ── Distância com referência corporal (Item 2) ───────────────────────────────

/**
 * Limiares de distância máxima.
 * `shape` são os valores calibrados para a forma da mão (não mudam).
 * `body` é a folga extra (em larguras de ombro) aceita quando o par é comparado
 * também pelo corpo: limite = √(shape² + w·body²). São valores PROVISÓRIOS — a
 * especificação pede recalibrar com os dados da coleta.
 */
const DIST_STATIC   = { shape: 1.2, body: 1.0 }   // z-damped: 1.2 equivale a ~1.5 sem amortecimento
const DIST_TEMPORAL = { shape: 3.5, body: 1.5 }   // amplo o suficiente para variação entre pessoas

function plainEuclideanSq(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return sum
}

/**
 * D = √(Dforma² + w·Dcorpo²).
 * Quando um dos dois lados não tem corpo válido (ou w = 0), usa só a forma.
 */
export function combinedDistance(
  shapeDist: number,
  bodyA: number[] | null | undefined,
  bodyB: number[] | null | undefined,
  w: number
): { dist: number; usedBody: boolean } {
  if (w <= 0 || !bodyA || !bodyB || bodyA.length !== bodyB.length)
    return { dist: shapeDist, usedBody: false }
  return { dist: Math.sqrt(shapeDist ** 2 + w * plainEuclideanSq(bodyA, bodyB)), usedBody: true }
}

interface Neighbor { dist: number; name: string; usedBody: boolean }

export interface KnnOptions {
  k?: number
  confidenceThreshold?: number
  distThreshold?: number     // limite para a distância de forma
  marginThreshold?: number   // gap mínimo entre 1º e 2º colocado — rejeita casos ambíguos
  bodyWeight?: number        // w; 0 = só forma (configuração A)
}

function decide(
  neighbors: Neighbor[],
  limits: { shape: number; body: number },
  opts: KnnOptions
): ClassificationResult | null {
  const { k = 5, confidenceThreshold = 0.6, marginThreshold = 0.15, bodyWeight = 0 } = opts
  const shapeLimit = opts.distThreshold ?? limits.shape

  if (neighbors.length === 0) return null
  neighbors.sort((a, b) => a.dist - b.dist)

  const nearest = neighbors[0]
  const limit = nearest.usedBody
    ? Math.sqrt(shapeLimit ** 2 + bodyWeight * limits.body ** 2)
    : shapeLimit
  if (nearest.dist > limit) return null

  const result = inverseDistanceVote(neighbors, k)
  if (!result) return null

  const { winner, confidence, runnerUpConf, avgWinnerDist } = result
  if (confidence < confidenceThreshold) return null
  if (confidence - runnerUpConf < marginThreshold) return null

  return { name: winner, confidence, dist: avgWinnerDist, usedBody: nearest.usedBody }
}

// ── Classificador KNN estático (frame único, fallback) ────────────────────────

/**
 * @param body features de corpo (10) do quadro atual — null/ausente = só forma
 */
export function knnClassify(
  vector: number[],
  gestures: GestureEntry[],
  opts: KnnOptions = {},
  body?: number[] | null
): ClassificationResult | null {
  if (gestures.length === 0) return null
  const w = opts.bodyWeight ?? 0

  const neighbors: Neighbor[] = []
  for (const gesture of gestures)
    gesture.samples.forEach((sample, i) => {
      if (sample.length !== vector.length) return  // ignora amostras de formato incompatível
      const d = combinedDistance(euclidean(vector, sample), body, gesture.samplesBody?.[i], w)
      neighbors.push({ ...d, name: gesture.name })
    })

  return decide(neighbors, DIST_STATIC, opts)
}

// ── Classificador KNN temporal (buffer de frames) ─────────────────────────────

/**
 * Classifica um buffer de N frames contra a biblioteca usando features temporais (252-dim).
 * Usa apenas gestos que têm `temporalVectors`. Retorna null se nenhum gesto qualificar.
 *
 * @param bodyTemporalVec vetor temporal do corpo (40) do mesmo buffer — null/ausente = só forma
 */
export function temporalKnnClassify(
  buffer: number[][],
  gestures: GestureEntry[],
  opts: KnnOptions = {},
  bodyTemporalVec?: number[] | null
): ClassificationResult | null {
  const withTemporal = gestures.filter(g => g.temporalVectors && g.temporalVectors.length > 0)
  if (withTemporal.length === 0) return null
  const w = opts.bodyWeight ?? 0

  const query = extractTemporalFeatures(buffer)
  const neighbors: Neighbor[] = []

  for (const gesture of withTemporal)
    gesture.temporalVectors!.forEach((tvec, i) => {
      if (tvec.length !== query.length) return  // ignora vetores gravados com formato anterior
      const d = combinedDistance(euclidean(query, tvec), bodyTemporalVec, gesture.temporalBody?.[i], w)
      neighbors.push({ ...d, name: gesture.name })
    })

  // nenhum vetor compatível → null (o chamador cai no KNN estático)
  return decide(neighbors, DIST_TEMPORAL, opts)
}
