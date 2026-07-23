# TASKS — Motor de Produtividade

Checklist sequencial. Cada fase depende da anterior estar funcional. Marcar `[x]` ao concluir.
Detalhes de cada decisão estão em `PLANO.md`.

## Fase 1 — Fundação

- [x] `create-next-app` (TypeScript, App Router, Tailwind) na raiz do repo
- [x] Instalar e configurar shadcn/ui
- [x] Criar projeto Supabase (ou conectar a um existente) e rodar `supabase/schema.sql`
- [x] Rodar `supabase/seed.sql` (catálogo já mapeado, ver seção abaixo)
- [x] Configurar RLS conforme `PLANO.md` seção 2 — corrigida em
      `supabase/migrations/0002` (auth_role SECURITY DEFINER, views com security_invoker,
      grants de anon revogados)
- [x] Auth Supabase — decisão fechada: e-mail/senha, sem cadastro público (contas criadas
      pelo gestor em `/colaboradores` via service role)
- [x] Proteção de rotas por `role` — `proxy.ts` (sessão) + `requireGestor()` em
      páginas/actions de gestor (lib/auth.ts)
- [x] `.env.local` a partir do `.env.example`, testar conexão local

## Fase 2 — Apontamento (tela crítica)

- [x] `/apontamento` — formulário: demanda (select), quantidade (default 1), tempo manual
      (só aparece se demanda for `variavel`), observações
- [x] Otimizar pra mobile — testar em viewport de celular antes de dar por concluída
- [x] `/apontamento/historico` — listagem dos últimos apontamentos do próprio colaborador,
      com exclusão do dia atual (edição ficou fora do escopo do MVP)
- [ ] Validar que RLS bloqueia colaborador de editar apontamento de outra pessoa
      (fazer após aplicar a migration 0002, com duas contas reais)

## Fase 3 — Dashboard

- [x] `/dashboard` — tabela colaborador x índice de produtividade (usa a view
      `indicadores_diarios`), com farol verde/amarelo/vermelho
- [x] Filtro por período (dia / semana / mês) e por área
- [x] `/dashboard/[colaborador]` — série histórica em gráfico (Recharts)
- [x] Confirmar que só `role = gestor` acessa essas rotas

## Fase 4 — Admin do catálogo

- [x] `/catalogo` — CRUD de áreas e demandas (cadastrar nova demanda, editar tempo padrão,
      marcar `variavel`)
- [x] `/colaboradores` — CRUD de colaboradores, carga horária, área, ativo/inativo
- [x] `/relatorios` — export do período selecionado em CSV

## Fase 5 — Automação (Vercel Cron)

- [x] Configurar `vercel.json` com os 3 crons (lembrete, alerta, relatório — horários em
      `PLANO.md` seção 4)
- [x] `app/api/cron/lembrete-diario` — checa `CRON_SECRET`, consulta quem não apontou hoje,
      envia e-mail via Resend (no-op logado se `RESEND_API_KEY` ausente)
- [x] `app/api/cron/alerta-queda` — índice < 70% nos 2 últimos dias úteis → e-mail aos gestores
- [x] `app/api/cron/relatorio-semanal` — resumo da semana anterior por área/colaborador
- [ ] Testar cada rota manualmente (com o header correto) antes de confiar no cron —
      requer `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`

## Fase 6 — Deploy

- [x] **Aplicar `supabase/migrations/0002_fix_rls_views_grants.sql` no SQL Editor** (corrige
      recursão de RLS que hoje quebra `colaboradores`/`apontamentos` e fecha o vazamento
      das views para a anon key) — ver roteiro no README
- [x] Aplicar as 6 migrations de 21/07/2026 no banco real (`apontamentos_rls_data_atual`,
      `areas_ativo`, `apontamentos_motivo`, `solicitacoes_cancelar_pendente`,
      `notificacoes_realtime`, `apontamentos_calculado_motivo`) — rodadas via
      `supabase/APLICAR_PENDENTES.sql` no SQL Editor
- [x] Confirmar se `20260720225916_solicitacoes_demandas` e `20260721000000_notificacoes`
      já foram aplicadas no banco real — confirmado via `information_schema.tables`, ambas
      existem; aba Solicitações de `/catalogo` está ativa de ponta a ponta
