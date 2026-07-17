-- Motor de Produtividade — schema inicial
-- Rodar no SQL editor do Supabase (ou via supabase db push)

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

-- View: tempo total por apontamento
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

-- =========================================================
-- RLS
-- =========================================================

alter table areas enable row level security;
alter table demandas enable row level security;
alter table colaboradores enable row level security;
alter table apontamentos enable row level security;

-- helper: papel do usuário logado
create or replace function auth_role() returns text
language sql stable as $$
  select role from colaboradores where id = auth.uid()
$$;

-- areas / demandas: leitura geral, escrita só gestor
create policy "areas_select_all" on areas for select using (true);
create policy "areas_write_gestor" on areas for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

create policy "demandas_select_all" on demandas for select using (true);
create policy "demandas_write_gestor" on demandas for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

-- colaboradores: cada um vê/edita a própria linha; gestor vê e edita todas
create policy "colaboradores_select_own_or_gestor" on colaboradores for select
  using (id = auth.uid() or auth_role() = 'gestor');
create policy "colaboradores_update_own_or_gestor" on colaboradores for update
  using (id = auth.uid() or auth_role() = 'gestor');
create policy "colaboradores_insert_gestor" on colaboradores for insert
  with check (auth_role() = 'gestor' or id = auth.uid());

-- apontamentos: colaborador só mexe no próprio; gestor só lê tudo (sem editar apontamento alheio)
create policy "apontamentos_select_own_or_gestor" on apontamentos for select
  using (colaborador_id = auth.uid() or auth_role() = 'gestor');
create policy "apontamentos_insert_own" on apontamentos for insert
  with check (colaborador_id = auth.uid());
create policy "apontamentos_update_own" on apontamentos for update
  using (colaborador_id = auth.uid());
create policy "apontamentos_delete_own" on apontamentos for delete
  using (colaborador_id = auth.uid());
