-- Bug de produto identificado no Gate 6 do plano de MCP
-- (docs/PLANO-MCP-PRODUTO.md): a escrita de apontamento grava `data =
-- current_date`, que no Postgres é a data civil do timezone do banco (UTC no
-- Supabase, sem config explícita em nenhuma migration), enquanto toda leitura
-- (lib/dates::hoje()) usa a data civil de America/Sao_Paulo. Entre 21h e meia-
-- noite em São Paulo os dois discordam: um apontamento lançado nesse
-- intervalo nasce com a data do dia seguinte (ainda em UTC) e some do
-- heatmap/histórico de "hoje", mesmo aparecendo normalmente na lista de
-- lançamentos recentes (que não filtra por data). RLS nunca bloqueia o
-- INSERT porque policy e função concordam entre si sobre o `current_date`
-- errado — só discordam da regra de produto.
--
-- Correção cirúrgica no domínio de apontamentos (função de escrita, função de
-- edição e as três policies que comparam `data = current_date`), sem alterar
-- o timezone do banco inteiro — isso teria efeito colateral em qualquer outra
-- função/coluna que já assume UTC.

begin;

-- Fonte única da data civil "hoje" para o domínio de apontamentos, espelhando
-- lib/dates::hoje() (America/Sao_Paulo) do lado do banco. `stable`, não
-- `immutable`: o resultado muda a cada dia, mas não dentro do mesmo comando.
create or replace function public.hoje_br()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

comment on function public.hoje_br() is
  'Data civil de America/Sao_Paulo, para igualar o "hoje" do banco ao de lib/dates::hoje(). Nunca use current_date em regra de negócio de apontamento — current_date segue o timezone do servidor (UTC), não o do usuário.';

-- registrar_apontamento_para: RPC de escrita real (registrar_apontamento é
-- só o wrapper que resolve auth.uid() e delega pra cá). Grava a data civil de
-- São Paulo, não a do servidor.
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

  -- p_demanda_id vem de fora: sem o filtro, um id de outra organização
  -- criaria apontamento vinculado a uma demanda que não é a sua. A
  -- organização vem da linha do colaborador (fonte confiável), nunca de
  -- parâmetro — sob service role não há org_atual() a que recorrer.
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
    public.hoje_br(),
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end,
    v_organizacao_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- atualizar_apontamento: SECURITY DEFINER, então RLS não protege esta
-- consulta — o filtro "data = hoje" precisa concordar com o que a função de
-- escrita gravou, senão editar um apontamento lançado à noite (nascido com
-- data de amanhã em UTC antes desta migration) nunca encontra a linha.
create or replace function public.atualizar_apontamento(p_id uuid, p_demanda_id uuid, p_quantidade numeric, p_tempo_manual_min integer, p_motivo text, p_observacoes text)
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

  -- p_demanda_id vem de fora: sem o filtro de organização, um id de outra
  -- empresa passaria pela checagem de "demanda existe e está ativa" e o
  -- apontamento seria reatribuído a uma demanda que não é da mesma organização.
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
    and data = public.hoje_br()
    and organizacao_id = (select public.org_atual())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'APONTAMENTO_NAO_ENCONTRADO';
  end if;

  return v_row;
end;
$function$;

-- As três policies (20260721013000, 20260722010000, normalizadas por
-- 20260802130000_rls_initplan_e_metas para initplan) trocam CURRENT_DATE por
-- public.hoje_br(), a mesma fonte que as duas funções acima agora usam —
-- senão alguém que tentasse fazer o INSERT/UPDATE/DELETE direto pela API REST
-- (contornando a Server Action) continuaria na regra antiga.
alter policy apontamentos_insert_own on public.apontamentos
  with check (((colaborador_id = (select auth.uid())) AND (data = public.hoje_br())));

alter policy apontamentos_update_own on public.apontamentos
  using (((colaborador_id = (select auth.uid())) AND (data = public.hoje_br())))
  with check (((colaborador_id = (select auth.uid())) AND (data = public.hoje_br())));

alter policy apontamentos_delete_own on public.apontamentos
  using (((colaborador_id = (select auth.uid())) AND (data = public.hoje_br())));

commit;
