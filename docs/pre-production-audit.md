# Ateliux Pre-Production Audit

Auditoria operacional antes de colocar o ecossistema Ateliux em staging/producao.

## Estado atual

- Backend NestJS com Prisma, PostgreSQL, Redis/BullMQ, auth por cookie httpOnly, modulos de portal, admin, uploads, contato, newsletter e blog.
- Migrations `20260626200000_contact_lead_file_asset`, `20260627142000_blog_editorial_real`, `20260627183000_file_risk_metadata`, `20260628110000_inbox_message_file_links`, `20260628123000_cloudinary_resource_type`, `20260628201500_project_full_setup`, `20260629170000_lgpd_privacy` e `20260630120000_client_pipeline_status` versionadas para `prisma migrate deploy`.
- Seed demo separada em `backend/prisma/seed.dev.ts` e bloqueada por `NODE_ENV`/`ALLOW_DEMO_SEED`.
- Bootstrap seguro de admin principal criado em `backend/prisma/bootstrap-admin.ts`.
- E2E por API validou cliente, admin, revisao de arquivo, solicitacoes, suporte, contato e newsletter.
- Frontend e admin possuem fallbacks de desenvolvimento controlados por `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true`; os fluxos principais de portal, blog publico, blog admin, newsletter, inbox, clientes e arquivos ja consomem API real.
- Blog editorial real cobre tags, imagens de card/hero via Cloudinary, campos editoriais, SEO, comentarios de clientes, artigos salvos, compartilhamentos e abertura de conversa no Portal do Cliente.
- Blog publico padroniza autoria como `Equipe Ateliux`; `authorId` e nome do admin permanecem somente para auditoria/admin.
- Arte geometrica local do blog e conteudos mockados nao sao usados como imagem real de artigo em producao; posts sem imagem usam placeholder neutro.
- Anexos de solicitacoes, suporte e mensagens agora aparecem tambem dentro da Caixa de Entrada admin, usando o mesmo `FileAsset` referenciado por `InboxMessage`, `ClientRequestAttachment` e `SupportTicketAttachment`.
- Criacao completa de projeto admin agora usa `POST /admin/projects/full-setup`, exige responsavel principal, permite equipe interna, cria etapa inicial e opcionais de briefing, cronograma e financeiro em uma transacao.
- A tela Clientes nao possui mais modal falso de vinculo; a acao e `Criar projeto para este cliente`, levando `clientId` para `/portal-do-cliente/projetos?clientId=<clientId>&create=1` e salvando pelo full setup real.
- Central operacional do projeto criada na admin em `/portal-do-cliente/projetos/[projectId]`, consumindo `GET /admin/projects/:id/overview`.
- Portal do Cliente consome responsavel, equipe, plano, etapa atual e resumo a partir dos dados reais de `Project`, `Client`, `AdminUser` e `ProjectTeamMember`.
- `POST /admin/projects` foi transformado em endpoint legado bloqueado: retorna erro controlado e nao cria `Project`.
- Edicao segura por `PATCH /admin/projects/:id` bloqueia projeto visivel no Portal sem responsavel, etapa atual, progresso valido, prazo valido e escopo/resumo.
- Base tecnica LGPD adicionada: `CookieConsent`, `PrivacyRequest`, banner de cookies, paginas legais, formulario LGPD e modulo admin. Textos legais exigem revisao juridica antes de producao.
- Status comercial de cliente separado do status de conta: `Client.status` controla acesso; `Client.pipelineStatus` controla kanban/lista interna da admin e nao e exposto ao Portal do Cliente.
- Rotina oficial de validacao adicionada na raiz com `scripts/validate.mjs` e comandos `validate:backend`, `validate:admin`, `validate:frontend`, `validate:e2e`, `validate:all`, `validate:pre-staging` e `validate:pre-production`.
- Relatorios de validacao sao gerados em `docs/reports/*-validation-latest.md` sem valores de `.env`.
- Banco limpo de validacao pre-producao foi criado em ambiente local controlado, recebeu migrations via `migrate deploy`, bootstrap admin, `production:check-clean`, `validate:pre-production`, E2E e health check. Relatorio: `docs/reports/preproduction-database-validation-latest.md`.
- Homologacao Docker local criada para backend + PostgreSQL + Redis, expondo a API em `http://localhost:3054/api` e documentando uso com Vercel/ngrok. Relatorio: `docs/reports/docker-local-homolog-latest.md`.
- Homologacao do backend 100% em container validada em 2026-07-01: Dockerfile de producao com `node dist/src/main.js`, Postgres/Redis internos, migrations/bootstrap/check-clean no container, health local/ngrok e login cliente/admin via ngrok. Relatorio: `docs/reports/docker-backend-full-container-latest.md`.
- Caminho Docker -> ngrok -> backend validado com health publico, CORS configurado, cookies httpOnly cross-site, login cliente/admin e fluxo projeto visivel/invisivel. Vercel real segue pendente de dominio/redeploy no provedor. Relatorio: `docs/reports/ngrok-vercel-homolog-latest.md`.

