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
- [ ] Deploy na Vercel, plano compatível com uso institucional (ver PLANO.md); configurar
      todas as envs (incluindo `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Apontar `mp.unicive.cloud` (CNAME) e validar SSL
- [ ] Revisão final de RLS com dados reais antes de liberar pro time
- [ ] Confirmar que as 3 demandas pendentes (Estágio, Intercorrência, ICode) foram definidas
      ou seguem sinalizadas como pendente — não travar o lançamento por causa disso

---

## Seed do catálogo (Fase 1)

Usar exatamente os dados já validados na planilha — não inventar tempos novos. Ver
`supabase/seed.sql`. As únicas demandas sem `tempo_padrao_min` são Estágio, Intercorrência e
ICode (Área Moodle) — isso é esperado, não corrigir "adivinhando" um valor.
