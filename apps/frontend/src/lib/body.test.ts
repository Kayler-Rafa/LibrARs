import { describe, it, expect } from 'vitest'
import { computeBodyFeatures, buildBodyFrame, bodyTemporal, BODY_DIM, BODY_TEMPORAL_DIM } from './body'
import { knnClassify, temporalKnnClassify, combinedDistance, normalizeLandmarks, landmarksToVector } from './classifier'
import type { Landmark, PoseData, GestureEntry } from '@/types'

// ── Cenário sintético ─────────────────────────────────────────────────────────
// Vídeo 640×480. Pessoa de frente: ombros a 200 px um do outro, na altura y=300.
//   O (meio dos ombros) = (320, 300)   S = 200 px
const W = 640, H = 480

function makePose(ok = true, scale = 1, dx = 0, dy = 0): PoseData {
  const px = (x: number, y: number) => ({
    x: (320 + (x - 320) * scale + dx) / W,
    y: (300 + (y - 300) * scale + dy) / H,
  })
  return {
    points: [
      px(320, 160),   // nariz
      px(300, 140),   // olho esq.
      px(340, 140),   // olho dir.
      px(305, 185),   // boca esq.
      px(335, 185),   // boca dir.
      px(220, 300),   // ombro esq.
      px(420, 300),   // ombro dir.
    ],
    ok,
    width: W,
    height: H,
  }
}

/** Mesma forma de mão (dedos para cima), com o pulso em (cx, cy) pixels. */
function makeHand(cx: number, cy: number, scale = 1): Landmark[] {
  const offsets: [number, number][] = [
    [0, 0],                                         // 0 pulso
    [-20, -10], [-35, -25], [-45, -40], [-50, -55], // polegar
    [-15, -50], [-17, -75], [-18, -90], [-18, -105],// indicador (8 = ponta)
    [0, -55], [0, -82], [0, -100], [0, -115],       // médio
    [14, -50], [16, -74], [17, -90], [17, -102],    // anelar
    [26, -42], [30, -60], [32, -72], [33, -82],     // mínimo
  ]
  return offsets.map(([ox, oy]) => ({
    x: (cx + ox * scale) / W,
    y: (cy + oy * scale) / H,
    z: 0,
  }))
}

const shapeVector = (hand: Landmark[]) => landmarksToVector(normalizeLandmarks(hand))

