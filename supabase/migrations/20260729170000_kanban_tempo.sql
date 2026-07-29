-- Timer de card: sessões com início/fim. Um colaborador só pode ter UMA
-- sessão aberta (finalizado_em is null) por vez, em qualquer card — é o que
-- sustenta o widget flutuante global (app/(app)/layout.tsx): sempre há no
-- máximo uma sessão "rodando" pra mostrar. "Tempo nesta tarefa" (soma
-- logada vs. tempo_estimado_min do card) é a soma de `minutos` das sessões
-- fechadas + o elapsed da sessão aberta (calculado no client).
--
-- Realtime habilitado pra o widget refletir play/pause entre abas/dispositivos
-- do mesmo usuário (mesmo padrão de cartoes/colunas, ver 20260723010000_kanban.sql).

begin;

create table if not exists cartoes_sessoes_tempo (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  minutos integer,
  check (finalizado_em is null or minutos is not null)
);

create index if not exists cartoes_sessoes_tempo_cartao_idx on cartoes_sessoes_tempo (cartao_id);
create unique index if not exists cartoes_sessoes_tempo_uma_aberta_idx
  on cartoes_sessoes_tempo (colaborador_id)
  where finalizado_em is null;

commit;

begin;

alter table cartoes_sessoes_tempo enable row level security;

drop policy if exists "cartoes_sessoes_tempo_select_membro" on cartoes_sessoes_tempo;
create policy "cartoes_sessoes_tempo_select_membro" on cartoes_sessoes_tempo for select
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sessoes_tempo.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "cartoes_sessoes_tempo_write_own" on cartoes_sessoes_tempo;
create policy "cartoes_sessoes_tempo_write_own" on cartoes_sessoes_tempo for all
  using (colaborador_id = auth.uid())
  with check (
    colaborador_id = auth.uid()
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sessoes_tempo.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on cartoes_sessoes_tempo from anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'cartoes_sessoes_tempo'
  ) then
    alter publication supabase_realtime add table cartoes_sessoes_tempo;
  end if;
end $$;

commit;