## Auditoria de staging/deploy - 2026-06-27

Checkpoint registrado para o relatorio final: `checkpoint/full-api-integration-v1`.

### Resultado executivo

- Backend, frontend e admin passaram em typecheck, lint e build.
- Backend passou em `prisma:generate`, `prisma migrate status` e testes automatizados de upload/arquivos.
- `GET /api/health` foi criado e validado com database e Redis.
- Probes reais validaram database, Redis, BullMQ, Cloudinary upload/delete e SMTP Gmail `verify()`.
- Fluxos HTTP reais validados: health, login cliente/admin, `/me`, endpoints isolados do cliente, upload pendente, bloqueio de download pendente, aprovacao admin, signed URL aprovado, solicitacao com resposta, suporte com resposta via inbox, blog admin/publico, financeiro e notificacao lida.
- Nenhum valor real de `.env` foi registrado em documentacao.

### Ajustes aplicados na auditoria

- `.env.example` do frontend e admin recebeu `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=false`.
- `.env.example` do backend recebeu variaveis de bootstrap admin e `ALLOW_DEMO_SEED=false`.
- `.env.example` foi explicitamente permitido nos `.gitignore`, mantendo `.env` real ignorado.
- `prisma:seed` agora aponta para `prisma/seed.dev.ts`, que aborta em producao e exige `ALLOW_DEMO_SEED=true`.
- `prisma:bootstrap-admin` cria somente o admin principal, sem dados demo e sem trocar senha existente sem `BOOTSTRAP_ADMIN_RESET_PASSWORD=true`.
- `production:check-clean` verifica indicadores demo conhecidos sem apagar dados.
- `production:clean-demo-data` adiciona limpeza demo controlada, com dry-run por padrao, apply protegido por flags e sem delete fisico no Cloudinary.
- Validacao de ambiente do backend agora bloqueia em staging/producao:
  - `CORS_ORIGINS=*`;
  - `COOKIE_SECURE=false`;
  - `COOKIE_SAME_SITE=none` sem cookie seguro;
  - `COOKIE_DOMAIN=localhost`;
  - `CORS_ORIGINS` apontando para localhost;
  - `DATABASE_URL` apontando para banco local.
- Logout cliente/admin limpa cookies com `domain`, `sameSite`, `secure` e `path` iguais aos usados na criacao.
- Auth cliente/admin agora usa cookies separados por escopo, endpoints de refresh e rotacao de refresh token persistido no banco.
- Novos refresh tokens sao persistidos como SHA-256 do token bruto; hashes bcrypt antigos ainda sao aceitos durante migracao para evitar quebra imediata de sessoes, mas nao sao usados para novos tokens porque bcrypt trunca entradas longas.
- Frontend e admin repetem uma requisicao autenticada uma unica vez apos `401`, chamando `/auth/client/refresh` ou `/auth/admin/refresh`. `403` permanece erro de permissao e nao derruba a sessao.
- `COOKIE_DOMAIN=localhost` foi tratado como configuracao local instavel: em dev o cookie vira host-only e a documentacao recomenda `COOKIE_DOMAIN=` vazio.
- Falha de upload no Cloudinary agora retorna erro controlado de provider em vez de erro 500 generico.
- Exclusao administrativa de arquivo agora remove o asset fisico do Cloudinary antes de marcar o `FileAsset` como `DELETED`; rejeicao continua sendo apenas mudanca de status.

