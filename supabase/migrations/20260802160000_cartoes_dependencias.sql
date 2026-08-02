-- F7: "este card esta bloqueado por aquele". Diferente de subtarefa, que e
-- hierarquia; aqui e ordem entre cards do mesmo nivel.
create table if not exists public.cartoes_dependencias (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references public.cartoes(id) on delete cascade,
  depende_de_id uuid not null references public.cartoes(id) on delete cascade,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.colaboradores(id),
  constraint cartoes_dependencias_unica unique (cartao_id, depende_de_id),
  constraint cartoes_dependencias_sem_auto check (cartao_id <> depende_de_id)
);

-- Indice nas duas FKs: as consultas vao nos dois sentidos ("do que este card
-- depende" e "quem depende deste card").
create index if not exists idx_cartoes_dependencias_cartao_id on public.cartoes_dependencias (cartao_id);
create index if not exists idx_cartoes_dependencias_depende_de_id on public.cartoes_dependencias (depende_de_id);
create index if not exists idx_cartoes_dependencias_criado_por on public.cartoes_dependencias (criado_por);

alter table public.cartoes_dependencias enable row level security;
revoke all on public.cartoes_dependencias from anon;

-- Uma politica por acao, nao FOR ALL: FOR ALL cobriria SELECT e ficaria
-- permissiva junto com a de leitura — exatamente o que a migration
-- 20260802140000 acabou de limpar no resto do esquema.
create policy cartoes_dependencias_select_membro on public.cartoes_dependencias
  for select using (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = cartoes_dependencias.cartao_id and is_quadro_membro(col.quadro_id)
  ));
create policy cartoes_dependencias_insert_membro on public.cartoes_dependencias
  for insert with check (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = cartoes_dependencias.cartao_id and is_quadro_membro(col.quadro_id)
  ));
create policy cartoes_dependencias_delete_membro on public.cartoes_dependencias
  for delete using (exists (
    select 1 from cartoes c join colunas col on col.id = c.coluna_id
    where c.id = cartoes_dependencias.cartao_id and is_quadro_membro(col.quadro_id)
  ));
