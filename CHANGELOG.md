# CHANGELOG — Libras AR Translator

Todas as mudanças notáveis do projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [0.4.0] — 2026-05-12

### FASE 3 — Tradução em Tempo Real (AR Overlay)

#### Adicionado
- `src/hooks/useGestureClassifier.ts` — KNN por frame com debounce (12 frames), cooldown 1.5s, reset ao perder a mão, modo frase com janela de 3s
- `src/components/camera/ARDisplay.tsx` — overlay AR com texto do gesto, barra de confiança colorida (verde/amarelo/vermelho), animação fadeInScale, indicador de detecção intermediária
- `src/index.css` — keyframe `fadeInScale` + classe `.animate-fade-in-scale`
- `src/pages/Translate.tsx` — câmera + ARDisplay + modo frase + histórico das últimas 10 traduções + aviso de banco vazio com link para Treinar

#### Alterado
- `src/components/camera/CameraFeed.tsx` — adicionada prop `children?: React.ReactNode` para slot de overlay (ARDisplay renderiza dentro do container do vídeo)

---

## [0.3.0] — 2026-05-12

### FASE 2 — Sistema de Treino e Banco Local

#### Adicionado
- `src/lib/classifier.ts` — `normalizeLandmarks` (pulso como origem, escala MCP-9), `landmarksToVector` (vetor 63-dim), `knnClassify` (KNN com votação + threshold configurável)
- `src/components/gestures/GestureRecorder.tsx` — gravação com throttle de 100ms (~10 amostras/s), barra de progresso até 40 amostras, min 10 / max 150, feedback de salvo/erro, input auto-uppercase
- `src/components/gestures/GestureLibrary.tsx` — lista de gestos com deletar individual, exportar JSON (download), importar JSON (merge sem duplicatas)
- `src/pages/Train.tsx` — layout câmera + recorder + library com compartilhamento de landmarks via `onLandmarks`
- `src/pages/Library.tsx` — página standalone da biblioteca com link para Treinar

#### Alterado
- `src/components/camera/CameraFeed.tsx` — adicionada prop opcional `onLandmarks(landmarks, isHandDetected)` via `useEffect`

---

## [0.2.0] — 2026-05-12

### FASE 1 — Câmera + Detecção de Mão

#### Adicionado
- `src/lib/mediapipe.ts` — factory `createHands()` com MediaPipe carregado via CDN (solução para incompatibilidade CJS/Rolldown do Vite 8)
- `src/types/mediapipe.d.ts` — declarações globais `Hands` e `HAND_CONNECTIONS` (tipos npm, runtime CDN)
- `src/hooks/useCamera.ts` — gerencia stream getUserMedia, troca frontal/traseira, expõe `isReady` e `error`
- `src/hooks/useHandTracking.ts` — loop rAF com flag anti-concorrente, retorna landmarks, isHandDetected, isModelReady, fps
- `src/components/camera/CanvasOverlay.tsx` — skeleton com cores por grupo de dedo (21 pontos + conexões HAND_CONNECTIONS), auto-resize pelo offsetWidth/Height
- `src/components/camera/CameraFeed.tsx` — composição completa: vídeo espelhado, canvas overlay, status badges, FPS counter, botão trocar câmera, loading overlay durante inicialização do modelo
- `src/pages/Translate.tsx` — integração do CameraFeed com layout mobile-first
- `index.html` — script CDN MediaPipe Hands 0.4.1675469240, lang pt-BR, meta description

---

## [0.1.0] — 2026-05-12

### FASE 0 — Setup e Infraestrutura

#### Adicionado
- Projeto criado com Vite 8 + React 19 + TypeScript (strict mode)
- Tailwind CSS v4 via plugin `@tailwindcss/vite`
- Dependências runtime: `@mediapipe/hands`, `@tensorflow/tfjs`, `zustand`, `@supabase/supabase-js`, `react-router-dom`, `clsx`, `tailwind-merge`
- Dependências dev: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `eslint`, `prettier`
- Configuração ESLint com regras TypeScript + React Hooks
- Configuração Prettier (single quote, no semi, 100 cols)
- GitHub Actions CI: type-check + lint + test + build
- Estrutura de pastas completa:
  - `src/components/{camera,gestures,speech,auth,ui}/`
  - `src/hooks/`, `src/lib/`, `src/stores/`, `src/pages/`, `src/types/`
  - `supabase/migrations/`, `tests/`
- `src/types/index.ts` — interfaces: `Landmark`, `GestureEntry`, `ClassificationResult`, `SpeechState`, `SyncStatus`
- `src/lib/utils.ts` — funções: `cn()`, `generateId()`, `formatDate()`
- `src/lib/supabase.ts` — client Supabase com fallback gracioso quando env vars ausentes
- `src/stores/gestureStore.ts` — Zustand store com persistência localStorage; actions: `addGesture`, `updateGesture`, `deleteGesture`, `clearAll`, `exportAsJson`, `importFromJson`
- `src/App.tsx` — roteamento com React Router + nav bar acessível (5 rotas)
- Páginas placeholder para todas as fases: Translate, Train, Library, Speech, Auth
- `supabase/migrations/001_initial_schema.sql` — schema completo (profiles, gestures, gesture_packs) com RLS e trigger de criação de perfil
- `.env.example` com chaves Supabase (sem valores)
- `.gitignore` atualizado para excluir `.env*`

#### Pendente (requer ação do usuário)
- Criar projeto no Supabase e popular `.env` local com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Criar repositório GitHub e conectar
- Deploy inicial na Vercel
