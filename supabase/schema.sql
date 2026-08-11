-- Motor de Produtividade — schema de referência HISTÓRICO (pré-multi-inquilino)
--
-- ⚠️ NÃO USE ESTE ARQUIVO PARA CRIAR AMBIENTE NOVO.
--
-- Ele parou antes do trabalho de multi-inquilino (migrations de 08–09/08/2026):
-- não tem a tabela `organizacoes`, nem a coluna `organizacao_id`, nem as
-- políticas restritivas com `org_atual()`, nem as FKs compostas. Um banco
-- criado a partir daqui sobe SEM ISOLAMENTO ENTRE CLIENTES — e sem erro
-- visível, que é o que torna isso perigoso.
--
-- Estado canônico do banco: supabase/migrations/, aplicadas em ordem de nome.
-- Este arquivo permanece como retrato do schema anterior ao SaaS.

create extension if not exists "pgcrypto";

-- Áreas (Fábrica, TEC. Audiovisual, Diagramador, Auxiliar, Moodle...)
create table areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true
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
  motivo text,                       -- idem; um dos MOTIVOS_OUTROS (lib/motivos-outros.ts)
  observacoes text,
  created_at timestamptz not null default now(),
  -- Snapshot dos valores da demanda no instante do lançamento: o cálculo em
  -- apontamentos_calculado usa estes, não os valores atuais da demanda. Assim,
  -- editar a demanda depois não reescreve o histórico. Variável não usa
  -- (tempo vem de tempo_manual_min): grava snapshot nulo/1.
  tempo_padrao_snapshot integer,
  blocos_totais_snapshot integer not null default 1,
  -- Teto de blocos: quantidade não passa do total de blocos (snapshot > 1).
  -- Demanda comum (snapshot = 1) segue livre — ali quantidade é repetição.
  constraint apontamentos_quantidade_ate_blocos
    check (blocos_totais_snapshot <= 1 or quantidade <= blocos_totais_snapshot)
);

create index on apontamentos (colaborador_id, data);
create index on apontamentos (demanda_id);

-- Solicitações de demanda: colaborador sugere demanda nova ou alteração de
-- uma existente; gestor aprova/rejeita (vira insert/update em `demandas`).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_solicitacao') then
    create type tipo_solicitacao as enum ('NOVA', 'ALTERACAO');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_solicitacao') then
    create type status_solicitacao as enum ('PENDENTE', 'APROVADA', 'REJEITADA');
  end if;
end $$;

create table solicitacoes_demandas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references colaboradores(id) not null,
  area_id uuid references areas(id) not null,
  demanda_id uuid references demandas(id), -- null se tipo = 'NOVA'
  tipo tipo_solicitacao not null,

  -- campos propostos
  nome text not null,
  tempo_padrao_min integer,
  variavel boolean not null default false,
  blocos_totais integer not null default 1,
  ativo boolean,

  status status_solicitacao not null default 'PENDENTE',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Central de notificações: tabela genérica (tipo/titulo/mensagem/link), hoje
-- cobre status de solicitacoes_demandas; no futuro também lembrete de
-- apontamento, alerta de queda etc.
create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid references colaboradores(id) not null,
  tipo text not null,
  titulo text not null,
  mensagem text,
  link text,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index on notificacoes (destinatario_id, criado_em desc);

-- View: tempo total por apontamento (live, security_invoker => aplica RLS das tabelas)
-- Colunas listadas explicitamente (em vez de "a.*"): o Postgres expande "*"
-- em tempo de CREATE VIEW, então uma coluna nova em `apontamentos` não
-- apareceria aqui sozinha — precisaria de um CREATE OR REPLACE VIEW mesmo
-- assim. Listar explícito deixa isso óbvio e evita o mesmo erro de novo.
create view apontamentos_calculado
with (security_invoker = true) as
select
  a.id,
  a.colaborador_id,
  a.demanda_id,
  a.data,
  a.quantidade,
  a.tempo_manual_min,
  a.observacoes,
  a.created_at,
  d.area_id,
  -- Usa o SNAPSHOT do apontamento (congelado no lançamento), não os valores
  -- atuais da demanda — por isso editar a demanda não muda o passado.
  -- "variável" = tem tempo_manual_min (a Server Action só preenche nesse caso).
  case
    when a.tempo_manual_min is not null then a.tempo_manual_min
    -- quantidade = nº de blocos quando a demanda é dividida em blocos
    else round(coalesce(a.tempo_padrao_snapshot, 0) * a.quantidade
               / greatest(coalesce(a.blocos_totais_snapshot, 1), 1))
  end as tempo_total_min,
  a.motivo
