-- Infraestrutura para remetente de e-mail por organização (nome de exibição
-- e logo). Sem domínio verificado por cliente ainda (outra leva), o endereço
-- de envio ("from") continua sendo o do Vértice — só o NOME de exibição e a
-- assinatura no corpo do e-mail passam a usar estas colunas quando
-- preenchidas. Nulável e sem valor de backfill: nenhuma organização tem
-- remetente próprio configurado hoje.
alter table public.organizacoes
  add column if not exists email_remetente_nome text,
  add column if not exists logo_url text;
