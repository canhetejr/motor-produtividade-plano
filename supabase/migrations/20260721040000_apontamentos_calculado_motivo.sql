-- A view apontamentos_calculado usava "a.*", que o Postgres expande em tempo
-- de criação — adicionar uma coluna na tabela base (migration anterior,
-- 20260721030000_apontamentos_motivo) não propaga sozinho pra view. Por isso
-- "select apontamentos_calculado.motivo" ainda falhava com 42703 mesmo depois
-- da coluna existir em `apontamentos`.
--
-- CREATE OR REPLACE VIEW exige que colunas existentes mantenham nome e
-- posição — só permite acrescentar colunas novas no final. Por isso listamos
-- as colunas originais explicitamente (na mesma ordem que "a.*" expandia
-- antes) e acrescentamos `motivo` só no final.

begin;

create or replace view apontamentos_calculado
with (security_invoker = true) as
select
  a.id,
  a.colaborador_id,
  a.demanda_id,
  a.data,
  a.quantidade,
  a.tempo_manual_min,
  a.observacoes,
  a.created_at,
  d.area_id,
  case
    when d.variavel then coalesce(a.tempo_manual_min, 0)
    else round(coalesce(d.tempo_padrao_min, 0) * a.quantidade
               / greatest(coalesce(d.blocos_totais, 1), 1))
  end as tempo_total_min,
  a.motivo
from apontamentos a
join demandas d on d.id = a.demanda_id;

commit;
