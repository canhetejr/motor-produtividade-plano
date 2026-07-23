-- =====================================================================
-- Formulários públicos que criam cartão automaticamente (estilo Runrun.it/
-- Kamban original): gestor/membro do quadro monta um formulário vinculado
-- a uma coluna específica, gera um link público (sem login), e cada envio
-- vira um cartão novo naquela coluna — útil pra intake de demandas
-- externas (ex. "solicitar suporte", "pedir peça de design").
--
-- Diferente do resto do módulo Kanban: aqui o escritor final do cartão é
-- um visitante anônimo, não um colaborador logado. Por isso:
--   1. `cartoes.criado_por` precisa aceitar null (visitante não tem
--      colaborador_id).
--   2. A leitura do formulário ativo precisa de GRANT explícito pra
--      `anon` (RLS sozinha não basta — o grant e a policy são checados
--      em conjunto).
--   3. A criação do cartão a partir da submissão roda pelo client admin
--      (service role, bypassa RLS) numa Server Action — igual ao padrão
--      já usado em `colaboradores/actions.ts` pra criar contas. Não dá
--      pra abrir uma policy de INSERT em `cartoes` pra `anon`: qualquer
--      um poderia inserir cartão em QUALQUER coluna de QUALQUER quadro
--      só sabendo o UUID da coluna.
-- =====================================================================

begin;

alter table cartoes alter column criado_por drop not null;

create table if not exists formularios (
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

create index if not exists formularios_quadro_idx on formularios (quadro_id);

create table if not exists formularios_campos (
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

create index if not exists formularios_campos_formulario_idx on formularios_campos (formulario_id, posicao);

commit;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

begin;

alter table formularios enable row level security;
alter table formularios_campos enable row level security;

-- Visitante anônimo só lê formulário ativo (a página pública precisa
-- disso); membros do quadro veem todos (ativos ou não) pra gerenciar.
drop policy if exists "formularios_select_publico" on formularios;
create policy "formularios_select_publico" on formularios for select
  using (ativo = true or is_quadro_membro(quadro_id));

drop policy if exists "formularios_write_membro" on formularios;
create policy "formularios_write_membro" on formularios for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

drop policy if exists "formularios_campos_select_publico" on formularios_campos;
create policy "formularios_campos_select_publico" on formularios_campos for select
  using (
    exists (
      select 1 from formularios f
      where f.id = formularios_campos.formulario_id
      and (f.ativo = true or is_quadro_membro(f.quadro_id))
    )
  );

drop policy if exists "formularios_campos_write_membro" on formularios_campos;
create policy "formularios_campos_write_membro" on formularios_campos for all
  using (
    exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id))
  )
  with check (
    exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id))
  );

-- anon precisa do GRANT além da policy (RLS só filtra linhas, não concede
-- privilégio) — restrito a SELECT, nunca INSERT/UPDATE/DELETE.
grant select on formularios, formularios_campos to anon;

commit;
