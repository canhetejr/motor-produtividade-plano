-- A regra "colaborador só edita/exclui apontamento do dia atual" vivia só na
-- Server Action (app/(app)/apontamento/historico/actions.ts), não na policy.
-- Como o client Supabase do browser usa a mesma sessão do usuário, dava pra
-- chamar update/delete direto pela API REST e reescrever apontamentos de
-- qualquer dia passado. As policies passam a impor "data = current_date"
-- também no banco. Idempotente e transacional, como as migrations anteriores.

begin;

drop policy if exists "apontamentos_update_own" on apontamentos;
create policy "apontamentos_update_own" on apontamentos for update
  using (colaborador_id = auth.uid() and data = current_date)
  with check (colaborador_id = auth.uid() and data = current_date);

drop policy if exists "apontamentos_delete_own" on apontamentos;
create policy "apontamentos_delete_own" on apontamentos for delete
  using (colaborador_id = auth.uid() and data = current_date);

commit;
