# Ateliux Integration

Documento de execucao e validacao da integracao entre `backend`, `frontend` e `admin`.

## Apps e portas

- Backend: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`
- Frontend publico/Portal do Cliente: `http://localhost:3000`
- Admin: `http://localhost:3002`

Use `localhost` no browser e nos testes locais. Em desenvolvimento, deixe `COOKIE_DOMAIN` vazio para o browser criar cookie host-only em `localhost`; nao use `COOKIE_DOMAIN=localhost`, porque alguns browsers rejeitam ou deixam o cookie instavel. Chamadas para `127.0.0.1` nao compartilham a mesma sessao de `localhost`.

## Validacao Oficial

Scripts oficiais na raiz:

```bash
npm run validate:backend
npm run validate:admin
npm run validate:frontend
npm run validate:e2e
npm run validate:all
npm run validate:pre-staging
npm run validate:pre-production
```

A rotina e orquestrada por `scripts/validate.mjs`, para no primeiro erro e gera relatorio em `docs/reports/*-validation-latest.md`.

Fluxo recomendado antes de staging:

```bash
npm run validate:pre-staging
```

Fluxo recomendado antes de producao:

```bash
npm run validate:pre-production
```

Detalhes operacionais: `docs/pre-staging-validation.md`.

## Homologacao Docker/ngrok

Ambiente local de homologacao:

```txt
Docker backend:3001
-> host http://localhost:3054/api
-> ngrok HTTPS
-> frontend Vercel com NEXT_PUBLIC_API_BASE_URL=https://<ngrok-host>/api
```

Guia operacional:

```txt
DOCKER_LOCAL.md
```

Relatorios:

```txt
docs/reports/docker-local-homolog-latest.md
docs/reports/docker-backend-full-container-latest.md
docs/reports/ngrok-vercel-homolog-latest.md
```

O caminho Docker -> ngrok -> backend foi validado com health, CORS configurado, cookies httpOnly e login cliente/admin. Para esta homologacao, o backend nao deve ser iniciado com `npm run start:dev`, `npm run start` ou `nest start` no host; ele roda no container e expõe somente `http://localhost:3054/api`.

Valor atual para Vercel:

```txt
NEXT_PUBLIC_API_BASE_URL=https://aubrielle-wroth-shae.ngrok-free.dev/api
```

A validacao completa pelo browser Vercel depende do dominio real da Vercel configurado em `.env.docker`, variavel `NEXT_PUBLIC_API_BASE_URL` atualizada na Vercel e redeploy.

Setup de banco limpo para pre-producao:

```txt
docs/preproduction-database-setup.md
backend/.env.preproduction.example
frontend/.env.preproduction.example
admin/.env.preproduction.example
.env.e2e.preproduction.example
```

## Variaveis

