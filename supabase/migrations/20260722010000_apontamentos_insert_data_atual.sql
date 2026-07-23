-- A policy de INSERT em apontamentos só checava colaborador_id = auth.uid(),
-- diferente de UPDATE/DELETE (20260721013000), que já exigem data = current_date.
-- Sem isso, um colaborador autenticado podia inserir apontamento em qualquer
-- data (passada ou futura) chamando a API REST do Supabase direto, contornando
-- a regra "só lança hoje" que hoje só existe na Server Action (hoje() em
-- app/(app)/apontamento/actions.ts).

begin;

drop policy if exists "apontamentos_insert_own" on apontamentos;
create policy "apontamentos_insert_own" on apontamentos for insert
  with check (colaborador_id = auth.uid() and data = current_date);

commit;
