import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { PoseData } from '@/types'

/**
 * Rastreador de pose (Item 2 — referência corporal).
 *
 * PoseLandmarker (modelo lite) do @mediapipe/tasks-vision, modo VIDEO, uma pessoa.
 * Roda ao lado do rastreador de mãos atual, que não muda. Só 7 pontos são usados.
 *
 * Singleton, como o de mãos: o WASM é inicializado uma única vez por página.
 * A versão do pacote, do WASM e do modelo é fixa — mudar qualquer uma pode
 * alterar os pontos e, com isso, as features gravadas.
 */

const TASKS_VISION_VERSION = '0.10.21'   // igual à versão fixada no package.json
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

/** Índices do modelo: nariz, olhos, cantos da boca, ombros (nesta ordem em PoseData.points). */
export const POSE_INDICES = [0, 2, 5, 9, 10, 11, 12] as const
export const POSE_VISIBILITY_MIN = 0.5

let landmarker: PoseLandmarker | null = null
let initPromise: Promise<boolean> | null = null
let lastTimestamp = 0
let failures = 0

/**
 * Carrega o modelo (uma vez). Resolve false se não foi possível — o app segue só com a mão.
 *
 * @param after promessa que precisa terminar ANTES da carga — a inicialização do
 * rastreador de mãos. As duas bibliotecas disputam a variável global `Module` do
 * WebAssembly: o tasks-vision usa a que encontrar e a apaga ao terminar, e o
 * carregador do @mediapipe/hands depende dela enquanto baixa seus arquivos.
 * Carregadas ao mesmo tempo, o rastreador de mãos aborta. Por isso a pose só
 * começa depois, e com `Module` escondida durante a carga.
 */
export function initPose(after: Promise<unknown> = Promise.resolve()): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      try { await after } catch { /* a pose não depende do sucesso da mão */ }

      const globals = self as unknown as { Module?: unknown }
      const handsModule = globals.Module
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
        const create = (delegate: 'GPU' | 'CPU') => {
          globals.Module = undefined   // senão o tasks-vision reaproveita a do rastreador de mãos
          return PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        }
        try {
          landmarker = await create('GPU')
        } catch {
          landmarker = await create('CPU')   // aparelhos sem WebGL utilizável
        }
        return true
      } catch (e) {
        console.warn('[pose] não foi possível carregar o rastreador de corpo:', e)
        return false
      } finally {
        if (handsModule !== undefined) globals.Module = handsModule
      }
    })()
  }
  return initPromise
}

export function poseReady(): boolean {
  return landmarker !== null
}

/**
 * Detecta a pose no quadro atual do vídeo. Síncrono (alguns ms).
 * Retorna null se o rastreador não está disponível.
 */
export function detectPose(video: HTMLVideoElement): PoseData | null {
  if (!landmarker || video.videoWidth === 0 || video.videoHeight === 0) return null

  // O modo VIDEO exige carimbos de tempo estritamente crescentes
  const ts = Math.max(performance.now(), lastTimestamp + 1)
  lastTimestamp = ts

  const width = video.videoWidth
  const height = video.videoHeight

  try {
    const result = landmarker.detectForVideo(video, ts)
    failures = 0
    const lms = result.landmarks?.[0]
    if (!lms || lms.length < 13) return { points: null, ok: false, width, height }

    const visible = (i: number) => (lms[i].visibility ?? 0) >= POSE_VISIBILITY_MIN
    return {
      points: POSE_INDICES.map(i => ({ x: lms[i].x, y: lms[i].y })),
      ok: visible(0) && visible(11) && visible(12),
      width,
      height,
    }
  } catch (e) {
    // Falhas repetidas (ex.: contexto gráfico perdido) desligam a pose para não travar a câmera
    if (++failures >= 5) {
      console.warn('[pose] rastreador de corpo desligado após falhas repetidas:', e)
      landmarker = null
    }
    return null
  }
}
