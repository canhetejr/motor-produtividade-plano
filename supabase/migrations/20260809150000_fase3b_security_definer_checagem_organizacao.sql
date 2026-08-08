-- Fase 3b de docs/PLANO-PRODUTO.md: as 12 funções SECURITY DEFINER que
-- recebem um id e escrevem dado ganham checagem explícita de organização.
-- Elas rodam com o privilégio do dono e bypassam RLS por definição — a
-- Fase 3 (políticas restritivas) não protege nada aqui, e sem esta
-- migration a Fase 3 fica decorativa para estes 12 caminhos de escrita.
--
-- Padrão adotado, função a função: sempre que possível, o filtro de
-- organização entra na MESMA cláusula WHERE que já busca a linha pelo id
-- (`and organizacao_id = (select public.org_atual())`) — assim uma
-- tentativa cross-tenant cai no erro de "não encontrado" que a função já
-- tinha, sem inventar mensagem nova nem vazar se o id existe em outra
-- organização. Onde a função recebe um SEGUNDO id de fora (p_demanda_id,
-- p_aprovador_id, p_colaborador_id), esse também ganha o filtro — o
-- primeiro id sozinho não basta se o segundo puder vir de outra empresa.
--
-- As outras 6 funções SECURITY DEFINER (auth_role, auth_is_admin,
-- is_quadro_membro, gerar_codigo_cartao, colaboradores_proteger_admin,
-- cartoes_notificar_responsavel) não recebem id de fora ou são triggers —
-- ficam fora desta leva, ver skill vertice-isolamento.

-- ============================================================
-- aprovar_cartao / rejeitar_cartao — cartoes_aprovacoes por p_id
-- ============================================================
create or replace function public.aprovar_cartao(p_id uuid)
 returns cartoes_aprovacoes
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_aprovacao cartoes_aprovacoes;
  v_titulo text;
  v_quadro_id uuid;
begin
  update cartoes_aprovacoes
  set status = 'APROVADA', atualizado_em = now()
  where id = p_id and status = 'PENDENTE' and aprovador_id = auth.uid()
    and organizacao_id = (select public.org_atual())
  returning * into v_aprovacao;

  if v_aprovacao.id is null then
    raise exception 'APROVACAO_NAO_ENCONTRADA';
  end if;

  select c.titulo, col.quadro_id into v_titulo, v_quadro_id
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = v_aprovacao.cartao_id;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
  values (
    v_aprovacao.solicitado_por, 'cartao_aprovacao_aprovada', 'Solicitação aprovada',
    'Sua solicitação de aprovação para "' || v_titulo || '" foi aprovada.',
    '/kanban/' || v_quadro_id, v_aprovacao.organizacao_id
  );

  insert into comentarios_cartao (cartao_id, colaborador_id, conteudo, tipo, organizacao_id)
  values (v_aprovacao.cartao_id, auth.uid(), 'Aprovou a solicitação.', 'sistema', v_aprovacao.organizacao_id);

  return v_aprovacao;
end;
$function$;

create or replace function public.rejeitar_cartao(p_id uuid, p_comentario text DEFAULT NULL::text)
 returns cartoes_aprovacoes
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_aprovacao cartoes_aprovacoes;
  v_titulo text;
  v_quadro_id uuid;
begin
  update cartoes_aprovacoes
  set status = 'REJEITADA', comentario = p_comentario, atualizado_em = now()
  where id = p_id and status = 'PENDENTE' and aprovador_id = auth.uid()
    and organizacao_id = (select public.org_atual())
  returning * into v_aprovacao;

  if v_aprovacao.id is null then
    raise exception 'APROVACAO_NAO_ENCONTRADA';
  end if;

  select c.titulo, col.quadro_id into v_titulo, v_quadro_id
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = v_aprovacao.cartao_id;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
  values (
    v_aprovacao.solicitado_por, 'cartao_aprovacao_rejeitada', 'Solicitação rejeitada',
    'Sua solicitação de aprovação para "' || v_titulo || '" foi rejeitada.',
    '/kanban/' || v_quadro_id, v_aprovacao.organizacao_id
  );

  insert into comentarios_cartao (cartao_id, colaborador_id, conteudo, tipo, organizacao_id)
  values (
    v_aprovacao.cartao_id, auth.uid(),
    'Rejeitou a solicitação.' || case when p_comentario is not null then ' Motivo: ' || p_comentario else '' end,
    'sistema', v_aprovacao.organizacao_id
  );

  return v_aprovacao;
end;
$function$;

