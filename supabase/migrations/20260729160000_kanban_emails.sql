-- Aba "Emails": envio avulso a partir do card (usa lib/email.ts, já
-- existente) com log persistido. Não é caixa de entrada bidirecional (sem
-- infra de IMAP/webhook) — só "enviei isso, daqui".

begin;

create table if not exists cartoes_emails (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  destinatario text not null,
  assunto text not null,
  corpo text not null,
  enviado_em timestamptz not null default now()
);

create index if not exists cartoes_emails_cartao_idx on cartoes_emails (cartao_id, enviado_em desc);

commit;

begin;

alter table cartoes_emails enable row level security;

drop policy if exists "cartoes_emails_all_membro" on cartoes_emails;
create policy "cartoes_emails_all_membro" on cartoes_emails for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_emails.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    colaborador_id = auth.uid()
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_emails.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on cartoes_emails from anon;

commit;
