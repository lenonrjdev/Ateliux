# Docker Backend Full Container Report

- Data/hora: 2026-07-01
- Escopo: backend 100% em Docker, PostgreSQL Docker, Redis Docker, ngrok e preparo para Vercel
- Resultado: aprovado para Docker -> ngrok -> API local

## Decisao final

O backend nao depende de processo Node local. A API foi validada rodando dentro do container `ateliux-local-homolog-backend`, exposta no host por `3054:3001`.

Fluxo validado:

```txt
Docker backend:3001
-> host http://localhost:3054/api
-> ngrok https://aubrielle-wroth-shae.ngrok-free.dev/api
```

## Runtime

- Backend container: `3001`
- Backend host: `3054`
- API local: `http://localhost:3054/api`
- Health local: `http://localhost:3054/api/health`
- API ngrok: `https://aubrielle-wroth-shae.ngrok-free.dev/api`
- Health ngrok: `https://aubrielle-wroth-shae.ngrok-free.dev/api/health`
- PostgreSQL: container `postgres:16-alpine`, porta externa nao exposta
- Redis: container `redis:7-alpine`, porta externa nao exposta

## Dockerfile

`backend/Dockerfile` usa build multi-stage:

- `npm ci`;
- `npm run prisma:generate`;
- `npm run build`;
- copia `node_modules`, `dist`, `prisma` e `package*.json`;
- expoe `3001`;
- inicia com `node dist/src/main.js`;
- nao usa `start:dev`, watch mode ou backend local.

## Compose

`docker-compose.local-homolog.yml` contem:

- `postgres` com volume persistente e `pg_isready`;
- `redis` com volume persistente e `redis-cli ping`;
- `backend` com build de `./backend`, `env_file: .env.docker`, `3054:3001`, health em `/api/health` e dependencia de Postgres/Redis saudaveis;
- `ngrok` opcional por profile, apontando para `backend:3001` e usando `NGROK_DOMAIN` quando configurado.

## Variaveis esperadas

`.env.docker` deve conter, sem versionar:

```txt
DATABASE_URL=postgresql://...@postgres:5432/ateliux_local_homolog?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
COOKIE_SECRET
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
CLIENT_APP_URL=https://URL-REAL-DO-FRONTEND-VERCEL
ADMIN_APP_URL=https://URL-REAL-DA-ADMIN-VERCEL
CORS_ORIGINS=https://URL-REAL-DO-FRONTEND-VERCEL,https://URL-REAL-DA-ADMIN-VERCEL
ALLOW_DEMO_SEED=false
NGROK_AUTHTOKEN
NGROK_DOMAIN=aubrielle-wroth-shae.ngrok-free.dev
```

## Vercel

Configurar no frontend e na admin:

```txt
NEXT_PUBLIC_API_BASE_URL=https://aubrielle-wroth-shae.ngrok-free.dev/api
```

Apos alterar `NEXT_PUBLIC_*`, fazer redeploy obrigatorio dos dois projetos Vercel.

## CORS e cookies

Validado:

- backend usa `CORS_ORIGINS` por virgula;
- `credentials: true`;
- origem configurada recebe `Access-Control-Allow-Origin` correspondente;
- `Access-Control-Allow-Credentials=true`;
- preflight `OPTIONS /api/auth/client/me` retorna `204`;
- cookies de cliente/admin via ngrok possuem `HttpOnly`, `Secure`, `SameSite=None`;
- cookies nao usam `Domain=localhost`.

O origin correto em CORS e a URL da Vercel, nao a URL do ngrok.

Atualizacao 2026-07-01:

- `.env.docker` foi ajustado para `CLIENT_APP_URL=https://ateliux.com.br`;
- `CORS_ORIGINS` foi liberado para `https://ateliux.vercel.app`, `https://ateliux.com.br` e `https://www.ateliux.com.br`;
- `COOKIE_SECURE=true` e `COOKIE_SAME_SITE=none` foram mantidos;
- CORS local em `http://localhost:3054/api/health` validou `Access-Control-Allow-Origin` e `Access-Control-Allow-Credentials=true` para os tres origins publicos;
- preflight `OPTIONS /api/auth/client/me` validado para `https://ateliux.vercel.app` com status `204`;
- ngrok foi parado a pedido do usuario; porta `4040` fechada.

## Validacoes executadas

Comandos:

```txt
npm run docker:homolog:config
npm run docker:homolog:up
npm run docker:homolog:ps
npm run docker:homolog:health
npm run docker:homolog:migrate
npm run docker:homolog:migrate:status
npm run docker:homolog:bootstrap-admin
npm run docker:homolog:check-clean
npm run docker:homolog:ngrok
npm run docker:homolog:ngrok:url
npm run validate:backend
npm run validate:admin
npm run validate:frontend
npm run validate:e2e
npm run validate:all
```

Resultados:

- compose config: ok;
- backend: healthy;
- postgres: healthy;
- redis: healthy;
- porta `3001` no host: livre;
- porta `3054` no host: usada pelo Docker;
- health local: `200`, `status=ok`, `database=ok`, `redis=ok`;
- health ngrok: `200`, `status=ok`, `database=ok`, `redis=ok`;
- migrations: 10 migrations encontradas, sem pendencias;
- migrate status: schema atualizado;
- bootstrap admin: executado, admin existente preservado;
- check-clean: sem dados demo conhecidos;
- login cliente via ngrok: `201`;
- `GET /auth/client/me` via ngrok: `200`;
- login admin via ngrok: `201`;
- `GET /auth/admin/me` via ngrok: `200`;
- `validate:backend`: aprovado;
- `validate:admin`: aprovado;
- `validate:frontend`: aprovado;
- `validate:e2e`: aprovado com 4 testes Playwright usando backend Docker/ngrok;
- `validate:all`: aprovado, incluindo build, typecheck, lint, audit, testes backend e E2E.

## Scripts criados

- `scripts/get-ngrok-url.mjs`
- `scripts/docker-homolog-start.mjs`
- `scripts/run-e2e-docker-backend.mjs`

Scripts principais:

```txt
npm run docker:homolog:start
npm run docker:homolog:up
npm run docker:homolog:down
npm run docker:homolog:logs
npm run docker:homolog:ps
npm run docker:homolog:health
npm run docker:homolog:migrate
npm run docker:homolog:migrate:status
npm run docker:homolog:bootstrap-admin
npm run docker:homolog:check-clean
npm run docker:homolog:ngrok
npm run docker:homolog:ngrok:logs
npm run docker:homolog:ngrok:url
```

## Warnings

- Prisma avisa que `package.json#prisma` sera removido no Prisma 7.
- `npm` no container avisou sobre nova major disponivel.
- Ngrok free exige header `ngrok-skip-browser-warning: true` para chamadas automatizadas diretas.
- A API local do agente ngrok em `4040` pode nao estar disponivel dependendo da imagem; `docker:homolog:ngrok:url` usa `NGROK_DOMAIN` como fallback.
- Next.js avisa sobre multiplos lockfiles no repositorio raiz/admin/frontend.
- ESLint ainda avisa sobre usos pontuais de `<img>` em imagens dinamicas do blog/portal.

## Pendencias

- Informar as URLs reais da Vercel em `CLIENT_APP_URL`, `ADMIN_APP_URL` e `CORS_ORIGINS`.
- Configurar `NEXT_PUBLIC_API_BASE_URL` nos dois projetos Vercel e fazer redeploy.
- Validar login pelo browser real da Vercel.
- Manter Docker Desktop e ngrok ativos enquanto a Vercel depender deste backend local.
