import type { Landmark, GestureEntry, ClassificationResult } from '@/types'

// Normaliza landmarks usando o pulso (0) como origem e a distância
// pulso → MCP do dedo médio (9) como escala, tornando o vetor
// independente de posição e tamanho de mão.
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

// Achata 21 landmarks normalizados em vetor 63-dim [x0,y0,z0,...,x20,y20,z20]
export function landmarksToVector(landmarks: Landmark[]): number[] {
  return landmarks.flatMap(lm => [lm.x, lm.y, lm.z])
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

export function knnClassify(
  vector: number[],
  gestures: GestureEntry[],
  k = 3,
  threshold = 0.3
): ClassificationResult | null {
  if (gestures.length === 0) return null

  const neighbors: { dist: number; name: string }[] = []

  for (const gesture of gestures) {
    for (const sample of gesture.samples) {
      neighbors.push({ dist: euclidean(vector, sample), name: gesture.name })
    }
  }

  neighbors.sort((a, b) => a.dist - b.dist)
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
    if (count > maxVotes) {
      maxVotes = count
      winner = name
    }
  }

  const confidence = maxVotes / k
  if (confidence < threshold) return null

  return {
    name: winner,
    confidence,
    dist: votes[winner].totalDist / votes[winner].count,
  }
}
