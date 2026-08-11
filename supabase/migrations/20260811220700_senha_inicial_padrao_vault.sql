-- A senha padrão pertence a cada organização e não pode ficar em coluna de
-- texto. O Vault mantém o valor cifrado; a aplicação só o lê com service role
-- depois de requireGestor(), para criar uma conta nova.
alter table public.organizacoes
  add column if not exists senha_inicial_secret_id uuid;

create or replace function public.definir_senha_inicial_padrao(p_senha text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_org uuid := (select public.org_atual());
  v_secret_id uuid;
begin
  if not public.auth_is_admin() then
    raise exception 'APENAS_ADMIN';
  end if;
  if length(trim(p_senha)) < 6 then
    raise exception 'SENHA_INVALIDA';
  end if;

  select senha_inicial_secret_id into v_secret_id
  from public.organizacoes where id = v_org for update;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_senha,
      'vertice-senha-inicial-' || v_org::text,
      'Senha inicial padrão da organização Vértice',
      null
    );
    update public.organizacoes set senha_inicial_secret_id = v_secret_id where id = v_org;
  else
    perform vault.update_secret(v_secret_id, p_senha, null, null, null);
  end if;
end;
$$;

create or replace function public.obter_senha_inicial_padrao(p_organizacao_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  -- A função só é chamada pelo createAdminClient depois do requireGestor()
  -- da action. Sem esta barreira, um JWT comum poderia obter o texto secreto.
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'APENAS_SERVICE_ROLE';
  end if;

  return (
    select d.decrypted_secret
    from public.organizacoes o
    join vault.decrypted_secrets d on d.id = o.senha_inicial_secret_id
    where o.id = p_organizacao_id
  );
end;
$$;

revoke all on function public.definir_senha_inicial_padrao(text) from public, anon;
grant execute on function public.definir_senha_inicial_padrao(text) to authenticated;
revoke all on function public.obter_senha_inicial_padrao(uuid) from public, anon, authenticated;
grant execute on function public.obter_senha_inicial_padrao(uuid) to service_role;
