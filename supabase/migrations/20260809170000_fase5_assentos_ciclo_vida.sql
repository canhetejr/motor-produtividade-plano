-- Fase 5 de docs/PLANO-PRODUTO.md: contagem e bloqueio de assentos.
--
-- Um assento é colaborador ativo=true + convite pendente não expirado —
-- só colaboradores permite disparar 50 convites num plano de 5; só
-- convites ignora quem foi criado por outro caminho.
create or replace function public.assentos_ocupados(p_org uuid) returns integer
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.colaboradores
      where organizacao_id = p_org and ativo = true)
  + (select count(*) from public.convites
      where organizacao_id = p_org
        and aceito_em is null and revogado_em is null and expira_em > now())
$$;

revoke all on function public.assentos_ocupados(uuid) from public, anon;
grant execute on function public.assentos_ocupados(uuid) to authenticated;

-- O trigger é o enforcement real; a checagem em TypeScript (Fase 7) existe
-- só para dar mensagem legível antes de bater aqui.
--
-- FOR UPDATE na linha da organização serializa dois convites/ativações
-- simultâneos — sem isso, duas transações leem "4 de 5" ao mesmo tempo e
-- ambas passam, e o teto vira sugestão (mesmo bug que
-- 20260803150000_timer_blocos_finitos.sql já corrigiu para blocos
-- finitos).
--
-- AFTER, não BEFORE: em BEFORE INSERT a contagem não enxerga a própria
-- linha entrando, e o teto fica sempre um a mais.
create or replace function public.trg_assentos_verificar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := new.organizacao_id;
  v_limite integer;
  v_status text;
  v_ocupados integer;
begin
  select limite_assentos, status into v_limite, v_status
    from public.organizacoes where id = v_org for update;

  if v_status not in ('trialing', 'ativa') then
    raise exception 'ORGANIZACAO_INATIVA';
  end if;

  v_ocupados := public.assentos_ocupados(v_org);
  if v_ocupados > v_limite then
    raise exception 'LIMITE_ASSENTOS_EXCEDIDO' using detail = v_ocupados || '/' || v_limite;
  end if;

  return new;
end;
$$;

create constraint trigger trg_convites_assentos
  after insert on public.convites
  deferrable initially immediate
  for each row execute function public.trg_assentos_verificar();

create constraint trigger trg_colaboradores_assentos
  after insert or update of ativo, organizacao_id on public.colaboradores
  for each row when (new.ativo = true)
  execute function public.trg_assentos_verificar();

-- Ciclo de vida: trial vencido → expirada; excluindo com prazo vencido
-- fica marcado, mas o delete em cascata NÃO é automático (irreversível,
-- decisão do plano — ver docs/PLANO-PRODUTO.md, risco 5). Este cron só
-- transiciona status; quem apaga é ação manual do operador.
create or replace function public.transicionar_organizacoes() returns table(id uuid, status_novo text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.organizacoes o
  set status = 'expirada'
  where o.status = 'trialing' and o.trial_expira_em < now()
  returning o.id, o.status;
end;
$$;

revoke all on function public.transicionar_organizacoes() from public, anon, authenticated;
-- Só service role chama — é o cron organizacoes-ciclo (Fase 7).
