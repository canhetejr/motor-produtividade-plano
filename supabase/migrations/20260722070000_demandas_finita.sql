-- Fase 2 da confiabilidade (bloco finito): "ID VET"-like demandas em blocos
-- que se esgotam de vez, não recorrem todo dia. Decisão confirmada com o
-- usuário: o teto é GLOBAL — a soma de quantidade de TODOS os colaboradores
-- que lançam nessa demanda nunca passa de blocos_totais, não um teto por
-- colaborador. Só faz sentido quando blocos_totais > 1 (senão não há o que
-- "esgotar" em blocos).

begin;

alter table demandas add column if not exists finita boolean not null default false;
alter table solicitacoes_demandas add column if not exists finita boolean not null default false;

-- Soma de quantidade por demanda, através de todos os colaboradores — usa
-- apontamentos (não apontamentos_calculado), já que só precisa de
-- quantidade, não do tempo calculado.
create or replace view demandas_acumulado
with (security_invoker = true) as
select demanda_id, coalesce(sum(quantidade), 0) as acumulado
from apontamentos
group by demanda_id;

grant select on demandas_acumulado to authenticated, service_role;

commit;


-- ---------------------------------------------------------------------
-- registrar_apontamento / atualizar_apontamento (create or replace):
-- ganham a trava de blocos finitos — quando demanda.finita, a soma de
-- TODOS os colaboradores nessa demanda (não só quem está lançando agora)
-- nunca pode passar de blocos_totais.
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
      -- Exclui a própria linha do acumulado: editar não deve contar o
      -- valor antigo dela duas vezes.
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


-- ---------------------------------------------------------------------
-- aprovar_solicitacao (create or replace): passa a copiar `finita` pra
-- demanda aprovada/alterada, e barra normalização incoerente (finita sem
-- estar em blocos) igual prepararDemanda faz no lado TS.
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
