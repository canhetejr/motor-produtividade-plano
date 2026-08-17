# Vértice

Produto Tera de produtividade e trabalho operacional. Colaboradores registram apontamentos
diários de demandas, o sistema calcula o índice (`tempo entregue / carga horária`) e gestores
acompanham em dashboard, com e-mails automáticos de lembrete, alerta e relatório semanal. Em
volta desse núcleo há um Kanban completo (automações, dependências, aprovações, anexos,
formulários públicos, compartilhamento por token), relatórios em CSV/XLSX/PDF, auditoria,
notificações in-app/e-mail/Web Push, integração com Google Agenda, PWA com fila offline, MFA
por e-mail e um servidor MCP que expõe parte do produto a agentes de IA.

**É um SaaS multi-inquilino.** Cada cliente é uma organização isolada, com plano por assento,
cadastro público com trial de 14 dias e convite de membros por e-mail. Não há gateway de
pagamento: toda a infraestrutura comercial existe (planos, limite de assentos, estados da
conta), mas a conversão de trial em cliente pagante é **manual**, feita pelo operador da
plataforma em `/console`. Foi decisão consciente — ver `docs/PLANO-PRODUTO.md`.

## Stack

- **Next.js 16** (App Router, Turbopack, `proxy.ts`) + React 19 + TypeScript strict
- **Supabase** (Postgres + Auth + RLS + Storage) via `@supabase/ssr`
- **Tailwind v4** + shadcn v4 (style `base-nova` sobre `@base-ui/react`)
- **SMTP** para e-mail, com **Resend** como caminho alternativo
- **Vercel Cron** (7 rotinas) — ver "Deploy"
- **MCP** via `@modelcontextprotocol/sdk` (Streamable HTTP) — ver [`docs/mcp.md`](docs/mcp.md)
- Recharts (gráficos), Zod (validação), sonner (toasts), date-fns, Tiptap (editor),
  ExcelJS e jsPDF (exportações), dnd-kit (arrastar e soltar), Vitest (testes)

## Rotas

### Públicas (sem sessão)

| Rota | O quê |
|---|---|
| `/` | Landing do produto |
| `/precos` | Planos, renderizados a partir da tabela `planos` |
| `/cadastro` | Cadastro público — cria organização em trial de 14 dias |
| `/login`, `/login/verificar` | E-mail/senha ou Google; `/verificar` é o segundo fator |
| `/convite/[token]` | Aceite de convite para entrar numa organização |
| `/formularios/[slug]` | Formulário público de intake; cria card no Kanban |
| `/q/[token]` | Acompanhamento somente leitura de um quadro |
| `/conta/expirada`, `/conta/suspensa` | Telas de conta fora de operação |
| `/auth/confirmar`, `/auth/redefinir-senha` | Confirmação de e-mail e redefinição de senha |
| `/offline` | Tela servida pelo service worker quando não há rede |

### Autenticadas

O guard de cada rota está no `page.tsx` correspondente (`requireUser`,
`requireGestor`, `requireAdmin` — `lib/auth.ts`).

| Rota | Quem | O quê |
|---|---|---|
| `/minha-semana` | autenticado | **Hub do dia a dia**: lançamento diário, agenda da semana e tarefas atribuídas. Aceita `?modo=lote` |
| `/apontamento/historico` | autenticado | Últimos lançamentos; exclusão só do dia atual |
| `/minhas-demandas` | autenticado | Catálogo da própria área e acompanhamento de sugestões |
| `/kanban`, `/kanban/[quadroId]` | autenticado | Quadros e tarefas operacionais |
| `/kanban/receber` | autenticado | Entrada de itens vindos de formulário |
| `/kanban/arquivados` | gestor | Quadros fora de uso; desarquivar devolve o quadro à lista |
| `/setup` | autenticado | Primeiros passos de quem acabou de entrar |
| `/perfil` | autenticado | Identidade e credenciais: dados, avatar, senha, MFA, tokens MCP |
| `/configuracoes` | autenticado | Preferências de uso, notificações e Google Agenda |
| `/documentacao` | autenticado | Documentação de produto e changelog |
| `/gestao` | gestor | Visão consolidada da equipe |
| `/gestao/equipe/[colaborador]` | gestor | Histórico e métricas de uma pessoa |
| `/gestao/catalogo` | gestor | Áreas, demandas e solicitações |
| `/gestao/acessos` | gestor | Pessoas, assentos e convites |
| `/gestao/relatorios` | gestor | Exportações CSV, XLSX e PDF |
| `/gestao/arquivo` | gestor | Apontamentos excluídos definitivamente, com nomes congelados |
| `/gestao/auditoria` | gestor | Trilha de alterações administrativas |
| `/gestao/sistema` | admin | Diagnóstico, quadros globais, automações e infraestrutura |
| `/console` | operador | Console da plataforma: organizações, assentos, ciclo de vida |

