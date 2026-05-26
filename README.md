<div align="center">

# LibrARs

**Tradução e treino de gestos de Libras com IA no navegador, chamadas P2P em tempo real e backend próprio.**

[Demo](#) · [Reportar bug](https://github.com/Kayler-Rafa/LibrARs/issues) · [Roadmap](ROADMAP.md)

</div>

---

## O que é

LibrARs é uma aplicação web que usa a câmera do usuário para reconhecer gestos de Libras (Língua Brasileira de Sinais) em tempo real. Toda a IA roda no browser — sem mandar vídeo para o servidor — usando MediaPipe Hands + um classificador KNN customizado. Usuários podem criar sua própria biblioteca de gestos, conectar-se com outra pessoa por videochamada P2P e ver os gestos reconhecidos traduzidos na tela.

---

## Funcionalidades

| Recurso | Descrição |
|---|---|
| **Tradução em tempo real** | Reconhece gestos pela câmera sem latência de rede |
| **Treino personalizado** | Grave amostras e treine gestos novos no browser |
| **Biblioteca de gestos** | Gerencie e sincronize seus gestos com o backend |
| **Videochamada P2P** | Chamada WebRTC com relay de gestos reconhecidos para o par |
| **Autenticação** | Cadastro e login com JWT; dados isolados por usuário |

---

## Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 19, Vite 8, TypeScript 6, Tailwind CSS 4, Zustand |
| **IA / Visão** | MediaPipe Hands, TensorFlow.js, KNN customizado |
| **Backend** | Node.js 20, Express 4, Socket.io 4, TypeScript 5 |
| **Banco** | PostgreSQL 16, driver `pg`, pgcrypto |
| **Auth** | JWT (Bearer token), bcryptjs |
| **Infra** | Docker Compose, npm workspaces (monorepo) |
| **Deploy** | Coolify |

---

## Arquitetura

```
Browser
  │
  ├─ MediaPipe Hands ──► KNN Classifier ──► Gesture confirmado
  │        (21 landmarks 3D por frame)         (12 frames + cooldown)
  │
  ├─ REST HTTP  ──────────────────────────► Express /api/auth  /api/gestures
  │   (Bearer JWT, fetch)                        │
  │                                         PostgreSQL 16
  └─ WebSocket (Socket.io)
       │
       ├─ create-room / join-room   (salas de 2 pessoas, código 6 chars)
       ├─ webrtc-offer/answer/ice   (sinalização WebRTC)
       └─ gesture ──────────────────► peer-gesture  (relay para o par)
                                                │
                              WebRTC P2P ◄──────┘  (vídeo/áudio direto)
```

### Fluxo de reconhecimento

1. `useCamera` → abre stream da câmera
2. `useHandTracking` → envia frames para MediaPipe via `requestAnimationFrame`
3. Landmarks normalizados → vetor de features
4. `useGestureClassifier` → KNN (k=3, threshold 0.30) por frame
5. 12 frames consecutivos + cooldown 1.5s → gesto confirmado
6. `ARDisplay` exibe o gesto; Socket.io pode retransmiti-lo ao par na chamada

---

## Estrutura do monorepo

```
LibrARs/
├── apps/
│   ├── frontend/           # @librars/frontend
│   │   ├── src/
│   │   │   ├── components/ # camera/, gestures/
│   │   │   ├── hooks/      # useCamera, useHandTracking, useGestureClassifier
│   │   │   ├── lib/        # api.ts, classifier.ts, mediapipe.ts
│   │   │   ├── pages/      # Translate, Train, Library, Call, Speech, Auth
│   │   │   ├── stores/     # authStore, gestureStore (Zustand)
│   │   │   └── types/
│   │   ├── Dockerfile          # producao (multi-stage + Nginx)
│   │   ├── Dockerfile.dev      # dev (Vite hot-reload)
│   │   └── nginx.conf          # proxy /api/ e /socket.io/ -> backend
│   │
│   └── backend/            # @librars/backend
│       ├── src/
│       │   ├── routes/     # auth.ts, gestures.ts
│       │   ├── middleware/ # auth.ts (JWT)
│       │   ├── socket/     # rooms + sinalização WebRTC
│       │   └── db.ts       # pool pg
│       ├── db/
│       │   └── init.sql    # schema (executado no primeiro start do Postgres)
│       ├── Dockerfile          # producao (multi-stage, tsc build)
│       └── Dockerfile.dev      # dev (tsx watch hot-reload)
│
├── docker-compose.yml      # PRODUCAO -- usado pelo Coolify
├── docker-compose.dev.yml  # desenvolvimento local com bind mounts
├── docs/
│   └── MONOREPO_GUIDELINES.md
├── .env.example
└── package.json            # orquestrador npm workspaces
```

---

## API do backend

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Cadastra usuário |
| `POST` | `/api/auth/login` | — | Login, retorna JWT |
| `GET` | `/api/auth/me` | JWT | Dados do usuário autenticado |
| `GET` | `/api/gestures` | JWT | Lista gestos do usuário |
| `POST` | `/api/gestures` | JWT | Cria ou atualiza gesto (upsert) |
| `DELETE` | `/api/gestures/:id` | JWT | Remove gesto |
| `GET` | `/api/gestures/user/:userId` | JWT | Gestos de outro usuário |
| `GET` | `/health` | — | Health check |

### Socket.io events

| Evento (cliente → servidor) | Payload | Descrição |
|---|---|---|
| `create-room` | `{ userId?, userName? }` | Cria sala; retorna `{ code }` |
| `join-room` | `{ code, userId?, userName? }` | Entra na sala |
| `webrtc-offer` | `{ code, sdp }` | Relay de offer WebRTC |
| `webrtc-answer` | `{ code, sdp }` | Relay de answer WebRTC |
| `webrtc-ice` | `{ code, candidate }` | Relay de ICE candidate |
| `gesture` | `{ code, gesture, confidence }` | Relay de gesto reconhecido |

---

## Setup

### Requisitos

- Node.js 20+, npm 10+
- Docker + Docker Compose (para rodar com banco)

### Sem Docker (apps separadas)

```bash
# Clone e instale
git clone https://github.com/Kayler-Rafa/LibrARs.git
cd LibrARs
cp .env.example .env     # edite DATABASE_URL e JWT_SECRET

npm install              # instala todas as workspaces

# Sobe frontend + backend juntos com concurrently
npm run dev
```

> Você precisa de um PostgreSQL local ou remoto. Configure `DATABASE_URL` no `.env`.

### Com Docker (desenvolvimento local)

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

| Serviço | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| Backend (API) | http://localhost:3001 |
| Postgres | localhost:5432 |

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Usado por | Descrição |
|---|---|---|
| `DATABASE_URL` | Backend | Connection string do Postgres |
| `JWT_SECRET` | Backend | Segredo para assinar tokens JWT |
| `CORS_ORIGIN` | Backend | Origem(ns) permitida(s); em producao = URL do frontend |
| `PORT` | Backend | Porta do servidor (padrão: 3001) |
| `POSTGRES_DB` | Compose | Nome do banco |
| `POSTGRES_USER` | Compose | Usuário do banco |
| `POSTGRES_PASSWORD` | Compose | Senha do banco |
| `VITE_API_URL` | Frontend | URL do backend (vazio = mesmo origin, via nginx proxy) |
| `VITE_WS_URL` | Frontend | URL do WebSocket |

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Frontend + backend com hot-reload (sem Docker) |
| `npm run build` | Build de ambas as apps |
| `npm run lint` | ESLint frontend (browser) e backend (node) |
| `npm run type-check` | TypeScript sem emit nos dois apps |
| `npm run test` | Vitest (frontend) |
| `npm run format` | Prettier nos dois apps |
| `npm run docker:dev` | Docker Compose dev (bind mounts + hot-reload) |
| `npm run docker:dev:down` | Para os containers de dev |
| `npm run docker:prod` | Docker Compose producao local |

---

## Deploy (Coolify)

1. Conecte o repositório no Coolify
2. Selecione **Docker Compose** e aponte para `docker-compose.yml`
3. Configure as variáveis de ambiente no painel:

```
POSTGRES_DB=libras_ar
POSTGRES_USER=libras
POSTGRES_PASSWORD=<senha-forte>
JWT_SECRET=<segredo-forte>
CORS_ORIGIN=https://seu-dominio.com
```

4. Faça o deploy

> O nginx do frontend faz proxy de `/api/` e `/socket.io/` para o backend. Configure apenas o domínio do frontend no Coolify; o backend não precisa de domínio próprio.

---

## Dívidas técnicas conhecidas

| Item | Impacto | Prioridade |
|---|---|---|
| JWT em `localStorage` | Vulnerável a XSS; ideal seria cookie `httpOnly` | Alta |
| Sem rate limiting nas rotas de auth | Risco de brute-force em `/login` | Alta |
| Sem validação de input no backend (Zod/express-validator) | Dados malformados chegam ao banco | Alta |
| Salas do Socket.io em memória | Perdidas se o backend reiniciar | Média |
| KNN O(n×m) por frame | Lento com muitos gestos/amostras | Média |
| Backend sem testes | Zero cobertura | Média |
| `supabase/` e `VITE_SUPABASE_*` legados | Confunde; não é mais usado | Baixa |
| `socket as unknown as Record<string, unknown>` | Type-unsafe; pode esconder bugs | Baixa |

---

## Contribuindo

Veja [docs/MONOREPO_GUIDELINES.md](docs/MONOREPO_GUIDELINES.md) para convenções de código, variáveis de ambiente e padrões de PR.

---

## Licença

MIT
