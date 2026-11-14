import type { Landmark, PoseData, BodyFrame } from '@/types'

/**
 * Referência corporal (Item 2): onde a mão está em relação ao rosto e aos ombros.
 *
 * Sistema de referência — todas as contas em PIXELS (x·largura, y·altura), porque
 * as coordenadas do MediaPipe vêm normalizadas por eixos diferentes:
 *   O = ponto médio dos ombros      S = distância entre os ombros
 *   r(p) = (p − O) / S              (posição em "larguras de ombro")
 *
 * As 10 features de corpo:
 *   1–2  r(pulso)                  3–4  r(ponta do indicador)   5–6  r(centro da palma)
 *   7    indicador → nariz / S     8    indicador → boca / S    9    indicador → olhos / S
 *   10   centro da palma → O / S
 */

export const BODY_DIM = 10
export const BODY_TEMPORAL_DIM = 40          // 10 × 4 blocos (média, desvio, velocidade, deslocamento)

/** Peso do corpo na distância do k-NN: D = √(Dforma² + w·Dcorpo²). Valor inicial da especificação. */
export const BODY_WEIGHT = 1
/** No Treinar, só salva a gravação com pose válida em pelo menos 80% dos quadros. */
export const POSE_RATIO_MIN = 0.8
/** No Traduzir, avisa quando menos de metade dos últimos 30 quadros tem pose válida. */
export const POSE_WINDOW = 30
export const POSE_WINDOW_MIN_RATIO = 0.5
/** Fração mínima de quadros com pose para montar o vetor temporal de corpo (igual ao servidor). */
export const BODY_TEMPORAL_MIN_RATIO = 0.5

// Ordem dos pontos em PoseData.points
const NOSE = 0, EYE_L = 1, EYE_R = 2, MOUTH_L = 3, MOUTH_R = 4, SHOULDER_L = 5, SHOULDER_R = 6
// Pontos da mão
const WRIST = 0, INDEX_TIP = 8
const PALM = [0, 5, 9, 13, 17]

type Pt = [number, number]

const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
const round = (v: number, d: number) => { const f = 10 ** d; return Math.round(v * f) / f }

/** Pulso, ponta do indicador e centro da palma, em pixels. */
function handAnchors(hand: Landmark[], w: number, h: number): [Pt, Pt, Pt] {
  const px = (i: number): Pt => [hand[i].x * w, hand[i].y * h]
  const palm: Pt = [0, 0]
  for (const i of PALM) { palm[0] += hand[i].x * w / PALM.length; palm[1] += hand[i].y * h / PALM.length }
  return [px(WRIST), px(INDEX_TIP), palm]
}

/**
 * Calcula as 10 features de corpo de um quadro.
 * Retorna null quando não há pose válida (o classificador usa só a forma da mão).
 */
export function computeBodyFeatures(hand: Landmark[], pose: PoseData | null): number[] | null {
  if (!pose || !pose.ok || !pose.points || hand.length !== 21) return null
  const { width: w, height: h } = pose
  const p = (i: number): Pt => [pose.points![i].x * w, pose.points![i].y * h]

  const shoulderL = p(SHOULDER_L), shoulderR = p(SHOULDER_R)
  const O = mid(shoulderL, shoulderR)
  const S = dist(shoulderL, shoulderR)
  if (!(S > 1)) return null   // ombros sobrepostos: escala indefinida

  const r = (q: Pt): Pt => [(q[0] - O[0]) / S, (q[1] - O[1]) / S]
  const [wrist, tip, palm] = handAnchors(hand, w, h)
  const nose = p(NOSE)
  const mouth = mid(p(MOUTH_L), p(MOUTH_R))
  const eyes = mid(p(EYE_L), p(EYE_R))

  return [
    ...r(wrist),
    ...r(tip),
    ...r(palm),
    dist(tip, nose) / S,
    dist(tip, mouth) / S,
    dist(tip, eyes) / S,
    dist(palm, O) / S,
  ]
}

/**
 * Monta o registro de corpo de um quadro para ser guardado com a gravação:
 * os 7 pontos brutos da pose (permitem recalcular as features se a fórmula mudar),
 * os 3 pontos da mão usados na conta, as 10 features e pose_ok.
 */
export function buildBodyFrame(hand: Landmark[], pose: PoseData | null): BodyFrame {
  const w = pose?.width ?? 0
  const h = pose?.height ?? 0
  const features = computeBodyFeatures(hand, pose)
  return {
    pose: pose?.points ? pose.points.map(pt => [round(pt.x * w, 1), round(pt.y * h, 1)]) : null,
    hand: w > 0 && hand.length === 21
      ? handAnchors(hand, w, h).map(pt => [round(pt[0], 1), round(pt[1], 1)])
      : [],
    features: features ? features.map(v => round(v, 5)) : null,
    pose_ok: features !== null,
    size: [w, h],
  }
}

/**
 * Vetor temporal do corpo (40 valores): os mesmos 4 blocos do vetor temporal da
 * forma, aplicados às 10 features, usando só os quadros com pose válida.
 * Retorna null se menos de metade dos quadros tiver pose.
 */
export function bodyTemporal(feats: (number[] | null)[]): number[] | null {
  const valid = feats.filter((f): f is number[] => f !== null)
  if (feats.length === 0 || valid.length === 0) return null
  if (valid.length / feats.length < BODY_TEMPORAL_MIN_RATIO) return null

  const N = valid.length
  const mean = new Array(BODY_DIM).fill(0)
  for (const f of valid) for (let i = 0; i < BODY_DIM; i++) mean[i] += f[i] / N

  const std = new Array(BODY_DIM).fill(0)
  for (const f of valid) for (let i = 0; i < BODY_DIM; i++) std[i] += (f[i] - mean[i]) ** 2 / N
  for (let i = 0; i < BODY_DIM; i++) std[i] = Math.sqrt(std[i])

  const velocity = new Array(BODY_DIM).fill(0)
  if (N >= 2)
    for (let k = 1; k < N; k++)
      for (let i = 0; i < BODY_DIM; i++) velocity[i] += (valid[k][i] - valid[k - 1][i]) / (N - 1)

  const displacement = valid[N - 1].map((v, i) => v - valid[0][i])

  return [...mean, ...std, ...velocity, ...displacement]
}
