-- Fase 1 de docs/PLANO-PRODUTO.md: organizacoes/planos/convites/operadores,
-- org_atual(), e o eixo de organização nas 4 tabelas raiz (areas,
-- colaboradores, quadros, demandas), com migração do dado atual para a
-- organização nº 1.
--
-- Deliberadamente NÃO mexe em nenhuma política RLS existente. As ~95
-- políticas de hoje continuam exatamente como estão — isso é seguro só
-- porque existe uma organização só. A reescrita com o eixo é a Fase 3, e as
-- duas não podem ir ao ar separadas com cadastro público aberto (ver
-- docs/PLANO-PRODUTO.md, "Ordem de execução").
--
-- Ordem importa: colaboradores.organizacao_id precisa existir ANTES de
-- org_atual() ser criada, porque funções `language sql` têm o corpo validado
-- contra o catálogo já no CREATE (check_function_bodies) — não é só no
-- primeiro uso. Por isso os `alter table add column` das 4 raízes vêm cedo,
-- antes de qualquer coisa que dependa de org_atual().

create extension if not exists citext;

-- ============================================================
-- 1. planos — catálogo global, fora do eixo
-- ============================================================
create table public.planos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  assentos_inclusos integer not null,
  preco_mensal_centavos integer not null default 0,
  ativo boolean not null default true,
  ordem integer not null default 0
);

alter table public.planos enable row level security;

create policy "planos_leitura_publica" on public.planos
  for select
  to anon, authenticated
  using (ativo = true);

-- ============================================================
-- 2. organizacoes (sem policy ainda — depende de org_atual())
-- ============================================================
create table public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug citext not null unique,
  plano_id uuid not null references public.planos(id),
  limite_assentos integer not null,
  status text not null default 'trialing',
  trial_expira_em timestamptz,
  suspensa_em timestamptz,
  excluir_em timestamptz,
  criado_em timestamptz not null default now(),

  constraint organizacoes_status_valido
    check (status in ('trialing','ativa','suspensa','expirada','excluindo')),
  constraint organizacoes_limite_positivo check (limite_assentos > 0),
  constraint organizacoes_trial_coerente
    check ((status = 'trialing') = (trial_expira_em is not null))
);

alter table public.organizacoes enable row level security;

-- ============================================================
-- 3. operadores — papel fora do modelo de cliente, sem organizacao_id
-- ============================================================
create table public.operadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);

alter table public.operadores enable row level security;
revoke all on public.operadores from anon, authenticated;

-- ============================================================
-- 4. organizacao_id nas 4 raízes — nulável, ANTES de org_atual() existir
-- ============================================================
alter table public.areas add column organizacao_id uuid references public.organizacoes(id);
alter table public.colaboradores add column organizacao_id uuid references public.organizacoes(id);
alter table public.quadros add column organizacao_id uuid references public.organizacoes(id);
alter table public.demandas add column organizacao_id uuid references public.organizacoes(id);

-- ============================================================
-- 5. org_atual() — agora colaboradores.organizacao_id já existe
-- ============================================================
create or replace function public.org_atual() returns uuid
language sql stable security definer set search_path = public as $$
  select c.organizacao_id
  from public.colaboradores c
  join public.organizacoes o on o.id = c.organizacao_id
  where c.id = auth.uid()
    and c.ativo = true
    and o.status in ('trialing','ativa')
$$;

revoke all on function public.org_atual() from public, anon;
grant execute on function public.org_atual() to authenticated;

comment on function public.org_atual() is
  'Devolve a organizacao_id de quem chama, ou NULL se a conta estiver '
  'inativa ou a organização suspensa/expirada — suspensão vira defesa no '
  'banco: organizacao_id = NULL nunca é true, então toda tabela some sem '
  'exceção. Ainda não é usada em nenhuma policy do eixo (isso é a Fase 3); '
  'aqui ela só sustenta a policy de organizacoes abaixo e convites.';

create policy "organizacoes_leitura_propria" on public.organizacoes
  for select
  to authenticated
  using (id = (select public.org_atual()));

-- ============================================================
-- 6. convites
-- ============================================================
create table public.convites (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  email citext not null,
  role text not null default 'colaborador' check (role in ('colaborador','gestor')),
  area_id uuid,
  token_hash text not null unique,
  convidado_por uuid not null,
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_em timestamptz,
  revogado_em timestamptz,
  criado_em timestamptz not null default now()
);

create unique index convites_pendente_unico
  on public.convites (organizacao_id, email)
  where aceito_em is null and revogado_em is null;

create index on public.convites (organizacao_id);

alter table public.convites enable row level security;

create policy "convites_gestor_da_org" on public.convites
  as restrictive for all
  using (
    organizacao_id = (select public.org_atual())
    and public.auth_role() = 'gestor'
  )
  with check (
    organizacao_id = (select public.org_atual())
    and public.auth_role() = 'gestor'
  );

-- ============================================================
-- 7. Migração do dado atual para a organização nº 1
-- ============================================================
insert into public.planos (codigo, nome, assentos_inclusos, preco_mensal_centavos, ordem)
values ('interno', 'Interno', 100, 0, 99);

insert into public.organizacoes (id, nome, slug, plano_id, limite_assentos, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Teralabs',
  'teralabs',
  (select id from public.planos where codigo = 'interno'),
  100,
  'ativa'
);

update public.areas set organizacao_id = '00000000-0000-0000-0000-000000000001';
update public.colaboradores set organizacao_id = '00000000-0000-0000-0000-000000000001';
update public.quadros set organizacao_id = '00000000-0000-0000-0000-000000000001';
update public.demandas set organizacao_id = '00000000-0000-0000-0000-000000000001';

do $$
begin
  if exists (select 1 from public.areas where organizacao_id is null) then
    raise exception 'areas com organizacao_id nula após backfill';
  end if;
  if exists (select 1 from public.colaboradores where organizacao_id is null) then
    raise exception 'colaboradores com organizacao_id nula após backfill';
  end if;
  if exists (select 1 from public.quadros where organizacao_id is null) then
    raise exception 'quadros com organizacao_id nula após backfill';
  end if;
  if exists (select 1 from public.demandas where organizacao_id is null) then
    raise exception 'demandas com organizacao_id nula após backfill';
  end if;
end $$;

alter table public.areas alter column organizacao_id set not null;
alter table public.colaboradores alter column organizacao_id set not null;
alter table public.quadros alter column organizacao_id set not null;
alter table public.demandas alter column organizacao_id set not null;

alter table public.areas add constraint areas_id_org unique (id, organizacao_id);
alter table public.colaboradores add constraint colaboradores_id_org unique (id, organizacao_id);
alter table public.quadros add constraint quadros_id_org unique (id, organizacao_id);
alter table public.demandas add constraint demandas_id_org unique (id, organizacao_id);

create index on public.areas (organizacao_id);
create index on public.colaboradores (organizacao_id);
create index on public.quadros (organizacao_id);
create index on public.demandas (organizacao_id);

alter table public.convites
  add constraint convites_area_org
  foreign key (area_id, organizacao_id) references public.areas (id, organizacao_id);
