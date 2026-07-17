-- =====================================================================
-- 0002_fix_rls_views_grants.sql
--
-- RODAR 1x NO SQL EDITOR DO SUPABASE (banco real). Transação única:
-- se qualquer passo falhar, nada é aplicado.
--
-- Corrige:
--   1. Recursão infinita de RLS ("stack depth limit exceeded") —
--      auth_role() vira SECURITY DEFINER e para de reavaliar as
--      policies de colaboradores dentro de si mesma.
--   2. Auto-promoção: colaborador não pode mais alterar a própria role
--      nem se auto-inserir (contas passam a nascer via service role).
--   3. Views recriadas como views NORMAIS (live, sem refresh) com
--      security_invoker = true — fecha o vazamento de indicadores
--      para a anon key e aplica RLS das tabelas base.
--   4. Índice passa a dividir por blocos_totais (o form registra
--      quantidade em nº de blocos) e a incluir colaboradores sem
--      apontamento (LEFT JOIN).
--   5. Grants: anon perde acesso a tudo; a RPC de refresh morre.
-- =====================================================================

begin;

-- =====================================================================
-- 1) Mata a recursão: auth_role() SECURITY DEFINER
--    (dona = postgres => a consulta interna bypassa RLS de colaboradores)
-- =====================================================================
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.colaboradores where id = auth.uid()
$$;

revoke all on function public.auth_role() from public;
grant execute on function public.auth_role() to anon, authenticated, service_role;
-- anon precisa de EXECUTE para as policies não estourarem "permission
-- denied"; para anon, auth.uid() é null => retorna null => policies false.

-- =====================================================================
-- 2) Endurece policies de colaboradores
-- =====================================================================
drop policy if exists "colaboradores_update_own_or_gestor" on public.colaboradores;
create policy "colaboradores_update_gestor" on public.colaboradores
  for update using (auth_role() = 'gestor') with check (auth_role() = 'gestor');

drop policy if exists "colaboradores_insert_gestor" on public.colaboradores;
create policy "colaboradores_insert_gestor" on public.colaboradores
  for insert with check (auth_role() = 'gestor');
-- O signup público foi removido do app; contas são criadas pelo gestor
-- em /colaboradores via service role (que bypassa RLS).

-- =====================================================================
-- 3) Recria as views como VIEWS NORMAIS com security_invoker
--    (drop defensivo: no banco real indicadores_diarios pode ser
--    materialized view criada à mão)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'indicadores_diarios') then
    execute 'drop materialized view public.indicadores_diarios cascade';
  elsif exists (select 1 from pg_views where schemaname = 'public' and viewname = 'indicadores_diarios') then
    execute 'drop view public.indicadores_diarios cascade';
  end if;
end $$;

drop view if exists public.apontamentos_calculado cascade;
drop function if exists public.refresh_indicadores_diarios(text);
drop function if exists public.refresh_indicadores_diarios();

create view public.apontamentos_calculado
with (security_invoker = true) as
select
  a.*,
  d.area_id,
  case
    when d.variavel then coalesce(a.tempo_manual_min, 0)
    -- quantidade = nº de blocos quando a demanda é dividida em blocos
    else round(coalesce(d.tempo_padrao_min, 0) * a.quantidade
               / greatest(coalesce(d.blocos_totais, 1), 1))
  end as tempo_total_min
from public.apontamentos a
join public.demandas d on d.id = a.demanda_id;

create view public.indicadores_diarios
with (security_invoker = true) as
select
  c.id   as colaborador_id,
  c.nome,
  c.area_id,
  c.ativo,
  ac.data,
  c.carga_horaria_min,
  coalesce(sum(ac.tempo_total_min), 0)::int as tempo_entregue_min,
  round(coalesce(sum(ac.tempo_total_min), 0)::numeric
        / nullif(c.carga_horaria_min, 0), 4) as indice
from public.colaboradores c
left join public.apontamentos_calculado ac on ac.colaborador_id = c.id
group by c.id, c.nome, c.area_id, c.ativo, ac.data, c.carga_horaria_min;

-- =====================================================================
-- 4) Grants: fecha o vazamento para anon; authenticated mantém leitura
-- =====================================================================
revoke all on public.areas, public.demandas, public.colaboradores,
           public.apontamentos from anon;
revoke all on public.apontamentos_calculado, public.indicadores_diarios from anon;

grant select on public.apontamentos_calculado, public.indicadores_diarios
  to authenticated, service_role;

commit;

-- =====================================================================
-- Verificação pós-migration (rodar no próprio SQL Editor):
--   select * from indicadores_diarios limit 5;   -- funciona, índice coerente
--   select auth_role();                          -- null, sem stack depth
-- E de fora (deve dar permission denied — hoje vaza dados):
--   curl "https://<proj>.supabase.co/rest/v1/indicadores_diarios" -H "apikey: <anon>"
--
-- Nota de negócio: a divisão por blocos_totais corrige o índice de
-- demandas em blocos. Se os índices históricos "certos" eram os antigos,
-- remova "/ greatest(coalesce(d.blocos_totais, 1), 1)" e recrie a view.
-- =====================================================================