### Variaveis de ambiente

- `backend/.env`: chaves obrigatorias presentes.
- `backend/.env.example`: chaves obrigatorias presentes.
- `frontend/.env.example`: chaves publicas obrigatorias presentes.
- `admin/.env.example`: chaves publicas obrigatorias presentes.
- `frontend/.env.local`, `frontend/.env.production`, `admin/.env.local`, `admin/.env.production` nao existem no workspace atual.
- Para staging/producao, configurar explicitamente `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=false`.

### CORS e cookies

- Backend usa `credentials: true` com lista de origins vinda de `CORS_ORIGINS`.
- Wildcard de CORS agora e recusado pela validacao de env.
- Cookies de acesso/refresh sao `httpOnly`.
- Cookies atuais por escopo:
  - admin: `ateliux_admin_access_token` e `ateliux_admin_refresh_token`;
  - cliente: `ateliux_client_access_token` e `ateliux_client_refresh_token`;
  - legado aceito durante migracao: `ateliux_access_token` e `ateliux_refresh_token`.
- Access token deve permanecer curto (`JWT_ACCESS_EXPIRES_IN`, recomendado `15m`) e refresh token deve ser mais longo (`JWT_REFRESH_EXPIRES_IN`, recomendado `7d`).
- Refresh token e rotacionado a cada refresh e reuso de token antigo deve retornar `401`.
- Refresh token novo nao deve ser salvo com bcrypt; validar reuso de token antigo para prevenir colisao por truncamento.
- Em desenvolvimento local, usar `localhost` nos tres apps e `COOKIE_DOMAIN=` vazio. Nao usar `COOKIE_DOMAIN=localhost`.
- Apps frontend/admin usam `credentials: "include"`.
- Apps frontend/admin enviam `X-Ateliux-Auth-Scope` para evitar conflito quando admin e cliente estao logados no mesmo browser.
- Busca em frontend/admin nao encontrou uso de `localStorage` ou `sessionStorage` para sessao.
- Para dominios separados ou subdominios, revisar:
  - `COOKIE_DOMAIN`;
  - `COOKIE_SECURE=true`;
  - `COOKIE_SAME_SITE=none` quando cross-site for necessario.

### Banco e migrations

- `npx prisma migrate status` retornou schema atualizado no banco local.
- Foram encontradas migrations versionadas incluindo `20260628201500_project_full_setup` e `20260629170000_lgpd_privacy`.
- Para staging/producao usar somente `npx prisma migrate deploy`.
- `prisma migrate dev` continua proibido fora de ambiente local.

### LGPD e cookies

- `CookieConsent` registra consentimento anonimo ou autenticado, versao, origem, IP e User-Agent.
- `PrivacyRequest` registra pedidos de titulares com status operacional.
- Admin consulta consentimentos em `/admin/privacy/consents` e pedidos em `/admin/privacy/requests`.
- Frontend adicionou `/politica-de-privacidade`, `/politica-de-cookies`, `/termos-de-uso`, `/termos-do-portal` e `/lgpd`.
- Banner permite aceitar todos, recusar nao essenciais ou personalizar preferencias.
- Cookies necessarios nao podem ser desativados.
- Scripts de analytics/marketing devem ser bloqueados ate consentimento por helper.
- Inventarios criados em `docs/lgpd-data-audit.md` e `docs/cookie-inventory.md`.
- Revisao juridica permanece obrigatoria antes de afirmar conformidade LGPD.
- O banco do checkpoint local aponta para localhost; isso e aceitavel localmente, mas bloqueado por validacao quando `NODE_ENV=staging` ou `NODE_ENV=production`.

### Redis, BullMQ e filas

- Redis respondeu `PING`.
- BullMQ conseguiu consultar fila de auditoria.
- Filas registradas: `mail`, `notifications`, `audit`, `uploads`.
- Upload pendente cria job/notificacao administrativa via fila `uploads`.
- SMTP esta ligado ao processor `mail`; falha de SMTP fica no job e nao precisa derrubar o backend.

### Central operacional do projeto

