-- Correção de dado histórico: 6 apontamentos gravados antes de
-- 20260819210000_apontamentos_data_fuso_sao_paulo.sql ficaram com `data` um
-- dia à frente do dia civil real de São Paulo, porque a escrita usava
-- current_date (fuso do servidor, UTC) para lançamentos feitos entre 21h e
-- meia-noite BRT. Sintoma relatado: apontamento aparecia com "data de
-- amanhã" e o botão Editar/Excluir sumia (a regra "só hoje" comparava contra
-- a data real, BRT, que nunca batia com a data errada gravada).
--
-- Identificado com:
--   select id from apontamentos
--   where data <> (created_at at time zone 'America/Sao_Paulo')::date;
-- Nenhuma constraint de unicidade em (colaborador_id, demanda_id, data)
-- existe nesta tabela — a correção não colide com nenhuma linha existente.
--
-- Cada UPDATE está pinado por id explícito (não por uma condição ampla tipo
-- "data <> ..."), porque a correção é um evento único desta migration: rodar
-- de novo no futuro contra dado que já mudou por outro motivo não pode
-- "corrigir" de volta algo que passou a ser legítimo.
begin;

update public.apontamentos set data = '2026-08-18'
  where id = 'bd7adae8-0a9c-4a09-a14c-51d314acf835' and data = '2026-08-19';

update public.apontamentos set data = '2026-08-18'
  where id = 'cf64e594-e0df-4e73-a872-76f232d706c1' and data = '2026-08-19';

update public.apontamentos set data = '2026-08-04'
  where id = '10e23ccf-1ccd-4229-81e4-e9f67b16ac15' and data = '2026-08-05';

update public.apontamentos set data = '2026-08-04'
  where id = '011a2931-4af8-464e-b101-6f3fb6ccea32' and data = '2026-08-05';

update public.apontamentos set data = '2026-08-02'
  where id = 'd772ef47-d932-450e-ab9c-042346e7dbf5' and data = '2026-08-03';

update public.apontamentos set data = '2026-08-02'
  where id = '9e1b1898-256f-44c4-aced-e17a1a74a552' and data = '2026-08-03';

commit;
