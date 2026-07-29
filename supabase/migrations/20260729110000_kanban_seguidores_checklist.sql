-- Seguidores (watchers, distintos de responsáveis — só recebem notificação,
-- não são cobrados pela entrega) e checklist simples por card.

begin;

create table if not exists cartoes_seguidores (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) on delete cascade not null,
  criado_em timestamptz not null default now(),
  primary key (cartao_id, colaborador_id)
);

create table if not exists cartoes_checklist_itens (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  texto text not null,
  concluido boolean not null default false,
  posicao integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cartoes_checklist_cartao_idx on cartoes_checklist_itens (cartao_id, posicao);

commit;

begin;

alter table cartoes_seguidores enable row level security;
alter table cartoes_checklist_itens enable row level security;

drop policy if exists "cartoes_seguidores_all_membro" on cartoes_seguidores;
create policy "cartoes_seguidores_all_membro" on cartoes_seguidores for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_seguidores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_seguidores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "cartoes_checklist_all_membro" on cartoes_checklist_itens;
create policy "cartoes_checklist_all_membro" on cartoes_checklist_itens for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_checklist_itens.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_checklist_itens.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on cartoes_seguidores, cartoes_checklist_itens from anon;

commit;
