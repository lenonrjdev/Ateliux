# Ateliux Docker Local Homologation Report

- Date: 2026-06-30
- Scope: backend + PostgreSQL + Redis em Docker local
- Result: passed with documented warnings

Atualizacao 2026-07-01: a validacao especifica de backend 100% em container, ngrok fixo, cookies cross-site e login cliente/admin via ngrok foi registrada em `docs/reports/docker-backend-full-container-latest.md`.

## Files

Created:

- `.env.docker.example`
- `DOCKER_LOCAL.md`
- `backend/.dockerignore`
- `docker-compose.local-homolog.yml`
- `docs/reports/docker-local-homolog-latest.md`

Changed:

- `.gitignore`
- `backend/Dockerfile`
- `package.json`

## Runtime

- Backend container port: `3001`
- Host port: `3054`
- Local API: `http://localhost:3054/api`
- Local health: `http://localhost:3054/api/health`
- Expected ngrok API: `https://<ngrok-host>/api`
- Vercel frontend env: `NEXT_PUBLIC_API_BASE_URL=https://<ngrok-host>/api`

## Compose

`docker-compose.local-homolog.yml` defines:

- `postgres` with internal Docker network and persistent volume.
- `redis` with internal Docker network and persistent volume.
- `backend` built from `backend/Dockerfile`, exposed as `3054:3001`.
- Optional `ngrok` profile.

PostgreSQL receives only `POSTGRES_*` variables. Backend receives `.env.docker`.

## Validation

Commands validated:

- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml config`
- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml up -d --build`
- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml ps`
- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml logs --tail 100 backend`
- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml exec -T backend npx prisma migrate deploy`
- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml exec -T backend npx prisma migrate status`
- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml exec -T backend npm run prisma:bootstrap-admin`
- `docker compose --env-file .env.docker -f docker-compose.local-homolog.yml exec -T backend npm run production:check-clean`
- `npm run docker:homolog:config`
- `npm run docker:homolog:health`

Results:

- Compose config: passed.
- Docker build/up: passed.
- Backend status: healthy.
- PostgreSQL status: healthy.
- Redis status: healthy.
- Health local: `status=ok`, `database=ok`, `redis=ok`.
- Migrations: 10 applied successfully with `migrate deploy`.
- Migration status: database schema up to date.
- Bootstrap admin: executed successfully with local non-real credentials.
- Docker database clean check: passed, no known demo data found.
- Validation containers were stopped after the test with `docker compose down`.
- Temporary `.env.docker` used during validation was removed after the test.
- Docker volumes were left intact by default; `DOCKER_LOCAL.md` documents `down -v` for explicit local reset.

## Existing Validations

Passed:

- `npm run validate:backend`
- `npm run validate:admin`
- `npm run validate:frontend`
- `npm run validate:e2e`
- `npm run validate:all`

`npm run validate:pre-production` executed the full suite, then blocked at `production:check-clean` because the developer local backend database contains known seed/demo data. This is expected safety behavior for the current local database and is not caused by the Docker homologation database.

## Fixes Made During Validation

- Corrected Docker runtime entrypoint from `dist/main.js` to `dist/src/main.js`.
- Corrected Docker runtime Prisma Client by copying `node_modules` from the builder stage after `prisma generate`.
- Prevented Postgres from receiving all backend environment variables.
- Added explicit `--env-file .env.docker` usage to npm Docker scripts.

## CORS And Cookies

For Vercel -> ngrok authenticated flows:

- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none`
- `COOKIE_DOMAIN=` empty unless using a controlled shared parent domain.
- `CORS_ORIGINS` must include the Vercel domain and must not use `*`.

For localhost-only browser flows:

- `COOKIE_SECURE=false`
- `COOKIE_SAME_SITE=lax`
- `COOKIE_DOMAIN=` empty.

## Ngrok

The ngrok profile was documented and configured, but not executed in this validation because no ngrok token/domain was provided for this run.

## Warnings

- Prisma warns that `package.json#prisma` is deprecated and will be removed in Prisma 7.
- Admin and frontend lint report existing Next.js `<img>` warnings, with zero lint errors.
- Next.js reports multiple lockfile workspace root warnings because the repository has root, admin and frontend lockfiles.
- `docker compose config` prints resolved environment values; use only with non-real/local values when logs are shared.

## Backup And Restore

Documented in `DOCKER_LOCAL.md`:

- `pg_dump` backup from the Postgres container.
- `psql` restore into the Postgres container.

## Pending

- Test the ngrok profile with a real `NGROK_AUTHTOKEN`.
- Configure Vercel with the real ngrok URL and redeploy frontend/admin when needed.
- Run strict pre-production validation against a clean non-local pre-production database.
