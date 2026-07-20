-- Idempotente e em transação única: pode ser re-executada com segurança
-- mesmo que uma tentativa anterior tenha parado no meio (ex: "type already
-- exists" ao rodar de novo depois de uma falha parcial).

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_solicitacao') then
    create type tipo_solicitacao as enum ('NOVA', 'ALTERACAO');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_solicitacao') then
    create type status_solicitacao as enum ('PENDENTE', 'APROVADA', 'REJEITADA');
  end if;
end $$;

create table if not exists solicitacoes_demandas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references colaboradores(id) not null,
  area_id uuid references areas(id) not null,
  demanda_id uuid references demandas(id), -- Null if 'NOVA'
  tipo tipo_solicitacao not null,

  -- Campos propostos
  nome text not null,
  tempo_padrao_min integer,
  variavel boolean not null default false,
  blocos_totais integer not null default 1,
  ativo boolean,

  status status_solicitacao not null default 'PENDENTE',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- RLS
alter table solicitacoes_demandas enable row level security;

drop policy if exists "Gestores podem ver tudo" on solicitacoes_demandas;
create policy "Gestores podem ver tudo"
on solicitacoes_demandas
for all
to authenticated
using (
  exists (
    select 1 from colaboradores c
    where c.id = auth.uid() and c.role = 'gestor'
  )
)
with check (
  exists (
    select 1 from colaboradores c
    where c.id = auth.uid() and c.role = 'gestor'
  )
);

-- Colaborador só solicita e acompanha; só o gestor aprova/rejeita (policy
-- acima). Sem update/delete aqui: senão o colaborador conseguiria aprovar
-- a própria solicitação direto via UPDATE, sem passar pelo gestor.
drop policy if exists "Colaboradores podem gerenciar as proprias solicitacoes" on solicitacoes_demandas;

drop policy if exists "Colaboradores podem ver as proprias solicitacoes" on solicitacoes_demandas;
create policy "Colaboradores podem ver as proprias solicitacoes"
on solicitacoes_demandas
for select
to authenticated
using (
  colaborador_id = auth.uid()
);

drop policy if exists "Colaboradores podem criar solicitacoes pendentes" on solicitacoes_demandas;
create policy "Colaboradores podem criar solicitacoes pendentes"
on solicitacoes_demandas
for insert
to authenticated
with check (
  colaborador_id = auth.uid()
  and status = 'PENDENTE'
);

commit;
