-- F13: o cron relatorio-semanal e fixo — segunda de manha, sempre a semana
-- anterior, sempre para todo gestor com a preferencia ligada. Estas tabelas
-- deixam o gestor escolher recorte e destinatarios.
--
-- O cron continua no mesmo horario; o que muda e passar a ler daqui em vez de
-- assumir. A preferencia individual (colaboradores.notif_relatorio_semanal)
-- continua valendo como opt-out: quem desligou nao recebe, mesmo listado.
create table if not exists public.relatorios_agendados (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  -- Janela em dias uteis para tras a partir da execucao. 5 = semana anterior,
  -- que e o comportamento de hoje.
  janela_dias_uteis integer not null default 5 check (janela_dias_uteis between 1 and 60),
  -- 1 = segunda, 7 = domingo (ISO).
  dia_semana integer not null default 1 check (dia_semana between 1 and 7),
  -- Nulo = equipe inteira.
  area_id uuid references public.areas(id) on delete cascade,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.colaboradores(id),
  constraint relatorios_agendados_nome_unico unique (nome)
);

-- Sem linha aqui, o relatorio vai para os gestores — comportamento atual e
-- padrao seguro: um agendamento salvo pela metade manda para quem ja recebia,
-- em vez de nao mandar para ninguem.
create table if not exists public.relatorios_agendados_destinatarios (
  relatorio_id uuid not null references public.relatorios_agendados(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  primary key (relatorio_id, colaborador_id)
);

create index if not exists idx_relatorios_agendados_area_id on public.relatorios_agendados (area_id);
create index if not exists idx_relatorios_agendados_criado_por on public.relatorios_agendados (criado_por);
create index if not exists idx_relatorios_dest_colaborador_id on public.relatorios_agendados_destinatarios (colaborador_id);

alter table public.relatorios_agendados enable row level security;
alter table public.relatorios_agendados_destinatarios enable row level security;
revoke all on public.relatorios_agendados from anon;
revoke all on public.relatorios_agendados_destinatarios from anon;

create policy relatorios_select_autenticado on public.relatorios_agendados
  for select using ((select auth.uid()) is not null);
create policy relatorios_insert_gestor on public.relatorios_agendados
  for insert with check ((select auth_role()) = 'gestor');
create policy relatorios_update_gestor on public.relatorios_agendados
  for update using ((select auth_role()) = 'gestor') with check ((select auth_role()) = 'gestor');
create policy relatorios_delete_gestor on public.relatorios_agendados
  for delete using ((select auth_role()) = 'gestor');

create policy relatorios_dest_select_autenticado on public.relatorios_agendados_destinatarios
  for select using ((select auth.uid()) is not null);
create policy relatorios_dest_insert_gestor on public.relatorios_agendados_destinatarios
  for insert with check ((select auth_role()) = 'gestor');
create policy relatorios_dest_delete_gestor on public.relatorios_agendados_destinatarios
  for delete using ((select auth_role()) = 'gestor');
