-- "Requisitos da etapa": checklist preso à COLUNA (etapa), não ao card —
-- todo card que passa por aquela coluna vê a mesma lista de requisitos e
-- marca individualmente o que já cumpriu (cartoes_requisitos_status).

begin;

create table if not exists colunas_requisitos (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid references colunas(id) on delete cascade not null,
  descricao text not null,
  obrigatorio boolean not null default true,
  posicao integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists colunas_requisitos_coluna_idx on colunas_requisitos (coluna_id, posicao);

create table if not exists cartoes_requisitos_status (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  requisito_id uuid references colunas_requisitos(id) on delete cascade not null,
  concluido boolean not null default false,
  concluido_em timestamptz,
  primary key (cartao_id, requisito_id)
);

commit;

begin;

alter table colunas_requisitos enable row level security;
alter table cartoes_requisitos_status enable row level security;

drop policy if exists "colunas_requisitos_all_membro" on colunas_requisitos;
create policy "colunas_requisitos_all_membro" on colunas_requisitos for all
  using (exists (select 1 from colunas col where col.id = colunas_requisitos.coluna_id and is_quadro_membro(col.quadro_id)))
  with check (exists (select 1 from colunas col where col.id = colunas_requisitos.coluna_id and is_quadro_membro(col.quadro_id)));

drop policy if exists "cartoes_requisitos_status_all_membro" on cartoes_requisitos_status;
create policy "cartoes_requisitos_status_all_membro" on cartoes_requisitos_status for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_requisitos_status.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_requisitos_status.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on colunas_requisitos, cartoes_requisitos_status from anon;

commit;
