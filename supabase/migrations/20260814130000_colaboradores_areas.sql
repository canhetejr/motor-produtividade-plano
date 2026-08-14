-- Colaborador em mais de uma área.
--
-- Hoje `colaboradores.area_id` é uma coluna só, e é ela que decide qual
-- catálogo de demandas a pessoa enxerga em /apontamento. Quem atua em duas
-- frentes precisa que alguém troque a área dela no cadastro para lançar do
-- outro lado — e aí some do primeiro.
--
-- O que este bloco NÃO faz, de propósito: substituir `area_id`. Aquela
-- coluna continua sendo a área PRINCIPAL, e é ela que agrupa relatório,
-- meta por área, dashboard, heatmap e import/export. Trocar tudo isso por
-- N:N é um projeto por si só, e não é o que falta para a pessoa conseguir
-- apontar. Aqui entram só as áreas ADICIONAIS.

begin;

create table if not exists public.colaboradores_areas (
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  colaborador_id uuid not null,
  area_id uuid not null,
  criado_em timestamptz not null default now(),
  primary key (colaborador_id, area_id),

  -- FKs compostas (skill vertice-isolamento, regra 3): sem elas, nada
  -- estruturalmente impede um vínculo entre o colaborador da org A e a área
  -- da org B — e um vínculo desses é, literalmente, dar a alguém o catálogo
  -- de outro cliente. MATCH SIMPLE (padrão): as duas colunas são NOT NULL.
  constraint colaboradores_areas_colaborador_org
    foreign key (colaborador_id, organizacao_id)
    references public.colaboradores (id, organizacao_id) on delete cascade,
  constraint colaboradores_areas_area_org
    foreign key (area_id, organizacao_id)
    references public.areas (id, organizacao_id) on delete cascade
);

-- A PK começa por colaborador_id, então não serve à política do eixo.
create index if not exists colaboradores_areas_organizacao_idx
  on public.colaboradores_areas (organizacao_id);
create index if not exists colaboradores_areas_area_idx
  on public.colaboradores_areas (area_id);

alter table public.colaboradores_areas enable row level security;
revoke all on public.colaboradores_areas from anon;

create policy "colaboradores_areas_org" on public.colaboradores_areas
  as restrictive for all
  to authenticated
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

-- Leitura para todos: a própria pessoa precisa saber em que áreas está, e o
-- gestor precisa ver o vínculo de todo mundo ao montar a equipe.
create policy colaboradores_areas_select on public.colaboradores_areas
  for select to authenticated using ((select auth.uid()) is not null);
create policy colaboradores_areas_insert_gestor on public.colaboradores_areas
  for insert to authenticated with check ((select public.auth_role()) = 'gestor');
create policy colaboradores_areas_delete_gestor on public.colaboradores_areas
  for delete to authenticated using ((select public.auth_role()) = 'gestor');

grant select, insert, delete on public.colaboradores_areas to authenticated;

-- Backfill: a área principal de cada um vira também um vínculo explícito.
-- Sem isto, `areas_do_colaborador` teria que tratar a principal como caso
-- especial em toda consulta — e é o tipo de exceção que uma delas esquece.
insert into public.colaboradores_areas (organizacao_id, colaborador_id, area_id)
select c.organizacao_id, c.id, c.area_id
from public.colaboradores c
where c.area_id is not null
on conflict (colaborador_id, area_id) do nothing;

commit;

begin;

-- ---------------------------------------------------------------------
-- Áreas de uma pessoa, principal incluída.
--
-- SECURITY INVOKER (o padrão): a política do eixo de colaboradores_areas já
-- cobre a organização, e uma DEFINER aqui teria que refazer essa checagem à
-- mão sem ganhar nada — a função não precisa ver nada que quem chama não
-- veja. STABLE porque só lê.
--
-- O `union` com a área principal é cinto e suspensório depois do backfill,
-- mas garante que trocar a área principal de alguém tenha efeito imediato,
-- sem depender de a aplicação lembrar de gravar o vínculo junto.
-- ---------------------------------------------------------------------
create or replace function public.areas_do_colaborador(p_colaborador_id uuid)
returns setof uuid
language sql
stable
set search_path = public
as $$
  select area_id from public.colaboradores_areas
  where colaborador_id = p_colaborador_id
  union
  select area_id from public.colaboradores
  where id = p_colaborador_id and area_id is not null
$$;

revoke all on function public.areas_do_colaborador(uuid) from public, anon;
grant execute on function public.areas_do_colaborador(uuid) to authenticated;

commit;
