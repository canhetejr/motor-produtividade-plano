-- =====================================================================
-- Consolidado de TODAS as migrations pendentes no banco real
-- (bapufbypqmtjtujfbiai, fora do alcance do conector MCP). Assume que
-- 0001_baseline.sql e 0002_fix_rls_views_grants.sql já foram aplicadas
-- (são bootstrap/histórico e não devem ser re-rodadas — ver aviso no
-- topo de 0001_baseline.sql).
--
-- Cada bloco é idempotente e transacional por conta própria (na mesma
-- ordem cronológica dos arquivos originais em supabase/migrations/), então
-- rodar este arquivo inteiro de uma vez é equivalente a rodar todos os
-- arquivos originais em sequência — inclusive se alguns já tiverem sido
-- aplicados antes: cada bloco usa IF NOT EXISTS/OR REPLACE/DROP...IF
-- EXISTS, então repetir um bloco já aplicado é um no-op seguro. Se algo
-- falhar no meio, os blocos anteriores já commitados continuam válidos —
-- não precisa re-rodar tudo, só retomar a partir do bloco que falhou.
--
-- Arquivos de origem (mantidos em supabase/migrations/ como registro
-- histórico — não precisam ser rodados de novo depois deste script):
--   1. 20260720225916_solicitacoes_demandas.sql
--   2. 20260721000000_notificacoes.sql
--   3. 20260721013000_apontamentos_rls_data_atual.sql
--   4. 20260721014500_areas_ativo.sql
--   5. 20260721030000_apontamentos_motivo.sql
--   6. 20260721031500_solicitacoes_cancelar_pendente.sql
--   7. 20260721033000_notificacoes_realtime.sql
--   8. 20260721040000_apontamentos_calculado_motivo.sql
--   9. 20260721060000_perfil_avatar_notif_prefs.sql
--  10. 20260721070000_apontamentos_snapshot_travas.sql
--  11. 20260722010000_apontamentos_insert_data_atual.sql
--  12. 20260722015000_auth_role_ativo.sql
--  13. 20260722020000_apontamentos_registrar_rpc.sql
--  14. 20260722030000_solicitacoes_aprovar_rejeitar_rpc.sql
--  15. 20260722040000_cron_execucoes.sql
--  16. 20260722050000_apontamentos_atualizar_rpc.sql
--  17. 20260722060000_auditoria.sql
--  18. 20260722070000_demandas_finita.sql
--  19. 20260723010000_kanban.sql
--  20. 20260723020000_kanban_formularios.sql
--  21. 20260729100000_kanban_cartoes_campos_novos.sql
--  22. 20260729110000_kanban_seguidores_checklist.sql
--  23. 20260729120000_kanban_requisitos_etapa.sql
--  24. 20260729130000_kanban_regras_dependencias.sql
--  25. 20260729140000_kanban_anexos.sql
--  26. 20260729150000_kanban_aprovacoes.sql
--  27. 20260729160000_kanban_emails.sql
--  28. 20260729170000_kanban_tempo.sql
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 20260720225916_solicitacoes_demandas.sql
--
-- Colaborador sugere demanda nova/alteração; gestor aprova ou rejeita.
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- 2. 20260721000000_notificacoes.sql
--
-- Central de notificações genérica (sino no layout autenticado).
-- ---------------------------------------------------------------------

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

drop policy if exists "Usuario marca as proprias notificacoes como lidas" on notificacoes;
create policy "Usuario marca as proprias notificacoes como lidas"
on notificacoes
for update
to authenticated
using (destinatario_id = auth.uid())
with check (destinatario_id = auth.uid());

commit;


-- ---------------------------------------------------------------------
-- 3. 20260721013000_apontamentos_rls_data_atual.sql
--
-- A regra "colaborador só edita/exclui apontamento do dia atual" vivia só
-- na Server Action, não na policy. Como o client Supabase do browser usa
-- a mesma sessão do usuário, dava pra chamar update/delete direto pela
-- API REST e reescrever apontamentos de qualquer dia passado.
-- ---------------------------------------------------------------------

begin;

drop policy if exists "apontamentos_update_own" on apontamentos;
create policy "apontamentos_update_own" on apontamentos for update
  using (colaborador_id = auth.uid() and data = current_date)
  with check (colaborador_id = auth.uid() and data = current_date);

drop policy if exists "apontamentos_delete_own" on apontamentos;
create policy "apontamentos_delete_own" on apontamentos for delete
  using (colaborador_id = auth.uid() and data = current_date);

commit;


-- ---------------------------------------------------------------------
-- 4. 20260721014500_areas_ativo.sql
--
-- Áreas não tinham campo `ativo` (diferente de demandas) — uma área
-- obsoleta só podia ser renomeada, nunca retirada dos seletores de
-- cadastro.
-- ---------------------------------------------------------------------

begin;

alter table areas add column if not exists ativo boolean not null default true;

commit;


-- ---------------------------------------------------------------------
-- 5. 20260721030000_apontamentos_motivo.sql
--
-- "Outros" (demanda variável) ganha um motivo obrigatório de uma lista
-- fixa (lib/motivos-outros.ts) — dá visibilidade ao gestor de pra onde
-- está indo o tempo não padronizado.
-- ---------------------------------------------------------------------

begin;

alter table apontamentos add column if not exists motivo text;

commit;


-- ---------------------------------------------------------------------
-- 6. 20260721031500_solicitacoes_cancelar_pendente.sql
--
-- Colaborador não conseguia retirar uma sugestão enviada por engano — só
-- dava pra esperar o gestor aprovar/rejeitar.
-- ---------------------------------------------------------------------

begin;

drop policy if exists "solicitacoes_delete_own_pendente" on solicitacoes_demandas;
create policy "solicitacoes_delete_own_pendente" on solicitacoes_demandas for delete
  using (colaborador_id = auth.uid() and status = 'PENDENTE');

commit;


-- ---------------------------------------------------------------------
-- 7. 20260721033000_notificacoes_realtime.sql
--
-- Sino de notificações trocou polling de 60s por Supabase Realtime —
-- precisa da tabela na publication padrão. ADD TABLE não aceita
-- IF NOT EXISTS, então checa pg_publication_tables antes.
-- ---------------------------------------------------------------------

begin;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table notificacoes;
  end if;
end $$;

commit;


-- ---------------------------------------------------------------------
-- 8. 20260721040000_apontamentos_calculado_motivo.sql
--
-- A view apontamentos_calculado usava "a.*", que o Postgres expande em
-- tempo de criação — adicionar a coluna `motivo` na tabela base (bloco 5
-- acima) não propaga sozinho pra view. CREATE OR REPLACE VIEW exige que
-- colunas existentes mantenham nome e posição, por isso listamos as
-- colunas originais explicitamente e acrescentamos `motivo` só no final.
--
-- Esta definição é substituída de novo pelo bloco 10 (snapshot) — mantida
-- aqui só para preservar a ordem cronológica real das migrations; rodar
-- os dois em sequência dá no mesmo resultado final do bloco 10.
-- ---------------------------------------------------------------------

begin;

create or replace view apontamentos_calculado
with (security_invoker = true) as
select
  a.id,
  a.colaborador_id,
  a.demanda_id,
  a.data,
  a.quantidade,
  a.tempo_manual_min,
  a.observacoes,
  a.created_at,
  d.area_id,
  case
    when d.variavel then coalesce(a.tempo_manual_min, 0)
    else round(coalesce(d.tempo_padrao_min, 0) * a.quantidade
               / greatest(coalesce(d.blocos_totais, 1), 1))
  end as tempo_total_min,
  a.motivo
from apontamentos a
join demandas d on d.id = a.demanda_id;

commit;


-- ---------------------------------------------------------------------
-- 9. 20260721060000_perfil_avatar_notif_prefs.sql
--
-- Tela de Perfil ganhou foto e preferências de notificação. Bucket
-- "avatars" público (leitura sem auth via URL pública). O upload em si
-- nunca passa pelo client do browser, só por Server Action com o client
-- admin (SUPABASE_SERVICE_ROLE_KEY), então não precisa de policy de
-- INSERT/UPDATE em storage.objects: quem decide o path (sempre
-- "{user_id}/avatar", travado no id da sessão) é o código do servidor,
-- não uma policy de RLS.
--
-- notif_* controlam o que cada colaborador recebe: notif_lembrete_diario
-- e notif_alerta_queda/notif_relatorio_semanal são e-mails dos crons;
-- notif_solicitacoes cobre as notificações in-app de aprovação de
-- demandas (pendente pro gestor, aprovada/rejeitada pro colaborador que
-- sugeriu).
-- ---------------------------------------------------------------------

begin;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

alter table colaboradores add column if not exists avatar_url text;
alter table colaboradores add column if not exists notif_lembrete_diario boolean not null default true;
alter table colaboradores add column if not exists notif_solicitacoes boolean not null default true;
alter table colaboradores add column if not exists notif_alerta_queda boolean not null default true;
alter table colaboradores add column if not exists notif_relatorio_semanal boolean not null default true;

commit;


-- ---------------------------------------------------------------------
-- 10. 20260721070000_apontamentos_snapshot_travas.sql
--
-- Fase 1 da confiabilidade: congela o cálculo no momento do lançamento
-- (snapshot) e trava a quantidade de blocos no próprio banco.
--
-- PROBLEMA 1 — histórico se reescrevia sozinho:
--   apontamentos_calculado derivava tempo_total_min de demandas.tempo_padrao_min
--   e demandas.blocos_totais ATUAIS. Editar uma demanda (ou aprovar uma
--   solicitação de ALTERACAO) reescrevia retroativamente o tempo de todo o
--   histórico daquela demanda. Agora cada apontamento guarda tempo_padrao e
--   blocos do instante do lançamento, e a view calcula a partir desse snapshot.
--   Edições de catálogo passam a valer só dali pra frente.
--
-- PROBLEMA 2 — blocos sem teto:
--   nada impedia lançar "100 de 4 blocos". O CHECK abaixo trava
--   quantidade > blocos_totais no banco, não só na Server Action.
--
-- Nota: o "ADD CONSTRAINT" original não checava se a constraint já
-- existia (achado do relatório de conferência — migration não era
-- plenamente idempotente); aqui isso é corrigido com um bloco DO
-- defensivo, pra este arquivo poder ser re-executado com segurança.
-- ---------------------------------------------------------------------

begin;

-- 1. Snapshot dos valores da demanda, congelados no lançamento.
alter table apontamentos
  add column if not exists tempo_padrao_snapshot integer,
  add column if not exists blocos_totais_snapshot integer not null default 1;

