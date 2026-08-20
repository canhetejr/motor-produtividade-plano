-- Apontamentos são lançados e exibidos pela data civil de São Paulo. O
-- servidor/Postgres pode rodar em UTC; current_date mudava às 21h locais,
-- fazendo criação, edição e RLS discordarem da UI no fim do dia.
--
-- O cronômetro não usa esta fonte: ele já recebe p_data calculada pela fatia
-- local em lib/tempo.ts e preserva a data real de cada trecho da sessão.

begin;

alter table public.apontamentos
  alter column data set default timezone('America/Sao_Paulo', now())::date;

-- Mesmo contrato no caminho REST/RLS, embora INSERT/UPDATE diretos estejam
-- revogados para authenticated: evita reintroduzir UTC se os grants mudarem.
drop policy if exists "apontamentos_insert_own" on public.apontamentos;
create policy "apontamentos_insert_own" on public.apontamentos for insert
  with check (colaborador_id = auth.uid() and data = timezone('America/Sao_Paulo', now())::date);

drop policy if exists "apontamentos_update_own" on public.apontamentos;
create policy "apontamentos_update_own" on public.apontamentos for update
  using (colaborador_id = auth.uid() and data = timezone('America/Sao_Paulo', now())::date)
  with check (colaborador_id = auth.uid() and data = timezone('America/Sao_Paulo', now())::date);

drop policy if exists "apontamentos_delete_own" on public.apontamentos;
create policy "apontamentos_delete_own" on public.apontamentos for delete
  using (colaborador_id = auth.uid() and data = timezone('America/Sao_Paulo', now())::date);

-- Fonte única para criação manual na UI e pelo MCP. O wrapper autenticado
-- continua delegando para esta função, que é a única com colaborador explícito.
create or replace function public.registrar_apontamento_para(
  p_colaborador_id uuid,
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
)
returns apontamentos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_acumulado numeric;
  v_row apontamentos;
  v_organizacao_id uuid;
begin
  if p_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min, organizacao_id into v_carga_horaria_min, v_organizacao_id
  from colaboradores
  where id = p_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  select variavel, tempo_padrao_min, blocos_totais, ativo, finita
  into v_demanda
  from demandas
  where id = p_demanda_id and organizacao_id = v_organizacao_id;

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
    data, tempo_padrao_snapshot, blocos_totais_snapshot, organizacao_id
  ) values (
    p_colaborador_id, p_demanda_id, p_quantidade, p_tempo_manual_min, v_motivo, p_observacoes,
    timezone('America/Sao_Paulo', now())::date,
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end,
    v_organizacao_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- A edição precisa reconhecer o mesmo "hoje" da criação. Sem isso, um
-- apontamento criado às 21h locais nasceria certo, mas não poderia ser editado
-- nem excluído até a meia-noite de São Paulo.
create or replace function public.atualizar_apontamento(
  p_id uuid,
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
)
returns apontamentos
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  where id = p_demanda_id and organizacao_id = (select public.org_atual());

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
    and data = timezone('America/Sao_Paulo', now())::date
    and organizacao_id = (select public.org_atual())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'APONTAMENTO_NAO_ENCONTRADO';
  end if;

  return v_row;
end;
$function$;

commit;
