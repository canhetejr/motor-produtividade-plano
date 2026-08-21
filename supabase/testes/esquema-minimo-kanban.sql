-- Recorte mínimo do schema do Vértice para provar as regras do Kanban num
-- Postgres local, sem tocar em nenhum projeto Supabase.
--
-- POR QUE ISTO EXISTE
-- As garantias que a migration 20260820213000 entrega — WIP que não estoura
-- sob corrida, posição que não duplica, rollback integral — só se provam com
-- DUAS conexões simultâneas de verdade. O projeto Supabase de integração
-- (khaeknegymhygsdofkce) serve para o isolamento entre organizações via
-- PostgREST; para corrida de transação ele é lento e depende de credencial.
-- Um cluster local (`initdb` + `pg_ctl`) dá o mesmo Postgres, em milissegundos,
-- e sem risco nenhum de escrever em banco de cliente.
--
-- O QUE ELE NÃO É
-- Não é a fonte de verdade do schema — supabase/migrations/ é. Este arquivo
-- reproduz só as tabelas, triggers e funções que as RPCs do Kanban tocam,
-- copiadas das migrations que as criaram (referência em cada bloco). RLS não
-- é reproduzida: as RPCs são SECURITY DEFINER e a autorização delas é escrita
-- à mão, que é exatamente o que estes testes precisam exercitar.

create schema if not exists auth;

-- Supabase resolve auth.uid() a partir do JWT. Aqui a identidade da sessão
-- vem de um GUC, que é o que permite um teste "virar" outra pessoa.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- === Raízes do eixo (20260808170000) ===
create table organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status text not null default 'ativa',
  unique (id, status)
);

create table colaboradores (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  role text not null default 'colaborador',
  admin boolean not null default false,
  ativo boolean not null default true,
  area_id uuid,
  carga_horaria_min integer not null default 480,
  unique (id, organizacao_id)
);

create table areas (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  unique (id, organizacao_id)
);

create table demandas (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  area_id uuid,
  nome text not null,
  ativo boolean not null default true,
  unique (id, organizacao_id)
);

-- === Kanban (20260723010000 + eixo da Fase 2) ===
create table quadros (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  codigo text not null default '',
  ativo boolean not null default true,
  unique (id, organizacao_id)
);

create table quadros_membros (
  quadro_id uuid not null,
  colaborador_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  primary key (quadro_id, colaborador_id),
  -- FK composta: é o que impede um quadro da org A ter membro da org B.
  foreign key (quadro_id, organizacao_id) references quadros (id, organizacao_id) on delete cascade,
  foreign key (colaborador_id, organizacao_id) references colaboradores (id, organizacao_id) on delete cascade
);

create table colunas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  posicao integer not null,
  etapa_final boolean not null default false,
  limite_wip integer check (limite_wip is null or limite_wip > 0),
  sla_horas integer,
  created_at timestamptz not null default now(),
  unique (id, organizacao_id),
  foreign key (quadro_id, organizacao_id) references quadros (id, organizacao_id) on delete cascade
);

create table cartoes (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  titulo text not null,
  descricao text,
  posicao integer not null,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  tipo text not null default 'Padrão',
  prazo date,
  inicio_desejado date,
  tempo_estimado_min integer,
  centro_id uuid,
  demanda_id uuid,
  tag_referencia text,
  recorrencia jsonb,
  cartao_pai_id uuid references cartoes(id) on delete set null,
  codigo text not null,
  referencia text,
  codigo_legado text,
  entregue_em timestamptz,
  proxima_recorrencia_em date,
  etapa_desde timestamptz,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organizacao_id),
  foreign key (coluna_id, organizacao_id) references colunas (id, organizacao_id) on delete cascade
);

create index cartoes_coluna_idx on cartoes (coluna_id, posicao);

create table cartoes_responsaveis (
  cartao_id uuid not null,
  colaborador_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  primary key (cartao_id, colaborador_id),
  foreign key (cartao_id, organizacao_id) references cartoes (id, organizacao_id) on delete cascade,
  foreign key (colaborador_id, organizacao_id) references colaboradores (id, organizacao_id) on delete cascade
);

create table comentarios_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null,
  colaborador_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  conteudo text not null,
  tipo text not null default 'usuario',
  created_at timestamptz not null default now(),
  foreign key (cartao_id, organizacao_id) references cartoes (id, organizacao_id) on delete cascade
);

-- === Regras de etapa (20260729120000 / 20260729130000) ===
create table cartoes_predecessores (
  cartao_id uuid not null,
  predecessor_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  primary key (cartao_id, predecessor_id)
);