-- Backfill: congela o histórico existente no valor ATUAL da demanda. É um
-- freeze único — a partir daqui esses números não mudam mais sozinhos. Demanda
-- variável não usa snapshot (o tempo vem de tempo_manual_min), então deixa
-- tempo_padrao_snapshot nulo e blocos = 1 pra não disparar o CHECK à toa.
update apontamentos a
set tempo_padrao_snapshot = case when d.variavel then null else d.tempo_padrao_min end,
    blocos_totais_snapshot = case when d.variavel then 1
                                  else greatest(coalesce(d.blocos_totais, 1), 1) end
from demandas d
where d.id = a.demanda_id
  and a.tempo_padrao_snapshot is null;

-- 2. Trava de blocos. Para demanda em blocos (snapshot > 1) a quantidade não
-- pode passar do total de blocos. Demanda comum (snapshot = 1) segue com
-- quantidade livre — ali quantidade é multiplicador de repetições, não bloco.
--   NOT VALID de propósito: lançamentos antigos, feitos antes desta trava,
--   podem já violar a regra; não queremos abortar a migration por causa deles.
--   A regra vale para tudo que for inserido/atualizado daqui pra frente.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'apontamentos_quantidade_ate_blocos'
      and conrelid = 'apontamentos'::regclass
  ) then
    alter table apontamentos
      add constraint apontamentos_quantidade_ate_blocos
      check (blocos_totais_snapshot <= 1 or quantidade <= blocos_totais_snapshot)
      not valid;
  end if;
end $$;

-- 3. View recalculada a partir do snapshot do apontamento (não mais da demanda).
--   "variável" é identificado por tempo_manual_min preenchido: a Server Action
--   exige o tempo manual para demanda variável e nunca o preenche para as
--   demais, então isso separa os dois casos sem depender de demandas.variavel.
--   Colunas listadas explícitas e na mesma ordem/nome das anteriores (regra do
--   CREATE OR REPLACE VIEW — só permite acrescentar coluna no final).
create or replace view apontamentos_calculado
with (security_invoker = true) as
select
  a.id,
  a.colaborador_id,
  a.demanda_id,
  a.data,
  a.quantidade,
  a.tempo_manual_min,
  a.observacoes,
  a.created_at,
  d.area_id,
  case
    when a.tempo_manual_min is not null then a.tempo_manual_min
    else round(coalesce(a.tempo_padrao_snapshot, 0) * a.quantidade
               / greatest(coalesce(a.blocos_totais_snapshot, 1), 1))
  end as tempo_total_min,
  a.motivo
from apontamentos a
join demandas d on d.id = a.demanda_id;

commit;


-- ---------------------------------------------------------------------
-- 11. 20260722010000_apontamentos_insert_data_atual.sql
--
-- A policy de INSERT em apontamentos só checava colaborador_id = auth.uid(),
-- diferente de UPDATE/DELETE (bloco 3), que já exigem data = current_date.
-- Sem isso, um colaborador podia inserir apontamento em qualquer data via
-- API REST direta, contornando a regra "só lança hoje" da Server Action.
-- ---------------------------------------------------------------------

begin;

drop policy if exists "apontamentos_insert_own" on apontamentos;
create policy "apontamentos_insert_own" on apontamentos for insert
  with check (colaborador_id = auth.uid() and data = current_date);

commit;


-- ---------------------------------------------------------------------
-- 12. 20260722015000_auth_role_ativo.sql
--
-- auth_role() não checava colaboradores.ativo — um gestor desativado
-- continuava passando em toda policy "gestor-only" enquanto a sessão Auth
-- continuasse válida. Defesa em profundidade no banco (a correção
-- principal é em app, lib/auth.ts: requireUser() agora derruba sessão de
-- conta inativa). Não cobre policies "colaborador_id = auth.uid()"
-- (independem de role) — essas dependem só da correção em app.
-- ---------------------------------------------------------------------

begin;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.colaboradores where id = auth.uid() and ativo = true
$$;

commit;


-- ---------------------------------------------------------------------
-- 13. 20260722020000_apontamentos_registrar_rpc.sql
--
-- Mesmo com o bloco 11 (RLS exige data = current_date), nada validava
-- motivo/teto de blocos/tempo manual/demanda ativa num INSERT direto via
-- REST — só a Server Action validava. registrar_apontamento() (SECURITY
-- DEFINER) replica essas regras no banco e vira o único caminho de
-- escrita: revoga INSERT direto de `authenticated` no final.
-- ---------------------------------------------------------------------

begin;