A divisão entre `/perfil` e `/configuracoes` é deliberada: identidade e credenciais de um lado
(quem você é e como prova), preferência e integração do outro (como o sistema se comporta para
você).

`/console` é do **operador da plataforma** (tabela `operadores`), não do gestor de um cliente.
São papéis diferentes: o gestor administra a própria empresa, o operador administra o produto.

Rotas antigas seguem vivas como redirect, para não quebrar link salvo — e, no caso de
`/apontamento`, porque o e-mail de lembrete diário já enviado e o `start_url` do PWA já
instalado apontam para lá:

| Rota antiga | Destino |
|---|---|
| `/apontamento`, `/apontamento/lote` | `/minha-semana` (preservando a query, incl. `?modo=lote`) |
| `/dashboard`, `/dashboard/[colaborador]` | `/gestao`, `/gestao/equipe/[colaborador]` |
| `/relatorios` | `/gestao/relatorios` |
| `/auditoria` | `/gestao/auditoria` |
| `/areas`, `/catalogo` | `/gestao/catalogo` (com a aba correspondente) |
| `/colaboradores` | `/gestao/acessos` |
| `/admin` | `/gestao/sistema` |

### API

`/api/cron/*` (7 rotinas, validadas por `CRON_SECRET`) · `/api/export` e
`/api/export/demandas` (CSV) · `/api/google/{connect,callback,disconnect}` e
`/api/google/calendar/sync` · `/api/calendario` (ICS) · `/api/mcp` (Streamable HTTP,
token MCP pessoal — ver [`docs/mcp.md`](docs/mcp.md)) · `/auth/callback` (PKCE).

## Isolamento multi-inquilino

É a propriedade que não pode regredir: um vazamento aqui é **entre clientes**.

- Toda tabela de negócio tem `organizacao_id NOT NULL` e ao menos uma política `restrictive`
  amarrada a `org_atual()`. Restritiva de propósito — política permissiva *amplia* acesso.
- FKs são **compostas** (`(id, organizacao_id)`): impede a org A apontar para linha da org B.
- Funções `SECURITY DEFINER` bypassam RLS por construção e checam organização explicitamente.
  **Toda função nova precisa da mesma checagem.**
- Uma pessoa pertence a **uma** organização (`colaboradores.id` = `auth.users.id`, e o e-mail
  é único globalmente no Supabase Auth).

`npm test` cobre isso: catálogo de eixo (tabela nova sem `organizacao_id` quebra o teste) e um
teste estático que barra uso novo de service role fora de uma allowlist explícita. Rode antes
de dar qualquer coisa por pronta.

Estados de uma organização: `trialing` → `ativa` | `expirada` | `suspensa` | `excluindo`.
O cron `organizacoes-ciclo` apenas **marca** `excluindo` e notifica; o `delete` é ação manual e
explícita no console, por ser irreversível em cascata.

## Fluxo Git e ambientes

O fluxo diário separa validação, homologação e produção:

```text
feat/* ou fix/* → develop → main
```

1. Atualize sua cópia de `develop` e crie uma tarefa isolada:
   ```bash
   git switch develop
   git pull --ff-only canonical develop
   git switch -c feat/nome-da-tarefa
   # ou: git switch -c fix/nome-da-tarefa
   ```
2. Faça commits pequenos, rode `npm run lint`, `npm test` e `npm run build`; abra uma PR da sua `feat/*` ou `fix/*` para `develop`.
3. Após o merge, teste a homologação em https://dev.vertice.teralabs.cloud.
4. Abra uma PR de `develop` para `main`. Só depois de revisão e CI verde ela pode ser mesclada.
5. **Produção faz deploy exclusivamente de `main`** em https://vertice.teralabs.cloud. Staging acompanha exclusivamente `develop`.

Os dois ambientes são aplicações independentes no Coolify, com domínios, variáveis, bancos e volumes separados. Consulte [o guia de deploy](docs/deploy-coolify.md) antes de alterar o painel.

## Setup local

Node **22.x** (fixado em `engines`).

```bash
npm install
# crie .env.local com as variáveis abaixo (o .gitignore ignora .env*)
npm run dev
```

| Script | O quê |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção (`output: 'standalone'`) |
| `npm start` | Sobe o build de produção |
| `npm run lint` | ESLint (`eslint.config.mjs`) |
| `npm test` | Suíte inteira (Vitest). Os testes que exigem banco **pulam** sem credencial |
| `npm run test:isolamento` | Só `__tests__/isolamento/` |
| `npm run icons` | Regera os ícones do PWA (`scripts/gerar-icones.mjs`, via sharp) |
| `npm run tipos:gerar` | Regera `lib/database.types.ts`; exige `SUPABASE_PROJECT_ID` |

