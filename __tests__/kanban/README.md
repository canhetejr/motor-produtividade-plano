# Testes de movimentação atômica do Kanban

## Como rodar

```bash
export KANBAN_TESTE_PG_URL="$(scripts/postgres-teste-local.sh iniciar)"
npm run test:kanban
scripts/postgres-teste-local.sh parar
```

Sem `KANBAN_TESTE_PG_URL`, os casos **pulam** com aviso — mesmo critério dos
arquivos de `__tests__/isolamento`. `npm test` continua verde numa máquina sem
Postgres; o que se perde é a prova, não a suíte.

## Por que um Postgres local, e não o Supabase

O projeto isolado de integração (`khaeknegymhygsdofkce`) existe para provar
isolamento entre organizações **através do PostgREST**, que é a superfície que
o app usa. Corrida de transação é outra pergunta: precisa de duas sessões sob
controle, uma segurando o commit enquanto a outra tenta passar. Isso não se
monta por HTTP.

Um cluster efêmero (`initdb` + `pg_ctl`, sem senha, sem rede externa, apagado
no fim) dá o mesmo Postgres em segundos. E, principalmente, não escreve em
banco que atende cliente: produção (`bapufbypqmtjtujfbiai`) e staging estão
fora de questão — **staging compartilha as credenciais da produção**.

## O que roda contra o quê

`supabase/testes/esquema-minimo-kanban.sql` é um recorte do schema real: só as
tabelas, triggers e funções que as RPCs do Kanban tocam, copiadas das
migrations que as criaram. **Não é fonte de verdade** — `supabase/migrations/`
é. Quando uma coluna nova entrar em `cartoes` ou `colunas` e as RPCs passarem a
usá-la, o recorte precisa acompanhar.

A migration sob teste (`20260820213000_kanban_movimentacao_atomica.sql`) é
aplicada por cima do recorte, exatamente como será aplicada no banco real.

## O caso que dá sentido aos outros

`sensibilidade da suíte` restaura, num banco descartável, a versão **anterior**
do trigger de WIP — a que contava sem travar — e exige que a mesma corrida
**estoure** o limite. Um teste de concorrência que passa porque a concorrência
não aconteceu não prova nada; este é o que mede se os outros têm dente.

## O que estes testes não cobrem

- **RLS.** As RPCs são `SECURITY DEFINER` e a autorização delas é escrita à
  mão; é isso que a suíte exercita. A prova de que as *policies* seguram um
  cliente contra o outro continua em `__tests__/isolamento`.
- **PostgREST.** Erro de grant que só apareceria em `/rest/v1/rpc` não é
  visto aqui. O contrato de grants está travado por texto em
  `supabase/kanban-movimentacao-atomica.test.ts`.
