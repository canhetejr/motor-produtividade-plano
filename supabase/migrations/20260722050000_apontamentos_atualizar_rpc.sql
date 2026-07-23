-- Editar apontamento (hoje só existia excluir + relançar). Mesma regra de
-- data do UPDATE/DELETE existentes: só o dia atual. atualizar_apontamento()
-- espelha as validações de registrar_apontamento() (20260722020000) — motivo
-- válido, teto de blocos, teto de tempo manual, demanda ativa — e recongela
-- o snapshot com os valores atuais da demanda (edição no mesmo dia, então
-- recongelar não reintroduz a reescrita retroativa que o snapshot existe
-- pra evitar). Revoga UPDATE direto de `authenticated`, mesmo raciocínio da
-- RPC de registrar: só esse caminho valida as regras de negócio no banco.

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

-- UPDATE direto continuava permitido pela RLS (apontamentos_update_own já
-- exige dono + data atual), mas sem validar motivo/blocos/tempo/demanda
-- ativa — mesma lacuna que o INSERT tinha antes da RPC de registrar.
revoke update on public.apontamentos from authenticated;

commit;