create or replace function public.registrar_apontamento(
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colaborador_id uuid := auth.uid();
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_row apontamentos;
begin
  if v_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min into v_carga_horaria_min
  from colaboradores
  where id = v_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  select variavel, tempo_padrao_min, blocos_totais, ativo
  into v_demanda
  from demandas
  where id = p_demanda_id;

  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  if v_demanda.variavel then
    if p_tempo_manual_min is null or p_tempo_manual_min <= 0 then
      raise exception 'TEMPO_OBRIGATORIO';
    end if;
    if p_tempo_manual_min > v_carga_horaria_min then
      raise exception 'TEMPO_EXCEDE_CARGA';
    end if;
    if v_motivo is null or v_motivo not in
      ('Reunião', 'Treinamento', 'Suporte a colega', 'Retrabalho', 'Imprevisto', 'Outro')
    then
      raise exception 'MOTIVO_INVALIDO';
    end if;
    if v_motivo = 'Outro' and coalesce(trim(p_observacoes), '') = '' then
      raise exception 'OBSERVACAO_OBRIGATORIA';
    end if;
  else
    v_motivo := null;
    if v_demanda.tempo_padrao_min is null then
      raise exception 'DEMANDA_SEM_TEMPO_PADRAO';
    end if;
    if v_demanda.blocos_totais > 1 and p_quantidade > v_demanda.blocos_totais then
      raise exception 'BLOCOS_EXCEDIDOS';
    end if;
  end if;

  insert into apontamentos (
    colaborador_id, demanda_id, quantidade, tempo_manual_min, motivo, observacoes,
    data, tempo_padrao_snapshot, blocos_totais_snapshot
  ) values (
    v_colaborador_id, p_demanda_id, p_quantidade, p_tempo_manual_min, v_motivo, p_observacoes,
    current_date,
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.registrar_apontamento(uuid, numeric, integer, text, text) from public;
grant execute on function public.registrar_apontamento(uuid, numeric, integer, text, text) to authenticated;

revoke insert on public.apontamentos from authenticated;

commit;


-- ---------------------------------------------------------------------
-- 14. 20260722030000_solicitacoes_aprovar_rejeitar_rpc.sql
--
-- aprovarSolicitacao/rejeitarSolicitacao faziam de 4 a 5 chamadas separadas
-- ao Supabase; se caísse no meio, podia sobrar solicitação "APROVADA" sem
-- demanda correspondente, ou notificação perdida. aprovar_solicitacao()/
-- rejeitar_solicitacao() (SECURITY DEFINER) movem tudo pra uma única
-- transação — um RAISE EXCEPTION desfaz tudo da mesma invocação.
-- ---------------------------------------------------------------------

begin;

create or replace function public.aprovar_solicitacao(p_id uuid)
returns solicitacoes_demandas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitacoes_demandas;
  v_tempo_padrao_min integer;
  v_blocos_totais integer;
  v_gestor_ativo boolean;
begin
  select ativo into v_gestor_ativo
  from colaboradores
  where id = auth.uid() and role = 'gestor';

  if v_gestor_ativo is not true then
    raise exception 'NAO_AUTORIZADO';
  end if;

  update solicitacoes_demandas
  set status = 'APROVADA', atualizado_em = now()
  where id = p_id and status = 'PENDENTE'
  returning * into v_sol;

  if v_sol.id is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA';
  end if;

  if v_sol.variavel then
    v_tempo_padrao_min := null;
    v_blocos_totais := 1;
  else
    v_tempo_padrao_min := v_sol.tempo_padrao_min;
    v_blocos_totais := greatest(coalesce(v_sol.blocos_totais, 1), 1);
    if v_blocos_totais > 1 and v_tempo_padrao_min is null then
      raise exception 'DEMANDA_BLOCOS_SEM_TEMPO';
    end if;
  end if;

  if v_sol.tipo = 'NOVA' then
    insert into demandas (area_id, nome, tempo_padrao_min, variavel, blocos_totais, ativo)
    values (v_sol.area_id, v_sol.nome, v_tempo_padrao_min, v_sol.variavel, v_blocos_totais, true);
  elsif v_sol.tipo = 'ALTERACAO' then
    if v_sol.demanda_id is null then
      raise exception 'ALTERACAO_SEM_DEMANDA';
    end if;
    update demandas
    set nome = v_sol.nome,
        tempo_padrao_min = v_tempo_padrao_min,
        variavel = v_sol.variavel,
        blocos_totais = v_blocos_totais,
        ativo = coalesce(v_sol.ativo, true)
    where id = v_sol.demanda_id;
  end if;

  if exists (
    select 1 from colaboradores
    where id = v_sol.colaborador_id and notif_solicitacoes = true
  ) then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
    values (
      v_sol.colaborador_id, 'solicitacao_aprovada', 'Solicitação aprovada',
      'Sua sugestão "' || v_sol.nome || '" foi aprovada.', '/catalogo?tab=solicitacoes'
    );
  end if;

  return v_sol;
exception
  when unique_violation then
    raise exception 'NOME_DUPLICADO';
end;
$$;

create or replace function public.rejeitar_solicitacao(p_id uuid)
returns solicitacoes_demandas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitacoes_demandas;
  v_gestor_ativo boolean;
begin
  select ativo into v_gestor_ativo
  from colaboradores
  where id = auth.uid() and role = 'gestor';

  if v_gestor_ativo is not true then
    raise exception 'NAO_AUTORIZADO';
  end if;

  update solicitacoes_demandas
  set status = 'REJEITADA', atualizado_em = now()
  where id = p_id and status = 'PENDENTE'
  returning * into v_sol;

  if v_sol.id is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA';
  end if;

  if exists (
    select 1 from colaboradores
    where id = v_sol.colaborador_id and notif_solicitacoes = true
  ) then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
    values (
      v_sol.colaborador_id, 'solicitacao_rejeitada', 'Solicitação rejeitada',
      'Sua sugestão "' || v_sol.nome || '" foi rejeitada.', '/catalogo?tab=solicitacoes'
    );
  end if;

  return v_sol;
end;
$$;

revoke all on function public.aprovar_solicitacao(uuid) from public;
grant execute on function public.aprovar_solicitacao(uuid) to authenticated;

revoke all on function public.rejeitar_solicitacao(uuid) from public;
grant execute on function public.rejeitar_solicitacao(uuid) to authenticated;

commit;


-- ---------------------------------------------------------------------
-- 15. 20260722040000_cron_execucoes.sql
--
-- Nenhum dos 3 crons registrava execução — retry da Vercel ou hit manual
-- na rota reenviava os mesmos e-mails do período. Trava de idempotência
-- (tipo, chave) único, sem RLS (só service_role acessa).
-- ---------------------------------------------------------------------

begin;

create table if not exists cron_execucoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  chave text not null,
  executado_em timestamptz not null default now(),
  unique (tipo, chave)
);

-- Sem policy nenhuma de propósito: service_role (usado pelos crons) ignora
-- RLS de qualquer jeito, e habilitar aqui garante que anon/authenticated não
-- tenham acesso nenhum por padrão (mesmo raciocínio da migration 0002).
alter table cron_execucoes enable row level security;
revoke all on cron_execucoes from anon, authenticated;

commit;


-- ---------------------------------------------------------------------
-- 16. 20260722050000_apontamentos_atualizar_rpc.sql
--
-- Editar apontamento (antes só existia excluir + relançar). Mesma regra de
-- data do UPDATE existente: só o dia atual. atualizar_apontamento() espelha
-- as validações de registrar_apontamento() (bloco 13) e recongela o
-- snapshot com os valores atuais da demanda. Revoga UPDATE direto de
-- `authenticated` — mesmo raciocínio da RPC de registrar.
-- ---------------------------------------------------------------------

begin;

create or replace function public.atualizar_apontamento(
  p_id uuid,
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colaborador_id uuid := auth.uid();
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_row apontamentos;
begin
  if v_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min into v_carga_horaria_min
  from colaboradores
  where id = v_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  select variavel, tempo_padrao_min, blocos_totais, ativo
  into v_demanda
  from demandas
  where id = p_demanda_id;

  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  if v_demanda.variavel then
    if p_tempo_manual_min is null or p_tempo_manual_min <= 0 then
      raise exception 'TEMPO_OBRIGATORIO';
    end if;
    if p_tempo_manual_min > v_carga_horaria_min then
      raise exception 'TEMPO_EXCEDE_CARGA';
    end if;
    if v_motivo is null or v_motivo not in
      ('Reunião', 'Treinamento', 'Suporte a colega', 'Retrabalho', 'Imprevisto', 'Outro')
    then
      raise exception 'MOTIVO_INVALIDO';
    end if;
    if v_motivo = 'Outro' and coalesce(trim(p_observacoes), '') = '' then
      raise exception 'OBSERVACAO_OBRIGATORIA';
    end if;
  else
    v_motivo := null;
    if v_demanda.tempo_padrao_min is null then
      raise exception 'DEMANDA_SEM_TEMPO_PADRAO';
    end if;
    if v_demanda.blocos_totais > 1 and p_quantidade > v_demanda.blocos_totais then
      raise exception 'BLOCOS_EXCEDIDOS';
    end if;
  end if;

  update apontamentos
  set demanda_id = p_demanda_id,
      quantidade = p_quantidade,
      tempo_manual_min = p_tempo_manual_min,
      motivo = v_motivo,
      observacoes = p_observacoes,
      tempo_padrao_snapshot = case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
      blocos_totais_snapshot = case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end
  where id = p_id
    and colaborador_id = v_colaborador_id
    and data = current_date
  returning * into v_row;

  if v_row.id is null then
    raise exception 'APONTAMENTO_NAO_ENCONTRADO';
  end if;

  return v_row;
end;
$$;

revoke all on function public.atualizar_apontamento(uuid, uuid, numeric, integer, text, text) from public;
grant execute on function public.atualizar_apontamento(uuid, uuid, numeric, integer, text, text) to authenticated;

revoke update on public.apontamentos from authenticated;

commit;


-- ---------------------------------------------------------------------
-- 17. 20260722060000_auditoria.sql
--
-- Trilha de auditoria: mudança de carga horária/área/ativo de colaborador
-- e aprovação/rejeição de solicitação não ficavam registradas com "quem fez
-- e quando". Mesmo padrão de `notificacoes` — insert só via service_role.
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- 18. 20260722070000_demandas_finita.sql
--
-- Fase 2 da confiabilidade (bloco finito): demandas em blocos que se
-- esgotam de vez, não recorrem todo dia. Teto GLOBAL — soma de TODOS os
-- colaboradores nunca passa de blocos_totais. registrar_apontamento/
-- atualizar_apontamento/aprovar_solicitacao são recriadas (create or
-- replace) pra conhecer a nova coluna/regra.
-- ---------------------------------------------------------------------

begin;

alter table demandas add column if not exists finita boolean not null default false;
alter table solicitacoes_demandas add column if not exists finita boolean not null default false;

create or replace view demandas_acumulado
with (security_invoker = true) as
select demanda_id, coalesce(sum(quantidade), 0) as acumulado
from apontamentos
group by demanda_id;

grant select on demandas_acumulado to authenticated, service_role;

commit;

begin;

create or replace function public.registrar_apontamento(
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colaborador_id uuid := auth.uid();
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_acumulado numeric;
  v_row apontamentos;
begin
  if v_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min into v_carga_horaria_min
  from colaboradores
  where id = v_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  select variavel, tempo_padrao_min, blocos_totais, ativo, finita
  into v_demanda
  from demandas
  where id = p_demanda_id;

  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  if v_demanda.variavel then
    if p_tempo_manual_min is null or p_tempo_manual_min <= 0 then
      raise exception 'TEMPO_OBRIGATORIO';
    end if;
    if p_tempo_manual_min > v_carga_horaria_min then
      raise exception 'TEMPO_EXCEDE_CARGA';
    end if;
    if v_motivo is null or v_motivo not in
      ('Reunião', 'Treinamento', 'Suporte a colega', 'Retrabalho', 'Imprevisto', 'Outro')
    then
      raise exception 'MOTIVO_INVALIDO';
    end if;
    if v_motivo = 'Outro' and coalesce(trim(p_observacoes), '') = '' then
      raise exception 'OBSERVACAO_OBRIGATORIA';
    end if;
  else
    v_motivo := null;
    if v_demanda.tempo_padrao_min is null then
      raise exception 'DEMANDA_SEM_TEMPO_PADRAO';
    end if;
    if v_demanda.blocos_totais > 1 and p_quantidade > v_demanda.blocos_totais then
      raise exception 'BLOCOS_EXCEDIDOS';
    end if;
    if v_demanda.finita then
      select coalesce(sum(quantidade), 0) into v_acumulado
      from apontamentos
      where demanda_id = p_demanda_id;

      if v_acumulado + p_quantidade > v_demanda.blocos_totais then
        raise exception 'BLOCOS_FINITOS_ESGOTADOS';
      end if;
    end if;
  end if;

  insert into apontamentos (
    colaborador_id, demanda_id, quantidade, tempo_manual_min, motivo, observacoes,
    data, tempo_padrao_snapshot, blocos_totais_snapshot
  ) values (
    v_colaborador_id, p_demanda_id, p_quantidade, p_tempo_manual_min, v_motivo, p_observacoes,
    current_date,
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.atualizar_apontamento(
  p_id uuid,
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colaborador_id uuid := auth.uid();
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_acumulado numeric;
  v_row apontamentos;
begin
  if v_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min into v_carga_horaria_min
  from colaboradores
  where id = v_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  select variavel, tempo_padrao_min, blocos_totais, ativo, finita
  into v_demanda
  from demandas
  where id = p_demanda_id;

  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  if v_demanda.variavel then
    if p_tempo_manual_min is null or p_tempo_manual_min <= 0 then
      raise exception 'TEMPO_OBRIGATORIO';
    end if;
    if p_tempo_manual_min > v_carga_horaria_min then
      raise exception 'TEMPO_EXCEDE_CARGA';
    end if;
    if v_motivo is null or v_motivo not in
      ('Reunião', 'Treinamento', 'Suporte a colega', 'Retrabalho', 'Imprevisto', 'Outro')
    then
      raise exception 'MOTIVO_INVALIDO';
    end if;
    if v_motivo = 'Outro' and coalesce(trim(p_observacoes), '') = '' then
      raise exception 'OBSERVACAO_OBRIGATORIA';
    end if;
  else
    v_motivo := null;
    if v_demanda.tempo_padrao_min is null then
      raise exception 'DEMANDA_SEM_TEMPO_PADRAO';
    end if;
    if v_demanda.blocos_totais > 1 and p_quantidade > v_demanda.blocos_totais then
      raise exception 'BLOCOS_EXCEDIDOS';
    end if;
    if v_demanda.finita then
      select coalesce(sum(quantidade), 0) into v_acumulado
      from apontamentos
      where demanda_id = p_demanda_id and id <> p_id;

      if v_acumulado + p_quantidade > v_demanda.blocos_totais then
        raise exception 'BLOCOS_FINITOS_ESGOTADOS';
      end if;
    end if;
  end if;

  update apontamentos
  set demanda_id = p_demanda_id,
      quantidade = p_quantidade,
      tempo_manual_min = p_tempo_manual_min,
      motivo = v_motivo,
      observacoes = p_observacoes,
      tempo_padrao_snapshot = case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
      blocos_totais_snapshot = case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end
  where id = p_id
    and colaborador_id = v_colaborador_id
    and data = current_date
  returning * into v_row;

  if v_row.id is null then
    raise exception 'APONTAMENTO_NAO_ENCONTRADO';
  end if;

  return v_row;
end;
$$;

commit;

begin;

create or replace function public.aprovar_solicitacao(p_id uuid)
returns solicitacoes_demandas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitacoes_demandas;
  v_tempo_padrao_min integer;
  v_blocos_totais integer;
  v_finita boolean;
  v_gestor_ativo boolean;
begin
  select ativo into v_gestor_ativo
  from colaboradores
  where id = auth.uid() and role = 'gestor';

  if v_gestor_ativo is not true then
    raise exception 'NAO_AUTORIZADO';
  end if;

  update solicitacoes_demandas
  set status = 'APROVADA', atualizado_em = now()
  where id = p_id and status = 'PENDENTE'
  returning * into v_sol;

  if v_sol.id is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA';
  end if;

  if v_sol.variavel then
    v_tempo_padrao_min := null;
    v_blocos_totais := 1;
    v_finita := false;
  else
    v_tempo_padrao_min := v_sol.tempo_padrao_min;
    v_blocos_totais := greatest(coalesce(v_sol.blocos_totais, 1), 1);
    v_finita := coalesce(v_sol.finita, false);
    if v_blocos_totais > 1 and v_tempo_padrao_min is null then
      raise exception 'DEMANDA_BLOCOS_SEM_TEMPO';
    end if;
    if v_finita and v_blocos_totais <= 1 then
      raise exception 'DEMANDA_FINITA_SEM_BLOCOS';
    end if;
  end if;

  if v_sol.tipo = 'NOVA' then
    insert into demandas (area_id, nome, tempo_padrao_min, variavel, blocos_totais, finita, ativo)
    values (v_sol.area_id, v_sol.nome, v_tempo_padrao_min, v_sol.variavel, v_blocos_totais, v_finita, true);
  elsif v_sol.tipo = 'ALTERACAO' then
    if v_sol.demanda_id is null then
      raise exception 'ALTERACAO_SEM_DEMANDA';
    end if;
    update demandas
    set nome = v_sol.nome,
        tempo_padrao_min = v_tempo_padrao_min,
        variavel = v_sol.variavel,
        blocos_totais = v_blocos_totais,
        finita = v_finita,
        ativo = coalesce(v_sol.ativo, true)
    where id = v_sol.demanda_id;
  end if;

  if exists (
    select 1 from colaboradores
    where id = v_sol.colaborador_id and notif_solicitacoes = true
  ) then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
    values (
      v_sol.colaborador_id, 'solicitacao_aprovada', 'Solicitação aprovada',
      'Sua sugestão "' || v_sol.nome || '" foi aprovada.', '/catalogo?tab=solicitacoes'
    );
  end if;

  return v_sol;
exception
  when unique_violation then
    raise exception 'NOME_DUPLICADO';
end;
$$;

commit;


-- ---------------------------------------------------------------------
-- 19. 20260723010000_kanban.sql
--
-- Módulo Kanban: quadros que o gestor cria e vincula colaboradores
-- específicos (estilo Runrun.it) — sem organizações/projetos, só
-- reaproveitando colaboradores/areas já existentes. Modelo: quadros ->
-- colunas -> cartoes, com responsáveis/etiquetas/comentários por cartão.
-- Acesso: gestor vê e gerencia tudo; colaborador só acessa quadros em que
-- foi vinculado via `quadros_membros` (é o gestor quem vincula/
-- desvincula — colaborador não se autoadiciona).
-- ---------------------------------------------------------------------

begin;

create table if not exists quadros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  codigo text not null unique, -- prefixo curto (ex. "UX") usado no código do cartão
  cartao_contador integer not null default 0,
  criado_por uuid references colaboradores(id) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quadros_membros (
  quadro_id uuid references quadros(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) on delete cascade not null,
  adicionado_em timestamptz not null default now(),
  primary key (quadro_id, colaborador_id)
);

create table if not exists colunas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  posicao integer not null,
  created_at timestamptz not null default now()
);

create index if not exists colunas_quadro_idx on colunas (quadro_id, posicao);

create table if not exists cartoes (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid references colunas(id) on delete cascade not null,
  titulo text not null,
  descricao text,
  posicao integer not null,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  prazo date,
  codigo text not null, -- gerado pela trigger abaixo, ex. "UX-12"
  criado_por uuid references colaboradores(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cartoes_coluna_idx on cartoes (coluna_id, posicao);

create table if not exists cartoes_responsaveis (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) on delete cascade not null,
  primary key (cartao_id, colaborador_id)
);

create table if not exists etiquetas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  cor text not null default '#6B7280',
  created_at timestamptz not null default now(),
  unique (quadro_id, nome)
);

create table if not exists cartoes_etiquetas (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  etiqueta_id uuid references etiquetas(id) on delete cascade not null,
  primary key (cartao_id, etiqueta_id)
);

create table if not exists comentarios_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists comentarios_cartao_idx on comentarios_cartao (cartao_id, created_at desc);

commit;

begin;

create or replace function public.gerar_codigo_cartao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quadro_id uuid;
  v_prefixo text;
  v_novo_contador integer;
begin
  select col.quadro_id into v_quadro_id from colunas col where col.id = new.coluna_id;

  update quadros
  set cartao_contador = cartao_contador + 1,
      updated_at = now()
  where id = v_quadro_id
  returning codigo, cartao_contador into v_prefixo, v_novo_contador;

  new.codigo := v_prefixo || '-' || v_novo_contador;
  return new;
end;
$$;

drop trigger if exists tr_gerar_codigo_cartao on cartoes;
create trigger tr_gerar_codigo_cartao
  before insert on cartoes
  for each row
  execute function public.gerar_codigo_cartao();

commit;

begin;

alter table quadros enable row level security;
alter table quadros_membros enable row level security;
alter table colunas enable row level security;
alter table cartoes enable row level security;
alter table cartoes_responsaveis enable row level security;
alter table etiquetas enable row level security;
alter table cartoes_etiquetas enable row level security;
alter table comentarios_cartao enable row level security;

create or replace function public.is_quadro_membro(p_quadro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() = 'gestor' or exists (
    select 1 from quadros_membros
    where quadro_id = p_quadro_id and colaborador_id = auth.uid()
  )
$$;

revoke all on function public.is_quadro_membro(uuid) from public;
grant execute on function public.is_quadro_membro(uuid) to authenticated, service_role;

drop policy if exists "quadros_select_membro" on quadros;
create policy "quadros_select_membro" on quadros for select
  using (is_quadro_membro(id));

drop policy if exists "quadros_write_gestor" on quadros;
create policy "quadros_write_gestor" on quadros for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

drop policy if exists "quadros_membros_select" on quadros_membros;
create policy "quadros_membros_select" on quadros_membros for select
  using (is_quadro_membro(quadro_id));

drop policy if exists "quadros_membros_write_gestor" on quadros_membros;
create policy "quadros_membros_write_gestor" on quadros_membros for all
  using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

drop policy if exists "colunas_all_membro" on colunas;
create policy "colunas_all_membro" on colunas for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

drop policy if exists "cartoes_all_membro" on cartoes;
create policy "cartoes_all_membro" on cartoes for all
  using (
    exists (select 1 from colunas col where col.id = cartoes.coluna_id and is_quadro_membro(col.quadro_id))
  )
  with check (
    exists (select 1 from colunas col where col.id = cartoes.coluna_id and is_quadro_membro(col.quadro_id))
  );

drop policy if exists "cartoes_responsaveis_all_membro" on cartoes_responsaveis;
create policy "cartoes_responsaveis_all_membro" on cartoes_responsaveis for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "etiquetas_all_membro" on etiquetas;
create policy "etiquetas_all_membro" on etiquetas for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

drop policy if exists "cartoes_etiquetas_all_membro" on cartoes_etiquetas;
create policy "cartoes_etiquetas_all_membro" on cartoes_etiquetas for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_etiquetas.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_etiquetas.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "comentarios_select_membro" on comentarios_cartao;
create policy "comentarios_select_membro" on comentarios_cartao for select
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = comentarios_cartao.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "comentarios_insert_membro" on comentarios_cartao;
create policy "comentarios_insert_membro" on comentarios_cartao for insert
  with check (
    colaborador_id = auth.uid()
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = comentarios_cartao.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "comentarios_delete_own" on comentarios_cartao;
create policy "comentarios_delete_own" on comentarios_cartao for delete
  using (colaborador_id = auth.uid());

commit;

begin;

revoke all on quadros, quadros_membros, colunas, cartoes, cartoes_responsaveis,
  etiquetas, cartoes_etiquetas, comentarios_cartao from anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'cartoes'
  ) then
    alter publication supabase_realtime add table cartoes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'colunas'
  ) then
    alter publication supabase_realtime add table colunas;
  end if;
end $$;

commit;


-- ---------------------------------------------------------------------
-- 20. 20260723020000_kanban_formularios.sql
--
-- Formulários públicos (sem login) que criam cartão automaticamente ao
-- serem enviados — gestor/membro do quadro monta um formulário vinculado
-- a uma coluna, gera um link público, e cada envio vira um cartão novo.
-- `cartoes.criado_por` passa a aceitar null (visitante anônimo não tem
-- colaborador_id). Leitura de formulário ativo liberada pra `anon` via
-- policy + grant explícito; a criação do cartão em si roda pelo client
-- admin numa Server Action, nunca por INSERT direto de anon.
-- ---------------------------------------------------------------------

begin;

alter table cartoes alter column criado_por drop not null;

create table if not exists formularios (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  coluna_id uuid references colunas(id) on delete cascade not null,
  titulo text not null,
  descricao text,
  slug text not null unique,
  ativo boolean not null default true,
  cor_tema text not null default '#006652',
  mensagem_sucesso text not null default 'Recebemos sua solicitação — um card já foi criado no nosso quadro.',
  mostrar_marca boolean not null default true,
  criado_por uuid references colaboradores(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists formularios_quadro_idx on formularios (quadro_id);

create table if not exists formularios_campos (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid references formularios(id) on delete cascade not null,
  rotulo text not null,
  tipo text not null check (tipo in ('texto', 'texto_longo', 'selecao', 'data', 'prioridade')),
  placeholder text,
  obrigatorio boolean not null default false,
  posicao integer not null,
  opcoes text[] not null default '{}',
  mapeado_para text not null default 'personalizado'
    check (mapeado_para in ('titulo', 'descricao', 'prazo', 'prioridade', 'personalizado')),
  created_at timestamptz not null default now()
);

create index if not exists formularios_campos_formulario_idx on formularios_campos (formulario_id, posicao);

commit;

begin;

alter table formularios enable row level security;
alter table formularios_campos enable row level security;

drop policy if exists "formularios_select_publico" on formularios;
create policy "formularios_select_publico" on formularios for select
  using (ativo = true or is_quadro_membro(quadro_id));

drop policy if exists "formularios_write_membro" on formularios;
create policy "formularios_write_membro" on formularios for all
  using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));

drop policy if exists "formularios_campos_select_publico" on formularios_campos;
create policy "formularios_campos_select_publico" on formularios_campos for select
  using (
    exists (
      select 1 from formularios f
      where f.id = formularios_campos.formulario_id
      and (f.ativo = true or is_quadro_membro(f.quadro_id))
    )
  );

drop policy if exists "formularios_campos_write_membro" on formularios_campos;
create policy "formularios_campos_write_membro" on formularios_campos for all
  using (
    exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id))
  )
  with check (
    exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id))
  );

