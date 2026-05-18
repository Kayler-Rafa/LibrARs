# ROADMAP — Libras AR Translator

> Marque cada item como `[x]` ao concluir. Não avance de fase sem aprovação.

---

## FASE 0 — Setup e Infraestrutura
**Status:** ✅ Concluída

- [x] Criar projeto com `npm create vite@latest libras-ar -- --template react-ts`
- [x] Instalar e configurar: Tailwind CSS v4, ESLint, Prettier, Vitest
- [x] Instalar dependências: `@mediapipe/hands`, `@tensorflow/tfjs`, `zustand`, `@supabase/supabase-js`, `react-router-dom`
- [x] Criar `.env.example` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [x] Criar `ROADMAP.md` e `CHANGELOG.md`
- [x] Configurar GitHub Actions básico (lint + test + build)
- [x] Criar estrutura de pastas (`components/`, `hooks/`, `lib/`, `stores/`, `pages/`, `types/`)
- [x] Criar `src/types/index.ts`, `src/lib/utils.ts`, `src/lib/supabase.ts`
- [x] Criar `gestureStore.ts` (Zustand + persistência localStorage)
- [x] Criar páginas placeholder com roteamento (Traduzir, Treinar, Biblioteca, Fala, Conta)
- [x] Criar migration SQL inicial (`supabase/migrations/001_initial_schema.sql`)
- [ ] Criar projeto no Supabase e configurar `.env` local
- [ ] Deploy inicial em branco na Vercel
- [ ] Configurar repositório GitHub

**Critério de aceite:** `npm run dev` abre app sem erros. CI verde.

---

## FASE 1 — MVP Core (Câmera + Detecção de Mão)
**Status:** ✅ Concluída

- [x] Hook `useCamera.ts` — acessa câmera, gerencia stream, suporte câmera traseira/frontal
- [x] Hook `useHandTracking.ts` — inicializa MediaPipe Hands via CDN, loop rAF com flag anti-concurrent, retorna landmarks + fps
- [x] Componente `CameraFeed` — exibe vídeo + canvas overlay + badges de status + botão trocar câmera
- [x] Componente `CanvasOverlay` — skeleton colorido por dedo (21 pontos + conexões)
- [x] Indicador de status: câmera ativa / IA pronta / mão detectada / FPS counter
- [x] Responsivo: aspect-ratio 16/9, mobile-first, câmera traseira/frontal via toggle
- [x] `src/types/mediapipe.d.ts` — declarações globais para uso CDN com tipos do npm

**Critério de aceite:** Câmera abre, mão com skeleton desenhado a 30fps mínimo.

---

## FASE 2 — Sistema de Treino e Banco Local
**Status:** ✅ Concluída

- [x] `lib/classifier.ts`: `normalizeLandmarks`, `landmarksToVector`, `knnClassify` (KNN com k=3, threshold=0.30)
- [x] Componente `GestureRecorder`: input nome, botão gravar/parar, barra de progresso, throttle 100ms (~10 amostras/s), min 10 / max 150 amostras, feedback visual
- [x] `gestureStore.ts` integrado: addGesture, deleteGesture, exportAsJson, importFromJson + persistência localStorage
- [x] Componente `GestureLibrary`: lista com nome/amostras/data, deletar, exportar JSON, importar JSON
- [x] `pages/Train.tsx`: câmera + recorder + library na mesma página
- [x] `pages/Library.tsx`: biblioteca standalone com link para Treinar
- [x] `CameraFeed` expõe `onLandmarks` callback para compartilhar landmarks com outras páginas

**Critério de aceite:** Gravar "OLÁ" com 40 amostras, reabrir app, gesto ainda está no banco.

---

## FASE 3 — Tradução em Tempo Real (AR Overlay)
**Status:** ✅ Concluída

- [x] `useGestureClassifier.ts`: KNN por frame, debounce 12 frames consecutivos, cooldown 1.5s, reset ao sair do frame
- [x] `ARDisplay.tsx`: texto AR centralizado, barra de confiança (verde ≥70% / amarelo ≥45% / vermelho abaixo), animação fadeInScale, indicador "Analisando…"
- [x] Histórico das últimas 10 traduções com timestamp (hh:mm:ss)
- [x] Modo frase: acumula gestos confirmados com janela de 3s de inatividade
- [x] `CameraFeed` aceita `children` para slot de overlay AR
- [x] `Translate.tsx`: integração completa + aviso quando sem gestos cadastrados