`backend/.env` minimo local:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ateliux?schema=public
JWT_ACCESS_SECRET=change-me-access-secret
JWT_REFRESH_SECRET=change-me-refresh-secret
COOKIE_SECRET=change-me-cookie-secret-32
COOKIE_DOMAIN=
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
AUTH_DEBUG=false
CLIENT_APP_URL=http://localhost:3000
ADMIN_APP_URL=http://localhost:3002
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
REDIS_HOST=localhost
REDIS_PORT=6379
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true
```

`admin/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
NEXT_PUBLIC_ADMIN_URL=http://localhost:3002
NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true
```

`NEXT_PUBLIC_ENABLE_DEV_FALLBACK` deve existir somente em desenvolvimento local. Em producao, a ausencia da flag bloqueia uso silencioso de mocks e as telas exibem estado de erro/empty state quando a API falha.

## Banco, bootstrap e seed

Migration aplicada nesta etapa:

```txt
20260626200000_contact_lead_file_asset
20260627142000_blog_editorial_real
20260627183000_file_risk_metadata
20260628110000_inbox_message_file_links
20260628123000_cloudinary_resource_type
20260628201500_project_full_setup
20260629170000_lgpd_privacy
20260630120000_client_pipeline_status
```

Status de cliente:

- `Client.status` e status de conta/acesso (`ACTIVE`, `INVITED`, `SUSPENDED`, `ARCHIVED`).
- `Client.pipelineStatus` e status comercial interno da admin (`NEW`, `BRIEFING`, `DESIGN`, `DEVELOPMENT`, `APPROVAL`, `COMPLETED`, `INACTIVE`).
- O Portal do Cliente nao deve receber `pipelineStatus`; respostas autenticadas do cliente devem usar objeto `Client` sanitizado.

Fluxo seguro para producao limpa:

```bash
cd backend
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:bootstrap-admin
npm run production:check-clean
```

O bootstrap cria somente o admin principal definido por `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` e `BOOTSTRAP_ADMIN_PASSWORD`. Ele nao cria clientes, projetos, arquivos, blog, newsletter, financeiro ou inbox demo.

Na raiz existem atalhos seguros:

```bash
npm run db:check-clean
npm run db:clean-demo:dry-run
```

`db:clean-demo:dry-run` nao altera o banco e gera `docs/reports/demo-cleanup-latest.md`. Para aplicar limpeza demo em banco local/staging controlado, use `db:clean-demo:apply` somente com `CONFIRM_CLEAN_DEMO_DATA=true`, `ALLOW_DEMO_CLEANUP=true`, `ALLOW_DEMO_CLEANUP_ENV=local|staging` e `CLEAN_DEMO_DATA_MODE=apply`.

Guia completo: `docs/clean-database-preproduction.md`.

Seed demo local:

```bash
ALLOW_DEMO_SEED=true npm run prisma:seed:dev
```

No PowerShell:

```powershell
$env:ALLOW_DEMO_SEED='true'
npm run prisma:seed:dev
```

O seed demo e bloqueado se `NODE_ENV=production` ou se `ALLOW_DEMO_SEED` for diferente de `true`.

## Auth

O frontend usa:

- `POST /auth/client/login`
- `POST /auth/client/register`
- `POST /auth/client/refresh`
- `POST /auth/client/logout`
- `GET /auth/client/me`

O admin usa:

- `POST /auth/admin/login`
- `POST /auth/admin/refresh`
- `POST /auth/admin/logout`
- `GET /auth/admin/me`

Os dois apps usam cookie httpOnly via `credentials: "include"` e nao armazenam token em `localStorage`. A sessao usa access token curto (`JWT_ACCESS_EXPIRES_IN`, default `15m`) e refresh token longo (`JWT_REFRESH_EXPIRES_IN`, default `7d`). Quando uma chamada recebe `401`, o API client chama o endpoint de refresh uma vez, atualiza o cookie de access e repete a chamada original. `403` e tratado como falta de permissao e nao como logout. Novos refresh tokens sao persistidos como SHA-256 do token bruto; bcrypt antigo ainda e aceito durante migracao, mas nao e usado para novos tokens.

Cookies atuais:

- admin: `ateliux_admin_access_token` e `ateliux_admin_refresh_token`;
- cliente: `ateliux_client_access_token` e `ateliux_client_refresh_token`;
- legado aceito durante migracao: `ateliux_access_token` e `ateliux_refresh_token`.
- consentimento: `ateliux_cookie_anonymous_id` e `ateliux_cookie_consent`.

Os clients tambem enviam `X-Ateliux-Auth-Scope: admin` ou `client` para endpoints compartilhados, como signed URL de arquivos. Isso evita conflito quando admin e cliente estao logados no mesmo browser.

## Fluxos validados por API

E2E real executado em `http://localhost:3001/api`:

- login cliente e `GET /auth/client/me`
- login admin e `GET /auth/admin/me`
- cliente lista arquivos
- admin lista arquivos pendentes
- cliente tenta baixar arquivo pendente e recebe `403`
- admin aprova arquivo
- cliente baixa arquivo aprovado via `GET /files/:id/signed-url`
- cliente cria solicitacao com anexo
- admin abre conversa vinculada pelo `inboxConversationId`
- admin responde pela inbox
- cliente recebe a resposta em `/client/requests`
- cliente abre chamado de suporte
- admin responde pela inbox
- cliente recebe a resposta em `/client/support/tickets`
- lead publico criado em `POST /contact`
- assinante criado em `POST /newsletter/subscribe`
- admin lista clientes em `GET /admin/clients`
- admin abre workspace de projeto em `GET /admin/projects/:id/overview`

## Validacao do fluxo "Criar projeto para este cliente"

Fluxo admin:

```txt
/clientes
-> Criar projeto para este cliente
-> /portal-do-cliente/projetos?clientId=<clientId>&create=1
-> POST /admin/projects/full-setup
-> /portal-do-cliente/projetos/[projectId]
```

Validacoes obrigatorias:

- cliente vindo da query permanece pre-selecionado e bloqueado no full setup;
- sucesso depende da resposta do backend, sem toast antecipado;
- F5 na admin e na central do projeto recarrega dados reais;
- projeto `visibleToClient=true` aparece em `/client/projects`;
- projeto `visibleToClient=false` nao aparece em `/client/projects`;
- erro por responsavel ou dados minimos ausentes bloqueia a criacao;
- `POST /admin/projects` legado segue bloqueado.

Automacao relacionada:

```txt
backend/src/projects/projects.service.spec.ts
e2e/admin-client-project-flow.spec.ts
```