-- ============================================================
-- aprovar_correcao_apontamento / rejeitar_correcao_apontamento —
-- apontamentos_correcoes por p_id
-- ============================================================
create or replace function public.aprovar_correcao_apontamento(p_id uuid)
 returns apontamentos
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_correcao apontamentos_correcoes;
  v_demanda record;
  v_carga integer;
  v_row apontamentos;
begin
  if auth_role() <> 'gestor' then
    raise exception 'APENAS_GESTOR: so um gestor pode aprovar correcao de apontamento';
  end if;

  select * into v_correcao
  from apontamentos_correcoes
  where id = p_id and status = 'PENDENTE'
    and organizacao_id = (select public.org_atual())
  for update;

  if v_correcao.id is null then
    raise exception 'CORRECAO_NAO_ENCONTRADA';
  end if;

  select carga_horaria_min into v_carga
  from colaboradores where id = v_correcao.colaborador_id and ativo = true;
  if v_carga is null then
    raise exception 'CONTA_INATIVA';
  end if;

  select variavel, tempo_padrao_min, blocos_totais, ativo
  into v_demanda from demandas
  where id = v_correcao.demanda_id and organizacao_id = (select public.org_atual());
  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  if v_demanda.variavel then
    if v_correcao.tempo_manual_min is null or v_correcao.tempo_manual_min <= 0 then
      raise exception 'TEMPO_OBRIGATORIO';
    end if;
    if v_correcao.tempo_manual_min > v_carga then
      raise exception 'TEMPO_EXCEDE_CARGA';
    end if;
  else
    if v_demanda.tempo_padrao_min is null then
      raise exception 'DEMANDA_SEM_TEMPO_PADRAO';
    end if;
    if v_demanda.blocos_totais > 1 and v_correcao.quantidade > v_demanda.blocos_totais then
      raise exception 'BLOCOS_EXCEDIDOS';
    end if;
  end if;

  insert into apontamentos (
    colaborador_id, demanda_id, quantidade, tempo_manual_min, motivo, observacoes,
    data, tempo_padrao_snapshot, blocos_totais_snapshot, organizacao_id
  ) values (
    v_correcao.colaborador_id, v_correcao.demanda_id, v_correcao.quantidade,
    v_correcao.tempo_manual_min, v_correcao.motivo, v_correcao.observacoes,
    v_correcao.data,
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end,
    v_correcao.organizacao_id
  )
  returning * into v_row;

  update apontamentos_correcoes
  set status = 'APROVADA', decidido_em = now(), decidido_por = auth.uid(), apontamento_id = v_row.id
  where id = p_id;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
  values (
    v_correcao.colaborador_id, 'solicitacao_aprovada', 'Correção aprovada',
    'Seu lançamento retroativo de ' || to_char(v_correcao.data, 'DD/MM/YYYY') || ' foi aprovado.',
    '/apontamento/historico', v_correcao.organizacao_id
  );

  return v_row;
end;
$function$;

create or replace function public.rejeitar_correcao_apontamento(p_id uuid, p_motivo text DEFAULT NULL::text)
 returns apontamentos_correcoes
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_correcao apontamentos_correcoes;
begin
  if auth_role() <> 'gestor' then
    raise exception 'APENAS_GESTOR: so um gestor pode rejeitar correcao de apontamento';
  end if;

  update apontamentos_correcoes
  set status = 'REJEITADA', decidido_em = now(), decidido_por = auth.uid()
  where id = p_id and status = 'PENDENTE'
    and organizacao_id = (select public.org_atual())
  returning * into v_correcao;

  if v_correcao.id is null then
    raise exception 'CORRECAO_NAO_ENCONTRADA';
  end if;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
  values (
    v_correcao.colaborador_id, 'solicitacao_rejeitada', 'Correção recusada',
    'Seu lançamento retroativo de ' || to_char(v_correcao.data, 'DD/MM/YYYY') || ' foi recusado.'
      || coalesce(' Motivo: ' || p_motivo, ''),
    '/apontamento/historico', v_correcao.organizacao_id
  );

  return v_correcao;
end;
$function$;

-- ============================================================
-- aprovar_solicitacao / rejeitar_solicitacao — solicitacoes_demandas por p_id
-- ============================================================
create or replace function public.aprovar_solicitacao(p_id uuid)
 returns solicitacoes_demandas
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    and organizacao_id = (select public.org_atual())
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
    insert into demandas (area_id, nome, tempo_padrao_min, variavel, blocos_totais, finita, ativo, organizacao_id)
    values (v_sol.area_id, v_sol.nome, v_tempo_padrao_min, v_sol.variavel, v_blocos_totais, v_finita, true, v_sol.organizacao_id);
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
    where id = v_sol.demanda_id and organizacao_id = v_sol.organizacao_id;
  end if;

  if exists (
    select 1 from colaboradores
    where id = v_sol.colaborador_id and notif_solicitacoes = true
  ) then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
    values (
      v_sol.colaborador_id, 'solicitacao_aprovada', 'Solicitação aprovada',
      'Sua sugestão "' || v_sol.nome || '" foi aprovada.', '/catalogo?tab=solicitacoes', v_sol.organizacao_id
    );
  end if;

  return v_sol;
