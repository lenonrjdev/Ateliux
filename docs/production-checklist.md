# Ateliux Production Checklist

Checklist para liberar o ecossistema Ateliux em producao.

## Dominio e HTTPS

- [ ] Dominios definidos
- [ ] HTTPS ativo
- [ ] Backend atras de proxy/reverse proxy seguro
- [ ] Health check publico ou interno configurado
- [ ] Monitoramento basico ativo

## Env e cookies

- [ ] `NODE_ENV=production`
- [ ] `COOKIE_SECURE=true`
- [ ] `COOKIE_DOMAIN` correto
- [ ] `COOKIE_SAME_SITE` correto
- [ ] `COOKIE_DOMAIN` nao aponta para `localhost`
- [ ] `JWT_ACCESS_EXPIRES_IN` definido conscientemente
- [ ] `JWT_REFRESH_EXPIRES_IN` definido conscientemente
- [ ] CORS restrito
- [ ] `NEXT_PUBLIC_ENABLE_DEV_FALLBACK=false`
- [ ] Secrets fortes
- [ ] Nenhum valor real de `.env` em repositorio/log/documentacao

## Dados e servicos

- [ ] `DATABASE_URL` producao
- [ ] Homologacao Docker local revisada antes do deploy externo
- [ ] Relatorio `docs/reports/docker-local-homolog-latest.md` revisado
- [ ] Relatorio `docs/reports/docker-backend-full-container-latest.md` revisado
- [ ] Relatorio `docs/reports/ngrok-vercel-homolog-latest.md` revisado quando usar Vercel via ngrok
- [ ] Banco de pre-producao criado limpo
- [ ] Backup do banco
- [ ] Redis producao
- [ ] Cloudinary producao
- [ ] `cloudinaryResourceType` preenchido para arquivos Cloudinary existentes
- [ ] SMTP producao
- [ ] Migrations com `npx prisma migrate deploy`
- [ ] Nao rodar `npm run prisma:seed` em producao
- [ ] Seed demo bloqueado em producao
- [ ] `ALLOW_DEMO_SEED=false` em producao
- [ ] Bootstrap admin executado
- [ ] Admin principal criado
- [ ] Admin principal acessa a dashboard
- [ ] Banco nao contem clientes demo
- [ ] Banco nao contem projetos demo
- [ ] Banco nao contem arquivos demo
- [ ] Banco nao contem URLs `res.cloudinary.com/demo`
- [ ] Banco nao contem usuarios com senha padrao demo
- [ ] `npm run production:check-clean` ok
- [ ] `npm run db:check-clean` ok
- [ ] Limpeza demo, se usada, foi executada em dry-run antes
- [ ] Limpeza demo, se usada, teve confirmacao explicita
- [ ] Relatorio `docs/reports/demo-cleanup-latest.md` revisado

## Seguranca operacional