create table colunas_requisitos (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  descricao text not null,
  obrigatorio boolean not null default false,
  posicao integer not null default 0
);

create table cartoes_requisitos_status (
  cartao_id uuid not null,
  requisito_id uuid not null,
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  concluido boolean not null default false,
  primary key (cartao_id, requisito_id)
);

-- === Referência global do card (20260820200000) ===
create sequence cartoes_referencia_seq;

create or replace function public.gerar_referencia_cartao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.referencia := 'VRT-' || lpad(nextval('public.cartoes_referencia_seq')::text, 6, '0');
  new.codigo := new.referencia;
  return new;
end;
$$;

create trigger trg_gerar_referencia_cartao
  before insert on cartoes for each row execute function public.gerar_referencia_cartao();

-- === Entrega / etapa_desde (20260730100000 + 20260730120000) ===
create or replace function public.cartoes_aplicar_entrega()
returns trigger language plpgsql set search_path = public as $$
declare
  v_destino_final boolean;
  v_tipo text;
begin
  if tg_op = 'UPDATE' and new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  new.etapa_desde := now();

  select etapa_final into v_destino_final from colunas where id = new.coluna_id;

  if coalesce(v_destino_final, false) then
    if new.entregue_em is null then
      new.entregue_em := now();
    end if;
    v_tipo := new.recorrencia->>'tipo';
    if v_tipo is not null then
      new.proxima_recorrencia_em := case v_tipo
        when 'diaria' then (current_date + 1)::date
        when 'semanal' then (current_date + 7)::date
        when 'mensal' then (current_date + interval '1 month')::date
      end;
    end if;
  else
    new.entregue_em := null;
    new.proxima_recorrencia_em := null;
  end if;

  return new;
end;
$$;

create trigger trg_cartoes_aplicar_entrega
  before insert or update on cartoes
  for each row execute function public.cartoes_aplicar_entrega();

-- Versão ANTERIOR à 20260820213000, de propósito: contagem de WIP sem lock.
-- A migration em teste substitui esta função; manter o original aqui é o que
-- deixa o teste medir o antes e o depois.
create or replace function public.cartoes_validar_saida_etapa()
returns trigger language plpgsql set search_path = public as $$
declare
  v_pendentes text;
  v_wip integer;
  v_limite integer;
begin
  if new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  select string_agg(pre.codigo, ', ' order by pre.codigo) into v_pendentes
  from cartoes_predecessores cp
  join cartoes pre on pre.id = cp.predecessor_id
  where cp.cartao_id = new.id and pre.entregue_em is null;

  if v_pendentes is not null then
    raise exception 'PREREQUISITO_PENDENTE:%', v_pendentes;
  end if;

  select string_agg(cr.descricao, '; ' order by cr.posicao) into v_pendentes
  from colunas_requisitos cr
  left join cartoes_requisitos_status crs
    on crs.requisito_id = cr.id and crs.cartao_id = new.id
  where cr.coluna_id = old.coluna_id
    and cr.obrigatorio = true
    and coalesce(crs.concluido, false) = false;

  if v_pendentes is not null then
    raise exception 'REQUISITO_OBRIGATORIO_PENDENTE:%', v_pendentes;
  end if;

  select limite_wip into v_limite from colunas where id = new.coluna_id;
  if v_limite is not null then
    select count(*) into v_wip from cartoes where coluna_id = new.coluna_id and id <> new.id;
    if v_wip >= v_limite then
      raise exception 'WIP_EXCEDIDO:%', v_limite;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_cartoes_validar_saida_etapa
  before update on cartoes
  for each row execute function public.cartoes_validar_saida_etapa();

-- === Autorização de quadro (20260815140000) ===
create or replace function public.pode_acessar_quadro(p_quadro_id uuid, p_colaborador_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from colaboradores c
    join quadros q on q.id = p_quadro_id and q.organizacao_id = c.organizacao_id
    where c.id = p_colaborador_id and c.ativo = true and c.role = 'gestor'
  ) or exists (
    select 1
    from quadros_membros m
    join colaboradores c on c.id = m.colaborador_id and c.organizacao_id = m.organizacao_id
    where m.quadro_id = p_quadro_id and m.colaborador_id = p_colaborador_id and c.ativo = true
  )
$$;

create or replace function public.org_atual() returns uuid
language sql stable security definer set search_path = public as $$
  select c.organizacao_id
  from public.colaboradores c
  join public.organizacoes o on o.id = c.organizacao_id
  where c.id = auth.uid() and c.ativo = true and o.status in ('trialing','ativa')
$$;

-- Papéis que a migration referencia nos grants. No Supabase eles já existem.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
