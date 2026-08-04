# Motor de Produtividade

App interno que substitui a planilha de produtividade da equipe: colaboradores registram
apontamentos diários de demandas, o sistema calcula o índice (`tempo entregue / carga horária`)
e gestores acompanham tudo em dashboard, com e-mails automáticos de lembrete, alerta e
relatório semanal.

## Stack

- **Next.js 16** (App Router, Turbopack, `proxy.ts`) + React 19 + TypeScript strict
- **Supabase** (Postgres + Auth + RLS) via `@supabase/ssr`
- **Tailwind v4** + shadcn/ui (style `base-nova` sobre `@base-ui/react`)
- **Resend** (e-mails dos crons) + **Vercel Cron** (agendamento)
- Recharts (gráficos), Zod (validação), sonner (toasts), date-fns

## Rotas

| Rota | Quem | O quê |
|---|---|---|
| `/login` | todos | E-mail/senha; contas são criadas pela gestão |
| `/apontamento` | autenticado | Apontamento individual ou em lote (`?modo=lote`) |
| `/apontamento/historico` | autenticado | Últimos lançamentos; exclusão só do dia atual |
| `/minhas-demandas` | colaborador | Consulta o catálogo da própria área e acompanha sugestões |
| `/minha-semana` | autenticado | Agenda semanal e tarefas atribuídas |
| `/kanban` | autenticado | Quadros e tarefas operacionais |
| `/gestao` | gestor | Área do Gestor: visão consolidada da equipe |
| `/gestao/equipe/[id]` | gestor | Histórico e métricas de uma pessoa |
| `/gestao/catalogo` | gestor | Áreas, demandas, equipe e solicitações |
| `/gestao/relatorios` | gestor | Exportações CSV, XLSX e PDF |
| `/gestao/auditoria` | gestor | Trilha de alterações administrativas |
| `/gestao/sistema` | admin | Diagnóstico, quadros globais, automações e infraestrutura |
| `/api/cron/*` | Vercel Cron | Rotinas automáticas |

`/gestao` filtra por área **atual do colaborador** (visão "meu time hoje"); o CSV de
`/gestao/relatorios` atribui cada apontamento pela área **da demanda no momento do lançamento**.
Se alguém muda de área, os dois números para o mesmo período podem divergir — a visão geral
reclassifica o histórico da pessoa pra área nova, o CSV mantém a área original de cada
lançamento.

## Setup local

```bash
npm install
cp .env.example .env.local   # preencha (tabela abaixo)
npm run dev
```

### Variáveis de ambiente

| Variável | Onde obter | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**nunca** expor no client) | p/ criar contas e crons |
| `CRON_SECRET` | string aleatória (`openssl rand -hex 32`); na Vercel ela vira o header dos crons | p/ crons |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys (domínio verificado) | p/ e-mails (sem ela os crons rodam em no-op) |
| `RESEND_FROM_EMAIL` | remetente no domínio verificado do Resend | p/ e-mails |
| `NEXT_PUBLIC_APP_URL` | URL pública do app (links dos e-mails) | p/ e-mails |

## Banco de dados (Supabase)

O estado canônico do schema vive em `supabase/migrations/` (o `schema.sql` é referência
consolidada do estado final):

- **Ambiente novo**: rode, nessa ordem, no SQL Editor do Supabase:
  1. `0001_baseline.sql`
  2. `0002_fix_rls_views_grants.sql`
  3. `20260720225916_solicitacoes_demandas.sql` (fluxo de aprovação de demandas)
  4. `20260721000000_notificacoes.sql` (central de notificações)
  5. `20260721013000_apontamentos_rls_data_atual.sql` (RLS: só edita/exclui apontamento de hoje)
  6. `20260721014500_areas_ativo.sql` (campo `ativo` em `areas`)
  7. `20260721030000_apontamentos_motivo.sql` (campo `motivo` para lançamentos de "Outros")
  8. `20260721031500_solicitacoes_cancelar_pendente.sql` (colaborador cancela sugestão pendente)
  9. `20260721033000_notificacoes_realtime.sql` (habilita Realtime na tabela `notificacoes`)
  10. `20260721040000_apontamentos_calculado_motivo.sql` (recria a view `apontamentos_calculado`
      pra expor `motivo` — adicionar coluna em `apontamentos` não propaga sozinho pra uma
      view criada com `select a.*`)
  11. `seed.sql`
- **Banco existente (produção atual)**: rode as migrations que ainda não foram aplicadas,
  na ordem acima, cada uma uma única vez. Todas são idempotentes (`create table/policy if
  not exists`, etc.), então rodar de novo uma já aplicada não quebra nada. As mais
  importantes: `0002_fix_rls_views_grants.sql` corrige a recursão infinita de RLS
  (`auth_role()` vira `SECURITY DEFINER`), fecha o vazamento das views para a anon key
  (`security_invoker`) e revoga o acesso do papel `anon`; `20260721013000` fecha uma
  brecha onde um colaborador conseguia editar/excluir apontamento de dias passados
  chamando a API do Supabase direto do browser, driblando a regra "só hoje" da tela.

Verificação pós-migration (no próprio SQL Editor):

```sql
select * from indicadores_diarios limit 5;  -- funciona, sem "stack depth limit exceeded"
select auth_role();                          -- null (sem sessão), sem erro
```

E de fora, o vazamento fechado (deve retornar permission denied):

```bash
curl "https://<projeto>.supabase.co/rest/v1/indicadores_diarios" -H "apikey: <anon key>"
```

## Crons (Vercel)

`vercel.json` agenda 3 rotas (horários em UTC; Maringá = UTC-3):

| Rota | Agenda | O quê |
|---|---|---|
| `/api/cron/lembrete-diario` | `0 21 * * 1-5` (18h) | E-mail p/ quem não apontou hoje |
| `/api/cron/alerta-queda` | `0 11 * * 1-5` (8h) | Índice <70% por 2 dias úteis → e-mail aos gestores |
| `/api/cron/relatorio-semanal` | `0 11 * * 1` (seg 8h) | Resumo da semana anterior → gestores |

Com a env `CRON_SECRET` configurada no projeto Vercel, os requests dos crons chegam com
`Authorization: Bearer <CRON_SECRET>` automaticamente. Teste manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/lembrete-diario
```

Sem `RESEND_API_KEY`, os crons respondem normalmente mas marcam os envios como
`skipped` (no-op) — útil em dev/preview.

## Deploy (checklist)

1. Aplicar `supabase/migrations/0002` no banco (ver acima).
2. Projeto na Vercel com todas as envs da tabela (incluindo `CRON_SECRET` e service role).
3. Domínio verificado no Resend para o `RESEND_FROM_EMAIL`.
4. Apontar `mp.unicive.cloud` (CNAME) e validar SSL.
5. Testar os 3 crons via curl com o header e conferir recebimento dos e-mails.

## Estrutura

```
app/(app)/           rotas autenticadas (apontamento, dashboard, catalogo, ...)
app/api/cron/        3 route handlers dos crons (validados por CRON_SECRET)
app/api/export/      export CSV
lib/                 dates (TZ America/Sao_Paulo), auth (requireGestor), email, cron, tipos
utils/supabase/      clients (browser, server, admin/service-role, proxy)
supabase/migrations/ migrations SQL versionadas (estado canônico do banco)
docs/                PLANO.md (spec) e TASKS.md (checklist)
proxy.ts             sessão + proteção de rota (Next 16; substitui middleware.ts)
```

Documentação de produto: `docs/PLANO.md` (spec técnica) e `docs/TASKS.md` (fases).
