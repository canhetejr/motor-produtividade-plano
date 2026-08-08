-- Fase 4: crons passam a iterar por organização. A trava de idempotência de
-- cron_execucoes era única em (tipo, chave) — com mais de uma organização,
-- a primeira a rodar reservava a chave do dia e as demais silenciosamente
-- viravam no-op (insert batia em unique_violation / 23505, e o código
-- interpretava isso como "já processado"), então só um cliente recebia
-- e-mail. A chave de idempotência precisa incluir a organização.
--
-- cron_execucoes é tabela de infraestrutura, fora do eixo normal (sem RLS de
-- organização, só service_role acessa) — organizacao_id aqui é só parte da
-- chave de unicidade, não precisa de política restritiva nova.

begin;

alter table public.cron_execucoes
  add column if not exists organizacao_id uuid;

alter table public.cron_execucoes
  drop constraint if exists cron_execucoes_tipo_chave_key;

alter table public.cron_execucoes
  add constraint cron_execucoes_tipo_org_chave_key unique (tipo, organizacao_id, chave);

commit;
