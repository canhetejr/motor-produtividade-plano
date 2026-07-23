-- Fase 1 da confiabilidade: congela o cálculo no momento do lançamento
-- (snapshot) e trava a quantidade de blocos no próprio banco.
--
-- PROBLEMA 1 — histórico se reescrevia sozinho:
--   apontamentos_calculado derivava tempo_total_min de demandas.tempo_padrao_min
--   e demandas.blocos_totais ATUAIS. Editar uma demanda (ou aprovar uma
--   solicitação de ALTERACAO) reescrevia retroativamente o tempo de todo o
--   histórico daquela demanda. Agora cada apontamento guarda tempo_padrao e
--   blocos do instante do lançamento, e a view calcula a partir desse snapshot.
--   Edições de catálogo passam a valer só dali pra frente.
--
-- PROBLEMA 2 — blocos sem teto:
--   nada impedia lançar "100 de 4 blocos". O CHECK abaixo trava
--   quantidade > blocos_totais no banco, não só na Server Action.

begin;

-- 1. Snapshot dos valores da demanda, congelados no lançamento.
alter table apontamentos
  add column if not exists tempo_padrao_snapshot integer,
  add column if not exists blocos_totais_snapshot integer not null default 1;

-- Backfill: congela o histórico existente no valor ATUAL da demanda. É um
-- freeze único — a partir daqui esses números não mudam mais sozinhos. Demanda
-- variável não usa snapshot (o tempo vem de tempo_manual_min), então deixa
-- tempo_padrao_snapshot nulo e blocos = 1 pra não disparar o CHECK à toa.
update apontamentos a
set tempo_padrao_snapshot = case when d.variavel then null else d.tempo_padrao_min end,
    blocos_totais_snapshot = case when d.variavel then 1
                                  else greatest(coalesce(d.blocos_totais, 1), 1) end
from demandas d
where d.id = a.demanda_id;

-- 2. Trava de blocos. Para demanda em blocos (snapshot > 1) a quantidade não
-- pode passar do total de blocos. Demanda comum (snapshot = 1) segue com
-- quantidade livre — ali quantidade é multiplicador de repetições, não bloco.
--   NOT VALID de propósito: lançamentos antigos, feitos antes desta trava,
--   podem já violar a regra; não queremos abortar a migration por causa deles.
--   A regra vale para tudo que for inserido/atualizado daqui pra frente.
alter table apontamentos
  add constraint apontamentos_quantidade_ate_blocos
  check (blocos_totais_snapshot <= 1 or quantidade <= blocos_totais_snapshot)
  not valid;

-- 3. View recalculada a partir do snapshot do apontamento (não mais da demanda).
--   "variável" é identificado por tempo_manual_min preenchido: a Server Action
--   exige o tempo manual para demanda variável e nunca o preenche para as
--   demais, então isso separa os dois casos sem depender de demandas.variavel.
--   Colunas listadas explícitas e na mesma ordem/nome das anteriores (regra do
--   CREATE OR REPLACE VIEW — só permite acrescentar coluna no final).
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
    when a.tempo_manual_min is not null then a.tempo_manual_min
    else round(coalesce(a.tempo_padrao_snapshot, 0) * a.quantidade
               / greatest(coalesce(a.blocos_totais_snapshot, 1), 1))
  end as tempo_total_min,
  a.motivo
from apontamentos a
join demandas d on d.id = a.demanda_id;

commit;