- [ ] Deploy na Vercel, plano compatível com uso institucional (ver PLANO.md); configurar
      todas as envs (incluindo `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Apontar `mp.unicive.cloud` (CNAME) e validar SSL
- [ ] Revisão final de RLS com dados reais antes de liberar pro time
- [ ] Confirmar que as 3 demandas pendentes (Estágio, Intercorrência, ICode) foram definidas
      ou seguem sinalizadas como pendente — não travar o lançamento por causa disso

## Fase 7 — Aprovação de demandas e notificações

- [x] `solicitacoes_demandas` — colaborador sugere demanda nova/alteração; gestor aprova
      (aplica em `demandas`) ou rejeita, na aba "Aprovações"/"Minhas Sugestões" de `/catalogo`
- [x] `notificacoes` — tabela genérica + sino no layout autenticado (polling a cada 60s),
      dispara em nova solicitação (pro gestor) e em aprovação/rejeição (pro colaborador)
- [x] RLS: colaborador só cria/lê as próprias solicitações e notificações; gestor gerencia
      solicitações; notificações só nascem via service role
- [x] Corrigida corrida em `aprovarSolicitacao`/`rejeitarSolicitacao`: a mudança de status
      agora é um `update ... where status = 'PENDENTE'` atômico antes de tocar em `demandas`,
      então dois cliques quase simultâneos não processam a mesma solicitação duas vezes

## Fase 8 — Consolidação de admin e autoatendimento

- [x] `/areas` e `/colaboradores` viraram abas dentro de `/catalogo` (junto com Demandas e
      Solicitações), com drill-down entre abas e filtro de área; rotas antigas mantidas só
      como `redirect()` pra não quebrar links salvos
- [x] `/perfil` — colaborador vê os próprios dados (e-mail, área, carga horária, perfil) e
      pode editar o próprio nome e trocar a própria senha (`auth.updateUser`, sem service
      role), fechando o item "Autoatendimento de conta" do backlog
- [x] `/perfil` ganhou foto (upload pro bucket `avatars` do Supabase Storage, via
      `SUPABASE_SERVICE_ROLE_KEY`), gestor pode editar a própria área/carga horária
      (RLS já libera pra quem é gestor), seletor de tema (claro/escuro/sistema) e
      preferências de notificação por tipo (lembrete diário, solicitações, alerta de
      queda, relatório semanal) — respeitadas pelos 3 crons e por `lib/notifications.ts`.
      Migration `20260721060000_perfil_avatar_notif_prefs.sql` aplicada no banco real

## Fase 9 — Plano de melhorias de 22/07/2026 (16 itens do relatório de conferência)

Ver `docs/RELATORIO-CONFERENCIA.md` (achados) e `supabase/APLICAR_PENDENTES.sql`
(migrations 11-18, todas já aplicadas no banco real).

- [x] RLS de INSERT em `apontamentos` exige `data = current_date` (fechava o mesmo
      vetor que UPDATE/DELETE já tinham corrigido)
- [x] `auth_role()` exige `ativo = true`; `requireUser()` derruba sessão de conta
      desativada na hora (`lib/auth.ts`)
- [x] Export CSV/XLSX neutraliza formula injection (`sanitizeFormula`, `lib/csv.ts`)
- [x] RPC `registrar_apontamento`/`atualizar_apontamento` (SECURITY DEFINER) — motivo,
      teto de blocos, teto de tempo manual e demanda ativa validados no banco, não só
      na Server Action; INSERT/UPDATE diretos revogados de `authenticated`
- [x] RPC `aprovar_solicitacao`/`rejeitar_solicitacao` — claim + validação +
      insert/update em `demandas` + notificação numa única transação
- [x] Idempotência dos 3 crons (`cron_execucoes`, `tentarReservarExecucao`)
- [x] `npm audit`: 9 → 5 vulnerabilidades em produção (fast-uri corrigido, `shadcn`
      movido pra devDependencies); risco residual documentado em `docs/SEGURANCA.md`
- [x] Confirmação (AlertDialog) antes de rejeitar solicitação em `/catalogo`
- [x] Progresso cumulativo no formulário de apontamento ("já lançado + este lançamento")
- [x] Editar apontamento no mesmo dia (`/apontamento/historico`, RPC `atualizar_apontamento`)
- [x] Trilha de auditoria (`auditoria`, `/auditoria`, só gestor) — mudança de
      colaborador e aprovação/rejeição de solicitação
- [x] Import em massa CSV/XLSX de demandas e colaboradores em `/catalogo`
      (`ImportDialog`, `lib/import-planilha.ts`)
- [x] Bloco finito (Fase 2 da confiabilidade) — `demandas.finita`, orçamento
      **global** (soma de todos os colaboradores), view `demandas_acumulado`
- [x] Testes automatizados (`vitest`, `npm run test`) cobrindo `lib/dates.ts`,
      `lib/demandas.ts::prepararDemanda`, `lib/csv.ts` — RLS/autorização real fica
      de fora (precisa de Supabase local, não configurado no projeto)
- [x] PWA — `app/manifest.ts`, `public/sw.js` (cache-first só pra `_next/static`),
      `viewport.themeColor`. Achado durante a validação: `proxy.ts` redirecionava
      `/manifest.webmanifest` e `/sw.js` pro `/login` — corrigido no matcher
- [x] Dashboard `top-demandas`/`top-performers` — já estavam corretos, confirmado que
      respeitam os mesmos filtros de período/área do resto do dashboard (nenhuma
      mudança necessária)

---

## Seed do catálogo (Fase 1)

Usar exatamente os dados já validados na planilha — não inventar tempos novos. Ver
`supabase/seed.sql`. As únicas demandas sem `tempo_padrao_min` são Estágio, Intercorrência e
ICode (Área Moodle) — isso é esperado, não corrigir "adivinhando" um valor.