grant select on formularios, formularios_campos to anon;

commit;


-- ---------------------------------------------------------------------
-- 21. 20260729100000_kanban_cartoes_campos_novos.sql
--
-- Campos novos no card pra cobrir o conjunto de metadados pedido (paridade
-- com ferramenta de referência estilo Runrun.it): tipo do card, subtarefas
-- (auto-referência — uma subtarefa é só um cartão com pai setado, herda
-- responsáveis/etiquetas/comentários/coluna de graça), datas desejadas vs.
-- entrega real, recorrência simples, tempo estimado, centro de custo
-- (reaproveita `areas`, ver nota no plano) e uma tag de referência avulsa
-- (distinta do sistema de etiquetas coloridas em `etiquetas`/`cartoes_etiquetas`).
--
-- `prazo` (já existente) continua sendo a data única de deadline — na UI vira
-- o campo "Entrega desejada"; `entregue_em` é quando o card de fato foi
-- entregue (preenchido pelas actions de mover/entregar, não pelo usuário).
-- ---------------------------------------------------------------------

begin;

alter table cartoes add column if not exists tipo text not null default 'Padrão'
  check (tipo in ('Padrão', 'Bug', 'Melhoria', 'Solicitação'));

alter table cartoes add column if not exists cartao_pai_id uuid references cartoes(id) on delete cascade;
create index if not exists cartoes_pai_idx on cartoes (cartao_pai_id);

