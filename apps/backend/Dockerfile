# ── Stage 1: build ────────────────────────────────────────────────────────────
# O contexto de build e a RAIZ do monorepo (context: . no docker-compose.yml)
# para que o package-lock.json completo esteja disponivel.
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar manifests do workspace raiz (lockfile completo)
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json

# Instalar dependencias usando o lockfile completo do monorepo
RUN npm ci -w apps/backend --include-workspace-root

# Copiar codigo-fonte e compilar
COPY apps/backend/ apps/backend/
WORKDIR /app/apps/backend
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Instalar apenas dependencias de producao (sem devDeps, sem lockfile de workspace)
COPY apps/backend/package.json ./package.json
RUN npm install --omit=dev

COPY --from=builder /app/apps/backend/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
