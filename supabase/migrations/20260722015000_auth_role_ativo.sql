-- auth_role() não checava colaboradores.ativo — um gestor desativado
-- continuava passando em toda policy "gestor-only" (areas_write_gestor,
-- demandas_write_gestor, colaboradores_update_gestor etc.) enquanto a sessão
-- Auth continuasse válida. A correção principal é em app (lib/auth.ts,
-- requireUser() agora derruba sessão de conta inativa), mas essa é a defesa
-- em profundidade no banco: nenhuma policy baseada em auth_role() = 'gestor'
-- passa mais pra conta inativa, mesmo se algo pular a checagem de app.
--
-- Não cobre policies "colaborador_id = auth.uid()" (independem de role) —
-- essas dependem só da correção em lib/auth.ts.

begin;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.colaboradores where id = auth.uid() and ativo = true
$$;

commit;