alter table cartoes add column if not exists inicio_desejado date;
alter table cartoes add column if not exists entregue_em timestamptz;
alter table cartoes add column if not exists recorrencia jsonb;
alter table cartoes add column if not exists tempo_estimado_min integer check (tempo_estimado_min is null or tempo_estimado_min > 0);
alter table cartoes add column if not exists centro_id uuid references areas(id);
alter table cartoes add column if not exists tag_referencia text;

alter table comentarios_cartao add column if not exists tipo text not null default 'usuario'
  check (tipo in ('usuario', 'sistema'));

commit;


-- ---------------------------------------------------------------------
-- 22. 20260729110000_kanban_seguidores_checklist.sql
--
-- Seguidores (watchers, distintos de responsáveis — só recebem notificação,
-- não são cobrados pela entrega) e checklist simples por card.
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- 23. 20260729120000_kanban_requisitos_etapa.sql
--
-- "Requisitos da etapa": checklist preso à COLUNA (etapa), não ao card —
-- todo card que passa por aquela coluna vê a mesma lista de requisitos e
-- marca individualmente o que já cumpriu (cartoes_requisitos_status).
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- 24. 20260729130000_kanban_regras_dependencias.sql
--
-- Aba "Regras": dependências entre cards (pré-requisito/subsequente — a
-- mesma tabela lida nos dois sentidos: pré-requisitos de X são as linhas
-- onde cartao_id = X; subsequentes de X são as linhas onde predecessor_id =
-- X) e sequência de responsáveis (fila ordenada — quando um entrega, avança
-- pro próximo automaticamente via RPC, notificando-o).
-- ---------------------------------------------------------------------

begin;

create table if not exists cartoes_predecessores (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  predecessor_id uuid references cartoes(id) on delete cascade not null,
  criado_em timestamptz not null default now(),
  primary key (cartao_id, predecessor_id),
  check (cartao_id <> predecessor_id)
);

create index if not exists cartoes_predecessores_inverso_idx on cartoes_predecessores (predecessor_id);

create table if not exists cartoes_sequencia_responsaveis (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  ordem integer not null,
  entregue boolean not null default false,
  entregue_em timestamptz,
  unique (cartao_id, ordem)
);

create index if not exists cartoes_sequencia_cartao_idx on cartoes_sequencia_responsaveis (cartao_id, ordem);

commit;

begin;

alter table cartoes_predecessores enable row level security;
alter table cartoes_sequencia_responsaveis enable row level security;

drop policy if exists "cartoes_predecessores_all_membro" on cartoes_predecessores;
create policy "cartoes_predecessores_all_membro" on cartoes_predecessores for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_predecessores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_predecessores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "cartoes_sequencia_all_membro" on cartoes_sequencia_responsaveis;
create policy "cartoes_sequencia_all_membro" on cartoes_sequencia_responsaveis for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sequencia_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sequencia_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on cartoes_predecessores, cartoes_sequencia_responsaveis from anon;

commit;

-- ---------------------------------------------------------------------
-- RPC: avança a sequência de responsáveis de um card — marca o atual (menor
-- `ordem` ainda não entregue) como entregue e notifica o próximo da fila.
-- SECURITY DEFINER só pra poder inserir em `notificacoes` (mesmo padrão de
-- aprovar_solicitacao); a checagem de acesso é feita à mão via
-- is_quadro_membro, igual às policies acima.
-- ---------------------------------------------------------------------

begin;

create or replace function public.avancar_sequencia_cartao(p_cartao_id uuid)
returns cartoes_sequencia_responsaveis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quadro_id uuid;
  v_atual cartoes_sequencia_responsaveis;
  v_proximo cartoes_sequencia_responsaveis;
  v_titulo text;
begin
  select col.quadro_id, c.titulo into v_quadro_id, v_titulo
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = p_cartao_id;

  if v_quadro_id is null or not is_quadro_membro(v_quadro_id) then
    raise exception 'NAO_AUTORIZADO';
  end if;

  select * into v_atual
  from cartoes_sequencia_responsaveis
  where cartao_id = p_cartao_id and entregue = false
  order by ordem asc
  limit 1;

  if v_atual.id is null then
    raise exception 'SEQUENCIA_SEM_PENDENTES';
  end if;

  update cartoes_sequencia_responsaveis
  set entregue = true, entregue_em = now()
  where id = v_atual.id;

  select * into v_proximo
  from cartoes_sequencia_responsaveis
  where cartao_id = p_cartao_id and entregue = false
  order by ordem asc
  limit 1;

  if v_proximo.id is not null then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
    values (
      v_proximo.colaborador_id, 'cartao_sequencia_avancou', 'É a sua vez',
      'O card "' || v_titulo || '" chegou até você na sequência de responsáveis.', null
    );
  end if;

  return v_proximo;
end;
$$;

revoke all on function public.avancar_sequencia_cartao(uuid) from public;
grant execute on function public.avancar_sequencia_cartao(uuid) to authenticated;

commit;


-- ---------------------------------------------------------------------
-- 25. 20260729140000_kanban_anexos.sql
--
-- Anexos por card. Bucket privado (diferente do "avatars" público) — todo
-- upload/download passa pela Server Action com o client admin (mesmo
-- raciocínio de updateMeuAvatar em perfil/actions.ts: quem decide o path é o
-- código do servidor, então não precisa de policy de storage.objects; a
-- listagem usa signed URL de curta duração, nunca URL pública).
-- ---------------------------------------------------------------------

begin;

insert into storage.buckets (id, name, public)
values ('anexos-cartoes', 'anexos-cartoes', false)
on conflict (id) do nothing;

create table if not exists cartoes_anexos (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  nome_arquivo text not null,
  caminho_storage text not null,
  tamanho_bytes bigint not null,
  tipo_mime text not null,
  created_at timestamptz not null default now()
);

create index if not exists cartoes_anexos_cartao_idx on cartoes_anexos (cartao_id, created_at desc);

commit;

begin;

alter table cartoes_anexos enable row level security;

