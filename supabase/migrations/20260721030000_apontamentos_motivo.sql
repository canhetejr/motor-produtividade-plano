-- "Outros" (demanda variável) ganha um motivo obrigatório de uma lista fixa
-- (lib/motivos-outros.ts) — dá visibilidade ao gestor de pra onde está indo o
-- tempo não padronizado, hoje uma caixa-preta. Coluna livre (não enum) pra não
-- travar em ALTER TYPE se a lista mudar; validação fica na Server Action.

begin;

alter table apontamentos add column if not exists motivo text;

commit;