from apontamentos a
join demandas d on d.id = a.demanda_id;

-- View: índice de produtividade por colaborador/dia
-- LEFT JOIN: colaborador sem apontamento aparece com data null / índice 0
create view indicadores_diarios
with (security_invoker = true) as
select
  c.id as colaborador_id,
  c.nome,
  c.area_id,
  c.ativo,
  ac.data,
  c.carga_horaria_min,
  coalesce(sum(ac.tempo_total_min), 0)::int as tempo_entregue_min,
  round(coalesce(sum(ac.tempo_total_min), 0)::numeric
        / nullif(c.carga_horaria_min, 0), 4) as indice
from colaboradores c
left join apontamentos_calculado ac on ac.colaborador_id = c.id
group by c.id, c.nome, c.area_id, c.ativo, ac.data, c.carga_horaria_min;

-- =========================================================
-- RLS
-- =========================================================

alter table areas enable row level security;
alter table demandas enable row level security;
alter table colaboradores enable row level security;
alter table apontamentos enable row level security;
alter table solicitacoes_demandas enable row level security;
alter table notificacoes enable row level security;

-- helper: papel do usuário logado
-- SECURITY DEFINER: a consulta interna bypassa RLS de colaboradores,
-- evitando recursão infinita (as policies chamam esta função)
create or replace function auth_role() returns text
language sql stable
security definer
set search_path = public
as $$
  select role from colaboradores where id = auth.uid()
$$;

revoke all on function auth_role() from public;
grant execute on function auth_role() to anon, authenticated, service_role;

-- areas / demandas: leitura geral (autenticado), escrita só gestor
create policy "areas_select_all" on areas for select using (true);
create policy "areas_write_gestor" on areas for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

create policy "demandas_select_all" on demandas for select using (true);
create policy "demandas_write_gestor" on demandas for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

-- colaboradores: cada um vê a própria linha; só gestor edita/insere
-- (contas são criadas via service role em /colaboradores)
create policy "colaboradores_select_own_or_gestor" on colaboradores for select
  using (id = auth.uid() or auth_role() = 'gestor');
create policy "colaboradores_update_gestor" on colaboradores for update
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');
create policy "colaboradores_insert_gestor" on colaboradores for insert
  with check (auth_role() = 'gestor');

-- apontamentos: colaborador só mexe no próprio, e só no dia atual (a UI só
-- permite editar/excluir "hoje" — a policy impõe isso também no banco, pra
-- não depender só da Server Action)
create policy "apontamentos_select_own_or_gestor" on apontamentos for select
  using (colaborador_id = auth.uid() or auth_role() = 'gestor');
create policy "apontamentos_insert_own" on apontamentos for insert
  with check (colaborador_id = auth.uid());
create policy "apontamentos_update_own" on apontamentos for update
  using (colaborador_id = auth.uid() and data = current_date)
  with check (colaborador_id = auth.uid() and data = current_date);
create policy "apontamentos_delete_own" on apontamentos for delete
  using (colaborador_id = auth.uid() and data = current_date);

-- solicitacoes_demandas: gestor vê/aprova tudo; colaborador só cria e
-- acompanha as próprias (sem update/delete pro colaborador — senão ele
-- conseguiria "aprovar" a própria solicitação direto via UPDATE)
create policy "solicitacoes_gestor_all" on solicitacoes_demandas for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');
create policy "solicitacoes_select_own" on solicitacoes_demandas for select
  using (colaborador_id = auth.uid());
