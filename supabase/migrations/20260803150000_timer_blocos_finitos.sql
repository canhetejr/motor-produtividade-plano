-- O timer também consome um bloco quando a demanda é finita. Sem esta trava,
-- sessões cronometradas contornavam o teto global aplicado ao apontamento manual.
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
  v_acumulado numeric;
  v_row apontamentos;
begin
  select * into v_sessao from cartoes_sessoes_tempo where id = p_sessao_id;
  if v_sessao.id is null then raise exception 'SESSAO_NAO_ENCONTRADA'; end if;
  if v_sessao.colaborador_id <> auth.uid() and auth_role() <> 'gestor' then raise exception 'NAO_AUTORIZADO'; end if;
  if v_sessao.finalizado_em is null then raise exception 'SESSAO_ABERTA'; end if;
  if exists (select 1 from apontamentos where cartao_sessao_id = p_sessao_id and data = p_data) then return null; end if;
  if p_minutos is null or p_minutos <= 0 then return null; end if;

  select demanda_id, codigo, titulo into v_demanda_id, v_codigo, v_titulo from cartoes where id = v_sessao.cartao_id;
  if v_demanda_id is null then return null; end if;

  -- FOR UPDATE serializa o consumo de uma mesma demanda finita: duas pausas
  -- simultâneas nunca podem observar o mesmo saldo e ultrapassar o teto.
  select variavel, tempo_padrao_min, ativo, blocos_totais, finita
  into v_demanda from demandas where id = v_demanda_id for update;
  if v_demanda is null or v_demanda.ativo is not true then raise exception 'DEMANDA_INATIVA'; end if;

  select carga_horaria_min into v_carga_horaria_min from colaboradores where id = v_sessao.colaborador_id and ativo = true;
  if v_carga_horaria_min is null then raise exception 'CONTA_INATIVA'; end if;
  if p_minutos > v_carga_horaria_min then raise exception 'TEMPO_EXCEDE_CARGA'; end if;

  if v_demanda.finita then
    select coalesce(sum(quantidade), 0) into v_acumulado from apontamentos where demanda_id = v_demanda_id;
    if v_acumulado + 1 > v_demanda.blocos_totais then raise exception 'BLOCOS_FINITOS_ESGOTADOS'; end if;
  end if;

  insert into apontamentos (
    colaborador_id, demanda_id, data, quantidade, tempo_manual_min, motivo, observacoes,
    tempo_padrao_snapshot, blocos_totais_snapshot, cartao_sessao_id
  ) values (
    v_sessao.colaborador_id, v_demanda_id, p_data, 1, p_minutos, null,
    'Kanban ' || coalesce(v_codigo, '') || ' · ' || coalesce(v_titulo, ''),
    null, 1, p_sessao_id
  ) returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.registrar_apontamento_timer(uuid, date, integer) from public;
grant execute on function public.registrar_apontamento_timer(uuid, date, integer) to authenticated;