### Variáveis de ambiente

A lista canônica vive em `ENVS_ESPERADAS` (`lib/admin-saude.ts`) e é auditada em tempo real
por `/console` → Infraestrutura. Se divergir daqui, **o código vale**.

| Variável | Nível | Impacto se faltar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | obrigatória | O app não conecta no banco |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | obrigatória | Login e leitura pelo browser param |
| `SUPABASE_SERVICE_ROLE_KEY` | obrigatória | Criar conta, redefinir senha, auditoria e crons param |
| `CRON_SECRET` | obrigatória | As rotas de cron negam tudo — nenhum e-mail sai |
| `NEXT_PUBLIC_APP_URL` | obrigatória | Links de e-mail caem no domínio padrão e conectar o Google Agenda **falha** |
| `GOOGLE_CLIENT_ID` | obrigatória | Ninguém conecta o Google Agenda |
| `GOOGLE_CLIENT_SECRET` | obrigatória | Troca e renovação do token do Google falham |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | obrigatória | Ver aviso abaixo |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | alternativa | Caminho principal de e-mail |
| `RESEND_API_KEY` | alternativa | Caminho alternativo, usado quando não há SMTP |
| `SMTP_PORT`, `SMTP_SECURE` | opcional | Assume 587; TLS implícito só liga sozinho na 465 |
| `EMAIL_FROM`, `RESEND_FROM_EMAIL` | opcional | Remetente cai no padrão do código |

E-mail está configurado quando há (`SMTP_HOST` **e** `SMTP_USER`) **ou** `RESEND_API_KEY`.

Fora de `ENVS_ESPERADAS` — e por isso **não** auditadas pelo console — existem três ajustes
opcionais do limitador do endpoint MCP, todos com padrão embutido em `lib/mcp/rate-limit.ts`:
`MCP_RATE_LIMIT_TOKEN` (120), `MCP_RATE_LIMIT_IP` (240) e `MCP_RATE_LIMIT_JANELA_SEGUNDOS`
(60). Só configure se precisar afrouxar ou apertar o padrão.

> **`GOOGLE_TOKEN_ENCRYPTION_KEY` é a única variável irrecuperável do sistema.** Ela cifra os
> refresh tokens guardados em `google_workspace_conexoes`. Trocá-la não "desconfigura" — torna
> o que está no banco indecifrável, sem erro óbvio, e a única saída passa a ser cada pessoa
> reconectar. Base64 de 32 bytes. Faça backup antes de qualquer migração de ambiente.

As chaves VAPID do Web Push **não** são variáveis de ambiente: ficam na tabela `config_push` e
são geradas sozinhas no primeiro uso.

## Banco de dados (Supabase)

O estado canônico é `supabase/migrations/` — 86 arquivos, aplicados **em ordem de nome**.
(Confira com `ls supabase/migrations | wc -l`; esta contagem envelhece.)

> ⚠️ **Não use `supabase/schema.sql` para criar ambiente novo.** Apesar do cabeçalho, ele
> ficou parado antes do trabalho de multi-inquilino: não tem `organizacoes` nem
> `organizacao_id`. Um banco criado a partir dele sobe **sem isolamento entre clientes**.
> Vale como referência histórica do schema pré-SaaS, e nada além disso.

Ambiente novo: aplique `supabase/migrations/` em ordem, depois `supabase/seed.sql`.
Ambiente existente: aplique só as que faltam, na mesma ordem. Fluxo completo (ensaio em branch
antes da produção, regeneração de `lib/database.types.ts`, `get_advisors`) na skill
`vertice-migrations`.

Verificação pós-migration, no SQL Editor:

```sql
select count(*) from pg_tables  where schemaname = 'public';
select count(*) from pg_policies where schemaname = 'public';
select * from indicadores_diarios limit 5;   -- sem "stack depth limit exceeded"
```

E de fora, o vazamento fechado (deve retornar permission denied):

```bash
curl "https://<projeto>.supabase.co/rest/v1/indicadores_diarios" -H "apikey: <anon key>"
```

## Crons

Agendados em `vercel.json`; horários em **UTC** (Maringá = UTC−3). As agendas precisam bater
com `CRONS_DECLARADOS` em `lib/admin-saude.ts`, que é o que `/console` usa para acusar atraso.

| Rota | Agenda | O quê |
|---|---|---|
| `/api/cron/lembrete-diario` | `0 21 * * 1-5` | Cobra quem não apontou no dia |
| `/api/cron/alerta-queda` | `0 11 * * 1-5` | Avisa o gestor quando o índice de alguém cai |
| `/api/cron/relatorio-semanal` | `0 11 * * 1` | Consolidado da semana, às segundas |
| `/api/cron/kanban-recorrencia` | `0 9 * * *` | Clona os cards recorrentes que venceram |
| `/api/cron/kanban-automacoes` | `0 10 * * *` | Avalia atraso e SLA |
| `/api/cron/google-calendar-sync` | `15 3 * * *` | Reconcilia cards com o Google Agenda |
| `/api/cron/organizacoes-ciclo` | `0 5 * * *` | Ciclo de vida das contas (trial, suspensão) |

