-- Fluxo de aprovação por card, mesmo padrão de solicitacoes_demandas
-- (supabase/migrations/20260720225916_solicitacoes_demandas.sql +
-- 20260722030000_solicitacoes_aprovar_rejeitar_rpc.sql): status via enum,
-- RPC única SECURITY DEFINER faz a mudança de status + notificação numa
-- transação só. Diferença: ali o aprovador era sempre "o gestor"; aqui quem
-- pede a aprovação escolhe A QUEM pedir (aprovador_id, um membro do quadro),
-- então o gate das RPCs de decisão é "auth.uid() = aprovador_id", não role.

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

-- Insert só pela RPC solicitar_aprovacao_cartao (grant abaixo); update/status
-- só pelas RPCs aprovar_cartao/rejeitar_cartao. Sem policy de insert/update
-- direta pro client normal: as RPCs (security definer) fazem esse trabalho.

revoke all on cartoes_aprovacoes from anon, authenticated;
grant select on cartoes_aprovacoes to authenticated;

commit;

-- ---------------------------------------------------------------------
-- RPCs
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