exception
  when unique_violation then
    raise exception 'NOME_DUPLICADO';
end;
$function$;

create or replace function public.rejeitar_solicitacao(p_id uuid)
 returns solicitacoes_demandas
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    and organizacao_id = (select public.org_atual())
  returning * into v_sol;

  if v_sol.id is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA';
  end if;

  if exists (
    select 1 from colaboradores
    where id = v_sol.colaborador_id and notif_solicitacoes = true
  ) then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
    values (
      v_sol.colaborador_id, 'solicitacao_rejeitada', 'Solicitação rejeitada',
      'Sua sugestão "' || v_sol.nome || '" foi rejeitada.', '/catalogo?tab=solicitacoes', v_sol.organizacao_id
    );
  end if;

  return v_sol;
end;
$function$;

-- ============================================================
-- atualizar_apontamento — apontamento por p_id, demanda por p_demanda_id
-- ============================================================
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
    and data = current_date
    and organizacao_id = (select public.org_atual())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'APONTAMENTO_NAO_ENCONTRADO';
  end if;

  return v_row;
end;
$function$;

-- ============================================================
-- registrar_apontamento — demanda por p_demanda_id (colaborador é sempre
-- o próprio chamador, auth.uid(), então não precisa de filtro adicional)
-- ============================================================
create or replace function public.registrar_apontamento(p_demanda_id uuid, p_quantidade numeric, p_tempo_manual_min integer, p_motivo text, p_observacoes text)
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
  v_organizacao_id uuid;
begin
  if v_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min, organizacao_id into v_carga_horaria_min, v_organizacao_id
  from colaboradores
  where id = v_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  -- p_demanda_id vem de fora: sem o filtro, um id de outra organização
  -- criaria apontamento vinculado a uma demanda que não é a sua.
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
    v_colaborador_id, p_demanda_id, p_quantidade, p_tempo_manual_min, v_motivo, p_observacoes,
    current_date,
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end,
    v_organizacao_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- ============================================================
-- registrar_apontamento_timer — sessão por p_sessao_id. cartoes_sessoes_
-- tempo.cartao_id tem FK composta (Fase 2, Nível C) contra cartoes, então
-- o cartão derivado da sessão é garantido da mesma organização. MAS
-- cartoes.demanda_id NÃO tem FK composta (só coluna_id tem, de propósito —
-- ver a migration da Fase 2) — nada impede hoje, estruturalmente, que
-- aponte para uma demanda de outra organização. O filtro na busca da
-- demanda é necessário de verdade, não defesa em profundidade redundante.
-- ============================================================
create or replace function public.registrar_apontamento_timer(p_sessao_id uuid, p_data date, p_minutos integer)
 returns apontamentos
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  select * into v_sessao from cartoes_sessoes_tempo
  where id = p_sessao_id and organizacao_id = (select public.org_atual());
  if v_sessao.id is null then raise exception 'SESSAO_NAO_ENCONTRADA'; end if;
  if v_sessao.colaborador_id <> auth.uid() and auth_role() <> 'gestor' then raise exception 'NAO_AUTORIZADO'; end if;
  if v_sessao.finalizado_em is null then raise exception 'SESSAO_ABERTA'; end if;
  if exists (select 1 from apontamentos where cartao_sessao_id = p_sessao_id and data = p_data) then return null; end if;
  if p_minutos is null or p_minutos <= 0 then return null; end if;

  select demanda_id, codigo, titulo into v_demanda_id, v_codigo, v_titulo from cartoes where id = v_sessao.cartao_id;
  if v_demanda_id is null then return null; end if;

  select variavel, tempo_padrao_min, ativo, blocos_totais, finita
  into v_demanda from demandas
  where id = v_demanda_id and organizacao_id = v_sessao.organizacao_id
  for update;
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
    tempo_padrao_snapshot, blocos_totais_snapshot, cartao_sessao_id, organizacao_id
  ) values (
    v_sessao.colaborador_id, v_demanda_id, p_data, 1, p_minutos, null,
    'Kanban ' || coalesce(v_codigo, '') || ' · ' || coalesce(v_titulo, ''),
    null, 1, p_sessao_id, v_sessao.organizacao_id
  ) returning * into v_row;
  return v_row;
end;
$function$;