create policy "solicitacoes_insert_own_pendente" on solicitacoes_demandas for insert
  with check (colaborador_id = auth.uid() and status = 'PENDENTE');
-- colaborador pode cancelar (excluir) a própria sugestão enquanto pendente
create policy "solicitacoes_delete_own_pendente" on solicitacoes_demandas for delete
  using (colaborador_id = auth.uid() and status = 'PENDENTE');

-- notificacoes: cada um só vê/marca como lida as próprias; nascem só via
-- service role (dentro das server actions que validam o evento de origem)
create policy "notificacoes_select_own" on notificacoes for select
  using (destinatario_id = auth.uid());
create policy "notificacoes_update_own" on notificacoes for update
  using (destinatario_id = auth.uid()) with check (destinatario_id = auth.uid());

-- =========================================================
-- Grants: anon não lê nada (só o fluxo de auth usa a anon key)
-- =========================================================
revoke all on areas, demandas, colaboradores, apontamentos from anon;
revoke all on apontamentos_calculado, indicadores_diarios from anon;
revoke all on solicitacoes_demandas, notificacoes from anon;
grant select on apontamentos_calculado, indicadores_diarios to authenticated, service_role;

-- =========================================================
-- Realtime: sino de notificações assina INSERT em `notificacoes` (a RLS
-- select_own acima já limita o que cada cliente recebe)
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table notificacoes;
  end if;
end $$;

-- =========================================================
-- Kanban: quadros que o gestor cria e vincula colaboradores específicos
-- (estilo Runrun.it) — sem organizações/projetos, reaproveita
-- colaboradores/areas. Ver supabase/migrations/20260723010000_kanban.sql
-- para o histórico completo (trigger de código, policies comentadas).
-- =========================================================

create table quadros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  codigo text not null unique,
  cartao_contador integer not null default 0,
  criado_por uuid references colaboradores(id) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quadros_membros (
  quadro_id uuid references quadros(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) on delete cascade not null,
  adicionado_em timestamptz not null default now(),
  primary key (quadro_id, colaborador_id)
);

create table colunas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  posicao integer not null,
  created_at timestamptz not null default now()
);

create index on colunas (quadro_id, posicao);

create table cartoes (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid references colunas(id) on delete cascade not null,
  titulo text not null,
  descricao text,
  posicao integer not null,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  prazo date,
  codigo text not null, -- gerado pela trigger gerar_codigo_cartao(), ex. "UX-12"
  criado_por uuid references colaboradores(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on cartoes (coluna_id, posicao);

create table cartoes_responsaveis (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) on delete cascade not null,
  primary key (cartao_id, colaborador_id)
);

create table etiquetas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  cor text not null default '#6B7280',
  created_at timestamptz not null default now(),
  unique (quadro_id, nome)
);

create table cartoes_etiquetas (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  etiqueta_id uuid references etiquetas(id) on delete cascade not null,
  primary key (cartao_id, etiqueta_id)
);

create table comentarios_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index on comentarios_cartao (cartao_id, created_at desc);

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

create trigger tr_gerar_codigo_cartao
  before insert on cartoes
  for each row
  execute function public.gerar_codigo_cartao();

alter table quadros enable row level security;
alter table quadros_membros enable row level security;
alter table colunas enable row level security;
alter table cartoes enable row level security;
alter table cartoes_responsaveis enable row level security;
alter table etiquetas enable row level security;
alter table cartoes_etiquetas enable row level security;
alter table comentarios_cartao enable row level security;

-- true se o usuário é gestor OU está vinculado ao quadro (SECURITY DEFINER
-- pra checar quadros_membros sem recursão de RLS, mesmo raciocínio de auth_role())
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

create policy "quadros_select_membro" on quadros for select
  using (is_quadro_membro(id));
create policy "quadros_write_gestor" on quadros for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

create policy "quadros_membros_select" on quadros_membros for select
  using (is_quadro_membro(quadro_id));
create policy "quadros_membros_write_gestor" on quadros_membros for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