describe('features de corpo (Item 2)', () => {
  it('gera 10 valores no sistema de referência dos ombros', () => {
    const hand = makeHand(320, 300)   // pulso exatamente no meio dos ombros
    const f = computeBodyFeatures(hand, makePose())!
    expect(f).toHaveLength(BODY_DIM)
    // r(pulso) = (0, 0)
    expect(f[0]).toBeCloseTo(0, 6)
    expect(f[1]).toBeCloseTo(0, 6)
    // ponta do indicador em (302, 195): r = (-18/200, -105/200)
    expect(f[2]).toBeCloseTo(-0.09, 6)
    expect(f[3]).toBeCloseTo(-0.525, 6)
    // indicador → nariz (320,160): √(18² + 35²) / 200
    expect(f[6]).toBeCloseTo(Math.hypot(18, 35) / 200, 6)
    // indicador → boca (320,185): √(18² + 10²) / 200
    expect(f[7]).toBeCloseTo(Math.hypot(18, 10) / 200, 6)
    // indicador → olhos (320,140): √(18² + 55²) / 200
    expect(f[8]).toBeCloseTo(Math.hypot(18, 55) / 200, 6)
    // centro da palma = média dos pontos 0, 5, 9, 13, 17 → (325, 260.6); distância até O
    expect(f[4]).toBeCloseTo(5 / 200, 6)
    expect(f[5]).toBeCloseTo(-39.4 / 200, 6)
    expect(f[9]).toBeCloseTo(Math.hypot(5, 39.4) / 200, 6)
  })

  it('o mesmo formato de mão na testa e no peito gera vetores de corpo diferentes', () => {
    const forehead = makeHand(320, 230)   // ponta do indicador na altura da testa
    const chest = makeHand(320, 400)      // mão na frente do peito

    // A forma da mão (vetor de 63 valores, centrado no pulso) é idêntica…
    const vForehead = shapeVector(forehead)
    const vChest = shapeVector(chest)
    vForehead.forEach((v, i) => expect(v).toBeCloseTo(vChest[i], 9))

    // …mas o corpo é bem diferente
    const bForehead = computeBodyFeatures(forehead, makePose())!
    const bChest = computeBodyFeatures(chest, makePose())!
    const d = Math.hypot(...bForehead.map((v, i) => v - bChest[i]))
    expect(d).toBeGreaterThan(1)   // mais de uma largura de ombro de diferença
    // na testa o indicador está perto dos olhos; no peito, longe
    expect(bForehead[8]).toBeLessThan(0.3)
    expect(bChest[8]).toBeGreaterThan(0.6)
  })

  it('não depende da distância da câmera nem da posição da pessoa no quadro', () => {
    const near = computeBodyFeatures(makeHand(320, 230), makePose())!
    // pessoa mais longe (metade do tamanho) e deslocada no quadro; a mão acompanha
    const s = 0.5, dx = 90, dy = -40
    const farHand = makeHand(320 + dx, 300 + (230 - 300) * s + dy, s)
    const far = computeBodyFeatures(farHand, makePose(true, s, dx, dy))!
    near.forEach((v, i) => expect(far[i]).toBeCloseTo(v, 6))
  })

  it('devolve null quando a pose não é válida', () => {
    const hand = makeHand(320, 230)
    expect(computeBodyFeatures(hand, null)).toBeNull()
    expect(computeBodyFeatures(hand, makePose(false))).toBeNull()
    expect(computeBodyFeatures(hand, { points: null, ok: false, width: W, height: H })).toBeNull()
  })

  it('monta o registro do quadro com pontos brutos em pixels, features e pose_ok', () => {
    const frame = buildBodyFrame(makeHand(320, 230), makePose())
    expect(frame.pose_ok).toBe(true)
    expect(frame.pose).toHaveLength(7)
    expect(frame.pose![0]).toEqual([320, 160])     // nariz, em pixels
    expect(frame.pose![5]).toEqual([220, 300])     // ombro
    expect(frame.hand).toHaveLength(3)
    expect(frame.hand[0]).toEqual([320, 230])      // pulso
    expect(frame.features).toHaveLength(BODY_DIM)
    expect(frame.size).toEqual([W, H])

    // Pose detectada mas inválida: guarda os pontos brutos, sem features
    const bad = buildBodyFrame(makeHand(320, 230), makePose(false))
    expect(bad.pose_ok).toBe(false)
    expect(bad.features).toBeNull()
    expect(bad.pose).toHaveLength(7)

    // Sem rastreador de corpo
    const none = buildBodyFrame(makeHand(320, 230), null)
    expect(none).toMatchObject({ pose: null, features: null, pose_ok: false })
  })
})

describe('vetor temporal do corpo', () => {
  const f = (v: number) => new Array(BODY_DIM).fill(v)

  it('aplica os 4 blocos (média, desvio, velocidade, deslocamento) às 10 features', () => {
    const t = bodyTemporal([f(0), f(1), f(2)])!
    expect(t).toHaveLength(BODY_TEMPORAL_DIM)
    expect(t[0]).toBeCloseTo(1)                       // média
    expect(t[10]).toBeCloseTo(Math.sqrt(2 / 3))       // desvio-padrão
    expect(t[20]).toBeCloseTo(1)                      // velocidade média
    expect(t[30]).toBeCloseTo(2)                      // deslocamento total
  })

  it('usa só os quadros com pose e exige pelo menos metade deles', () => {
    expect(bodyTemporal([f(1), null, f(1), f(1)])).not.toBeNull()
    expect(bodyTemporal([f(1), null, null, null])).toBeNull()
    expect(bodyTemporal([])).toBeNull()
  })
})

