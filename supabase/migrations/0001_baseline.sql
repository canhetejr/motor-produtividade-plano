-- =====================================================================
-- 0001_baseline.sql — estado do banco ANTES da correção 0002
--
-- ATENÇÃO: este arquivo é REFERÊNCIA HISTÓRICA / bootstrap de ambiente
-- novo. NÃO rodar no banco existente (bapufbypqmtjtujfbiai) — lá este
-- estado já existe (criado à mão). Em ambiente novo, rode 0001 e depois
-- 0002 na sequência.
--
-- Diferenças vs. o supabase/schema.sql original do repositório:
--   * demandas.blocos_totais (existia no banco real, não estava versionado)
--   * No banco real, indicadores_diarios era MATERIALIZED VIEW com uma
--     RPC refresh_indicadores_diarios(secret_key text) — definições exatas
--     desconhecidas. A 0002 dropa ambas defensivamente e recria como view
--     normal. Aqui criamos como view normal direto.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Áreas (Fábrica, TEC. Audiovisual, Diagramador, Auxiliar, Moodle...)
create table areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

-- Catálogo de demandas
create table demandas (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references areas(id) not null,
  nome text not null,
  tempo_padrao_min integer,          -- null = pendente de definição
  variavel boolean not null default false,  -- true para "Outros"
  ativo boolean not null default true,
  blocos_totais integer not null default 1, -- demanda dividida em blocos (qtd = nº de blocos)
  unique (area_id, nome)
);

-- Colaboradores (1:1 com auth.users do Supabase)
create table colaboradores (
  id uuid primary key references auth.users(id),
  nome text not null,
  area_id uuid references areas(id),
  carga_horaria_min integer not null default 480, -- 8h
  role text not null default 'colaborador' check (role in ('colaborador', 'gestor')),
  ativo boolean not null default true
);

-- Apontamento diário
create table apontamentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references colaboradores(id) not null,
  demanda_id uuid references demandas(id) not null,
  data date not null default current_date,
  quantidade numeric not null default 1 check (quantidade > 0),
  tempo_manual_min integer,          -- preenchido só quando demandas.variavel = true
  observacoes text,
  created_at timestamptz not null default now()
);

create index on apontamentos (colaborador_id, data);
create index on apontamentos (demanda_id);

-- RLS (estado original — a 0002 corrige a recursão e endurece policies)
alter table areas enable row level security;
alter table demandas enable row level security;
alter table colaboradores enable row level security;
alter table apontamentos enable row level security;

create or replace function auth_role() returns text
language sql stable as $$
  select role from colaboradores where id = auth.uid()
$$;

create policy "areas_select_all" on areas for select using (true);
create policy "areas_write_gestor" on areas for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

create policy "demandas_select_all" on demandas for select using (true);
create policy "demandas_write_gestor" on demandas for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

create policy "colaboradores_select_own_or_gestor" on colaboradores for select
  using (id = auth.uid() or auth_role() = 'gestor');
create policy "colaboradores_update_own_or_gestor" on colaboradores for update
  using (id = auth.uid() or auth_role() = 'gestor');
create policy "colaboradores_insert_gestor" on colaboradores for insert
  with check (auth_role() = 'gestor' or id = auth.uid());

create policy "apontamentos_select_own_or_gestor" on apontamentos for select
  using (colaborador_id = auth.uid() or auth_role() = 'gestor');
create policy "apontamentos_insert_own" on apontamentos for insert
  with check (colaborador_id = auth.uid());
create policy "apontamentos_update_own" on apontamentos for update
  using (colaborador_id = auth.uid());
create policy "apontamentos_delete_own" on apontamentos for delete
  using (colaborador_id = auth.uid());
