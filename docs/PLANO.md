# Motor de Produtividade — Spec Técnica (Next.js)

> **Histórico.** Spec original do MVP, escrita contra Next.js 14 e um app de uma empresa só.
> O produto hoje roda em Next.js 16 (`proxy.ts` no lugar de `middleware.ts`) e é SaaS
> multi-inquilino. Vale como registro do desenho original — as decisões de modelagem do
> apontamento e do índice continuam de pé; estrutura de rotas, stack e deploy, não.
> Para o estado atual, `README.md` na raiz e `PLANO-PRODUTO.md`.

Sistema web para substituir a planilha: apontamento diário de demandas, cálculo automático de
capacidade x entregue, e dashboard de produtividade por colaborador/área para a diretoria.

Sem n8n desta vez — automação fica dentro do próprio Next.js (Vercel Cron), e o deploy é na
Vercel em vez do Coolify. Menos peça móvel, mais nativo do stack Next.js.

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | Next.js Server Actions / Route Handlers |
| Banco + Auth | Supabase (Postgres + Auth + RLS) |
| Gráficos | Recharts |
| Automação | Vercel Cron Jobs → Route Handlers (sem serviço externo) |
| E-mail | Resend (integra direto com Vercel/Next.js) |
| Deploy | Vercel, domínio `mp.unicive.cloud` (CNAME apontando pra Vercel) |

Sem Board/TanIA como boilerplate de infra aqui já que a base muda (Vercel em vez de Coolify),
mas o padrão de auth/layout do Supabase continua reaproveitável.

---

## 2. Modelo de dados (Postgres / Supabase)

```sql
-- Áreas (Fábrica, TEC. Audiovisual, Diagramador, Auxiliar, Moodle...)
create table areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

-- Catálogo de demandas (vem direto do seu mapeamento atual)
create table demandas (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references areas(id) not null,
  nome text not null,
  tempo_padrao_min integer,          -- null = pendente de definição
  variavel boolean default false,    -- true para "Outros"
  ativo boolean default true,
  unique (area_id, nome)
);

-- Colaboradores (1:1 com auth.users do Supabase)
create table colaboradores (
  id uuid primary key references auth.users(id),
  nome text not null,
  area_id uuid references areas(id),
  carga_horaria_min integer not null default 480, -- 8h
  role text not null default 'colaborador',        -- 'colaborador' | 'gestor'
  ativo boolean default true
);

-- Apontamento diário — a tabela que cresce todo dia
create table apontamentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references colaboradores(id) not null,
  demanda_id uuid references demandas(id) not null,
  data date not null default current_date,
  quantidade numeric not null default 1,
  tempo_manual_min integer,          -- preenchido só quando demanda.variavel = true
  observacoes text,
  created_at timestamptz default now()
);

-- View: tempo total por apontamento (padrão x quantidade, ou manual se variável)
create view apontamentos_calculado as
select
  a.*,
  d.area_id,
  case
    when d.variavel then coalesce(a.tempo_manual_min, 0)
    else coalesce(d.tempo_padrao_min, 0) * a.quantidade
  end as tempo_total_min
from apontamentos a
join demandas d on d.id = a.demanda_id;

-- View: índice de produtividade por colaborador/dia
create view indicadores_diarios as
select
  c.id as colaborador_id,
  c.nome,
  ac.data,
  c.carga_horaria_min,
  sum(ac.tempo_total_min) as tempo_entregue_min,
  round(sum(ac.tempo_total_min)::numeric / c.carga_horaria_min, 4) as indice
from colaboradores c
join apontamentos_calculado ac on ac.colaborador_id = c.id
group by c.id, c.nome, ac.data, c.carga_horaria_min;
```

**RLS (essencial, já que colaborador e gestor acessam o mesmo app):**
- `colaboradores`: cada um vê/edita só sua própria linha; `gestor` vê todas.
- `apontamentos`: colaborador só insere/edita/exclui apontamentos com
  `colaborador_id = auth.uid()` **e `data = current_date`** (só o dia atual); gestor tem
  select em tudo, sem update.
- `demandas`/`areas`: leitura geral, escrita só para `role = 'gestor'`.

### 2.1 Sugestão de catálogo e notificações (adicionado após o MVP)

Colaboradores não editam `demandas` diretamente — em vez disso, sugerem uma demanda nova
ou uma alteração numa existente, e o gestor aprova ou rejeita:

```sql
create type tipo_solicitacao as enum ('NOVA', 'ALTERACAO');
create type status_solicitacao as enum ('PENDENTE', 'APROVADA', 'REJEITADA');

create table solicitacoes_demandas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references colaboradores(id) not null,
  area_id uuid references areas(id) not null,
  demanda_id uuid references demandas(id), -- null se tipo = 'NOVA'
  tipo tipo_solicitacao not null,
  nome text not null,
  tempo_padrao_min integer,
  variavel boolean not null default false,
  blocos_totais integer not null default 1,
  ativo boolean,
  status status_solicitacao not null default 'PENDENTE',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
```

Aprovar aplica o conteúdo da solicitação como `insert`/`update` em `demandas` e marca
`status = 'APROVADA'`; rejeitar só marca `status = 'REJEITADA'`. Colaborador só insere
(sempre `PENDENTE`) e lê as próprias; só o gestor edita status.