O E2E browser usa Playwright e cria um cliente E2E por API publica real antes de abrir a admin. A criacao do projeto passa pela UI da admin e pelo endpoint real `POST /admin/projects/full-setup`; o Portal do Cliente e validado em `http://localhost:3000/cliente/projeto`.

## LGPD e consentimento

Endpoints publicos:

- `GET /privacy/cookie-consent/config`
- `POST /privacy/cookie-consent`
- `GET /privacy/cookie-consent/current`
- `POST /privacy/requests`

Endpoints admin:

- `GET /admin/privacy/consents`
- `GET /admin/privacy/requests`
- `GET /admin/privacy/requests/:id`
- `PATCH /admin/privacy/requests/:id`

O frontend possui banner de cookies, modal de preferencias, paginas legais e formulario LGPD. Cookies nao essenciais devem ser carregados apenas apos consentimento. O cadastro de cliente exige aceite de Termos de Uso e Politica de Privacidade e registra o evento em `AuditLog`.

Documentos relacionados:

- `docs/lgpd-data-audit.md`
- `docs/cookie-inventory.md`

Auditoria de staging/deploy em 2026-06-27 tambem validou:

- `GET /api/health` com database e Redis;
- probe real de Redis e BullMQ;
- probe real de Cloudinary com upload/delete temporario;
- probe real de SMTP Gmail com `verify()`;
- login cliente/admin com cookies httpOnly;
- upload real via `/client/uploads`;
- bloqueio de signed URL para arquivo `PENDING_REVIEW`;
- aprovacao admin e signed URL apos `APPROVED`;
- solicitacao do cliente com resposta admin;
- suporte do cliente com resposta pela inbox;
- blog criado/publicado no admin e lido no endpoint publico;
- cobranca criada no admin e visivel no financeiro do cliente;
- notificacao criada e marcada como lida.

Resumo do ultimo E2E com seed demo local:

```json
{
  "clientLogin": "cliente demo local",
  "adminRole": "ADMIN",
  "pendingDownloadBlocked": true,
  "approvedFileStatus": "APPROVED",
  "signedUrlAfterApproval": true,
  "requestHasAdminReply": true,
  "supportHasAdminReply": true,
  "contactLeadCreated": true,
  "newsletterCreated": true,
  "adminClientsCount": "seed demo local"
}
```

## Upload e revisao

## Workspace administrativo do projeto

A admin possui uma central operacional por projeto em:

```txt
/portal-do-cliente/projetos/[projectId]
```

Fluxo:

```txt
Portal do Cliente -> Projetos -> Abrir projeto
```

A pagina usa o endpoint:

```txt
GET /admin/projects/:id/overview
```

O overview agrega `Project`, `Client`, responsavel, equipe, etapas, briefings, arquivos, aprovacoes, previews, cronograma, financeiro, historico, solicitacoes e inbox. O retorno tambem inclui `stats` e `permissions` para a UI esconder acoes que a role nao pode executar.

Roles com acesso ao overview:

- `ADMIN`
- `PROJECT_MANAGER`
- `DESIGNER_DEV`
- `SUPPORT`
- `FINANCE`

`EDITOR` e `ATTENDANCE` nao acessam esta rota. Dados financeiros ficam ocultos para `SUPPORT` e `DESIGNER_DEV`; o backend retorna `finance: []` e `stats.pendingPayments: 0`.

Abas atuais:

- Visao geral;
- Cliente;
- Equipe;
- Escopo;
- Etapas;
- Briefing;
- Arquivos;
- Aprovacoes;
- Preview;
- Cronograma;
- Financeiro;
- Historico;
- Configuracoes do Portal.

As acoes da tela reutilizam endpoints reais existentes: `PATCH /admin/projects/:id`, modulos de portal (`/admin/stages`, `/admin/briefings`, `/admin/approvals`, `/admin/previews`, `/admin/schedule`, `/admin/finance`, `/admin/history/manual-note`) e arquivos (`/admin/uploads`, `/admin/files/:id/approve`, `/admin/files/:id/reject`). A tela nao usa mocks como fonte principal.

Alteracoes feitas na central refletem no Portal do Cliente quando alteram dados consumidos por `/client/projects`, `/client/projects/:id`, `/client/team`, `/client/files`, `/client/schedule`, `/client/finance` e `/client/history`.

Portal do Cliente envia arquivos por upload seguro e o backend resolve `clientId` pela sessao. A politica agora separa uploads inbound e outbound:

- cliente/visitante -> Ateliux: politica restritiva, allowlist forte, extensoes perigosas bloqueadas, MIME e magic bytes obrigatorios quando aplicavel;
- admin/Ateliux -> cliente/blog/portal: politica administrativa ampla, autenticada por `AdminAuthGuard`, sem `actorType` confiado pelo body.

