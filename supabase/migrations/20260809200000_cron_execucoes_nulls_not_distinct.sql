-- A trava de idempotência de cron_execucoes é unique (tipo, organizacao_id,
-- chave). Isso funciona para os crons que iteram organizações, mas não para um
-- cron de plataforma — o de ciclo de vida, que decide trial vencido → expirada
-- e não pertence a organização nenhuma.
--
-- No Postgres, por padrão, NULL nunca é igual a NULL numa unique: duas linhas
-- ('organizacoes-ciclo', NULL, '2026-08-09') convivem sem violar constraint.
-- Ou seja, para todo cron global a trava aceita qualquer número de execuções
-- sem reclamar — tentarReservarExecucao() devolveria `true` sempre, e o "já
-- executado hoje" viraria decoração.
--
-- NULLS NOT DISTINCT faz a unique tratar os nulos como iguais, que é
-- exatamente a semântica desejada: "esta é A execução da plataforma para esta
-- chave".

begin;

alter table public.cron_execucoes
  drop constraint if exists cron_execucoes_tipo_org_chave_key;

alter table public.cron_execucoes
  add constraint cron_execucoes_tipo_org_chave_key
    unique nulls not distinct (tipo, organizacao_id, chave);

commit;
