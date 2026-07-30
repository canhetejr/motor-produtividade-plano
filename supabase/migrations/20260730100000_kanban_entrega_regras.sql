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