-- ============================================================
-- avancar_sequencia_cartao — p_cartao_id. is_quadro_membro() confirma
-- pertencimento ao quadro mas não confirma organização (também é
-- SECURITY DEFINER, também bypassa RLS) — o filtro entra na própria busca
-- do cartão.
-- ============================================================
create or replace function public.avancar_sequencia_cartao(p_cartao_id uuid)
 returns cartoes_sequencia_responsaveis
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quadro_id uuid;
  v_atual cartoes_sequencia_responsaveis;
  v_proximo cartoes_sequencia_responsaveis;
  v_titulo text;
  v_organizacao_id uuid;
begin
  select col.quadro_id, c.titulo, c.organizacao_id into v_quadro_id, v_titulo, v_organizacao_id
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = p_cartao_id and c.organizacao_id = (select public.org_atual());

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
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
    values (
      v_proximo.colaborador_id, 'cartao_sequencia_avancou', 'É a sua vez',
      'O card "' || v_titulo || '" chegou até você na sequência de responsáveis.',
      '/kanban/' || v_quadro_id, v_organizacao_id
    );
  end if;

  return v_proximo;
end;
$function$;

-- ============================================================
-- solicitar_aprovacao_cartao — cartão por p_cartao_id, aprovador por
-- p_aprovador_id. Ambos são ids externos: o cartão via a mesma lógica de
-- avancar_sequencia_cartao, e o aprovador precisa pertencer à mesma
-- organização — sem isso, alguém poderia designar um colaborador de outra
-- empresa como aprovador do próprio cartão.
-- ============================================================
create or replace function public.solicitar_aprovacao_cartao(p_cartao_id uuid, p_aprovador_id uuid)
 returns cartoes_aprovacoes
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quadro_id uuid;
  v_titulo text;
  v_organizacao_id uuid;
  v_aprovacao cartoes_aprovacoes;
begin
  select col.quadro_id, c.titulo, c.organizacao_id into v_quadro_id, v_titulo, v_organizacao_id
  from cartoes c join colunas col on col.id = c.coluna_id
  where c.id = p_cartao_id and c.organizacao_id = (select public.org_atual());

  if v_quadro_id is null or not is_quadro_membro(v_quadro_id) then
    raise exception 'NAO_AUTORIZADO';
  end if;

  if not exists (
    select 1 from colaboradores where id = p_aprovador_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'APROVADOR_NAO_E_MEMBRO';
  end if;

  if not exists (
    select 1 from quadros_membros
    where quadro_id = v_quadro_id and colaborador_id = p_aprovador_id
  ) and not exists (
    select 1 from colaboradores where id = p_aprovador_id and role = 'gestor' and ativo = true
  ) then
    raise exception 'APROVADOR_NAO_E_MEMBRO';
  end if;

  insert into cartoes_aprovacoes (cartao_id, solicitado_por, aprovador_id, organizacao_id)
  values (p_cartao_id, auth.uid(), p_aprovador_id, v_organizacao_id)
  returning * into v_aprovacao;

  insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
  values (
    p_aprovador_id, 'cartao_aprovacao_pendente', 'Aprovação pendente',
    'O card "' || v_titulo || '" está aguardando sua aprovação.',
    '/kanban/' || v_quadro_id, v_organizacao_id
  );

  return v_aprovacao;
end;
$function$;

-- ============================================================
-- definir_admin — colaborador por p_colaborador_id. Sem o filtro, um
-- admin poderia conceder (ou pior, revogar) admin de um colaborador que
-- nem pertence à sua organização.
-- ============================================================
create or replace function public.definir_admin(p_colaborador_id uuid, p_admin boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_role text;
  v_restantes integer;
begin
  if not auth_is_admin() then
    raise exception 'APENAS_ADMIN: só um admin pode conceder ou revogar acesso de admin';
  end if;

  select role into v_role from colaboradores
  where id = p_colaborador_id and organizacao_id = (select public.org_atual());
  if not found then
    raise exception 'COLABORADOR_INEXISTENTE: colaborador não encontrado';
  end if;

  if p_admin then
    if v_role <> 'gestor' then
      raise exception 'PRECISA_SER_GESTOR: promova a gestor antes de conceder acesso de admin';
    end if;
  else
    select count(*) into v_restantes
    from colaboradores
    where admin and ativo and id <> p_colaborador_id
      and organizacao_id = (select public.org_atual());

    if v_restantes = 0 then
      raise exception 'ULTIMO_ADMIN: o sistema precisa de pelo menos um admin ativo';
    end if;
  end if;

  update colaboradores set admin = p_admin
  where id = p_colaborador_id and organizacao_id = (select public.org_atual());
end;
$function$;
