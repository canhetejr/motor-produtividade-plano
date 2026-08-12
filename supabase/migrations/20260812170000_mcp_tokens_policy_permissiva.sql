-- mcp_tokens_proprio foi criada como RESTRICTIVE para manter o isolamento
-- colaborador + organização. Em Postgres, uma policy restritiva sozinha não
-- concede acesso: é necessária ao menos uma policy PERMISSIVE aplicável.
-- Esta policy usa a mesma condição do dono; em conjunto com a restritiva,
-- INSERT/SELECT/UPDATE seguem permitidos somente ao próprio colaborador da
-- organização atual.
create policy "mcp_tokens_proprio_base" on public.mcp_tokens
  as permissive for all
  to authenticated
  using (
    colaborador_id = (select auth.uid())
    and organizacao_id = (select public.org_atual())
  )
  with check (
    colaborador_id = (select auth.uid())
    and organizacao_id = (select public.org_atual())
  );