Os crons percorrem **todas** as organizações — idempotentes por dia, então repetir é seguro.
Teste manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/lembrete-diario
```

Sem e-mail configurado, respondem normalmente e marcam os envios como `skipped` (no-op).

## Deploy

**Hoje: Vercel.** Todas as variáveis da tabela acima no projeto, domínio verificado para o
remetente, e `CRON_SECRET` configurada (a Vercel injeta o header nos crons automaticamente).
As `NEXT_PUBLIC_*` precisam existir em **build time**.

**Planejado: Coolify.** O `Dockerfile` está no repositório e **nunca foi construído** — só
conferido. Apenas a Fase 0 (auditoria de variáveis no painel) foi entregue: 3 de 56 itens de
`docs/CHECKLIST-MIGRACAO.md`. O raciocínio está em `docs/PLANO-MIGRACAO-COOLIFY.md`.

> ⚠️ **O repositório se contradiz sobre onde o app roda hoje, e isto não foi resolvido aqui.**
> Contra o Coolify já estar em produção: `vercel.json` ainda declara os 7 crons, e o item
> "remover o bloco `crons` do `vercel.json`" segue desmarcado no checklist. A favor:
> `docs/PLANO-MCP-PRODUTO.md` abre dizendo "Produção: `https://vertice.teralabs.cloud/api/mcp`
> no Coolify", e `lib/mcp/rate-limit.ts` afirma em comentário que o app roda em container
> atrás do proxy do Coolify. Não dá para decidir pelo repositório — **confirme no painel antes
> de agir com base em qualquer das duas versões.**

## Integração contínua

Um workflow, `.github/workflows/mcp-integracao.yml` — dedicado à suíte de isolamento do MCP,
não a build geral. Roda em `pull_request` e em `push` para `master`, e só quando o PR toca
`lib/mcp/**`, `lib/mcp-auth.ts`, `lib/mcp-escopos.ts`, `app/api/mcp/**`, migrations com `mcp`
no nome, `__tests__/isolamento/**` ou o próprio workflow.

São dois passos: os testes unitários do servidor MCP (sem banco) e depois a suíte de
isolamento contra um projeto Supabase **exclusivo de integração**, jamais produção. Sem os
secrets `MCP_INTEGRATION_SUPABASE_URL` e `MCP_INTEGRATION_SERVICE_ROLE_KEY` o job **falha de
propósito**, em vez de pular em silêncio — inclusive em PR vindo de fork, que não os recebe.

`npm test`, `npm run lint` e `npm run build` continuam sendo responsabilidade local antes do
deploy: não há workflow que os rode para o repositório inteiro.

## Estrutura

```
app/(app)/            rotas autenticadas (minha-semana, kanban, gestão…)
app/(marketing)/      landing, /precos, /cadastro — públicas
app/(operador)/       /console do operador da plataforma
app/api/cron/         7 route handlers, validados por CRON_SECRET
app/api/mcp/          endpoint MCP — Bearer token, nunca cookie
components/ui/        shadcn v4 sobre @base-ui/react
lib/                  auth (requireUser/requireGestor/requireAdmin/requireOperador),
                      cron, email, auditoria, push, documentacao, changelog
lib/mcp/              servidor MCP: tools, resources, queries, mutations, rate limit
utils/supabase/       clients (browser, server, admin/service-role, middleware)
supabase/migrations/  estado canônico do banco
__tests__/isolamento/ testes de eixo, catálogo, service role e integração MCP
scripts/              gerar-icones.mjs (npm run icons)
proxy.ts              sessão + proteção de rota (Next 16; substitui middleware.ts)
design.md             contrato de identidade visual
```

Testes unitários ficam **ao lado do código** (`lib/*.test.ts`, `app/**/*.test.ts`); só os de
isolamento moram em `__tests__/`.

## Documentação

- **Para quem usa o produto**: `/documentacao` no app (`lib/documentacao.ts`, `lib/changelog.ts`).
- **Para quem desenvolve**: `docs/` — comece por [`docs/README.md`](docs/README.md), que diz o
  grau de confiança de cada documento. Depois `docs/PLANO-PRODUTO.md` (por que o isolamento é
  como é) e `docs/CHECKLIST-MIGRACAO.md` (o que está aberto).
- **Para conectar um agente ao MCP**: [`docs/mcp.md`](docs/mcp.md).
- **Para contribuir**: [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Para agentes**: as skills em `.claude/skills/` — `vertice-mapa` primeiro.
