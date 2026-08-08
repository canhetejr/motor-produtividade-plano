-- Função de introspecção só para o harness de testes da Fase 0
-- (__tests__/isolamento/catalogo-eixo.test.ts). information_schema e
-- pg_policies não são expostas via PostgREST por padrão neste projeto, e o
-- teste roda como client HTTP comum (supabase-js), sem acesso a SQL direto —
-- por isso a introspecção precisa vir embrulhada numa RPC.
--
-- security definer porque pg_policies só é legível pelo dono das tabelas;
-- stable e sem parâmetro sensível, então liberar para authenticated é seguro:
-- ela só devolve metadado de schema, nunca dado de linha.
create or replace function public.isolamento_status_tabela(p_tabela text)
returns table (
  tem_organizacao_id boolean,
  organizacao_id_not_null boolean,
  tem_politica_restrictive_org_atual boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = p_tabela and column_name = 'organizacao_id'
    ),
    coalesce(
      (
        select is_nullable = 'NO' from information_schema.columns
        where table_schema = 'public' and table_name = p_tabela and column_name = 'organizacao_id'
      ),
      false
    ),
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = p_tabela
        and permissive = 'RESTRICTIVE' and qual like '%org_atual%'
    )
$$;

revoke all on function public.isolamento_status_tabela(text) from public, anon;
grant execute on function public.isolamento_status_tabela(text) to authenticated, service_role;
