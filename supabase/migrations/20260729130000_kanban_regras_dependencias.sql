-- Aba "Regras": dependências entre cards (pré-requisito/subsequente — a
-- mesma tabela lida nos dois sentidos: pré-requisitos de X são as linhas
-- onde cartao_id = X; subsequentes de X são as linhas onde predecessor_id =
-- X) e sequência de responsáveis (fila ordenada — quando um entrega, avança
-- pro próximo automaticamente via RPC, notificando-o).

begin;

create table if not exists cartoes_predecessores (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  predecessor_id uuid references cartoes(id) on delete cascade not null,
  criado_em timestamptz not null default now(),
  primary key (cartao_id, predecessor_id),
  check (cartao_id <> predecessor_id)
);

create index if not exists cartoes_predecessores_inverso_idx on cartoes_predecessores (predecessor_id);

create table if not exists cartoes_sequencia_responsaveis (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  ordem integer not null,
  entregue boolean not null default false,
  entregue_em timestamptz,
  unique (cartao_id, ordem)
);

create index if not exists cartoes_sequencia_cartao_idx on cartoes_sequencia_responsaveis (cartao_id, ordem);

commit;

begin;

alter table cartoes_predecessores enable row level security;
alter table cartoes_sequencia_responsaveis enable row level security;

drop policy if exists "cartoes_predecessores_all_membro" on cartoes_predecessores;
create policy "cartoes_predecessores_all_membro" on cartoes_predecessores for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_predecessores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_predecessores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "cartoes_sequencia_all_membro" on cartoes_sequencia_responsaveis;
create policy "cartoes_sequencia_all_membro" on cartoes_sequencia_responsaveis for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sequencia_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sequencia_responsaveis.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on cartoes_predecessores, cartoes_sequencia_responsaveis from anon;

commit;

-- ---------------------------------------------------------------------
-- RPC: avança a sequência de responsáveis de um card — marca o atual (menor
-- `ordem` ainda não entregue) como entregue e notifica o próximo da fila.
-- SECURITY DEFINER só pra poder inserir em `notificacoes` (mesmo padrão de
-- aprovar_solicitacao); a checagem de acesso é feita à mão via
-- is_quadro_membro, igual às policies acima.
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
      'O card "' || v_titulo || '" chegou até você na sequência de responsáveis.', null
    );
  end if;

  return v_proximo;
end;
$$;

revoke all on function public.avancar_sequencia_cartao(uuid) from public;
grant execute on function public.avancar_sequencia_cartao(uuid) to authenticated;

commit;
