-- Fecha a lacuna que sobrava mesmo depois da RLS de INSERT exigir
-- `data = current_date` (20260722010000): nada impedia um INSERT direto via
-- REST forjar tempo_padrao_snapshot/blocos_totais_snapshot, pular o teto de
-- blocos, ignorar o teto de tempo manual, usar motivo fora da lista fixa, ou
-- lançar numa demanda inativa — a policy de INSERT não valida nenhuma dessas
-- regras, só quem é o dono e a data.
--
-- registrar_apontamento() replica em PL/pgSQL exatamente as regras hoje só
-- na Server Action (app/(app)/apontamento/actions.ts:64-98) e vira o único
-- caminho de escrita: revoga o INSERT direto de `authenticated` no final,
-- então só esta função (SECURITY DEFINER) e o service_role podem inserir.
--
-- Lista de motivos replicada de lib/motivos-outros.ts (MOTIVOS_OUTROS) —
-- se um motivo novo for adicionado lá, esta função precisa de uma migration
-- nova pra acompanhar (não há como compartilhar a constante entre TS e SQL).

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

-- Só a RPC acima (e service_role, pra scripts administrativos) escreve
-- daqui pra frente. UPDATE/DELETE seguem como estavam (RLS já exige dono +
-- data atual) — só o INSERT tinha o problema de cálculo forjável.
revoke insert on public.apontamentos from authenticated;

commit;
