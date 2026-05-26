# Monorepo Guidelines

Este documento define boas praticas para manter o repositorio organizado sem migracoes destrutivas.

## 1. Fronteiras de dominio

- `apps/frontend/src/` contem somente frontend.
- `apps/backend/src/` contem somente API, socket e acesso a banco.
- Evite importar codigo entre `apps/frontend` e `apps/backend`.

## 2. Variaveis de ambiente

- Toda variavel nova deve ser documentada em `.env.example`.
- Prefixo `VITE_` e exclusivo para variaveis consumidas no frontend.
- Segredos nunca devem ser commitados em `.env`.

## 3. Scripts

- Scripts de produto ficam na raiz e orquestram workspaces.
- Scripts do frontend ficam em `apps/frontend/package.json`.
- Scripts do backend ficam em `apps/backend/package.json`.
- Prefira comandos reutilizaveis (`build:frontend`, `build:backend`) em vez de comandos longos inline.

## 4. Qualidade

- Execute `npm run lint` e `npm run type-check` antes de abrir PR.
- Alteracoes de schema devem atualizar `apps/backend/db/init.sql` e/ou migracoes em `supabase/migrations`.

## 5. Estrutura de pastas

- Novas features do frontend entram em `apps/frontend/src/components`, `apps/frontend/src/hooks`, `apps/frontend/src/pages` ou `apps/frontend/src/lib`.
- Novas rotas do backend entram em `apps/backend/src/routes`.
- Middlewares compartilhados do backend entram em `apps/backend/src/middleware`.

## 6. Convencoes de PR

- PRs pequenos e focados em um objetivo.
- Descrever impacto em frontend, backend, banco e deploy.
- Se houver mudanca de env, incluir exemplo atualizado no diff.
