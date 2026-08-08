-- apontamentos_calculado expõe a.colaborador_id, mas não a.organizacao_id.
-- O PostgREST detecta relacionamento embedável numa view rastreando cada
-- coluna de saída até a tabela de origem via pg_depend, e casando esse
-- conjunto de colunas com uma FK real. A FK simples que sustentava
-- `colaboradores(nome)` embutido nesta view foi removida em
-- 20260809110000 (virou ambígua ao lado da composta). A composta
-- (colaborador_id, organizacao_id) → colaboradores(id, organizacao_id)
-- só é detectável se AMBAS as colunas aparecerem na view — daí adicionar
-- organizacao_id aqui. Confirmado como quebra real (não só de tipo) em
-- app/api/export/route.ts, que faz `.select('..., colaboradores(nome)')`
-- sobre esta view.
-- security_invoker=true está setado na view atual (roda com o privilégio
-- de quem consulta, não do dono) — declarado explícito aqui em vez de
-- confiar que CREATE OR REPLACE VIEW preserva a opção sozinho.
create or replace view public.apontamentos_calculado
with (security_invoker = true) as
-- organizacao_id vai no FINAL da lista: CREATE OR REPLACE VIEW só aceita
-- coluna nova acrescentada depois das existentes, na mesma ordem — inserir
-- no meio (ex. logo após colaborador_id) desloca as colunas seguintes e
-- quebra com "cannot change name of view column".
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
    when a.tempo_manual_min is not null then a.tempo_manual_min::numeric
    else round(coalesce(a.tempo_padrao_snapshot, 0)::numeric * a.quantidade / greatest(coalesce(a.blocos_totais_snapshot, 1), 1)::numeric)
  end as tempo_total_min,
  a.motivo,
  a.organizacao_id
from apontamentos a
join demandas d on d.id = a.demanda_id;