- `GET /admin/projects/:id/overview` agrega dados operacionais do projeto em uma unica resposta administrativa.
- O endpoint retorna `project`, `client`, `team`, `stages`, `briefings`, `files`, `approvals`, `previews`, `schedule`, `finance`, `history`, `requests`, `inbox`, `stats` e `permissions`.
- A rota esta protegida por `AdminAuthGuard` e `RolesGuard`.
- Roles permitidas: `ADMIN`, `PROJECT_MANAGER`, `DESIGNER_DEV`, `SUPPORT` e `FINANCE`.
- `EDITOR` e `ATTENDANCE` devem receber `403`.
- Dados financeiros sao retornados apenas para `ADMIN`, `PROJECT_MANAGER` e `FINANCE`; demais roles recebem `finance: []`.
- A pagina admin `/portal-do-cliente/projetos/[projectId]` tem abas de visao geral, cliente, equipe, escopo, etapas, briefing, arquivos, aprovacoes, preview, cronograma, financeiro, historico e configuracoes do Portal.
- Acoes disponiveis reutilizam endpoints reais existentes e nao criam uma segunda fonte de dados.
- Alteracoes em progresso, etapa atual, prazo, responsavel, resumo e visibilidade refletem nos endpoints do Portal do Cliente.
- Testes automatizados cobrem overview completo, projeto inexistente, roles permitidas/bloqueadas, ocultacao financeira, stats e coerencia com o Portal.
- Harness Playwright versionado em `/e2e` cobre o fluxo Admin -> Backend -> Portal do Cliente no browser.

### Validacao do fluxo "Criar projeto para este cliente"

Rota e endpoint:

```txt
/portal-do-cliente/projetos?clientId=<clientId>&create=1
POST /admin/projects/full-setup
```

Checklist de staging:

- admin logado acessa Clientes e ve a acao `Criar projeto para este cliente`;
- nao ha modal de vinculo local ou acao que salve apenas `useState`;
- full setup recebe `clientId` pela query e bloqueia troca acidental do cliente;
- projeto com `visibleToClient=true` persiste, redireciona para `/portal-do-cliente/projetos/[projectId]`, sobrevive a F5 e aparece no Portal;
- projeto com `visibleToClient=false` persiste na admin, sobrevive a F5 e nao aparece no Portal;
- erro de backend por responsavel/prazo/etapa/resumo ausente nao gera sucesso falso;
- testes em `backend/src/projects/projects.service.spec.ts` cobrem `clientId`, visibilidade, isolamento por cliente, notificacao e endpoint legado bloqueado.
- teste browser em `e2e/admin-client-project-flow.spec.ts` cobre criacao de projeto visivel, projeto invisivel, erro sem dados minimos, F5 e ausencia do fluxo falso.

### Cloudinary

- Cloudinary real foi testado com upload e delete de asset temporario de auditoria.
- Estrutura usada pelo app: `CLOUDINARY_ROOT_FOLDER/NODE_ENV/{context}/client_{clientId}/project_{projectId}`.
- `cloudinaryPublicId`, `cloudinaryResourceType`, `secureUrl` e delete fisico via `DELETE /admin/files/:id` estao cobertos pelo fluxo validado.
- `cloudinary.uploader.destroy` usa `resource_type` correto (`image`, `video` ou `raw`) e trata `not found` como sucesso idempotente.
- Falha de delete no Cloudinary registra `FILE_STORAGE_DELETE_FAILED` e nao marca o arquivo como `DELETED`.
- Rejeitar arquivo registra `REJECTED` e bloqueia download, mas nao remove o asset do Cloudinary.
- Upload com provider indisponivel ou erro externo retorna erro controlado.

### SMTP Gmail

- SMTP Gmail foi validado com `transporter.verify()`.
- Nenhuma credencial foi impressa.
- Para Gmail em staging/producao, usar senha de app ou credencial equivalente e manter `SMTP_PASS` apenas no ambiente seguro do provedor.

### Upload seguro

- A politica de upload foi separada em dois fluxos:
  - inbound restritivo para cliente/visitante (`CLIENT`/`PUBLIC`);
  - outbound amplo para admin/Ateliux (`ADMIN`), sempre via guard administrativo e backend.