**Critério de aceite:** Gesto "OLÁ" reconhecido em <1s com confiança >60%.

---

## FASE 4 — Fala para AR
**Status:** 🔲 Pendente

- [ ] Hook `useSpeechRecognition.ts`:
  - Web Speech API com `lang: 'pt-BR'`
  - Modo contínuo com `interimResults: true`
  - Retorna `{ transcript, interimText, isListening, error }`
  - Fallback gracioso se API não disponível
- [ ] Componente `SpeechToAR`:
  - Preview AR com texto sobreposto
  - Texto final maiúsculas + interim em cinza
  - Botões Ouvir / Parar / Copiar
  - Histórico de falas

**Critério de aceite:** Falar "qual é o seu nome" exibe em <2s.

---

## FASE 5 — Autenticação e Banco em Nuvem
**Status:** 🔲 Pendente

- [ ] Executar `supabase/migrations/001_initial_schema.sql` no projeto Supabase
- [ ] Componentes `LoginForm` / `SignupForm` (email+senha + OAuth Google)
- [ ] Sincronização: gesto local → upsert Supabase se autenticado
- [ ] Merge ao logar: banco local + banco nuvem (local tem prioridade em conflito)
- [ ] Indicador de sync status (local / sincronizado / erro)

**Critério de aceite:** Criar conta, gravar gesto, logout, login — gesto ainda existe.

---

## FASE 6 — Biblioteca Pública de Gestos
**Status:** 🔲 Pendente

- [ ] Página "Explorar" — gestos públicos com filtro por nome
- [ ] Botão "Tornar Público" em cada gesto do usuário
- [ ] Botão "Importar para meu banco" em gestos públicos
- [ ] Criação de "Packs" de gestos com nome e descrição
- [ ] Contador de downloads por pack
- [ ] Busca por nome de gesto ou pack

**Critério de aceite:** Usuário A publica "ÁGUA". Usuário B importa e usa na tradução.

---

## FASE 7 — Melhorias de IA (Avançada)
**Status:** 🔲 Pendente

- [ ] Treinar modelo TensorFlow.js (MLP 3 camadas) nas amostras do usuário
- [ ] Exportar modelo como `model.json` + `weights.bin`
- [ ] Importar modelo treinado na sessão de tradução
- [ ] Suporte a gestos dinâmicos: sequência temporal de landmarks
- [ ] Smooth temporal: média deslizante das últimas N predições

---

## FASE 8 — UX, Acessibilidade e Performance
**Status:** 🔲 Pendente

- [ ] Tour de onboarding (react-joyride ou similar)
- [ ] Modo escuro/claro
- [ ] PWA: `manifest.json` + service worker (Workbox via Vite plugin)
- [ ] Seletor de câmera (frontal / traseira / dispositivo)
- [ ] Configurações: threshold de confiança, frames para confirmar, idioma
- [ ] Acessibilidade: `aria-label` em todos os controles, navegação por teclado
- [ ] Performance: 30fps garantidos em mobile mid-range (Moto G)
- [ ] Lazy loading de modelos MediaPipe
- [ ] Analytics: Posthog ou Umami

---

## FASE 9 — Monetização e Comercialização
**Status:** 🔲 Pendente

- [ ] Plano Free: até 10 gestos, sem sync, sem biblioteca pública
- [ ] Plano Pro (Stripe): gestos ilimitados, sync, biblioteca, exportar banco
- [ ] Integração Stripe Checkout + webhook via Supabase Edge Functions
- [ ] Tabela `subscriptions` no Supabase sincronizada com Stripe
- [ ] Página de preços
- [ ] Portal do cliente Stripe
- [ ] Landing page pública com demo, benefícios, CTA

---

## FASE 10 — Lançamento
**Status:** 🔲 Pendente

- [ ] Domínio personalizado na Vercel
- [ ] SSL configurado
- [ ] Monitoramento de erros: Sentry
- [ ] README completo com screenshots e GIFs
- [ ] Submissão em: Product Hunt, comunidades de acessibilidade, grupos de Libras
- [ ] Política de Privacidade + Termos de Uso