drop policy if exists "cartoes_anexos_select_membro" on cartoes_anexos;
create policy "cartoes_anexos_select_membro" on cartoes_anexos for select
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_anexos.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "cartoes_anexos_insert_membro" on cartoes_anexos;
create policy "cartoes_anexos_insert_membro" on cartoes_anexos for insert
  with check (
    colaborador_id = auth.uid()
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_anexos.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "cartoes_anexos_delete_own_or_gestor" on cartoes_anexos;
create policy "cartoes_anexos_delete_own_or_gestor" on cartoes_anexos for delete
  using (colaborador_id = auth.uid() or auth_role() = 'gestor');

revoke all on cartoes_anexos from anon;

commit;


-- ---------------------------------------------------------------------
-- 26. 20260729150000_kanban_aprovacoes.sql
--
-- Fluxo de aprovação por card, mesmo padrão de solicitacoes_demandas
-- (20260720225916_solicitacoes_demandas.sql +
-- 20260722030000_solicitacoes_aprovar_rejeitar_rpc.sql): status via enum,
-- RPC única SECURITY DEFINER faz a mudança de status + notificação numa
-- transação só. Diferença: ali o aprovador era sempre "o gestor"; aqui quem
-- pede a aprovação escolhe A QUEM pedir (aprovador_id, um membro do quadro),
-- então o gate das RPCs de decisão é "auth.uid() = aprovador_id", não role.
-- ---------------------------------------------------------------------

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_aprovacao_cartao') then
    create type status_aprovacao_cartao as enum ('PENDENTE', 'APROVADA', 'REJEITADA');
  end if;
end $$;

create table if not exists cartoes_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  solicitado_por uuid references colaboradores(id) not null,
  aprovador_id uuid references colaboradores(id) not null,
  status status_aprovacao_cartao not null default 'PENDENTE',
  comentario text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists cartoes_aprovacoes_cartao_idx on cartoes_aprovacoes (cartao_id, criado_em desc);

commit;

begin;

alter table cartoes_aprovacoes enable row level security;

drop policy if exists "cartoes_aprovacoes_select_membro" on cartoes_aprovacoes;
create policy "cartoes_aprovacoes_select_membro" on cartoes_aprovacoes for select
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_aprovacoes.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on cartoes_aprovacoes from anon, authenticated;
grant select on cartoes_aprovacoes to authenticated;

commit;

-- ---------------------------------------------------------------------
-- RPCs de aprovação de cartão
-- ---------------------------------------------------------------------

begin;

create or replace function public.solicitar_aprovacao_cartao(p_cartao_id uuid, p_aprovador_id uuid)
returns cartoes_aprovacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quadro_id uuid;
  v_titulo text;
  v_aprovacao cartoes_aprovacoes;
begin
  select col.quadro_id, c.titulo into v_quadro_id, v_titulo
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = p_cartao_id;

  if v_quadro_id is null or not is_quadro_membro(v_quadro_id) then
    raise exception 'NAO_AUTORIZADO';
  end if;

  if not exists (
    select 1 from quadros_membros
    where quadro_id = v_quadro_id and colaborador_id = p_aprovador_id
  ) and not exists (
    select 1 from colaboradores where id = p_aprovador_id and role = 'gestor' and ativo = true
  ) then
    raise exception 'APROVADOR_NAO_E_MEMBRO';
  end if;

  insert into cartoes_aprovacoes (cartao_id, solicitado_por, aprovador_id)
  values (p_cartao_id, auth.uid(), p_aprovador_id)
  returning * into v_aprovacao;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
  values (
    p_aprovador_id, 'cartao_aprovacao_pendente', 'Aprovação pendente',
    'O card "' || v_titulo || '" está aguardando sua aprovação.', null
  );

  return v_aprovacao;
end;
$$;

create or replace function public.aprovar_cartao(p_id uuid)
returns cartoes_aprovacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aprovacao cartoes_aprovacoes;
  v_titulo text;
begin
  update cartoes_aprovacoes
  set status = 'APROVADA', atualizado_em = now()
  where id = p_id and status = 'PENDENTE' and aprovador_id = auth.uid()
  returning * into v_aprovacao;

  if v_aprovacao.id is null then
    raise exception 'APROVACAO_NAO_ENCONTRADA';
  end if;

  select titulo into v_titulo from cartoes where id = v_aprovacao.cartao_id;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
  values (
    v_aprovacao.solicitado_por, 'cartao_aprovacao_aprovada', 'Solicitação aprovada',
    'Sua solicitação de aprovação para "' || v_titulo || '" foi aprovada.', null
  );

  insert into comentarios_cartao (cartao_id, colaborador_id, conteudo, tipo)
  values (v_aprovacao.cartao_id, auth.uid(), 'Aprovou a solicitação.', 'sistema');

  return v_aprovacao;
end;
$$;

create or replace function public.rejeitar_cartao(p_id uuid, p_comentario text default null)
returns cartoes_aprovacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aprovacao cartoes_aprovacoes;
  v_titulo text;
begin
  update cartoes_aprovacoes
  set status = 'REJEITADA', comentario = p_comentario, atualizado_em = now()
  where id = p_id and status = 'PENDENTE' and aprovador_id = auth.uid()
  returning * into v_aprovacao;

  if v_aprovacao.id is null then
    raise exception 'APROVACAO_NAO_ENCONTRADA';
  end if;

  select titulo into v_titulo from cartoes where id = v_aprovacao.cartao_id;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
  values (
    v_aprovacao.solicitado_por, 'cartao_aprovacao_rejeitada', 'Solicitação rejeitada',
    'Sua solicitação de aprovação para "' || v_titulo || '" foi rejeitada.', null
  );

  insert into comentarios_cartao (cartao_id, colaborador_id, conteudo, tipo)
  values (
    v_aprovacao.cartao_id, auth.uid(),
    'Rejeitou a solicitação.' || case when p_comentario is not null then ' Motivo: ' || p_comentario else '' end,
    'sistema'
  );

  return v_aprovacao;
end;
$$;

revoke all on function public.solicitar_aprovacao_cartao(uuid, uuid) from public;
grant execute on function public.solicitar_aprovacao_cartao(uuid, uuid) to authenticated;

revoke all on function public.aprovar_cartao(uuid) from public;
grant execute on function public.aprovar_cartao(uuid) to authenticated;

revoke all on function public.rejeitar_cartao(uuid, text) from public;
grant execute on function public.rejeitar_cartao(uuid, text) to authenticated;

commit;


-- ---------------------------------------------------------------------
-- 27. 20260729160000_kanban_emails.sql
--
-- Aba "Emails": envio avulso a partir do card (usa lib/email.ts, já
-- existente) com log persistido. Não é caixa de entrada bidirecional (sem
-- infra de IMAP/webhook) — só "enviei isso, daqui".
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- 28. 20260729170000_kanban_tempo.sql
--
-- Timer de card: sessões com início/fim. Um colaborador só pode ter UMA
-- sessão aberta (finalizado_em is null) por vez, em qualquer card — é o que
-- sustenta o widget flutuante global (app/(app)/layout.tsx): sempre há no
-- máximo uma sessão "rodando" pra mostrar. "Tempo nesta tarefa" (soma
-- logada vs. tempo_estimado_min do card) é a soma de `minutos` das sessões
-- fechadas + o elapsed da sessão aberta (calculado no client).
--
-- Realtime habilitado pra o widget refletir play/pause entre abas/dispositivos
-- do mesmo usuário (mesmo padrão de cartoes/colunas, ver 20260723010000_kanban.sql).
-- ---------------------------------------------------------------------

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


-- =====================================================================
-- 29. 20260730100000_kanban_entrega_regras.sql
-- =====================================================================

-- Entrega de card, regras que bloqueiam de verdade e agenda de recorrência.
--
-- Contexto: o bloco 21 criou `cartoes.entregue_em` dizendo que seria
-- "preenchido pelas actions de mover/entregar" — essas actions nunca
-- existiram, e o campo acabou virando um input de data manual na sidebar.
-- Aqui a entrega passa a ser consequência do movimento: coluna marcada como
-- `etapa_final` entrega quem entra e reabre quem sai.
--
-- Por que trigger e não RPC/Server Action: `cartoes.coluna_id` é alterado por
-- 4 caminhos diferentes (drag, dialog, mover-de-quadro, enviar-pro-topo) e a
-- RLS de `cartoes` permite update direto do browser. Regra em trigger pega os
-- 5 casos de uma vez, sem reescrever a lógica de ordenação que já funciona.
-- Mesmo raciocínio que levou `registrar_apontamento` a virar RPC no bloco 13,
-- só que sem precisar mover a escrita inteira pra dentro de uma função.

begin;

alter table colunas add column if not exists etapa_final boolean not null default false;
alter table colunas add column if not exists limite_wip integer
  check (limite_wip is null or limite_wip > 0);

-- Quando o card é entregue e tem `recorrencia`, o trigger agenda aqui a data
-- em que o cron deve recriá-lo. Null = nada agendado.
alter table cartoes add column if not exists proxima_recorrencia_em date;
create index if not exists cartoes_proxima_recorrencia_idx on cartoes (proxima_recorrencia_em)
  where proxima_recorrencia_em is not null;

commit;

-- ---------------------------------------------------------------------
-- Trigger 1: entrega derivada da coluna de destino
-- ---------------------------------------------------------------------

begin;

create or replace function public.cartoes_aplicar_entrega()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_destino_final boolean;
  v_tipo text;
begin
  -- Só reage a entrada/saída de coluna. Update que não mexe em coluna_id
  -- (renomear, trocar prioridade) passa reto.
  if tg_op = 'UPDATE' and new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  select etapa_final into v_destino_final from colunas where id = new.coluna_id;

  if coalesce(v_destino_final, false) then
    -- Reentrar numa etapa final não reescreve a data da primeira entrega.
    if new.entregue_em is null then
      new.entregue_em := now();
    end if;

    -- Casts explícitos pra date: `current_date + interval` devolve timestamp,
    -- e depender do cast de atribuição pra chegar em date é sutil demais.
    v_tipo := new.recorrencia->>'tipo';
    if v_tipo is not null then
      new.proxima_recorrencia_em := case v_tipo
        when 'diaria' then (current_date + 1)::date
        when 'semanal' then (current_date + 7)::date
        when 'mensal' then (current_date + interval '1 month')::date
      end;
    end if;
  else
    -- Saiu da etapa final: o card voltou pro fluxo, então deixa de estar
    -- entregue e a recorrência agendada perde o sentido.
    new.entregue_em := null;
    new.proxima_recorrencia_em := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cartoes_aplicar_entrega on cartoes;
create trigger trg_cartoes_aplicar_entrega
  before insert or update on cartoes
  for each row execute function public.cartoes_aplicar_entrega();

commit;

-- ---------------------------------------------------------------------
-- Trigger 2: pré-requisito, requisito obrigatório da etapa e limite de WIP
-- ---------------------------------------------------------------------

begin;

create or replace function public.cartoes_validar_saida_etapa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pendentes text;
  v_wip integer;
  v_limite integer;
begin
  if new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  -- 1. Todo pré-requisito precisa estar entregue.
  select string_agg(pre.codigo, ', ' order by pre.codigo) into v_pendentes
  from cartoes_predecessores cp
  join cartoes pre on pre.id = cp.predecessor_id
  where cp.cartao_id = new.id and pre.entregue_em is null;

  if v_pendentes is not null then
    raise exception 'PREREQUISITO_PENDENTE:%', v_pendentes;
  end if;

  -- 2. Requisito obrigatório da etapa de ORIGEM precisa estar cumprido —
  -- é a condição pra sair dela, não pra entrar na próxima.
  select string_agg(cr.descricao, '; ' order by cr.posicao) into v_pendentes
  from colunas_requisitos cr
  left join cartoes_requisitos_status crs
    on crs.requisito_id = cr.id and crs.cartao_id = new.id
  where cr.coluna_id = old.coluna_id
    and cr.obrigatorio = true
    and coalesce(crs.concluido, false) = false;

  if v_pendentes is not null then
    raise exception 'REQUISITO_OBRIGATORIO_PENDENTE:%', v_pendentes;
  end if;

  -- 3. Limite de WIP da coluna de destino.
  select limite_wip into v_limite from colunas where id = new.coluna_id;
  if v_limite is not null then
    select count(*) into v_wip from cartoes where coluna_id = new.coluna_id and id <> new.id;
    if v_wip >= v_limite then
      raise exception 'WIP_EXCEDIDO:%', v_limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cartoes_validar_saida_etapa on cartoes;
create trigger trg_cartoes_validar_saida_etapa
  before update on cartoes
  for each row execute function public.cartoes_validar_saida_etapa();

commit;

-- ---------------------------------------------------------------------
-- Trigger 3: avisar quem virou responsável
-- ---------------------------------------------------------------------

begin;

create or replace function public.cartoes_notificar_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quadro_id uuid;
  v_titulo text;
begin
  -- Quem se atribui não precisa de aviso.
  if new.colaborador_id = auth.uid() then
    return new;
  end if;

  select col.quadro_id, c.titulo into v_quadro_id, v_titulo
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = new.cartao_id;

  if v_quadro_id is null then
    return new;
  end if;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
  values (
    new.colaborador_id, 'cartao_responsavel_atribuido', 'Novo card para você',
    'Você virou responsável pelo card "' || v_titulo || '".',
    '/kanban/' || v_quadro_id
  );

  return new;
end;
$$;

drop trigger if exists trg_cartoes_notificar_responsavel on cartoes_responsaveis;
create trigger trg_cartoes_notificar_responsavel
  after insert on cartoes_responsaveis
  for each row execute function public.cartoes_notificar_responsavel();

commit;

-- ---------------------------------------------------------------------
-- RPCs dos blocos 24 e 26: notificação sem link não é clicável no sino
-- (components/layout/notification-bell.tsx só renderiza <Link> quando há
-- link), então toda notificação de card passa a apontar pro quadro.
-- Recriadas na íntegra, sem mudança de assinatura.
-- ---------------------------------------------------------------------

begin;

create or replace function public.avancar_sequencia_cartao(p_cartao_id uuid)
returns cartoes_sequencia_responsaveis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quadro_id uuid;
  v_atual cartoes_sequencia_responsaveis;
  v_proximo cartoes_sequencia_responsaveis;
  v_titulo text;
begin
  select col.quadro_id, c.titulo into v_quadro_id, v_titulo
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = p_cartao_id;

  if v_quadro_id is null or not is_quadro_membro(v_quadro_id) then
    raise exception 'NAO_AUTORIZADO';
  end if;

  select * into v_atual
  from cartoes_sequencia_responsaveis
  where cartao_id = p_cartao_id and entregue = false
  order by ordem asc
  limit 1;

  if v_atual.id is null then
    raise exception 'SEQUENCIA_SEM_PENDENTES';
  end if;

  update cartoes_sequencia_responsaveis
  set entregue = true, entregue_em = now()
  where id = v_atual.id;

  select * into v_proximo
  from cartoes_sequencia_responsaveis
  where cartao_id = p_cartao_id and entregue = false
  order by ordem asc
  limit 1;

  if v_proximo.id is not null then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
    values (
      v_proximo.colaborador_id, 'cartao_sequencia_avancou', 'É a sua vez',
      'O card "' || v_titulo || '" chegou até você na sequência de responsáveis.',
      '/kanban/' || v_quadro_id
    );
  end if;

  return v_proximo;
end;
$$;

create or replace function public.solicitar_aprovacao_cartao(p_cartao_id uuid, p_aprovador_id uuid)
returns cartoes_aprovacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quadro_id uuid;
  v_titulo text;
  v_aprovacao cartoes_aprovacoes;
begin
  select col.quadro_id, c.titulo into v_quadro_id, v_titulo
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = p_cartao_id;

  if v_quadro_id is null or not is_quadro_membro(v_quadro_id) then
    raise exception 'NAO_AUTORIZADO';
  end if;

  if not exists (
    select 1 from quadros_membros
    where quadro_id = v_quadro_id and colaborador_id = p_aprovador_id
  ) and not exists (
    select 1 from colaboradores where id = p_aprovador_id and role = 'gestor' and ativo = true
  ) then
    raise exception 'APROVADOR_NAO_E_MEMBRO';
  end if;

  insert into cartoes_aprovacoes (cartao_id, solicitado_por, aprovador_id)
  values (p_cartao_id, auth.uid(), p_aprovador_id)
  returning * into v_aprovacao;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
  values (
    p_aprovador_id, 'cartao_aprovacao_pendente', 'Aprovação pendente',
    'O card "' || v_titulo || '" está aguardando sua aprovação.',
    '/kanban/' || v_quadro_id
  );

  return v_aprovacao;
end;
$$;

create or replace function public.aprovar_cartao(p_id uuid)
returns cartoes_aprovacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aprovacao cartoes_aprovacoes;
  v_titulo text;
  v_quadro_id uuid;
begin
  update cartoes_aprovacoes
  set status = 'APROVADA', atualizado_em = now()
  where id = p_id and status = 'PENDENTE' and aprovador_id = auth.uid()
  returning * into v_aprovacao;

  if v_aprovacao.id is null then
    raise exception 'APROVACAO_NAO_ENCONTRADA';
  end if;

  select c.titulo, col.quadro_id into v_titulo, v_quadro_id
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = v_aprovacao.cartao_id;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
  values (
    v_aprovacao.solicitado_por, 'cartao_aprovacao_aprovada', 'Solicitação aprovada',
    'Sua solicitação de aprovação para "' || v_titulo || '" foi aprovada.',
    '/kanban/' || v_quadro_id
  );

  insert into comentarios_cartao (cartao_id, colaborador_id, conteudo, tipo)
  values (v_aprovacao.cartao_id, auth.uid(), 'Aprovou a solicitação.', 'sistema');

  return v_aprovacao;
end;
$$;

create or replace function public.rejeitar_cartao(p_id uuid, p_comentario text default null)
returns cartoes_aprovacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aprovacao cartoes_aprovacoes;
  v_titulo text;
  v_quadro_id uuid;
begin
  update cartoes_aprovacoes
  set status = 'REJEITADA', comentario = p_comentario, atualizado_em = now()
  where id = p_id and status = 'PENDENTE' and aprovador_id = auth.uid()
  returning * into v_aprovacao;

  if v_aprovacao.id is null then
    raise exception 'APROVACAO_NAO_ENCONTRADA';
  end if;

  select c.titulo, col.quadro_id into v_titulo, v_quadro_id
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = v_aprovacao.cartao_id;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link)
  values (
    v_aprovacao.solicitado_por, 'cartao_aprovacao_rejeitada', 'Solicitação rejeitada',
    'Sua solicitação de aprovação para "' || v_titulo || '" foi rejeitada.',
    '/kanban/' || v_quadro_id
  );

  insert into comentarios_cartao (cartao_id, colaborador_id, conteudo, tipo)
  values (
    v_aprovacao.cartao_id, auth.uid(),
    'Rejeitou a solicitação.' || case when p_comentario is not null then ' Motivo: ' || p_comentario else '' end,
    'sistema'
  );

  return v_aprovacao;