- Upload admin agora tem limites por contexto: blog 8 MB, financeiro 20 MB e entregas/portal/previews 100 MB, sempre limitado por `UPLOAD_MAX_GLOBAL_SIZE_MB`.
- `FileAsset` possui `riskLevel` e `downloadMode` calculados no backend.
- `HIGH_RISK_DOWNLOAD_ONLY` e `DOWNLOAD_ONLY` sao entregues como anexo; `SAFE_PREVIEW` pode abrir inline.
- Upload admin valida role por contexto e registra `ADMIN_FILE_UPLOAD_DENIED_BY_ROLE` quando bloqueado.
- Testes automatizados continuam cobrindo:
  - arquivo valido;
  - arquivo grande demais;
  - cliente bloqueado em `.exe`, `.js`, `.html`, `.svg`, `.zip`, `.env`;
  - MIME falso;
  - magic bytes incompativel;
  - cliente tentando usar `clientId`/`projectId` indevido;
  - cliente/publico impedidos de usar contexto administrativo de blog;
  - admin enviando `.zip`, `.svg`, `.json`, `.psd` e formato sem magic bytes detectavel;
  - upload admin entrando como `APPROVED`;
  - upload admin sem role adequada recebendo `403`;
  - arquivo amplo recebendo `riskLevel` e `downloadMode`;
  - bloqueio de signed URL para `PENDING_REVIEW`;
  - signed URL para `APPROVED`;
  - delete fisico no Cloudinary antes de marcar `DELETED`;
  - rejeicao sem delete fisico no Cloudinary;
  - erro de Cloudinary impedindo soft delete no banco;
  - `not found` do Cloudinary tratado como sucesso idempotente;
  - bloqueio de delete quando arquivo ainda esta vinculado a blog/financeiro;
  - cliente impedido de excluir arquivo.
- Testes automatizados tambem cobrem:
  - solicitacao do cliente com `fileAssetIds` vinculando o mesmo arquivo a `ClientRequest` e `InboxMessage`;
  - suporte do cliente com `fileAssetIds` vinculando o mesmo arquivo a `SupportTicket` e `InboxMessage`;
  - resposta de suporte com anexo mantendo vinculo no ticket existente;
  - listagem admin da inbox retornando `messages.attachments`;
  - resposta admin com `fileAssetIds` conectando anexos na mensagem;
  - signed URL de arquivo `PENDING_REVIEW` liberada para admin analisar e bloqueada para cliente.
- Fluxo HTTP real validou upload PNG, status `PENDING_REVIEW`, bloqueio de download, aprovacao admin e signed URL aprovado.
- Download do cliente continua validando `clientId`, status `APPROVED` e signed URL com disposicao de anexo.

### Anexos na inbox

- `GET /admin/inbox/conversations` e `GET /admin/inbox/conversations/:id` retornam anexos dentro de cada mensagem.
- A admin ve nome, extensao, MIME, tamanho, status, risco, modo de download, contexto, origem e motivo de rejeicao.
- A admin pode baixar arquivo `PENDING_REVIEW` pelo chat para analise.
- A admin pode aprovar/rejeitar anexos diretamente no chat usando os mesmos endpoints da revisao de arquivos.
- A admin pode excluir anexo pelo chat com o mesmo endpoint `DELETE /admin/files/:id`; a mensagem fica no historico e o anexo aparece como removido.
- Cliente continua impedido de baixar arquivos `PENDING_REVIEW`, `REJECTED` ou de outro cliente.
- O mesmo arquivo pode aparecer em Arquivos/Revisao, Solicitacoes/Suporte e Inbox sem duplicar o registro de `FileAsset`.

### Dependencias

Resultado de `npm audit`:

| App | Criticas | Altas | Moderadas | Baixas | Observacao |
| --- | ---: | ---: | ---: | ---: | --- |
| backend | 0 | 0 | 0 | 0 | `npm audit` atual sem vulnerabilidades. |
| frontend | 0 | 0 | 0 | 0 | `npm audit` atual sem vulnerabilidades. |
| admin | 0 | 0 | 0 | 0 | Sem vulnerabilidades reportadas. |

Recomendacao: manter `npm audit` nos checks de staging/producao e nao aplicar `npm audit fix --force` sem validar impacto de build e runtime.