Contextos inbound restritivos: `client_file`, `support_attachment`, `contact_attachment`, `briefing_attachment` e `approval_attachment` quando enviados por cliente/publico. Esses uploads continuam entrando como `PENDING_REVIEW`.

Contextos admin/outbound: `blog_cover`, `blog_hero`, `client_file`, `approval_attachment`, `briefing_attachment`, `finance_receipt`, `preview_asset` e `support_attachment`. Arquivos enviados pela admin entram como `APPROVED`, exceto se um contexto futuro definir revisao manual. Blog aceita imagens `.jpg`, `.jpeg`, `.jfif`, `.png`, `.webp`, `.avif` e `.gif`; entregas do portal aceitam formatos amplos como PDF, Office, CSV, imagens, videos curtos, ZIP/RAR/7Z, SVG, JSON, PSD, AI, FIG e formatos que `file-type` nao detecta.

Limites administrativos:

- `blog_cover` e `blog_hero`: `BLOG_IMAGE_UPLOAD_MAX_SIZE_MB`, default 8 MB.
- `finance_receipt`: 20 MB.
- entregas/portal/previews/suporte admin: `ADMIN_UPLOAD_MAX_SIZE_MB`, default 100 MB.
- `UPLOAD_MAX_GLOBAL_SIZE_MB`, default 100 MB, limita o Multer antes da validacao por contexto.

Roles administrativas por contexto:

- `ADMIN`: todos os contextos administrativos.
- `EDITOR`: `blog_cover`, `blog_hero`.
- `DESIGNER_DEV`: `blog_cover`, `blog_hero`, `client_file`, `approval_attachment`, `briefing_attachment`, `preview_asset`.
- `PROJECT_MANAGER`: `client_file`, `approval_attachment`, `briefing_attachment`, `preview_asset`, `support_attachment`.
- `SUPPORT`: `support_attachment`, `client_file`.
- `FINANCE`: `finance_receipt`.
- `ATTENDANCE`: `contact_attachment` se habilitado futuramente.

Todo `FileAsset` novo recebe:

- `riskLevel=SAFE_PREVIEW`, `DOWNLOAD_ONLY` ou `HIGH_RISK_DOWNLOAD_ONLY`;
- `downloadMode=INLINE_ALLOWED` ou `ATTACHMENT_ONLY`;
- `cloudinaryResourceType=image`, `video` ou `raw`, conforme retorno do Cloudinary ou MIME inferido;
- AuditLog com contexto, role, tamanho, MIME, risco e modo de download.

Status reais:

- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `DELETED`

Download no cliente usa `GET /files/:id/signed-url` somente para arquivo aprovado. Arquivos `PENDING_REVIEW`, `REJECTED`, `DELETED` ou de outro `clientId` nao geram URL para cliente. A signed URL e gerada como anexo quando `downloadMode=ATTACHMENT_ONLY`, incluindo HTML, SVG, JS, JSON, ZIP/RAR/7Z e formatos similares. Em ambiente local sem Cloudinary configurado, o backend usa a URL persistida do seed como fallback depois de validar permissao e status.

Admin revisa arquivos por:

- `GET /admin/files`
- `GET /admin/files/pending-review`
- `POST /admin/files/:id/approve`
- `POST /admin/files/:id/reject`
- `GET /files/:id/signed-url`
- `DELETE /admin/files/:id`

Rejeitar arquivo (`POST /admin/files/:id/reject`) apenas altera status para `REJECTED`, registra motivo/auditoria e bloqueia download do cliente. Rejeicao nao apaga fisicamente o asset do Cloudinary.

Excluir arquivo (`DELETE /admin/files/:id`) e uma acao administrativa distinta. O backend valida permissao, registra `FILE_DELETE_REQUESTED`, verifica usos do `FileAsset`, remove o asset fisico do Cloudinary com `cloudinary.uploader.destroy(publicId, { resource_type })`, trata `not found` como sucesso idempotente, marca o banco como `DELETED`, limpa `secureUrl`/`url` e retorna `storageDeleted`, `storageProvider` e `storageDeleteResult`. Se o Cloudinary falhar, o backend registra `FILE_STORAGE_DELETE_FAILED`, retorna erro controlado e nao marca o banco como deletado.

O delete fisico e bloqueado quando o arquivo ainda esta vinculado a registros que usam o binario como ativo principal, como imagem de blog (`coverFileId`/`heroImageFileId`) ou recibo financeiro (`receiptFileId`). Anexos de inbox, solicitacoes e suporte podem permanecer no historico como `DELETED`, sem expor URL antiga para cliente. Falhas de Cloudinary sao retornadas como erro controlado de provider. O provider nao deve ser simulado em staging/producao.