describe('distância do k-NN com corpo: D = √(Dforma² + w·Dcorpo²)', () => {
  it('combina forma e corpo com o peso w', () => {
    const a = new Array(BODY_DIM).fill(0)
    const b = [3, ...new Array(BODY_DIM - 1).fill(0)]   // Dcorpo = 3
    expect(combinedDistance(4, a, b, 1)).toEqual({ dist: 5, usedBody: true })
    expect(combinedDistance(4, a, b, 4).dist).toBeCloseTo(Math.sqrt(16 + 4 * 9))
  })

  it('usa só a forma (w = 0) quando um dos lados não tem pose válida', () => {
    const a = new Array(BODY_DIM).fill(0)
    expect(combinedDistance(4, a, null, 1)).toEqual({ dist: 4, usedBody: false })
    expect(combinedDistance(4, null, a, 1)).toEqual({ dist: 4, usedBody: false })
    expect(combinedDistance(4, a, a, 0)).toEqual({ dist: 4, usedBody: false })
  })

  // Dois sinais com a MESMA forma de mão, um na testa e outro no peito
  const pose = makePose()
  const foreheadHand = makeHand(320, 230)
  const chestHand = makeHand(320, 400)
  const vec = shapeVector(foreheadHand)
  const bForehead = computeBodyFeatures(foreheadHand, pose)!
  const bChest = computeBodyFeatures(chestHand, pose)!

  const entry = (name: string, body: number[] | null): GestureEntry => ({
    id: name, name, samples: [vec, vec, vec], samplesBody: [body, body, body],
    sampleCount: 3, createdAt: '', updatedAt: '',
  })
  const library = [entry('TESTA', bForehead), entry('PEITO', bChest)]

  it('só com a forma (configuração A) os dois sinais são indistinguíveis', () => {
    // A resposta é a mesma com a mão na testa ou no peito: o lugar não é levado em conta
    const top = knnClassify(vec, library, { bodyWeight: 0 }, bForehead)
    const low = knnClassify(vec, library, { bodyWeight: 0 }, bChest)
    expect(top?.name).toBe(low?.name)
    expect(top?.usedBody ?? false).toBe(false)
  })

  it('com o corpo (configuração B) cada sinal é reconhecido no seu lugar', () => {
    const top = knnClassify(vec, library, { bodyWeight: 1 }, bForehead)
    expect(top).toMatchObject({ name: 'TESTA', usedBody: true })
    const low = knnClassify(vec, library, { bodyWeight: 1 }, bChest)
    expect(low).toMatchObject({ name: 'PEITO', usedBody: true })
  })

  it('sem pose no quadro atual, volta a comparar só a forma', () => {
    const noPose = knnClassify(vec, library, { bodyWeight: 1 }, null)
    const shapeOnly = knnClassify(vec, library, { bodyWeight: 0 }, null)
    expect(noPose).toEqual(shapeOnly)
    expect(noPose?.usedBody ?? false).toBe(false)
  })

  it('gravações antigas (sem corpo) continuam sendo reconhecidas pela forma', () => {
    const old: GestureEntry = {
      id: 'old', name: 'ANTIGO', samples: [vec, vec, vec],
      sampleCount: 3, createdAt: '', updatedAt: '',
    }
    expect(knnClassify(vec, [old], { bodyWeight: 1 }, bForehead))
      .toMatchObject({ name: 'ANTIGO', usedBody: false })
  })

  it('o caminho temporal também separa os dois sinais pelo corpo', () => {
    const buffer = new Array(12).fill(vec)
    const shapeTemporal = [...vec, ...new Array(63 * 3).fill(0)]   // sinal parado
    const tb = (b: number[]) => bodyTemporal(new Array(12).fill(b))!
    const tEntry = (name: string, b: number[]): GestureEntry => ({
      id: name, name, samples: [], temporalVectors: [shapeTemporal, shapeTemporal],
      temporalBody: [tb(b), tb(b)], sampleCount: 0, createdAt: '', updatedAt: '',
    })
    const lib = [tEntry('TESTA', bForehead), tEntry('PEITO', bChest)]

    expect(temporalKnnClassify(buffer, lib, { bodyWeight: 0 }, tb(bChest))).toBeNull()
    expect(temporalKnnClassify(buffer, lib, { bodyWeight: 1 }, tb(bChest)))
      .toMatchObject({ name: 'PEITO', usedBody: true })
    expect(temporalKnnClassify(buffer, lib, { bodyWeight: 1 }, tb(bForehead)))
      .toMatchObject({ name: 'TESTA', usedBody: true })
  })
})
