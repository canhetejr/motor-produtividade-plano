-- Referência humana global e imutável para cards.
-- O UUID continua sendo a chave técnica; `codigo` passa a espelhar a referência
-- para manter compatibilidade com toda a interface. O valor anterior fica em
-- `codigo_legado`, pesquisável durante a transição.
begin;

create sequence if not exists public.cartoes_referencia_seq;

alter table public.cartoes add column if not exists referencia text;
alter table public.cartoes add column if not exists codigo_legado text;

update public.cartoes
set codigo_legado = codigo
where codigo_legado is null;

with numerados as (
  select id, row_number() over (order by created_at, id)::bigint as numero
  from public.cartoes
)
update public.cartoes c
set referencia = 'VRT-' || lpad(n.numero::text, 6, '0')
from numerados n
where n.id = c.id and c.referencia is null;

update public.cartoes
set codigo = referencia
where codigo <> referencia;

alter table public.cartoes alter column referencia set not null;
alter table public.cartoes add constraint cartoes_referencia_key unique (referencia);

select setval(
  'public.cartoes_referencia_seq',
  coalesce((select max(split_part(referencia, '-', 2)::bigint) from public.cartoes), 1),
  exists (select 1 from public.cartoes)
);

create or replace function public.gerar_referencia_cartao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.referencia := 'VRT-' || lpad(nextval('public.cartoes_referencia_seq')::text, 6, '0');
  new.codigo := new.referencia;
  return new;
end;
$$;

create or replace function public.cartoes_referencia_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.referencia is distinct from old.referencia then
    raise exception 'REFERENCIA_IMUTAVEL';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_gerar_codigo_cartao on public.cartoes;
create trigger tr_gerar_referencia_cartao
before insert on public.cartoes
for each row execute function public.gerar_referencia_cartao();

drop trigger if exists tr_cartoes_referencia_imutavel on public.cartoes;
create trigger tr_cartoes_referencia_imutavel
before update on public.cartoes
for each row execute function public.cartoes_referencia_imutavel();

-- O prefixo antigo deixa de ser requisito para quadros novos. Registros
-- históricos continuam intactos; NULL é permitido para quadros criados após
-- esta migration.
-- Quadros novos não recebem mais prefixo manual. O código interno é mantido
-- só para compatibilidade de schema durante a transição.
create sequence if not exists public.quadros_codigo_interno_seq;
create or replace function public.gerar_codigo_interno_quadro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'Q' || nextval('public.quadros_codigo_interno_seq')::text;
  end if;
  return new;
end;
$$;
drop trigger if exists tr_gerar_codigo_interno_quadro on public.quadros;
create trigger tr_gerar_codigo_interno_quadro
before insert on public.quadros
for each row execute function public.gerar_codigo_interno_quadro();

commit;
