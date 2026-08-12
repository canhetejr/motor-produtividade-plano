-- O trigger de atribuição de cartão precisa propagar a organização da própria
-- atribuição. Sem isso, notificações em organizações novas caem no default
-- histórico da organização Teralabs e violam a FK composta de destinatário.
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
  from public.cartoes c
  join public.colunas col on col.id = c.coluna_id
  where c.id = new.cartao_id;

  if v_quadro_id is null then
    return new;
  end if;

  insert into public.notificacoes (destinatario_id, organizacao_id, tipo, titulo, mensagem, link)
  values (
    new.colaborador_id,
    new.organizacao_id,
    'cartao_responsavel_atribuido',
    'Novo card para você',
    'Você virou responsável pelo card "' || v_titulo || '".',
    '/kanban/' || v_quadro_id
  );

  return new;
end;
$$;
