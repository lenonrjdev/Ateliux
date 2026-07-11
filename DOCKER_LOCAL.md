# Ateliux Docker Local Homologation

Ambiente Docker leve para homologacao local do backend Ateliux com PostgreSQL e Redis.

Este ambiente nao e producao definitiva. Ele depende do PC ligado, Docker rodando, internet funcionando e ngrok ativo quando usado pela Vercel.

## Arquitetura

```txt
Frontend Vercel
-> NEXT_PUBLIC_API_BASE_URL=https://aubrielle-wroth-shae.ngrok-free.dev/api
-> ngrok
-> localhost:3054
-> Docker backend:3001
-> PostgreSQL + Redis
```

## Portas

- Backend no container: `3001`
- API no host: `http://localhost:3054/api`
- Health local: `http://localhost:3054/api/health`
- PostgreSQL: interno na rede Docker, sem porta exposta por padrao
- Redis: interno na rede Docker, sem porta exposta por padrao

## Preparar Env

PowerShell:

```powershell
Copy-Item .env.docker.example .env.docker
```

Bash:

```bash
cp .env.docker.example .env.docker
```

Edite `.env.docker` e preencha valores reais locais. Nao commitar `.env.docker`.

O exemplo usa `NODE_ENV=test` porque este ambiente e uma homologacao local com Postgres/Redis no Docker e origens `localhost`. Se trocar para `staging` ou `production`, remova qualquer `localhost` de `CORS_ORIGINS` e use um banco externo nao local, porque o backend bloqueia essa combinacao.

Para Vercel -> ngrok com login/cookies cross-site:

```env
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
CORS_ORIGINS=https://seu-frontend.vercel.app
CLIENT_APP_URL=https://seu-frontend.vercel.app
```

Para testes apenas em localhost:

```env
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
CLIENT_APP_URL=http://localhost:3000
```

Nao use `COOKIE_DOMAIN=localhost`.

## Subir Containers

Fluxo completo recomendado:

```bash
npm run docker:homolog:start
```

Esse comando valida `.env.docker`, sobe Postgres/Redis/backend, espera `/api/health`, roda migrations com `prisma migrate deploy`, executa bootstrap admin, roda `production:check-clean`, sobe o profile ngrok e mostra a URL final.

Ele nao inicia backend fora do Docker.

Validar compose:

```bash
npm run docker:homolog:config
```

```bash
npm run docker:homolog:up
```

Comando direto equivalente:

```bash
docker compose --env-file .env.docker -f docker-compose.local-homolog.yml up -d --build
```

Ver status:

```bash
npm run docker:homolog:ps
```

Logs do backend:

```bash
npm run docker:homolog:logs
```

Desligar:

```bash
npm run docker:homolog:down
```

Resetar banco/Redis locais, apagando os volumes Docker desse ambiente:

```bash
docker compose --env-file .env.docker -f docker-compose.local-homolog.yml down -v
```

Use esse reset quando trocar `POSTGRES_DB`, `POSTGRES_USER` ou `POSTGRES_PASSWORD` depois de ja ter subido o ambiente.

## Migrations, Bootstrap e Check Clean

Rodar migrations:

```bash
npm run docker:homolog:migrate
```

Ver status:

```bash
npm run docker:homolog:migrate:status
```

Criar admin principal:

```bash
npm run docker:homolog:bootstrap-admin
```

Verificar dados demo:

```bash
npm run docker:homolog:check-clean
```

Nao rode `prisma migrate dev`, `prisma migrate reset` ou seed demo nesse ambiente.

## Health

Local:

```txt
http://localhost:3054/api/health
```

Via script:

```bash
npm run docker:homolog:health
```

