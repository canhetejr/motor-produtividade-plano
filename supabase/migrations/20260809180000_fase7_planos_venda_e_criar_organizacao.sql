-- Fase 7 de docs/PLANO-PRODUTO.md: cadastro público.
--
-- 1. Planos reais de venda (o único plano existente, 'interno', é o da
--    Teralabs migrada na Fase 1 e não deve aparecer em /precos).
-- 2. RPC criar_organizacao: cria organizacao (trial) + área padrão +
--    colaborador gestor/admin numa única transação. NÃO cria auth.users —
--    isso fica fora do schema public, a action de cadastro cria o usuário
--    Auth primeiro e chama esta RPC passando o id; se a RPC falhar, a
--    action apaga o usuário órfão (auth.users órfão é benigno: getProfile()
--    devolve null e requireUser() manda para /login).

insert into public.planos (codigo, nome, assentos_inclusos, preco_mensal_centavos, ativo, ordem)
values
  ('trial', 'Trial', 5, 0, true, 1),
  ('essencial', 'Essencial', 5, 9900, true, 2),
  ('time', 'Time', 15, 24900, true, 3)
on conflict (codigo) do nothing;

create or replace function public.criar_organizacao(
  p_user_id uuid,
  p_nome_empresa text,
  p_nome_gestor text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_plano_id uuid;
  v_assentos integer;
  v_org_id uuid;
  v_area_id uuid;
  v_slug_base text;
  v_slug text;
begin
  select id, assentos_inclusos into v_plano_id, v_assentos
    from public.planos where codigo = 'trial' and ativo = true;

  if v_plano_id is null then
    raise exception 'PLANO_TRIAL_INDISPONIVEL';
  end if;

  if p_user_id is null or coalesce(trim(p_nome_empresa), '') = '' or coalesce(trim(p_nome_gestor), '') = '' then
    raise exception 'DADOS_INVALIDOS';
  end if;

  v_slug_base := trim(both '-' from regexp_replace(lower(trim(p_nome_empresa)), '[^a-z0-9]+', '-', 'g'));
  if v_slug_base = '' then
    v_slug_base := 'empresa';
  end if;

  -- Sufixo aleatório em vez de depender de retry no chamador: nome de
  -- empresa repetido ("Padaria do João" em duas cidades) não pode falhar o
  -- cadastro por causa de slug duplicado.
  v_slug := v_slug_base || '-' || substr(md5(random()::text), 1, 6);
  while exists (select 1 from public.organizacoes where slug = v_slug) loop
    v_slug := v_slug_base || '-' || substr(md5(random()::text), 1, 6);
  end loop;

  insert into public.organizacoes (nome, slug, plano_id, limite_assentos, status, trial_expira_em)
  values (trim(p_nome_empresa), v_slug, v_plano_id, v_assentos, 'trialing', now() + interval '14 days')
  returning id into v_org_id;

  insert into public.areas (nome, organizacao_id) values ('Geral', v_org_id)
  returning id into v_area_id;

  -- role='gestor' + admin=true: quem cadastra a organização é o primeiro
  -- admin dela (a constraint colaboradores_admin_exige_gestor exige que
  -- admin implique gestor). O trigger trg_colaboradores_assentos roda neste
  -- insert (ativo=true) e confere 1 <= limite_assentos do plano trial.
  insert into public.colaboradores (id, nome, area_id, role, admin, ativo, organizacao_id)
  values (p_user_id, trim(p_nome_gestor), v_area_id, 'gestor', true, true, v_org_id);

  return v_org_id;
end;
$$;

-- Só a action de cadastro chama, via service role (que não passa por grant
-- de authenticated/anon) — mesmo padrão de transicionar_organizacoes.
revoke all on function public.criar_organizacao(uuid, text, text) from public, anon, authenticated;
