-- Central de notificações: tabela genérica (tipo/titulo/mensagem/link),
-- pra hoje cobrir status de solicitacoes_demandas e no futuro também
-- lembrete de apontamento, alerta de queda etc. Idempotente e
-- transacional, como as migrations anteriores.

begin;

create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid references colaboradores(id) not null,
  tipo text not null,
  titulo text not null,
  mensagem text,
  link text,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists notificacoes_destinatario_idx
  on notificacoes (destinatario_id, criado_em desc);

alter table notificacoes enable row level security;
revoke all on notificacoes from anon;

drop policy if exists "Usuario ve as proprias notificacoes" on notificacoes;
create policy "Usuario ve as proprias notificacoes"
on notificacoes
for select
to authenticated
using (destinatario_id = auth.uid());

-- Só pra marcar como lida (toggle no próprio registro). Sem policy de
-- insert/delete: notificações só nascem via service role, dentro das
-- server actions que já validam o evento que as originou (aprovação,
-- rejeição, nova solicitação etc.) — nunca direto pelo client.
drop policy if exists "Usuario marca as proprias notificacoes como lidas" on notificacoes;
create policy "Usuario marca as proprias notificacoes como lidas"
on notificacoes
for update
to authenticated
using (destinatario_id = auth.uid())
with check (destinatario_id = auth.uid());

commit;
