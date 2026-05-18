import type { Results } from '@/types/mediapipe'

// Singleton — WASM só pode ser inicializado uma vez por página.
// React StrictMode monta efeitos duas vezes em dev; sem singleton, o segundo
// mount tenta reinicializar o WASM já modificado e aborta.

let instance: InstanceType<typeof Hands> | null = null
let initPromise: Promise<void> | null = null
let isReady = false

type ResultsCallback = (results: Results) => void

export async function getHandsInstance(onResults: ResultsCallback): Promise<void> {
  if (!instance) {
    instance = new Hands({
      locateFile: file =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
    })

    instance.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    })
  }

  // Atualiza callback (o último mount vence)
  instance.onResults(onResults)

  if (!initPromise) {
    initPromise = instance.initialize().then(() => {
      isReady = true
    })
  }

  await initPromise
}

export function sendFrame(image: HTMLVideoElement): Promise<void> {
  if (!instance || !isReady) return Promise.resolve()
  return instance.send({ image })
}

export function handsReady(): boolean {
  return isReady
}