Toda mudança de status (e a criação de uma solicitação) gera uma linha em `notificacoes`
— tabela genérica (`tipo`/`titulo`/`mensagem`/`link`/`lida`) usada pelo sino de
notificações no layout autenticado. Notificações nascem só via service role (dentro das
Server Actions que já validam o evento de origem), nunca inseridas direto pelo client.

---

## 3. Rotas / Páginas

| Rota | Quem acessa | O quê |
|---|---|---|
| `/login` | todos | Supabase Auth (magic link ou senha) |
| `/apontamento` | colaborador | Tela principal, mobile-first: escolher demanda, quantidade, salvar. Meta: <1 min por lançamento |
| `/apontamento/historico` | colaborador | Ver/editar lançamentos dos últimos dias |
| `/dashboard` | gestor | Índice por colaborador, por área, por período; farol verde/amarelo/vermelho |
| `/dashboard/[colaborador]` | gestor | Drill-down individual, série histórica |
| `/catalogo` | gestor | CRUD de áreas e demandas: cadastrar demanda nova, editar tempo padrão, marcar como variável ("Outros") — tudo dinâmico, sem depender de deploy |
| `/colaboradores` | gestor | CRUD de colaboradores, carga horária |
| `/relatorios` | gestor | Exportar período em CSV/XLSX |

`/apontamento` é a tela que decide se o produto vinga — se não for mais rápido que abrir a
planilha, ninguém preenche. Pensar em: poucos cliques, campos com valor padrão (quantidade = 1),
funcionar bem no celular.

---

## 4. Automação (Vercel Cron, sem n8n)

`vercel.json` declara os horários, cada um chama um Route Handler que consulta o Supabase e
dispara e-mail via Resend. Sem servidor externo, sem workflow visual — é tudo código no mesmo
repo.

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/lembrete-diario", "schedule": "0 21 * * 1-5" },
    { "path": "/api/cron/alerta-queda",    "schedule": "0 11 * * 1-5" },
    { "path": "/api/cron/relatorio-semanal","schedule": "0 11 * * 1" }
  ]
}
```
(horários em UTC — `21:00 UTC` = 18h em Maringá)

1. **Lembrete diário (18h, dias úteis):** consulta quem não tem apontamento hoje em
   `apontamentos` → e-mail via Resend para o colaborador.
2. **Alerta de queda (08h, dias úteis):** roda contra `indicadores_diarios` → se índice < 70%
   por 2 dias seguidos → e-mail para o gestor.
3. **Relatório semanal (segunda, 08h):** resumo por área/colaborador → e-mail HTML para a
   diretoria.

Cada rota de cron precisa checar o header `Authorization: Bearer ${CRON_SECRET}` que a Vercel
injeta automaticamente, pra ninguém disparar essas rotas de fora.

**Limitação a considerar:** o plano Hobby da Vercel permite no máximo 1 execução de cron por
dia por job (o `schedule` acima já respeita isso — 1x/dia cada). Se precisar de granularidade
maior (ex: checagem de hora em hora), isso exige plano Pro. Vale confirmar qual plano vocês
usam antes de fechar o desenho.

Se um dia quiser WhatsApp em vez de e-mail, dá pra trocar o Resend por uma chamada direta à
API do WhatsApp Business (ou Twilio) dentro da mesma rota — não muda a arquitetura.

---

## 5. Fases de implementação

1. **Fundação** — schema Supabase + RLS, auth, seed do catálogo atual (a planilha que já
   validamos vira o `INSERT` inicial).
2. **Apontamento** — a tela crítica, mobile-first, sem fricção.
3. **Dashboard** — índice por colaborador/área/período, gráficos Recharts, farol.
4. **Admin** — CRUD de catálogo e colaboradores (hoje vive na planilha, migra pro app).
5. **Automação** — rotas de cron (Vercel) + Resend: lembretes, alertas, relatório semanal.
6. **Deploy** — Vercel + `mp.unicive.cloud`, revisão de RLS antes de abrir para o time.

Cada fase é útil sozinha — dá pra colocar o time lançando apontamento na Fase 2 mesmo sem
dashboard pronto, e o CSV de `apontamentos` já serve de base pros indicadores enquanto isso.

---

## 6. Pontos em aberto (decidir antes de começar a construir)

- **Estágio, Intercorrência, ICode** não têm tempo padrão hoje — mas isso não trava o começo:
  a tela `/catalogo` (Fase 4) já é CRUD completo de demandas, então cadastrar uma demanda nova
  (ou definir/editar o tempo padrão de uma existente) é uma ação normal do gestor, a qualquer
  momento, sem precisar migração ou deploy novo. O schema já suporta isso — `tempo_padrao_min`
  é nullable, então uma demanda pode existir "pendente de definição" e ser calculada assim que
  alguém preencher o tempo.
- **Auth:** magic link (mais simples, sem senha) ou email/senha? Colaboradores vão usar
  celular no dia a dia — magic link tende a ser mais tranquilo.
- **Onde nasce o "Outros"?** hoje é tempo manual livre — vale um teto (ex: máx 2h) pra evitar
  lançamento fantasioso, ou fica livre mesmo?
- **Plano da Vercel:** não trava o começo — dá pra desenvolver inteiro no plano Hobby.
  Só precisa decidir antes do deploy em produção: com `mp.unicive.cloud` como domínio, isso é
  ferramenta oficial da UniCV, e o Hobby é pra uso pessoal/não-comercial. Deixar isso pra
  revisar quando o projeto estiver pronto pra ir ao ar.
