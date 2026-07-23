-- Áreas não tinham campo `ativo` (diferente de demandas) — uma área obsoleta
-- só podia ser renomeada, nunca retirada dos seletores de cadastro. Idempotente
-- e transacional, como as migrations anteriores.

begin;

alter table areas add column if not exists ativo boolean not null default true;

commit;
