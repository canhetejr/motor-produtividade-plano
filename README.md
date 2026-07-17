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
| `/login` | todos | E-mail/senha (sem cadastro público — contas nascem em `/colaboradores`) |
| `/apontamento` | colaborador | Tela crítica mobile-first: registrar produção em <1 min |
| `/apontamento/historico` | colaborador | Últimos 50 lançamentos; exclusão só do dia atual |
| `/dashboard` | gestor | Índice por colaborador (farol), stat cards, filtros período/área |
| `/dashboard/[id]` | gestor | Série histórica de 30 dias do colaborador |
| `/catalogo` | gestor | CRUD de áreas e demandas (tempo padrão, blocos, variável) |
| `/colaboradores` | gestor | CRUD de equipe + criação de contas (via service role) |
| `/relatorios` | gestor | Export CSV (UTF-8 com BOM, abre certo no Excel) |
| `/api/cron/*` | Vercel Cron | `lembrete-diario`, `alerta-queda`, `relatorio-semanal` |

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

- **Ambiente novo**: rode `0001_baseline.sql` → `0002_fix_rls_views_grants.sql` → `seed.sql`
  no SQL Editor do Supabase, nessa ordem.
- **Banco existente (produção atual)**: rode **apenas** `0002_fix_rls_views_grants.sql` no
  SQL Editor, uma vez. Ela corrige a recursão infinita de RLS (`auth_role()` vira
  `SECURITY DEFINER`), fecha o vazamento das views para a anon key (`security_invoker`),
  passa o índice a dividir por `blocos_totais` e revoga o acesso do papel `anon`.

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
