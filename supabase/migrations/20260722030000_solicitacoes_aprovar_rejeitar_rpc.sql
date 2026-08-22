-- aprovarSolicitacao/rejeitarSolicitacao (app/(app)/catalogo/actions.ts) faziam
-- de 4 a 5 chamadas separadas ao Supabase (claim → validação → insert/update
-- demandas → possível rollback manual do status → notificação). Se caísse no
-- meio, podia sobrar solicitação "APROVADA" sem demanda correspondente, ou
-- notificação perdida — não havia transação real amarrando os passos.
--
-- Mover tudo pra uma função PL/pgSQL resolve isso de graça: a chamada da RPC
-- é uma única statement, então qualquer RAISE EXCEPTION no meio desfaz TODAS
-- as mudanças já feitas na mesma invocação (inclusive o UPDATE de claim) —
-- não precisa mais do padrão manual de "reverter status pra PENDENTE".

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

  -- Normaliza igual prepararDemanda() em catalogo/actions.ts: variável zera
  -- tempo/blocos; demanda em blocos sem tempo padrão é incoerente, barra.
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