end;
$$;

commit;


-- =====================================================================
-- 30. 20260730110000_kanban_campos_customizados.sql
-- =====================================================================

-- Campos customizados por quadro.
--
-- Motivação: a instância de referência (Runrun.it, quadro "OPERAÇÃO EAD")
-- tem metade da sidebar do card em campos que não existem neste schema —
-- Período de Oferta, Solicitação, Coordenador, Organização do JACAD, Status
-- Deferimento, Repositorio. São campos do QUADRO (todo card daquele quadro
-- vê a mesma lista), no mesmo espírito de `colunas_requisitos`, que já é uma
-- definição presa à etapa com status por card.
--
-- Por que `valor jsonb` numa coluna só em vez de uma coluna por tipo: são
-- sete tipos e a alternativa (valor_texto/valor_numero/valor_data/...) obriga
-- toda leitura a saber qual coluna olhar. O preço é a validação sair do
-- banco — ela fica no Zod da action, mesma divisão de trabalho que
-- `cartaoSchema` em app/(app)/kanban/actions.ts já usa.

begin;

create table if not exists quadros_campos (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  tipo text not null check (tipo in ('texto', 'numero', 'data', 'selecao', 'pessoa', 'checkbox', 'url')),
  -- Só faz sentido em tipo = 'selecao'; vazio nos demais.
  opcoes text[] not null default '{}',
  obrigatorio boolean not null default false,
  posicao integer not null default 0,
  created_at timestamptz not null default now(),
  unique (quadro_id, nome)
);

create index if not exists quadros_campos_quadro_idx on quadros_campos (quadro_id, posicao);

create table if not exists cartoes_campos_valores (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  campo_id uuid references quadros_campos(id) on delete cascade not null,
  valor jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (cartao_id, campo_id)
);

commit;

begin;

alter table quadros_campos enable row level security;
alter table cartoes_campos_valores enable row level security;

drop policy if exists "quadros_campos_all_membro" on quadros_campos;
create policy "quadros_campos_all_membro" on quadros_campos for all
  using (is_quadro_membro(quadro_id))
  with check (is_quadro_membro(quadro_id));

drop policy if exists "cartoes_campos_valores_all_membro" on cartoes_campos_valores;
create policy "cartoes_campos_valores_all_membro" on cartoes_campos_valores for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_campos_valores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_campos_valores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on quadros_campos, cartoes_campos_valores from anon;

commit;


-- =====================================================================
-- 31. 20260730120000_kanban_automacoes.sql
-- =====================================================================

-- Motor de automações do quadro ("quando X acontecer, faça Y, Z, W") +
-- os dois dados que faltavam pro card e pros eventos de SLA.
--
-- Aqui só mora o ESTADO das automações. A execução fica na aplicação
-- (lib/automacoes.ts), diferente das regras de movimentação do bloco 29, que
-- foram pra trigger. O critério é o tipo de garantia: bloquear movimentação é
-- integridade e não pode ter caminho de fuga; automação é conveniência — e
-- ações como "enviar e-mail" (SMTP via nodemailer) não rodam dentro do
-- Postgres de qualquer forma.

begin;

-- `etapa_desde` alimenta duas coisas: "Tempo decorrido na etapa" na sidebar
-- do card e os eventos de SLA. `sla_horas` é o teto por etapa (null = sem SLA).
alter table cartoes add column if not exists etapa_desde timestamptz;
alter table colunas add column if not exists sla_horas integer
  check (sla_horas is null or sla_horas > 0);

-- Cards que já existem nunca passaram pelo trigger com a coluna nova: sem
-- backfill mostrariam "tempo na etapa" vazio pra sempre.
update cartoes set etapa_desde = coalesce(updated_at, created_at) where etapa_desde is null;

commit;

begin;

