-- Trilha de auditoria (docs/MELHORIAS-FUTURAS.md): mudança de carga
-- horária/área/ativo de colaborador e aprovação/rejeição de solicitação
-- não ficavam registradas com "quem fez e quando" — só a notificação (que
-- é pro destinatário, não um log). Mesmo padrão da tabela `notificacoes`:
-- insert só via service_role, sem policy de insert pra authenticated.

begin;

create table if not exists auditoria (
  id uuid primary key default gen_random_uuid(),
  ator_id uuid references colaboradores(id) not null,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists auditoria_criado_em_idx on auditoria (criado_em desc);

alter table auditoria enable row level security;
revoke all on auditoria from anon, authenticated;

drop policy if exists "Gestor le auditoria" on auditoria;
create policy "Gestor le auditoria" on auditoria
  for select to authenticated
  using (auth_role() = 'gestor');

grant select on auditoria to authenticated;

commit;