## Health check

Endpoint:

```txt
GET /api/health
```

Resposta segura:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "environment": "development",
  "uptime": 123
}
```

Se database ou Redis falharem, o endpoint retorna erro de disponibilidade sem expor secrets.

## Suporte, solicitacoes e inbox

`/cliente/suporte`:

- `GET /client/support/tickets`
- `POST /client/support/tickets`
- `POST /client/support/tickets/:id/messages`
- `POST /client/support/tickets/:id/close`

`/cliente/solicitacoes`:

- `GET /client/requests`
- `POST /client/requests`

Caixa de entrada admin:

- `GET /admin/inbox/conversations`
- `GET /admin/inbox/conversations/:id`
- `POST /admin/inbox/conversations/:id/messages`
- `PATCH /admin/inbox/conversations/:id`
- `DELETE /admin/inbox/conversations/:id`

O vinculo entre solicitacao/chamado e inbox usa `inboxConversationId` salvo na entidade principal.

Anexos enviados em solicitacoes, suporte ou mensagens usam o mesmo `FileAsset`; o binario nao e duplicado. O vinculo fica assim:

- `ClientRequest` -> `ClientRequestAttachment` -> `FileAsset`;
- `SupportTicket` -> `SupportTicketAttachment` -> `FileAsset`;
- `InboxMessage.attachments` -> `FileAsset.messageId`;
- `InboxConversation` continua centralizando a conversa por `clientId` e `projectId`.

Quando o cliente envia `fileAssetIds`, o backend valida que os arquivos pertencem ao cliente autenticado, nao estao `DELETED` e nao pertencem a outro projeto. Chamados publicos nao podem informar `clientId` por payload; arquivos publicos precisam ter `origin=PUBLIC` e `clientId=null`.

A Caixa de Entrada admin retorna anexos em:

- `GET /admin/inbox/conversations`;
- `GET /admin/inbox/conversations/:id`.

Cada mensagem retorna metadados de anexo: nome, extensao, MIME, tamanho, status, risco, modo de download, contexto, origem e motivo de rejeicao. A `InboxView` mostra esses anexos dentro do chat, permite baixar arquivo pendente para analise, aprovar com `POST /admin/files/:id/approve`, rejeitar com `POST /admin/files/:id/reject` e excluir fisicamente com `DELETE /admin/files/:id`. Quando um anexo de chat e excluido, a mensagem permanece no historico e o anexo passa a aparecer como removido, sem link antigo. Cliente continua baixando somente arquivo `APPROVED` via `GET /files/:id/signed-url`.

## Contato, newsletter e blog

Contato:

- `POST /contact`
- `GET /admin/contact-leads`
- `GET /admin/contact-leads/:id`
- `PATCH /admin/contact-leads/:id`
- `POST /admin/contact-leads/:id/convert-to-client`
- `POST /admin/contact-leads/:id/reply`

Newsletter:

- `POST /newsletter/subscribe`
- `POST /newsletter/unsubscribe`
- `GET /admin/newsletter/subscribers`
- `PATCH /admin/newsletter/subscribers/:id`
- `DELETE /admin/newsletter/subscribers/:id`
- `GET /admin/newsletter/subscribers/export`

Blog API:

- `GET /blog/posts`
- `GET /blog/posts/:id`
- `GET /blog/posts/:id/comments`
- `GET /blog/categories`
- `GET /blog/tags`
- `POST /blog/posts/:id/share`
- `GET /client/blog/saved`
- `GET /client/blog/posts/:id/saved-status`
- `POST /client/blog/posts/:id/save`
- `DELETE /client/blog/posts/:id/save`
- `POST /client/blog/posts/:id/comments`
- `POST /client/blog/posts/:id/message-thread`
- `GET /admin/blog/posts`
- `POST /admin/blog/posts`
- `PATCH /admin/blog/posts/:id`
- `DELETE /admin/blog/posts/:id`
- `POST /admin/blog/posts/:id/publish`
- `POST /admin/blog/posts/:id/unpublish`
- `POST /admin/blog/posts/:id/archive`
- `GET /admin/blog/tags`
- `POST /admin/blog/tags`
- `PATCH /admin/blog/tags/:id`
- `DELETE /admin/blog/tags/:id`
- `GET /admin/blog/posts/:id/comments`
- `DELETE /admin/blog/comments/:id`

As telas publicas `/blog` e `/blog/[slug]` usam a API publica de blog. Imagens de card/hero sao enviadas pela admin para `/admin/uploads` com contextos `blog_cover` e `blog_hero`, passam pela politica admin de imagem, ficam em Cloudinary e sao vinculadas ao post por `coverFileId` e `heroImageFileId`. Ao trocar ou remover uma imagem do artigo, o blog desvincula primeiro o `FileAsset` antigo e tenta apagar o asset antigo do Cloudinary somente se ele virou orfao. Se a imagem antiga ainda estiver vinculada a outro post, a exclusao fisica e bloqueada. A API publica retorna `coverImageUrl`, `heroImageUrl`, `coverFile`, `heroImageFile` e `authorDisplayName: "Equipe Ateliux"`. O `authorId` interno continua salvo somente para auditoria/admin. Comentarios, artigos salvos, compartilhamentos e abertura de conversa no Portal do Cliente usam endpoints reais. O conteudo local e a arte geometrica permanecem somente como fallback de desenvolvimento quando `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true`; em producao, post sem imagem usa placeholder neutro e nao imagem mockada fixa. O CRUD visual de blog na admin usa a API administrativa com fallback apenas em desenvolvimento.

## Admin conectado

Conectado a API real com fallback explicito em desenvolvimento:

- Auth admin
- Clientes: listar, criar, editar, arquivar/inativar, alterar status e convite
- Caixa de Entrada
- Revisao de arquivos
- BlogManagementView: listar, criar, editar, publicar/despublicar, arquivar, duplicar e excluir
- BlogManagementView: upload real de capa/hero, tags reais, campos editoriais e moderacao de comentarios
- NewsletterManagementView: listar, criar via subscribe, alterar status, exportar e remover
- PortalManagementView: clientes, projetos, briefings, etapas, aprovacoes, solicitacoes, arquivos, previews, cronograma, financeiro e historico com `clientId` e `projectId`
- PortalManagementView: criacao completa de projeto via `POST /admin/projects/full-setup`, com responsavel obrigatorio, equipe, etapa inicial, briefing, cronograma, financeiro, historico e notificacao.

### Criacao completa de projeto

O fluxo recomendado para projetos novos e:

```txt
Admin seleciona cliente
-> informa projeto, tipo, escopo, descricao, status, prioridade, prazo, etapa atual, progresso e resumo para o cliente
-> define responsavel principal e equipe interna
-> cria etapa inicial obrigatoria
-> opcionalmente cria briefing, evento de cronograma e cobranca inicial
-> backend grava tudo em transacao
-> Portal do Cliente le os dados reais por /client/*
```

Quando a origem for a tela de clientes:

```txt
Admin -> Clientes -> Criar projeto para este cliente
-> /portal-do-cliente/projetos?clientId=<clientId>&create=1
-> cliente pre-selecionado no full setup
-> POST /admin/projects/full-setup
-> /portal-do-cliente/projetos/[projectId]
```

Nao existe acao de "vincular projeto" apenas visual. Vincular ou mover projeto existente entre clientes nao esta habilitado; se essa operacao for criada no futuro, precisa de endpoint proprio, validacao de dados sensiveis e `AuditLog`.

Endpoints envolvidos:

```txt
GET  /admin/users
POST /admin/projects/full-setup
POST /admin/projects (legado bloqueado, retorna erro de substituicao)
PATCH /admin/projects/:id
GET  /client/projects
GET  /client/projects/:id
GET  /client/team
```

`POST /admin/projects/full-setup` valida `clientId`, `managerId` e `teamIds`, cria `Project`, `ProjectTeamMember`, etapa inicial, opcionais de briefing/cronograma/financeiro, `AuditLog` e `Notification`. O Portal agora usa `Client.plan`, `Project.manager` e `ProjectTeamMember` como fontes reais para evitar responsavel/equipe vazios.

`POST /admin/projects` nao deve ser usado por nenhuma tela admin. A rota foi mantida apenas para responder erro controlado informando a substituicao por `/admin/projects/full-setup`, evitando que um fluxo antigo crie projeto incompleto.

`PATCH /admin/projects/:id` e a edicao segura: atualiza responsavel principal, equipe, status, prioridade, prazo, progresso, etapa atual, resumo, escopo, descricao e visibilidade. O backend bloqueia qualquer tentativa de publicar projeto no Portal sem responsavel, etapa, progresso valido, prazo valido e escopo/resumo.

Documento complementar: `docs/admin-client-flow-audit.md`.

Ainda mockado ou parcialmente conectado:

- Dashboard geral
- Suporte legado administrativo
- Calendario, funcionarios, desempenho, folha, licencas e recrutamento

## Portal do Cliente conectado

Conectado a API real com fallback explicito em desenvolvimento:

- Auth cliente
- Arquivos
- Solicitacoes
- Suporte
- Meu projeto
- Etapas
- Aprovacoes
- Previews
- Cronograma
- Financeiro
- Historico
- Notificacoes do painel lateral e contador real no topbar
- Artigos salvos via `/client/blog/saved`
- Visao geral composta por projetos, arquivos, solicitacoes, aprovacoes, cronograma, financeiro, historico, notificacoes e equipe
- Equipe via `GET /client/team`
- Identidade/projeto exibidos no topbar via sessao e projetos reais

Ainda mockado ou parcialmente conectado:

- Conteudo institucional/CMS publico que ainda e estatico por design

## Fallbacks mockados

Fallbacks permanecem somente para desenvolvimento quando API ou sessao nao responder e quando `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true`:

- `frontend/components/client-portal/files/ClientFilesPage.tsx`
- `frontend/components/client-portal/requests/ClientRequestsPage.tsx`
- `frontend/components/client-portal/support/ClientSupportPage.tsx`
- `frontend/components/client-portal/project/ClientProjectPage.tsx`
- `frontend/components/client-portal/stages/ClientStagesPage.tsx`
- `frontend/components/client-portal/approvals/ClientApprovalsPage.tsx`
- `frontend/components/client-portal/preview/ClientPreviewPage.tsx`
- `frontend/components/client-portal/schedule/ClientSchedulePage.tsx`
- `frontend/components/client-portal/billing/ClientBillingPage.tsx`
- `frontend/components/client-portal/history/ClientHistoryPage.tsx`
- `frontend/components/client-portal/layout/ClientPortalNotifications.tsx`
- `frontend/components/client-portal/overview/ClientOverviewPage.tsx`
- `frontend/components/client-portal/team/ClientTeamPage.tsx`
- `frontend/app/blog/page.tsx`
- `frontend/app/blog/[slug]/page.tsx`
- `admin/components/admin/views/ClientsManagementView.tsx`
- `admin/components/admin/views/FileReviewView.tsx`
- `admin/components/admin/views/InboxView.tsx`
- `admin/components/admin/views/BlogManagementView.tsx`
- `admin/components/admin/views/NewsletterManagementView.tsx`
- `admin/components/admin/views/PortalManagementView.tsx`

Mocks ainda estruturais:

- `frontend/data/client-portal/client-portal-mock-data.ts`
- `frontend/content/blog/blog-content.ts`
- `frontend/data/crm/crm-mock-data.ts`
- `admin/data/admin/admin-mock-data.ts`

Esses mocks nao devem ser tratados como producao.

## Mapa de fallbacks e mocks restantes

| Projeto | Arquivo | Modulo | Tipo de fallback | Endpoint real equivalente | Status | Pode existir em dev? | Bloqueado em producao? | Acao necessaria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| frontend | `components/auth/MockAuthProvider.tsx` | Auth cliente | fallback visual de sessao | `/auth/client/*` | parcialmente conectado | sim, com flag | sim | remover provider mock quando auth estiver final |
| frontend | `components/client-portal/files/ClientFilesPage.tsx` | Arquivos | mock em falha de API | `/client/files`, `/uploads` | conectado | sim, com flag | sim | validar browser com storage real |
| frontend | `components/client-portal/requests/ClientRequestsPage.tsx` | Solicitacoes | mock em falha de API | `/client/requests` | conectado | sim, com flag | sim | adicionar testes browser |
| frontend | `components/client-portal/support/ClientSupportPage.tsx` | Suporte cliente | mock em falha de API | `/client/support/tickets` | conectado | sim, com flag | sim | adicionar testes browser |
| frontend | `components/client-portal/project/ClientProjectPage.tsx` | Projeto | mock em falha de API | `/client/projects`, `/client/projects/:id` | conectado | sim, com flag | sim | enriquecer DTO real com blocos de escopo |
| frontend | `components/client-portal/stages/ClientStagesPage.tsx` | Etapas | mock em falha de API | `/client/projects/:id/stages` | conectado | sim, com flag | sim | validar selecao multi-projeto |
| frontend | `components/client-portal/approvals/ClientApprovalsPage.tsx` | Aprovacoes | mock em falha de API | `/client/approvals` | conectado | sim, com flag | sim | persistir comentarios de preview se virar requisito |
| frontend | `components/client-portal/preview/ClientPreviewPage.tsx` | Previews | mock em falha de API | `/client/previews` | conectado | sim, com flag | sim | decidir persistencia de comentario de preview |
| frontend | `components/client-portal/schedule/ClientSchedulePage.tsx` | Cronograma | mock em falha de API | `/client/schedule` | conectado | sim, com flag | sim | validar eventos por projeto |
| frontend | `components/client-portal/billing/ClientBillingPage.tsx` | Financeiro | mock em falha de API | `/client/finance` | conectado | sim, com flag | sim | conectar recibo por signed URL |
| frontend | `components/client-portal/history/ClientHistoryPage.tsx` | Historico | mock em falha de API | `/client/history` | conectado | sim, com flag | sim | aumentar cobertura de audit log |
| frontend | `components/client-portal/layout/ClientPortalNotifications.tsx` | Notificacoes | mock em falha de API | `/client/notifications` | conectado | sim, com flag | sim | validar browser com contador real no topbar |
| frontend | `components/client-portal/overview/ClientOverviewPage.tsx` | Visao geral | mock em falha de API | composicao `/client/projects`, `/client/files`, `/client/requests`, `/client/approvals`, `/client/schedule`, `/client/finance`, `/client/history`, `/client/notifications`, `/client/team` | conectado | sim, com flag | sim | adicionar teste browser de dashboard |
| frontend | `components/client-portal/team/ClientTeamPage.tsx` | Equipe | mock em falha de API | `/client/team` | conectado | sim, com flag | sim | enriquecer avatar/cargo no backend se necessario |
| frontend | `content/blog/blog-content.ts` | Blog publico | conteudo local em fallback dev | `/blog/posts`, `/blog/posts/:id`, `/blog/posts/:id/comments`, `/client/blog/saved` | conectado | sim, com flag | sim | remover fallback local quando CMS/API estiver estavel |
| frontend | `data/crm/crm-mock-data.ts` | CRM legado | mock estrutural | indefinido | pendente | sim | nao aplicavel ainda | decidir remover ou virar produto |
| admin | `components/admin/views/ClientsManagementView.tsx` | Clientes | mock em falha de API | `/admin/clients` | conectado | sim, com flag | sim | validar permissoes por papel |
| admin | `components/admin/views/InboxView.tsx` | Inbox | mock em falha de API | `/admin/inbox/conversations` | conectado | sim, com flag | sim | completar criacao/anexo real |
| admin | `components/admin/views/FileReviewView.tsx` | Revisao de arquivos | mock em falha de API | `/admin/files` | conectado | sim, com flag | sim | validar storage real |
| admin | `components/admin/views/BlogManagementView.tsx` | Blog admin | mock em falha de API | `/admin/blog/posts`, `/admin/blog/tags`, `/admin/blog/comments`, `/admin/uploads` | conectado | sim, com flag | sim | validar UX de editor rico se virar requisito |
| admin | `components/admin/views/NewsletterManagementView.tsx` | Newsletter admin | mock em falha de API | `/admin/newsletter/subscribers` | conectado | sim, com flag | sim | ajustar export CSV final |
| admin | `components/admin/views/PortalManagementView.tsx` | Portal admin | fallback somente em falha controlada | `/admin/projects/full-setup`, `PATCH /admin/projects/:id`, `/admin/briefings`, `/admin/stages`, `/admin/approvals`, `/admin/requests`, `/admin/files`, `/admin/previews`, `/admin/schedule`, `/admin/finance`, `/admin/history` | conectado | sim, com flag | sim | adicionar testes browser para acoes reais |
| admin | `data/admin/admin-mock-data.ts` | Modulos internos | mock estrutural | varios `/admin/*` | pendente | sim | nao aplicavel ainda | substituir dashboard, suporte legado e RH |

## Como testar localmente

1. Subir PostgreSQL e Redis.
2. Em `backend`: `npm install`, `npm run prisma:generate`, `npx prisma migrate deploy`, configurar envs de bootstrap e rodar `npm run prisma:bootstrap-admin`, depois `npm run start:dev`.
3. Em `frontend`: `npm install`, `npm run dev`.
4. Em `admin`: `npm install`, `npm run dev -- -p 3002`.
5. Entrar na admin com o admin criado pelo bootstrap.
6. Criar um cliente real ou, apenas em banco local descartavel, rodar `ALLOW_DEMO_SEED=true npm run prisma:seed:dev`.
7. Validar `/cliente/visao-geral`, `/cliente/projeto`, `/cliente/equipe`, `/cliente/arquivos`, `/cliente/artigos-salvos`, `/cliente/solicitacoes`, `/cliente/suporte`, `/cliente/etapas`, `/cliente/aprovacoes`, `/cliente/previa`, `/cliente/cronograma`, `/cliente/financeiro` e `/cliente/historico` com cliente real ou demo local.
8. Validar clientes, inbox, revisao de arquivos, blog, newsletter e Portal do Cliente admin.

## Pendencias de migracao

- Criar tela admin dedicada para leads de contato ou integrar leads na inbox.
- Adicionar testes negativos por papel administrativo especifico alem do papel `ADMIN`.
- Configurar Cloudinary/SMTP reais antes de qualquer ambiente de staging.