- [ ] Logs
- [ ] Monitoramento basico
- [ ] Rate limit
- [ ] Upload inbound restritivo para cliente/publico validado
- [ ] Upload admin amplo validado via `/api/admin/uploads`
- [ ] Limites admin configurados: `UPLOAD_MAX_GLOBAL_SIZE_MB`, `ADMIN_UPLOAD_MAX_SIZE_MB`, `BLOG_IMAGE_UPLOAD_MAX_SIZE_MB`
- [ ] `riskLevel` e `downloadMode` persistidos em arquivos novos
- [ ] Roles admin por contexto de upload validadas
- [ ] Cliente/publico nao conseguem usar contexto admin
- [ ] Cookies admin e cliente separados por escopo
- [ ] Refresh cliente funciona apos expirar access token
- [ ] Refresh admin funciona apos expirar access token
- [ ] Reuso de refresh token antigo retorna `401`
- [ ] Novos refresh tokens persistidos como SHA-256, nao bcrypt
- [ ] `403` nao derruba sessao nem redireciona para login
- [ ] Logout remove cookies admin, cliente e legado
- [ ] Signed URL de cliente entrega arquivo como anexo
- [ ] Admin consegue baixar arquivo `PENDING_REVIEW` pela inbox para analise
- [ ] Cliente nao consegue baixar arquivo `PENDING_REVIEW`, `REJECTED` ou de outro cliente
- [ ] Cliente nao consegue baixar arquivo `DELETED`
- [ ] Admin delete fisico remove asset do Cloudinary antes de marcar `FileAsset` como `DELETED`
- [ ] Falha de delete no Cloudinary nao marca arquivo como `DELETED`
- [ ] `not found` do Cloudinary no delete e tratado como sucesso idempotente
- [ ] Delete bloqueado quando arquivo ainda esta vinculado a blog/financeiro
- [ ] Permissoes por role revisadas
- [ ] `POST /admin/projects/full-setup` validado com `ADMIN` e `PROJECT_MANAGER`
- [ ] Acao `Criar projeto para este cliente` leva para `/portal-do-cliente/projetos?clientId=<clientId>&create=1`
- [ ] Nao existe modal/acao de vinculo de projeto que salve somente na UI
- [ ] Full setup bloqueia troca acidental do cliente quando `clientId` vem pela query
- [ ] Criacao bem-sucedida redireciona para `/portal-do-cliente/projetos/[projectId]`
- [ ] F5 na admin mantem projeto criado e cliente correto
- [ ] Projeto `visibleToClient=true` aparece no Portal do Cliente
- [ ] Projeto `visibleToClient=false` nao aparece no Portal do Cliente
- [ ] Erro sem responsavel/prazo/dados minimos nao mostra sucesso falso
- [ ] `npm run e2e` passa com Playwright contra ambiente validado
- [ ] E2E nao aponta para producao sem autorizacao explicita
- [ ] `POST /admin/projects` legado retorna erro controlado e nao cria projeto
- [ ] `GET /admin/projects/:id/overview` validado com `ADMIN`, `PROJECT_MANAGER`, `DESIGNER_DEV`, `SUPPORT` e `FINANCE`
- [ ] `GET /admin/projects/:id/overview` retorna `403` para `EDITOR` e `ATTENDANCE`
- [ ] Overview de projeto oculta financeiro para roles sem permissao
- [ ] Botao `Abrir projeto` navega para `/portal-do-cliente/projetos/[projectId]`
- [ ] Projeto novo nao nasce sem responsavel principal
- [ ] Portal do Cliente mostra responsavel, equipe, prazo, escopo, etapa inicial e status vindos da API real
- [ ] Criacao completa de projeto registra `AuditLog`
- [ ] Criacao de projeto visivel gera notificacao para o cliente
- [ ] Edicao de responsavel/progresso/prazo/etapa reflete no Portal e registra historico
- [ ] Status comercial de cliente salvo em `Client.pipelineStatus`, separado de `Client.status`
- [ ] `pipelineStatus` nao aparece nas respostas autenticadas do cliente
- [ ] Ocultar projeto remove o item dos endpoints do cliente
- [ ] `npm audit` sem risco inaceitavel
- [ ] Teste de rollback
- [ ] Politica de Privacidade revisada juridicamente
- [ ] Politica de Cookies revisada juridicamente
- [ ] Termos de Uso revisados juridicamente
- [ ] Termos do Portal revisados juridicamente
- [ ] Canal LGPD e responsavel interno definidos
- [ ] Inventario de dados atualizado
- [ ] Inventario de cookies atualizado
- [ ] Banner de cookies testado em dominio real
- [ ] Scripts nao essenciais bloqueados antes de consentimento
- [ ] Retencao e descarte definidos

## Validacao final

- [ ] Backend build ok
- [ ] Frontend build ok
- [ ] Admin build ok
- [ ] `npm run validate:backend` ok
- [ ] `npm run validate:admin` ok
- [ ] `npm run validate:frontend` ok
- [ ] `npm run validate:e2e` ok
- [ ] `npm run validate:all` ok
- [ ] `npm run validate:pre-production` ok
- [ ] Relatorio `docs/reports/pre-production-validation-latest.md` revisado
- [ ] Relatorio `docs/reports/preproduction-database-validation-latest.md` revisado
- [ ] Env examples de pre-producao revisados sem secrets reais
- [ ] Auth cliente ok
- [ ] Auth admin ok
- [ ] Upload/revisao/download ok
- [ ] Upload cliente fica `PENDING_REVIEW`
- [ ] Upload admin fica `APPROVED` quando contexto permitir
- [ ] Inbox/suporte ok
- [ ] Anexo enviado em solicitacao aparece na mensagem correta da inbox admin
- [ ] Anexo enviado em suporte aparece na mensagem correta da inbox admin
- [ ] Aprovar/rejeitar anexo pelo chat atualiza tambem a revisao de arquivos
- [ ] `ClientRequestAttachment` e `SupportTicketAttachment` referenciam o mesmo `FileAsset`, sem duplicar arquivo
- [ ] Blog/newsletter ok
- [ ] Blog sem fallback mockado em falha de API
- [ ] Upload de capa/hero do blog validado com storage real
- [ ] Troca/remocao de capa/hero desvincula imagem antiga e apaga do Cloudinary somente se virou orfa
- [ ] Arquivo `HIGH_RISK_DOWNLOAD_ONLY` baixa como anexo e nao renderiza inline
- [ ] Portal mostra badge de visualizacao/download/download protegido
- [ ] `/blog` usa `coverImageUrl` real ou placeholder neutro
- [ ] `/blog/[slug]` usa `heroImageUrl` real, fallback para `coverImageUrl` ou placeholder neutro
- [ ] Arte geometrica/mockada nao aparece como imagem real de artigo
- [ ] Autor publico dos artigos aparece como `Equipe Ateliux`
- [ ] Comentarios reais do blog moderaveis na admin
- [ ] Artigos salvos disponiveis no Portal do Cliente
- [ ] Financeiro/notificacoes ok
- [ ] Empty states validados
- [ ] Central operacional do projeto valida abas de visao geral, cliente, equipe, escopo, etapas, briefing, arquivos, aprovacoes, preview, cronograma, financeiro, historico e configuracoes do Portal
- [ ] Alteracao de progresso/status/etapa/visibilidade na central reflete no Portal do Cliente
- [ ] Primeiro cliente real pode ser criado pela admin
- [ ] Harness Playwright documentado e executado antes do deploy