create table if not exists automacoes (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  ativa boolean not null default true,
  posicao integer not null default 0,
  evento text not null,
  -- Filtro do evento: { colunaId } pra "entrar na etapa X", { etiquetaId }
  -- pra "tag adicionada", { horasAntes } pra "perto de atrasar"...
  evento_config jsonb not null default '{}'::jsonb,
  criado_por uuid references colaboradores(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automacoes_quadro_idx on automacoes (quadro_id, posicao);
create index if not exists automacoes_evento_idx on automacoes (quadro_id, evento) where ativa = true;

create table if not exists automacoes_acoes (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid references automacoes(id) on delete cascade not null,
  ordem integer not null,
  tipo text not null,
  config jsonb not null default '{}'::jsonb
);

create index if not exists automacoes_acoes_automacao_idx on automacoes_acoes (automacao_id, ordem);

-- Log de execução: sustenta os badges de contagem da tela ("7 ATIVAS,
-- 0 COM ERRO") e o total de ações executadas. `status = 'cortado'` é a trava
-- anti-loop tendo agido — precisa ser visível, senão o gestor só vê a
-- automação "não rodando" sem entender por quê.
create table if not exists automacoes_execucoes (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid references automacoes(id) on delete cascade not null,
  cartao_id uuid references cartoes(id) on delete set null,
  status text not null check (status in ('ok', 'erro', 'cortado')),
  erro text,
  acoes_executadas integer not null default 0,
  executado_em timestamptz not null default now()
);

create index if not exists automacoes_execucoes_automacao_idx
  on automacoes_execucoes (automacao_id, executado_em desc);

commit;

begin;

alter table automacoes enable row level security;
alter table automacoes_acoes enable row level security;
alter table automacoes_execucoes enable row level security;

drop policy if exists "automacoes_all_membro" on automacoes;
create policy "automacoes_all_membro" on automacoes for all
  using (is_quadro_membro(quadro_id))
  with check (is_quadro_membro(quadro_id));

drop policy if exists "automacoes_acoes_all_membro" on automacoes_acoes;
create policy "automacoes_acoes_all_membro" on automacoes_acoes for all
  using (exists (select 1 from automacoes a where a.id = automacoes_acoes.automacao_id and is_quadro_membro(a.quadro_id)))
  with check (exists (select 1 from automacoes a where a.id = automacoes_acoes.automacao_id and is_quadro_membro(a.quadro_id)));

-- Insert liberado pro membro porque quem grava o log é o dispatcher rodando
-- com o client da sessão de quem disparou o evento (o cron usa service role e
-- ignora RLS). Update/delete não têm policy: log não se edita.
drop policy if exists "automacoes_execucoes_select_membro" on automacoes_execucoes;
create policy "automacoes_execucoes_select_membro" on automacoes_execucoes for select
  using (exists (select 1 from automacoes a where a.id = automacoes_execucoes.automacao_id and is_quadro_membro(a.quadro_id)));

drop policy if exists "automacoes_execucoes_insert_membro" on automacoes_execucoes;
create policy "automacoes_execucoes_insert_membro" on automacoes_execucoes for insert
  with check (exists (select 1 from automacoes a where a.id = automacoes_execucoes.automacao_id and is_quadro_membro(a.quadro_id)));

revoke all on automacoes, automacoes_acoes, automacoes_execucoes from anon;

commit;

-- ---------------------------------------------------------------------
-- Trigger de movimentação do bloco 29 recriado para também carimbar
-- `etapa_desde`. É o mesmo ponto onde a entrega já é aplicada — ter um
-- segundo trigger só pra isso duplicaria a mesma condição de mudança de
-- coluna.
-- ---------------------------------------------------------------------

begin;

create or replace function public.cartoes_aplicar_entrega()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_destino_final boolean;
  v_tipo text;
begin
  -- Só reage a entrada/saída de coluna. Update que não mexe em coluna_id
  -- (renomear, trocar prioridade) passa reto.
  if tg_op = 'UPDATE' and new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  new.etapa_desde := now();

  select etapa_final into v_destino_final from colunas where id = new.coluna_id;

  if coalesce(v_destino_final, false) then
    -- Reentrar numa etapa final não reescreve a data da primeira entrega.
    if new.entregue_em is null then
      new.entregue_em := now();
    end if;

    -- Casts explícitos pra date: `current_date + interval` devolve timestamp,
    -- e depender do cast de atribuição pra chegar em date é sutil demais.
    v_tipo := new.recorrencia->>'tipo';
    if v_tipo is not null then
      new.proxima_recorrencia_em := case v_tipo
        when 'diaria' then (current_date + 1)::date
        when 'semanal' then (current_date + 7)::date
        when 'mensal' then (current_date + interval '1 month')::date
      end;
    end if;
  else
    -- Saiu da etapa final: o card voltou pro fluxo, então deixa de estar
    -- entregue e a recorrência agendada perde o sentido.
    new.entregue_em := null;
    new.proxima_recorrencia_em := null;
  end if;

  return new;
end;
$$;

commit;


-- =====================================================================
-- 32. 20260730130000_kanban_apontamentos.sql
-- =====================================================================

-- O tempo do Kanban passa a contar no índice de produtividade.
--
-- Problema: `indicadores_diarios` (índice, dashboard, /relatorios, crons de
-- alerta-queda e relatorio-semanal) lê só de `apontamentos_calculado`. O
-- cronômetro do card gravava em `cartoes_sessoes_tempo`, que não alimenta
-- nada disso. Quem cronometrava 3h num card ganhava zero de índice e ainda
-- precisava lançar o mesmo trabalho à mão em /apontamento.
--
-- Aqui a sessão de cronômetro vira apontamento de verdade, na demanda que o
-- card aponta.
--
-- Nota que evita uma pergunta futura: NÃO é preciso mexer em
-- `apontamentos_calculado`. Ela decide usar tempo manual por
-- `tempo_manual_min is not null`, não por `demandas.variavel` — então
-- cronômetro em demanda padrão (com blocos) já calcula certo gravando
-- tempo_manual_min e blocos_totais_snapshot = 1.

begin;

-- Nullable de propósito: já existem cards sem demanda, e travar a coluna
-- quebraria o quadro. Obrigatório só no formulário de criação; card sem
-- demanda simplesmente não gera apontamento (e a UI avisa).
alter table cartoes add column if not exists demanda_id uuid references demandas(id);
create index if not exists cartoes_demanda_idx on cartoes (demanda_id) where demanda_id is not null;

-- O vínculo mora no apontamento, não na sessão, porque a cardinalidade é
-- 1:N: sessão que cruza a meia-noite vira UM apontamento por dia. Um
-- `apontamento_id` único na sessão só conseguiria apontar para o primeiro.
--
-- `on delete cascade`: apagar a sessão apaga os apontamentos que ela gerou,
-- senão o índice ficaria contando tempo de uma sessão que não existe mais.
-- O cascade roda no nível do sistema e não esbarra na policy de delete de
-- apontamentos (que só permite o dia corrente) — que é o desejado aqui.
alter table apontamentos add column if not exists cartao_sessao_id uuid
  references cartoes_sessoes_tempo(id) on delete cascade;
create index if not exists apontamentos_cartao_sessao_idx
  on apontamentos (cartao_sessao_id) where cartao_sessao_id is not null;

-- Correção da policy do bloco 28: `ajustarHorasRegistradas` e
-- `excluirSessaoTempo` permitem que o GESTOR registre/apague sessão de outra
-- pessoa, mas a policy original exigia `colaborador_id = auth.uid()` — a
-- action de gestor falhava silenciosamente no RLS.
drop policy if exists "cartoes_sessoes_tempo_write_own" on cartoes_sessoes_tempo;
create policy "cartoes_sessoes_tempo_write_own" on cartoes_sessoes_tempo for all
  using (colaborador_id = auth.uid() or auth_role() = 'gestor')
  with check (
    (colaborador_id = auth.uid() or auth_role() = 'gestor')
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sessoes_tempo.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

commit;

begin;

-- ---------------------------------------------------------------------
-- RPC: transforma uma fatia de sessão de cronômetro em apontamento.
--
-- Espelha `registrar_apontamento` (blocos 13/18) no que importa — SECURITY
-- DEFINER porque INSERT direto em `apontamentos` é revogado de
-- `authenticated` — e diverge em dois pontos, de propósito:
--
--   1. Aceita `p_data`. A trava "só lança hoje" (RLS + RPC original) existe
--      para impedir que alguém DIGITE tempo retroativo inventado. Sessão de
--      cronômetro tem timestamps reais, então lançar no dia em que o trabalho
--      de fato aconteceu é mais honesto, não menos. O gate é ter uma sessão
--      fechada de verdade, não a data.
--   2. Não exige `motivo`. O motivo do lançamento é o card, cujo código vai
--      em `observacoes`.
--
-- Quem fatia sessão que cruza a meia-noite é `fatiarSessaoPorDia`
-- (lib/tempo.ts), em TypeScript, para poder ser testado — esta função recebe
-- uma fatia já pronta.
-- ---------------------------------------------------------------------

create or replace function public.registrar_apontamento_timer(
  p_sessao_id uuid,
  p_data date,
  p_minutos integer
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessao cartoes_sessoes_tempo;
  v_demanda_id uuid;
  v_codigo text;
  v_titulo text;
  v_demanda record;
  v_carga_horaria_min integer;
  v_row apontamentos;
begin
  select * into v_sessao from cartoes_sessoes_tempo where id = p_sessao_id;

  if v_sessao.id is null then
    raise exception 'SESSAO_NAO_ENCONTRADA';
  end if;

  -- O dono da sessão lança o próprio tempo; o gestor também, porque
  -- `ajustarHorasRegistradas` permite a ele corrigir horas de outra pessoa.
  if v_sessao.colaborador_id <> auth.uid() and auth_role() <> 'gestor' then
    raise exception 'NAO_AUTORIZADO';
  end if;

  if v_sessao.finalizado_em is null then
    raise exception 'SESSAO_ABERTA';
  end if;

  -- Idempotência por (sessão, dia): pausar/despausar em sequência não lança
  -- duas vezes, e sessão que cruza a meia-noite ainda consegue lançar a fatia
  -- do segundo dia.
  if exists (
    select 1 from apontamentos
    where cartao_sessao_id = p_sessao_id and data = p_data
  ) then
    return null;
  end if;

  if p_minutos is null or p_minutos <= 0 then
    return null;
  end if;

  select c.demanda_id, c.codigo, c.titulo into v_demanda_id, v_codigo, v_titulo
  from cartoes c where c.id = v_sessao.cartao_id;

  -- Card sem demanda não vira apontamento. Não é erro: é um card que a pessoa
  -- ainda não ligou ao catálogo, e a UI avisa isso no widget de tempo.
  if v_demanda_id is null then
    return null;
  end if;

  select variavel, tempo_padrao_min, ativo into v_demanda from demandas where id = v_demanda_id;
  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  select carga_horaria_min into v_carga_horaria_min
  from colaboradores where id = v_sessao.colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  -- Mesma trava de `registrar_apontamento`: cronômetro esquecido a noite toda
  -- geraria 14h num dia e destruiria o índice. A pessoa lança o tempo real
  -- pelo ajuste manual.
  if p_minutos > v_carga_horaria_min then
    raise exception 'TEMPO_EXCEDE_CARGA';
  end if;

  insert into apontamentos (
    colaborador_id, demanda_id, data, quantidade, tempo_manual_min, motivo, observacoes,
    tempo_padrao_snapshot, blocos_totais_snapshot, cartao_sessao_id
  ) values (
    v_sessao.colaborador_id, v_demanda_id, p_data, 1, p_minutos, null,
    'Kanban ' || coalesce(v_codigo, '') || ' · ' || coalesce(v_titulo, ''),
    null, 1, p_sessao_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.registrar_apontamento_timer(uuid, date, integer) from public;
grant execute on function public.registrar_apontamento_timer(uuid, date, integer) to authenticated;

commit;


-- =====================================================================
-- Fim. Depois de rodar, vale conferir docs/TASKS.md e marcar as 32
-- migrations acima como aplicadas (as oito antes da 19 são das Fases
-- A/B/C1/C2/D3/E1/E3 do plano de melhorias de 22/07/2026; a 19ª e a 20ª
-- são o módulo Kanban e seus formulários públicos; as 21-28 são a paridade
-- de features do Kanban com a ferramenta de referência estilo Runrun.it; a
-- 29ª faz a entrega do card e as regras de dependência, requisito e WIP
-- valerem no banco, via trigger; a 30ª traz campos customizados por quadro;
-- a 31ª o motor de automações, o SLA por etapa e o tempo na etapa; e a 32ª
-- liga o cronômetro do card aos apontamentos, para o tempo do Kanban
-- contar no índice de produtividade).
-- =====================================================================