Resposta esperada:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok"
}
```

## ngrok

Modo manual:

```bash
ngrok http 3054
```

Na Vercel, configure:

```txt
NEXT_PUBLIC_API_BASE_URL=https://aubrielle-wroth-shae.ngrok-free.dev/api
```

Depois faca redeploy do frontend e da admin na Vercel, porque `NEXT_PUBLIC_*` entra no build.

Teste:

```txt
https://aubrielle-wroth-shae.ngrok-free.dev/api/health
```

Modo via compose, opcional:

```bash
npm run docker:homolog:ngrok
```

Esse modo exige `NGROK_AUTHTOKEN` em `.env.docker`. Se `NGROK_DOMAIN=aubrielle-wroth-shae.ngrok-free.dev` estiver configurado, o container tenta usar esse dominio fixo e encaminha para `backend:3001`.

Consultar a URL publica atual do ngrok:

```bash
npm run docker:homolog:ngrok:url
```

O profile Docker expoe a API local do ngrok em:

```txt
http://localhost:4040/api/tunnels
```

Dependendo da imagem atual do ngrok, a API local `4040` pode nao responder; nesse caso `docker:homolog:ngrok:url` usa `NGROK_DOMAIN` como fallback e nao imprime token.

Para dominio reservado do ngrok em modo manual:

```bash
ngrok http --url=https://aubrielle-wroth-shae.ngrok-free.dev 3054
```

Se a URL gratuita do ngrok mudar, atualize `NEXT_PUBLIC_API_BASE_URL` na Vercel e faca redeploy.

Chamadas automatizadas para dominios free do ngrok podem precisar do header:

```txt
ngrok-skip-browser-warning: true
```

## Vercel -> ngrok

Para testar o frontend hospedado na Vercel usando o backend local:

```txt
Vercel Dashboard
-> Project
-> Settings
-> Environment Variables
-> NEXT_PUBLIC_API_BASE_URL=https://aubrielle-wroth-shae.ngrok-free.dev/api
-> Redeploy
```

Tambem ajuste `.env.docker`:

```env
CLIENT_APP_URL=https://seu-frontend.vercel.app
ADMIN_APP_URL=https://sua-admin.vercel.app
CORS_ORIGINS=https://seu-frontend.vercel.app,https://sua-admin.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
```

Se tambem for testar admin local, mantenha `NODE_ENV=test` e inclua `http://localhost:3002` em `CORS_ORIGINS`.
Se trocar para `NODE_ENV=staging`, remova origins `localhost`, porque o backend bloqueia staging/producao apontando para localhost.

## CORS

O backend usa `CORS_ORIGINS` separado por virgula e `credentials: true`.

Nao use wildcard `*` com cookies.

Exemplo para Vercel:

```env
CORS_ORIGINS=https://seu-frontend.vercel.app
```

Exemplo misto para homologacao local:

```env
CORS_ORIGINS=https://seu-frontend.vercel.app,http://localhost:3000,http://localhost:3002
```

## Cookies

Vercel e ngrok ficam em dominios diferentes. Para autenticar via cookies httpOnly nesse cenario, use HTTPS do ngrok e:

```env
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
```

Para localhost puro, use:

```env
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=
```

Nunca salve JWT em `localStorage`.

## Banco

Acessar psql:

```bash
docker compose -f docker-compose.local-homolog.yml exec postgres psql -U postgres -d ateliux_local_homolog
```

Backup no PowerShell:

```powershell
docker compose -f docker-compose.local-homolog.yml exec -T postgres pg_dump -U postgres ateliux_local_homolog > backup-ateliux.sql
```

Restore no PowerShell:

```powershell
Get-Content backup-ateliux.sql | docker compose -f docker-compose.local-homolog.yml exec -T postgres psql -U postgres -d ateliux_local_homolog
```

Backup no Linux/macOS:

```bash
docker compose -f docker-compose.local-homolog.yml exec -T postgres pg_dump -U postgres ateliux_local_homolog > backup-ateliux.sql
```

Restore no Linux/macOS:

```bash
cat backup-ateliux.sql | docker compose -f docker-compose.local-homolog.yml exec -T postgres psql -U postgres -d ateliux_local_homolog
```

## Observacoes

- Esse Docker local e para teste/homologacao.
- Se o PC desligar, o backend sai do ar.
- Se o Docker parar, a Vercel perde acesso ao backend.
- PostgreSQL e Redis usam volumes persistentes.
- PostgreSQL e Redis nao expoem portas externas por padrao.
- Cloudinary e SMTP dependem das variaveis em `.env.docker`.
- `ALLOW_DEMO_SEED=false` deve permanecer como padrao.
