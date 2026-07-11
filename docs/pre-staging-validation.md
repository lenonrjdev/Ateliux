# Ateliux Pre-Staging Validation

Rotina oficial para validar backend, admin, frontend, dependencias, migrations, ambiente seguro, production clean check e Playwright E2E antes de publicar uma versao.

## Comandos Oficiais

Validacao local completa:

```bash
npm run validate:all
```

Validacao pre-staging:

```bash
npm run validate:pre-staging
```

Validacao pre-producao:

```bash
npm run validate:pre-production
```

Validacoes por app:

```bash
npm run validate:backend
npm run validate:admin
npm run validate:frontend
npm run validate:e2e
```

## O Que A Rotina Executa

- Backend: Prisma generate, migrate status, typecheck, lint, build, tests e audit.
- Admin: typecheck, lint, build e audit.
- Frontend: typecheck, lint, build e audit.
- Raiz: npm audit.
- E2E: Playwright com fluxo Admin -> Backend -> Portal do Cliente.
- Pre-producao: `npm run production:check-clean` no backend.
- Relatorio: `docs/reports/<modo>-validation-latest.md`.

## Ambiente Local

Use localmente para validar a versao antes de subir para staging:

```bash
npm install
npm --prefix backend install
npm --prefix admin install
npm --prefix frontend install
npx playwright install chromium
npm run validate:all
```

O comando `validate:e2e` define `E2E_START_SERVERS=true` por padrao. O Playwright tenta subir backend, admin e frontend, ou reutiliza servidores ja ativos.

## Staging

Para rodar contra staging real:

```bash
E2E_ALLOW_NON_LOCAL=true npm run validate:pre-staging
```

No PowerShell:

```powershell
$env:E2E_ALLOW_NON_LOCAL='true'
npm run validate:pre-staging
```

Configure as URLs E2E para staging em variaveis de ambiente ou `.env.e2e` local:

```env
E2E_BASE_API_URL=
E2E_ADMIN_URL=
E2E_FRONTEND_URL=
E2E_TARGET_ENV=staging
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_CLIENT_PASSWORD=
E2E_ALLOW_NON_LOCAL=true
```

Para exigir checagem rigida de ambiente, defina:

```env
VALIDATION_STRICT_ENV=true
NODE_ENV=staging
```

## Pre-Producao

Antes de publicar producao:

```bash
npm run validate:pre-production
```

Em ambiente real de producao, a validacao rigida deve encontrar:

```env
NODE_ENV=production
COOKIE_SECURE=true
ALLOW_DEMO_SEED=false
NEXT_PUBLIC_ENABLE_DEV_FALLBACK=false
```

Tambem e obrigatorio:

- `DATABASE_URL` nao apontar para localhost;
- `COOKIE_DOMAIN` nao ser localhost;
- `CORS_ORIGINS` nao usar `*`;
- `CORS_ORIGINS` nao apontar para localhost;
- `production:check-clean` passar sem dados demo conhecidos.

Se esse comando falhar em ambiente local por dados demo do seed de desenvolvimento, a falha esta correta. A rotina nao apaga dados automaticamente. Use um banco limpo para validacao de producao ou remova dados demo por um procedimento operacional revisado.

Dry-run da limpeza demo:

```bash
npm run db:clean-demo:dry-run
```

Aplicacao controlada em banco local:

```powershell
$env:CONFIRM_CLEAN_DEMO_DATA='true'
$env:ALLOW_DEMO_CLEANUP='true'
$env:ALLOW_DEMO_CLEANUP_ENV='local'
$env:CLEAN_DEMO_DATA_MODE='apply'
npm run db:clean-demo:apply
```

Detalhes completos: `docs/clean-database-preproduction.md`.

Setup de banco limpo de pre-producao:

```txt
docs/preproduction-database-setup.md
```

Relatorio da ultima validacao de banco limpo:

```txt
docs/reports/preproduction-database-validation-latest.md
```

## Homologacao Vercel via ngrok

Antes de validar staging externo definitivo, pode ser usado o caminho local:

```txt
Vercel frontend
-> NEXT_PUBLIC_API_BASE_URL=https://aubrielle-wroth-shae.ngrok-free.dev/api
-> ngrok
-> Docker backend em localhost:3054
```

Checklist minimo:

- Docker homologacao local saudavel;
- ngrok respondendo `/api/health`;
- `CORS_ORIGINS` contendo a origem real da Vercel, sem `*`;
- `COOKIE_SECURE=true`;
- `COOKIE_SAME_SITE=none`;
- `COOKIE_DOMAIN=` vazio para ngrok/free domains;
- Vercel redeploy apos trocar `NEXT_PUBLIC_API_BASE_URL`;
- login cliente e `/auth/client/me` validados em browser real.

Relatorio da ultima validacao:

```txt
docs/reports/docker-backend-full-container-latest.md
docs/reports/ngrok-vercel-homolog-latest.md
```

Enquanto a Vercel depender do backend local por ngrok, nao rode backend fora do Docker. O fluxo operacional e:

```bash
npm run docker:homolog:start
```

ou, por etapas:

```bash
npm run docker:homolog:up
npm run docker:homolog:migrate
npm run docker:homolog:bootstrap-admin
npm run docker:homolog:check-clean
npm run docker:homolog:ngrok
```

Para rodar Playwright usando a API Docker em `3054` sem subir backend local:

```powershell
$env:E2E_BASE_API_URL='http://localhost:3054/api'
$env:E2E_START_BACKEND_SERVER='false'
npm run validate:e2e
```

## Protecoes

- Falha em qualquer etapa encerra a rotina com exit code diferente de zero.
- Secrets nao sao impressos nem salvos no relatorio.
- E2E nao roda contra URL nao local sem `E2E_ALLOW_NON_LOCAL=true`.
- Alvo E2E de producao exige `E2E_TARGET_ENV=production` e `E2E_ALLOW_PRODUCTION=true`.
- Dados E2E usam prefixo `E2E`.
- Testes destrutivos continuam bloqueados sem `E2E_ALLOW_DESTRUCTIVE_TESTS=true`.
- `prisma migrate dev` nao faz parte da rotina.

## Relatorios

Cada execucao gera ou atualiza:

```txt
docs/reports/<modo>-validation-latest.md
```

O relatorio contem data, branch, commit, resultado de cada etapa, warnings conhecidos e pendencias. Ele nao inclui valores de `.env`.

## Warnings Conhecidos

- Prisma avisa que `package.json#prisma` sera removido no Prisma 7.
- Admin e frontend ainda podem emitir warnings de `@next/next/no-img-element`.
- Next.js pode avisar sobre multiplos lockfiles porque existem `package-lock.json` na raiz, admin e frontend.

Esses warnings nao bloqueiam build hoje, mas devem ser removidos antes de uma janela maior de hardening.

## Quando Falhar

1. Corrija a primeira etapa que falhou.
2. Rode novamente o comando especifico, por exemplo `npm run validate:backend`.
3. Depois rode `npm run validate:all`.
4. Para release, rode `npm run validate:pre-staging` ou `npm run validate:pre-production` conforme o alvo.
