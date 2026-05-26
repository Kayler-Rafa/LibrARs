# =============================================================================
#  Frontend -- Dockerfile de PRODUCAO (multi-stage)
#
#  Stage 1: compila o app Vite
#  Stage 2: serve o bundle estatico com Nginx
#           + faz proxy de /api/ e /socket.io/ para o backend
# =============================================================================

# -- Stage 1: Build -----------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Copia manifest e instala dependencias
# Nota: o frontend e um workspace npm sem package-lock.json proprio.
# npm install (sem ci) gera o lockfile no build, garantindo instalacao limpa.
COPY package.json ./
RUN npm install

# Copia o restante do fonte e compila
COPY . .
RUN npm run build

# -- Stage 2: Serve com Nginx -------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Bundle estatico gerado pelo Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuracao do Nginx (proxy /api/ e /socket.io/ para o backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