### Estrategia de deploy recomendada

Backend em VPS Hostinger ou VPS equivalente:

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:bootstrap-admin
npm run production:check-clean
npm run build
npm run start
```

Recomendacoes para VPS:

- usar Node `v22.12.0` ou superior compativel com o lockfile atual;
- rodar o processo com PM2 ou systemd;
- manter PostgreSQL e Redis persistentes, preferencialmente gerenciados ou em containers com volume;
- usar Nginx como reverse proxy;
- ativar HTTPS antes de `COOKIE_SECURE=true`;
- configurar health check em `/api/health`;
- separar `.env` por ambiente e nunca copiar `.env` local para producao sem revisao.

Frontend publico em Vercel ou hosting Next.js equivalente:

- build command: `npm run build`;
- `NEXT_PUBLIC_API_BASE_URL` apontando para a API de staging/producao;
- `NEXT_PUBLIC_SITE_URL` apontando para o dominio publico;
- `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=false`.

Admin em Vercel ou hosting Next.js equivalente:

- build command: `npm run build`;
- `NEXT_PUBLIC_API_BASE_URL` apontando para a API de staging/producao;
- `NEXT_PUBLIC_ADMIN_URL` apontando para o dominio admin;
- `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=false`.

## Checklist obrigatorio

### Banco

- `npx prisma migrate status` deve retornar banco atualizado.
- Rodar `npm run prisma:bootstrap-admin` para criar o admin principal.
- Rodar `npm run production:check-clean` antes de liberar o ambiente.
- Nunca rodar `npm run prisma:seed` ou `npm run prisma:seed:dev` em producao.
- `npm run prisma:seed:dev` e permitido somente em local/staging demo com `ALLOW_DEMO_SEED=true`.
- Verificar backups antes de staging/producao.
- Confirmar que `DATABASE_URL` nao aponta para banco local em deploy.

### Auth e cookies

- `COOKIE_SECRET`, `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` devem ser fortes e exclusivos por ambiente.
- `JWT_ACCESS_EXPIRES_IN` recomendado: `15m`.
- `JWT_REFRESH_EXPIRES_IN` recomendado: `7d` ou politica definida antes do deploy.
- `COOKIE_DOMAIN` deve bater com o dominio real.
- Em dev local, `COOKIE_DOMAIN` deve ficar vazio.
- Em HTTPS, usar `COOKIE_SECURE=true`.
- Se frontend/admin estiverem em dominios diferentes, revisar `COOKIE_SAME_SITE=none` com HTTPS.
- Confirmar que frontend e admin usam `credentials: "include"`.
- Confirmar que `401` dispara refresh e retry unico; confirmar que `403` mostra erro de permissao sem logout.
- Confirmar que logout limpa cookies admin, cliente e legado.
- Nao armazenar JWT em `localStorage`.

### CORS

- `CLIENT_APP_URL`, `ADMIN_APP_URL` e `CORS_ORIGINS` precisam conter somente dominios permitidos.
- Nao liberar wildcard com credenciais.
- Testar login cliente e admin pelo browser real, nao apenas por API.

### Uploads e storage

- Configurar Cloudinary ou storage definitivo antes de staging.
- Sem Cloudinary configurado, upload real retorna erro controlado; signed-url usa fallback somente para assets de seed com URL persistida.
- Validar limite de tamanho, extensoes, MIME real e rejeicao de arquivos perigosos no fluxo cliente/publico.
- Validar upload admin amplo para entregas do portal e imagens de blog (`.jpg`, `.jpeg`, `.jfif`, `.png`, `.webp`, `.avif`, `.gif`).
- Validar roles de upload admin por contexto.
- Validar `riskLevel`/`downloadMode` em arquivos de entrega e imagens de blog.
- Confirmar que arquivo `PENDING_REVIEW` nao gera download para cliente.
- Confirmar que arquivo `REJECTED` e `DELETED` nao gera download.
- Confirmar que downloads de arquivos enviados pela admin sao entregues como anexo.

### E-mail

- Configurar SMTP/Gmail/Resend real.
- Testar envio de contato, suporte, convite e notificacoes.
- Definir remetente oficial e politica de resposta.

### Redis e filas

- Redis deve estar disponivel antes do backend.
- Monitorar filas de upload/e-mail.
- Definir estrategia de retry e dead-letter antes de producao.

### Permissoes

- Validado: ADMIN acessa endpoints administrativos e cliente so acessa seus arquivos.
- Validado: cliente nao baixa arquivo pendente.
- Pendente: testes negativos completos para `PROJECT_MANAGER`, `SUPPORT`, `EDITOR`, `FINANCE` e demais papeis.
- Pendente: matriz final de permissoes por tela admin.

### Frontend

- Login/cadastro visual integrado ao backend.
- Portal conectado em visao geral, projeto, equipe, arquivos, solicitacoes, suporte, etapas, aprovacoes, previews, cronograma, financeiro, historico, notificacoes laterais e contador real no topbar.
- Fallback mockado de telas conectadas depende de `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true` e nao roda em producao.
- Blog publico `/blog` e `/blog/[slug]` consome API real com fallback apenas em desenvolvimento.
- Blog publico registra comentarios reais por cliente autenticado, compartilha artigo em endpoint real e permite salvar artigos no Portal do Cliente.
- Blog publico consome `coverImageUrl` e `heroImageUrl` gerados a partir de `FileAsset`/Cloudinary.
- `/cliente/artigos-salvos` consome `/client/blog/saved` e permite remover artigos salvos.

### Admin

- Clientes, inbox, revisao de arquivos, blog, newsletter e PortalManagementView conectados.
- PortalManagementView cria projetos completos com cliente, responsavel, equipe, escopo, etapa inicial, briefing opcional, cronograma opcional, financeiro opcional, historico e notificacao.
- PortalManagementView edita projeto com responsavel, equipe, status, prioridade, prazo, progresso, etapa atual, resumo, escopo, descricao e visibilidade, refletindo no Portal.
- `GET /admin/users` fornece a lista de usuarios administrativos ativos para responsavel/equipe do projeto.
- Fallback mockado de telas conectadas depende de `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true` e nao roda em producao.
- Pendente migrar dashboard geral, suporte legado e modulos internos de RH/operacao.

### Blog e newsletter

- API de blog e newsletter existe.
- Newsletter publica validada por API.
- Blog publico, blog admin e newsletter admin ligados ao backend.
- Comentarios de blog sao reais, podem ser apagados logicamente pela admin e nao usam dados fake em producao.
- Tags editoriais usam `BlogCategory` como tag principal unica do artigo.
- Autor publico do artigo e sempre `Equipe Ateliux`.
- Imagem mockada/geometrica do fallback local nao deve aparecer quando `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=false`.

### Observabilidade

- Manter logs de request sem expor token/cookie.
- Registrar `AuditLog` para acoes sensiveis.
- `GET /api/health` retorna status de app, database, Redis, ambiente e uptime sem secrets.
- Configurar monitoramento de erro e uptime.
- Definir politica de retencao de logs.

## Comandos de validacao

Backend:

```bash
cd backend
npm run prisma:generate
npx prisma migrate status
npm run typecheck
npm run lint
npm run build
npm run test
```

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

Admin:

```bash
cd admin
npm run typecheck
npm run lint
npm run build
```

## Bloqueios para producao

- Manter `npm audit` sem vulnerabilidades ou aceitar formalmente qualquer novo achado antes do deploy.
- Manter `NEXT_PUBLIC_ENABLE_DEV_FALLBACK` ausente/desativado em producao.
- Validar `npm run production:check-clean` sem achados demo.
- Confirmar que `ALLOW_DEMO_SEED=false` em producao.
- Completar migracao do dashboard geral, suporte legado e modulos internos que ainda nao fazem parte do fluxo principal de portal.
- Criar testes de permissao por papel.
- Validar CORS/cookies nos dominios reais.
- Configurar monitoramento/alertas e rotina de backup.

## Itens aceitos temporariamente em desenvolvimento

- Fallback local para assets de seed quando Cloudinary nao esta configurado.
- Dados mockados para telas ainda nao migradas.
- `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=true` somente em ambiente local.
- Testes browser Playwright existem para o fluxo principal Admin -> Backend -> Portal; telas/migracoes fora desse fluxo ainda podem precisar de cobertura propria.