-- colunas/cartoes/etiquetas: qualquer membro do quadro gerencia (montar o
-- board é tarefa de time, não só do gestor)
create policy "colunas_all_membro" on colunas for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

create policy "cartoes_all_membro" on cartoes for all
  using (exists (select 1 from colunas col where col.id = cartoes.coluna_id and is_quadro_membro(col.quadro_id)))
  with check (exists (select 1 from colunas col where col.id = cartoes.coluna_id and is_quadro_membro(col.quadro_id)));

create policy "cartoes_responsaveis_all_membro" on cartoes_responsaveis for all
  using (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = cartoes_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
  ))
  with check (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = cartoes_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
  ));

create policy "etiquetas_all_membro" on etiquetas for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

create policy "cartoes_etiquetas_all_membro" on cartoes_etiquetas for all
  using (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = cartoes_etiquetas.cartao_id and is_quadro_membro(col.quadro_id)
  ))
  with check (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = cartoes_etiquetas.cartao_id and is_quadro_membro(col.quadro_id)
  ));

-- comentarios_cartao: membros leem/comentam; só o autor exclui o próprio
create policy "comentarios_select_membro" on comentarios_cartao for select
  using (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = comentarios_cartao.cartao_id and is_quadro_membro(col.quadro_id)
  ));

create policy "comentarios_insert_membro" on comentarios_cartao for insert
  with check (
    colaborador_id = auth.uid()
    and exists (
      select 1 from cartoes c join colunas col on col.id = c.coluna_id
      where c.id = comentarios_cartao.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

create policy "comentarios_delete_own" on comentarios_cartao for delete
  using (colaborador_id = auth.uid());

revoke all on quadros, quadros_membros, colunas, cartoes, cartoes_responsaveis,
  etiquetas, cartoes_etiquetas, comentarios_cartao from anon;

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

-- =========================================================
-- Kanban: formulários públicos (sem login) que criam cartão ao serem
-- enviados. Ver supabase/migrations/20260723020000_kanban_formularios.sql
-- para o histórico completo.
-- =========================================================

alter table cartoes alter column criado_por drop not null;

create table formularios (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  coluna_id uuid references colunas(id) on delete cascade not null,
  titulo text not null,
  descricao text,
  slug text not null unique,
  ativo boolean not null default true,
  cor_tema text not null default '#006652',
  mensagem_sucesso text not null default 'Recebemos sua solicitação — um card já foi criado no nosso quadro.',
  mostrar_marca boolean not null default true,
  criado_por uuid references colaboradores(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on formularios (quadro_id);

create table formularios_campos (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid references formularios(id) on delete cascade not null,
  rotulo text not null,
  tipo text not null check (tipo in ('texto', 'texto_longo', 'selecao', 'data', 'prioridade')),
  placeholder text,
  obrigatorio boolean not null default false,
  posicao integer not null,
  opcoes text[] not null default '{}',
  mapeado_para text not null default 'personalizado'
    check (mapeado_para in ('titulo', 'descricao', 'prazo', 'prioridade', 'personalizado')),
  created_at timestamptz not null default now()
);

create index on formularios_campos (formulario_id, posicao);

alter table formularios enable row level security;
alter table formularios_campos enable row level security;

create policy "formularios_select_publico" on formularios for select
  using (ativo = true or is_quadro_membro(quadro_id));
create policy "formularios_write_membro" on formularios for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

create policy "formularios_campos_select_publico" on formularios_campos for select
  using (exists (
    select 1 from formularios f
    where f.id = formularios_campos.formulario_id
    and (f.ativo = true or is_quadro_membro(f.quadro_id))
  ));
create policy "formularios_campos_write_membro" on formularios_campos for all
  using (exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id)))
  with check (exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id)));

-- RLS sozinha não concede privilégio — precisa do grant explícito também.
-- Restrito a SELECT: a criação de cartão a partir da submissão pública
-- roda pelo client admin numa Server Action, nunca por INSERT direto de anon.
grant select on formularios, formularios_campos to anon;
