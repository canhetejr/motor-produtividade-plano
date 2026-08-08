---
name: vertice-migrations
description: Fluxo de migrations Supabase do Vértice — nomeação dos arquivos em supabase/migrations/, ensaio em branch antes da produção, regeneração de lib/database.types.ts, e verificação com get_advisors. Use SEMPRE que for criar tabela, coluna, índice, constraint, trigger, função, política RLS ou RPC neste projeto; sempre que precisar aplicar SQL no Supabase; e sempre que alguém pedir para "mexer no banco", "criar tabela", "rodar migration" ou "alterar o schema". Também use antes de rodar execute_sql com qualquer DDL.
---

# Migrations no Vértice

O banco de produção (`bapufbypqmtjtujfbiai`, projeto "Motor Produtividade") atende uma empresa real com dado real. `supabase/migrations/` é o estado canônico — não é histórico decorativo.

## Regra que organiza todo o resto

**DDL vive em arquivo de migration versionado, nunca em `execute_sql` avulso.**

`execute_sql` via MCP é para *ler*: inspecionar schema, conferir contagem, investigar. No momento em que você aplica DDL por ali, o repositório e o banco divergem, e a próxima pessoa (ou você, semana que vem) escreve uma migration contra um schema que não é o que está no ar. Use `apply_migration`, que registra a migration no histórico do Supabase, ou aplique o arquivo pelo CLI.

## Nomeação

```
supabase/migrations/YYYYMMDDHHMMSS_descricao_curta.sql
```

Timestamp real, em UTC, maior que o do último arquivo — a ordem lexicográfica **é** a ordem de execução. Descrição em snake_case e em português, como o resto do repositório: `20260808143000_organizacoes_eixo_raizes.sql`.

Confira o último arquivo existente antes de escolher o timestamp. Colisão ou ordem invertida produz migration que roda antes da tabela que ela altera existir.

## Como escrever o arquivo

O projeto tem uma convenção de comentário que vale seguir, porque ela é o que torna o SQL revisável meses depois: **comente o porquê e o modo de falha, não o quê.** Compare:

```sql
-- Ruim: repete o que o SQL já diz
-- Cria índice em organizacao_id
create index on public.cartoes (organizacao_id);

-- Bom: explica a decisão e o que ela evita
-- A política do eixo filtra por organizacao_id em toda leitura. Os índices de
-- FK de 20260802120000 cobrem (coluna_id), não este — sem o índice isolado,
-- cada consulta vira seq scan depois que a base crescer.
create index on public.cartoes (organizacao_id);
```

Migrations idempotentes onde for barato (`if not exists`, `create or replace`), porque retry de deploy acontece.

Se a migration mexe em RLS, política, função `security definer` ou dado multi-inquilino, **leia a skill `vertice-isolamento` antes de escrever** — as regras de restritiva-vs-permissiva e de FK composta estão lá, e errá-las não gera erro visível.

## Ordem de trabalho

1. **Inspecione o estado real** antes de escrever. O `docs/` pode estar desatualizado: a contagem de tabelas e de linhas já divergiu do que os planos afirmam. Pergunte ao banco.
   ```sql
   select count(*) from pg_tables where schemaname='public';
   select count(*) from pg_policies where schemaname='public';
   ```
2. **Escreva o arquivo** em `supabase/migrations/`.
3. **Ensaie antes de tocar produção**, sempre que a migration for grande, destrutiva ou irreversível — backfill, `set not null`, `drop`, reescrita de política em massa. O Supabase tem branching (`create_branch`), que custa cerca de US$ 0,013/hora e pode ser destruído logo depois. O ensaio existe para confirmar o tempo e o resultado, não para descobrir se funciona.
4. **Aplique** com `apply_migration`.
5. **Regenere os tipos** — `lib/database.types.ts` é usado com `createClient<Database>` em todo lugar. Schema novo com tipos velhos não quebra o build; produz autocompletar mentiroso e `any` silencioso.
6. **Rode `get_advisors`** nos dois tipos, `security` e `performance`. É o que pega tabela sem RLS, política sem índice e `auth_rls_initplan`. Vale especialmente depois de mexer em política: o projeto já teve 17 avisos desse tipo de uma vez.

## Migração de dado: a asserção que se esquece

Quando a migration move ou preenche dado existente, três verificações, dentro da mesma transação:

1. Nenhuma linha órfã (`where <coluna_nova> is null`).
2. Contagens idênticas antes e depois — nada sumiu, nada duplicou.
3. **Assumindo o JWT de um usuário real, a contagem que ele vê é a mesma de antes.**

A terceira é a que importa e a que quase sempre falta. As duas primeiras provam que o dado está no banco; só a terceira prova que ele **continua visível para quem já o via**. Um eixo aplicado corretamente com uma política escrita errada produz um app vazio na segunda-feira de manhã, com o dado intacto e inalcançável.

Tire as contagens de referência do banco no momento da migração, não de um documento. Os números em `docs/` estão defasados.

## Coisas que já morderam este projeto

- **`ACCESS EXCLUSIVE` em `set not null`** — instantâneo com a base atual, mas o lock é real. Em `alter table` sobre muitas tabelas de uma vez, faça a conta do tempo total.
- **Revogar acesso do papel `anon`** foi feito de propósito em `0002_fix_rls_views_grants.sql` e `20260802150000_revogar_execute_anon.sql`. Ao criar função ou view nova, decida explicitamente o grant; não deixe o padrão decidir por você.
- **Views precisam de `security_invoker`** neste projeto, senão rodam com o privilégio do dono e furam a RLS de quem consulta.
- **Trigger de contagem precisa de `for update` na linha pai.** Sem serialização, duas transações leem o mesmo estado e ambas passam — foi o bug que `20260803150000_timer_blocos_finitos.sql` corrigiu para blocos finitos, e o mesmo padrão vale para qualquer teto (assentos, limites de plano).
- **`AFTER`, não `BEFORE`, quando o trigger conta linhas.** Em `BEFORE INSERT` a contagem não enxerga a linha que está entrando, e o teto fica sempre um a mais.

## O que nunca fazer sem confirmação explícita

- `drop table`, `drop column`, `truncate` ou `delete` em massa na produção.
- Aplicar migration diretamente em produção sem que o arquivo esteja commitado.
- `delete from organizacoes` (ou qualquer delete que dispare cascade em dezenas de tabelas) — é irreversível e não tem `git revert`.

Existem `supabase/APLICAR_PENDENTES.sql` e `supabase/RESETAR_APONTAMENTOS_TESTE.sql` no repositório. O segundo apaga apontamentos. Leia o conteúdo antes de executar qualquer um dos dois.
