-- get_advisors (security) acusou function_search_path_mutable em
-- public.hoje_br(), criada na migration anterior: faltou `set search_path`.
-- Sem isso, um schema malicioso na frente de `public` no search_path da
-- sessão poderia sequestrar `now()`/tipos não qualificados dentro da função.
create or replace function public.hoje_br()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;
