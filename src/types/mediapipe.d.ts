// Tipos globais do MediaPipe carregado via CDN
// O pacote npm é usado apenas para tipos; a runtime vem do script CDN no index.html

import type {
  Hands as HandsClass,
  Results,
  NormalizedLandmarkList,
  LandmarkConnectionArray,
} from '@mediapipe/hands'

declare global {
  const Hands: typeof HandsClass
  const HAND_CONNECTIONS: LandmarkConnectionArray
}

export type { Results, NormalizedLandmarkList, LandmarkConnectionArray }
