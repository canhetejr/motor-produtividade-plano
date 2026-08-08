-- Fase 7: aceite de convite (app/convite/[token]/page.tsx).
--
-- RPC transacional em vez de duas chamadas separadas da action porque a
-- ordem importa para não contar assento duas vezes: assentos_ocupados()
-- soma colaboradores ativos + convites pendentes. Se a action inserisse o
-- colaborador ANTES de marcar o convite aceito, as duas chamadas do
-- trigger trg_colaboradores_assentos veriam, por um instante, o convite
-- ainda pendente E o colaborador já ativo — contando o mesmo assento duas
-- vezes e podendo recusar uma aceitação legítima perto do teto. Aqui o
-- update (convite -> aceito) roda antes do insert (colaborador), dentro da
-- mesma transação, então o total nunca sobe.
--
-- FOR UPDATE na linha do convite serializa duas tentativas de aceite do
-- mesmo token (ex.: duplo clique) — mesma razão de trg_assentos_verificar
-- travar a linha de organizacoes.
create or replace function public.aceitar_convite(
  p_token_hash text,
  p_user_id uuid,
  p_nome text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_convite public.convites%rowtype;
begin
  select * into v_convite from public.convites where token_hash = p_token_hash for update;

  if not found then
    raise exception 'CONVITE_INVALIDO';
  end if;
  if v_convite.aceito_em is not null then
    raise exception 'CONVITE_JA_ACEITO';
  end if;
  if v_convite.revogado_em is not null then
    raise exception 'CONVITE_REVOGADO';
  end if;
  if v_convite.expira_em < now() then
    raise exception 'CONVITE_EXPIRADO';
  end if;
  if p_user_id is null or coalesce(trim(p_nome), '') = '' then
    raise exception 'DADOS_INVALIDOS';
  end if;

  update public.convites set aceito_em = now() where id = v_convite.id;

  insert into public.colaboradores (id, nome, area_id, role, ativo, organizacao_id)
  values (p_user_id, trim(p_nome), v_convite.area_id, v_convite.role, true, v_convite.organizacao_id);

  return v_convite.organizacao_id;
end;
$$;

-- Só a action de aceite chama, via service role — o token da URL, verificado
-- por hash, é a única autorização (mesmo padrão de rota pública com token
-- descrito na skill vertice-isolamento).
revoke all on function public.aceitar_convite(text, uuid, text) from public, anon, authenticated;
