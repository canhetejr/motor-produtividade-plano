-- =====================================================================
-- Módulo Kanban: quadros que o gestor cria e vincula colaboradores
-- específicos (estilo Runrun.it) — sem organizações/projetos, só
-- reaproveitando colaboradores/areas já existentes.
--
-- Modelo: quadros -> colunas -> cartoes, com responsáveis/etiquetas/
-- comentários por cartão. Acesso: gestor vê e gerencia tudo; colaborador
-- só acessa quadros em que foi vinculado via `quadros_membros` (é o
-- gestor quem vincula/desvincula — colaborador não se autoadiciona).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

begin;

create table if not exists quadros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  codigo text not null unique, -- prefixo curto (ex. "UX") usado no código do cartão
  cartao_contador integer not null default 0,
  criado_por uuid references colaboradores(id) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quadros_membros (
  quadro_id uuid references quadros(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) on delete cascade not null,
  adicionado_em timestamptz not null default now(),
  primary key (quadro_id, colaborador_id)
);

create table if not exists colunas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  posicao integer not null,
  created_at timestamptz not null default now()
);

create index if not exists colunas_quadro_idx on colunas (quadro_id, posicao);

create table if not exists cartoes (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid references colunas(id) on delete cascade not null,
  titulo text not null,
  descricao text,
  posicao integer not null,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  prazo date,
  codigo text not null, -- gerado pela trigger abaixo, ex. "UX-12"
  criado_por uuid references colaboradores(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cartoes_coluna_idx on cartoes (coluna_id, posicao);

create table if not exists cartoes_responsaveis (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) on delete cascade not null,
  primary key (cartao_id, colaborador_id)
);

create table if not exists etiquetas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  cor text not null default '#6B7280',
  created_at timestamptz not null default now(),
  unique (quadro_id, nome)
);

create table if not exists cartoes_etiquetas (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  etiqueta_id uuid references etiquetas(id) on delete cascade not null,
  primary key (cartao_id, etiqueta_id)
);

create table if not exists comentarios_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists comentarios_cartao_idx on comentarios_cartao (cartao_id, created_at desc);

commit;

-- ---------------------------------------------------------------------
-- 2. Código incremental do cartão (ex. "UX-12"), mesmo raciocínio do
-- gerador de custom_id do projeto de referência: soma o contador do
-- quadro dentro da própria trigger para não ter corrida entre inserts
-- concorrentes.
-- ---------------------------------------------------------------------

begin;

create or replace function public.gerar_codigo_cartao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quadro_id uuid;
  v_prefixo text;
  v_novo_contador integer;
begin
  select col.quadro_id into v_quadro_id from colunas col where col.id = new.coluna_id;

  update quadros
  set cartao_contador = cartao_contador + 1,
      updated_at = now()
  where id = v_quadro_id
  returning codigo, cartao_contador into v_prefixo, v_novo_contador;

  new.codigo := v_prefixo || '-' || v_novo_contador;
  return new;
end;
$$;

drop trigger if exists tr_gerar_codigo_cartao on cartoes;
create trigger tr_gerar_codigo_cartao
  before insert on cartoes
  for each row
  execute function public.gerar_codigo_cartao();

commit;

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------

begin;

alter table quadros enable row level security;
alter table quadros_membros enable row level security;
alter table colunas enable row level security;
alter table cartoes enable row level security;
alter table cartoes_responsaveis enable row level security;
alter table etiquetas enable row level security;
alter table cartoes_etiquetas enable row level security;
alter table comentarios_cartao enable row level security;

-- Helper: true se o usuário logado é gestor OU está vinculado ao quadro.
-- SECURITY DEFINER pra checar quadros_membros sem recursão de RLS (mesmo
-- raciocínio de auth_role(), já usado no resto do projeto).
create or replace function public.is_quadro_membro(p_quadro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() = 'gestor' or exists (
    select 1 from quadros_membros
    where quadro_id = p_quadro_id and colaborador_id = auth.uid()
  )
$$;

revoke all on function public.is_quadro_membro(uuid) from public;
grant execute on function public.is_quadro_membro(uuid) to authenticated, service_role;

-- quadros: membros (gestor ou vinculado) leem; só gestor cria/edita/arquiva
drop policy if exists "quadros_select_membro" on quadros;
create policy "quadros_select_membro" on quadros for select
  using (is_quadro_membro(id));

drop policy if exists "quadros_write_gestor" on quadros;
create policy "quadros_write_gestor" on quadros for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

-- quadros_membros: membros do quadro leem a lista; só gestor vincula/desvincula
drop policy if exists "quadros_membros_select" on quadros_membros;
create policy "quadros_membros_select" on quadros_membros for select
  using (is_quadro_membro(quadro_id));

drop policy if exists "quadros_membros_write_gestor" on quadros_membros;
create policy "quadros_membros_write_gestor" on quadros_membros for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

-- colunas: qualquer membro do quadro gerencia (mesmo espírito do projeto de
-- referência: montar o board é tarefa de time, não só de admin)
drop policy if exists "colunas_all_membro" on colunas;
create policy "colunas_all_membro" on colunas for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

-- cartoes: idem, via join até o quadro da coluna
drop policy if exists "cartoes_all_membro" on cartoes;
create policy "cartoes_all_membro" on cartoes for all
  using (
    exists (select 1 from colunas col where col.id = cartoes.coluna_id and is_quadro_membro(col.quadro_id))
  )
  with check (
    exists (select 1 from colunas col where col.id = cartoes.coluna_id and is_quadro_membro(col.quadro_id))
  );

-- cartoes_responsaveis: idem, via join até o quadro do cartão
drop policy if exists "cartoes_responsaveis_all_membro" on cartoes_responsaveis;
create policy "cartoes_responsaveis_all_membro" on cartoes_responsaveis for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

-- etiquetas: por quadro
drop policy if exists "etiquetas_all_membro" on etiquetas;
create policy "etiquetas_all_membro" on etiquetas for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

-- cartoes_etiquetas: via join até o quadro do cartão
drop policy if exists "cartoes_etiquetas_all_membro" on cartoes_etiquetas;
create policy "cartoes_etiquetas_all_membro" on cartoes_etiquetas for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_etiquetas.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_etiquetas.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

-- comentarios_cartao: membros leem/comentam; só o autor edita/exclui o próprio
drop policy if exists "comentarios_select_membro" on comentarios_cartao;
create policy "comentarios_select_membro" on comentarios_cartao for select
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = comentarios_cartao.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "comentarios_insert_membro" on comentarios_cartao;
create policy "comentarios_insert_membro" on comentarios_cartao for insert
  with check (
    colaborador_id = auth.uid()
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = comentarios_cartao.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "comentarios_delete_own" on comentarios_cartao;
create policy "comentarios_delete_own" on comentarios_cartao for delete
  using (colaborador_id = auth.uid());

commit;

-- ---------------------------------------------------------------------
-- 4. Grants e Realtime
-- ---------------------------------------------------------------------

begin;

revoke all on quadros, quadros_membros, colunas, cartoes, cartoes_responsaveis,
  etiquetas, cartoes_etiquetas, comentarios_cartao from anon;

-- Board reage em tempo real a mudanças de cartões/colunas feitas por outros
-- membros (mesmo padrão já usado pra `notificacoes`).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'cartoes'
  ) then
    alter publication supabase_realtime add table cartoes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'colunas'
  ) then
    alter publication supabase_realtime add table colunas;
  end if;
end $$;

commit;
