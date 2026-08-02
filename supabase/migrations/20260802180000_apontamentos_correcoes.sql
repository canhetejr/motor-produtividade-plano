-- F3: pedido de lancamento retroativo.
--
-- A regra "so se lanca hoje" e deliberada e NAO muda: a policy
-- apontamentos_insert_own continua exigindo data = CURRENT_DATE. O que faltava
-- era valvula para quem esqueceu — em vez de nao existir saida, existe um
-- pedido que o gestor aprova. A regra continua valendo; o que passa a existir e
-- quem pode abrir excecao, com registro de quem abriu.
--
-- Ver 20260802180001 para as funcoes de decisao.

create table if not exists public.apontamentos_correcoes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  demanda_id uuid not null references public.demandas(id) on delete restrict,
  data date not null,
  quantidade numeric not null check (quantidade > 0),
  tempo_manual_min integer check (tempo_manual_min is null or tempo_manual_min > 0),
  motivo text,
  observacoes text,
  justificativa text not null check (length(trim(justificativa)) > 0),
  status status_solicitacao not null default 'PENDENTE',
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references public.colaboradores(id),
  apontamento_id uuid references public.apontamentos(id) on delete set null,
  -- Pedir para um dia futuro nao e correcao, e adiantamento.
  constraint apontamentos_correcoes_data_passada check (data < current_date)
);

create index if not exists idx_apontamentos_correcoes_colaborador_id on public.apontamentos_correcoes (colaborador_id);
create index if not exists idx_apontamentos_correcoes_demanda_id on public.apontamentos_correcoes (demanda_id);
create index if not exists idx_apontamentos_correcoes_decidido_por on public.apontamentos_correcoes (decidido_por);
create index if not exists idx_apontamentos_correcoes_apontamento_id on public.apontamentos_correcoes (apontamento_id);
-- Pendentes sao o que o gestor consulta; indice parcial cobre a fila barato.
create index if not exists idx_apontamentos_correcoes_pendentes
  on public.apontamentos_correcoes (criado_em) where status = 'PENDENTE';

alter table public.apontamentos_correcoes enable row level security;
revoke all on public.apontamentos_correcoes from anon;

create policy correcoes_select_own_ou_gestor on public.apontamentos_correcoes
  for select using (colaborador_id = (select auth.uid()) or (select auth_role()) = 'gestor');
-- So o proprio, so pendente, e so para si mesmo: pedir em nome de outra pessoa
-- criaria apontamento alheio pela porta dos fundos.
create policy correcoes_insert_own on public.apontamentos_correcoes
  for insert with check (colaborador_id = (select auth.uid()) and status = 'PENDENTE');
create policy correcoes_delete_own_pendente on public.apontamentos_correcoes
  for delete using (colaborador_id = (select auth.uid()) and status = 'PENDENTE');
