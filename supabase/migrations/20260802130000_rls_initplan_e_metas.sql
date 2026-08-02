-- Espelho das migrations aplicadas via MCP nesta leva. O historico local tem
-- que refletir o banco, senao um `supabase db reset` recria um esquema que ja
-- nao existe mais.
--
-- 1) advisor auth_rls_initplan (17 -> 0): as politicas abaixo chamavam
--    auth.uid()/auth_role() direto na expressao, o que faz o Postgres reavaliar
--    a funcao uma vez POR LINHA. A subconsulta escalar vira InitPlan: uma vez
--    por comando. As tres funcoes sao STABLE, entao o resultado e identico.
--    is_quadro_membro(col.quadro_id) fica de fora: recebe valor da linha.
-- 2) F11: tabela `metas`.
--
-- As expressoes de RLS foram geradas a partir do que o Postgres tinha
-- normalizado em pg_policies, nao redigitadas: ali um erro de transcricao nao
-- quebra o build, vaza ou esconde dado.

alter policy apontamentos_delete_own on public.apontamentos using (((colaborador_id = (select auth.uid())) AND (data = CURRENT_DATE)));
alter policy apontamentos_insert_own on public.apontamentos with check (((colaborador_id = (select auth.uid())) AND (data = CURRENT_DATE)));
alter policy apontamentos_select_own_or_gestor on public.apontamentos using (((colaborador_id = (select auth.uid())) OR ((select auth_role()) = 'gestor'::text)));
alter policy apontamentos_update_own on public.apontamentos using (((colaborador_id = (select auth.uid())) AND (data = CURRENT_DATE))) with check (((colaborador_id = (select auth.uid())) AND (data = CURRENT_DATE)));
alter policy areas_write_gestor on public.areas using (((select auth_role()) = 'gestor'::text)) with check (((select auth_role()) = 'gestor'::text));
alter policy "Gestor le auditoria" on public.auditoria using (((select auth_role()) = 'gestor'::text));
alter policy cartoes_anexos_delete_own_or_gestor on public.cartoes_anexos using (((colaborador_id = (select auth.uid())) OR ((select auth_role()) = 'gestor'::text)));
alter policy colaboradores_insert_gestor on public.colaboradores with check (((select auth_role()) = 'gestor'::text));
alter policy colaboradores_select_own_or_gestor on public.colaboradores using (((id = (select auth.uid())) OR ((select auth_role()) = 'gestor'::text)));
alter policy colaboradores_update_gestor on public.colaboradores using (((select auth_role()) = 'gestor'::text)) with check (((select auth_role()) = 'gestor'::text));
alter policy comentarios_delete_own on public.comentarios_cartao using ((colaborador_id = (select auth.uid())));
alter policy demandas_write_gestor on public.demandas using (((select auth_role()) = 'gestor'::text)) with check (((select auth_role()) = 'gestor'::text));
alter policy "Usuario marca as proprias notificacoes como lidas" on public.notificacoes using ((destinatario_id = (select auth.uid()))) with check ((destinatario_id = (select auth.uid())));
alter policy "Usuario ve as proprias notificacoes" on public.notificacoes using ((destinatario_id = (select auth.uid())));
alter policy quadros_write_gestor on public.quadros using (((select auth_role()) = 'gestor'::text)) with check (((select auth_role()) = 'gestor'::text));
alter policy quadros_membros_write_gestor on public.quadros_membros using (((select auth_role()) = 'gestor'::text)) with check (((select auth_role()) = 'gestor'::text));
alter policy "Colaboradores podem criar solicitacoes pendentes" on public.solicitacoes_demandas with check (((colaborador_id = (select auth.uid())) AND (status = 'PENDENTE'::status_solicitacao)));
alter policy "Colaboradores podem ver as proprias solicitacoes" on public.solicitacoes_demandas using ((colaborador_id = (select auth.uid())));
alter policy solicitacoes_delete_own_pendente on public.solicitacoes_demandas using (((colaborador_id = (select auth.uid())) AND (status = 'PENDENTE'::status_solicitacao)));

-- F11 — metas por colaborador ou por area.
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  area_id uuid references public.areas(id) on delete cascade,
  -- Fracao da carga horaria esperada como entrega. 1.0 = 100% da jornada.
  alvo numeric not null check (alvo > 0 and alvo <= 3),
  vigente_desde date not null default current_date,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.colaboradores(id),
  -- Uma meta e de pessoa OU de area, nunca das duas nem de nenhuma.
  constraint metas_alvo_unico check (
    (colaborador_id is not null and area_id is null)
    or (colaborador_id is null and area_id is not null)
  )
);

create index if not exists idx_metas_colaborador_id on public.metas (colaborador_id);
create index if not exists idx_metas_area_id on public.metas (area_id);
create index if not exists idx_metas_criado_por on public.metas (criado_por);

alter table public.metas enable row level security;
revoke all on public.metas from anon;

-- Uma politica por (papel, acao): FOR ALL cobriria SELECT tambem e ficaria
-- permissiva junto com a de leitura, que e o que o advisor
-- multiple_permissive_policies acusa.
create policy metas_select_autenticado on public.metas
  for select using ((select auth.uid()) is not null);
create policy metas_insert_gestor on public.metas
  for insert with check ((select auth_role()) = 'gestor');
create policy metas_update_gestor on public.metas
  for update using ((select auth_role()) = 'gestor') with check ((select auth_role()) = 'gestor');
create policy metas_delete_gestor on public.metas
  for delete using ((select auth_role()) = 'gestor');
