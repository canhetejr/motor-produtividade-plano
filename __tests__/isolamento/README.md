# Testes de isolamento entre organizações

Rede de segurança da Fase 0 de `docs/PLANO-PRODUTO.md`. Dois testes rodam **hoje**, antes de qualquer DDL da Fase 1, e é esperado que falhem — é assim que se mede o antes e o depois.

## O que existe

- **`admin-client-estatico.test.ts`** — varre o código por `createAdminClient()` fora da allowlist. Não depende de banco, roda em qualquer `npm test`. É o único dos dois que já vale a pena manter passando desde já: cada uso novo do client de service role tem que decidir explicitamente se entra na lista.
- **`catalogo-eixo.test.ts`** — para cada tabela de negócio em `public` (lista abaixo, tirada do catálogo real do banco em 08/08/2026), confere se ela tem `organizacao_id NOT NULL` e uma política `restrictive` mencionando `org_atual`. Hoje falha para as 43; depois da Fase 1–3, passa tabela por tabela. Precisa de `SUPABASE_SERVICE_ROLE_KEY` no ambiente — sem ela, pula com aviso em vez de quebrar o resto da suíte.

## O que falta (fica para quando a Fase 1 estiver no ar)

Os testes de leitura cruzada, escrita cruzada e das 18 funções `SECURITY DEFINER` exigem duas organizações completas semeadas no banco — algo que não existe enquanto `organizacoes` não existir. Construir esse seed agora seria trabalho que a Fase 1 reescreveria de qualquer forma. Quando a coluna `organizacao_id` chegar:

1. Escrever `seed.ts`: duas organizações, cada uma com gestor, colaborador, área, demanda, quadro, cartão e apontamento.
2. `leitura-cruzada.test.ts`, orientado pela mesma lista de tabelas de `catalogo-eixo.test.ts` — assumindo o papel da org A, contagem de linhas da org B tem que ser zero.
3. `escrita-cruzada.test.ts` — org A inserindo/atualizando com id da org B tem que falhar. É o teste que prova que a FK composta existe.
4. `security-definer.test.ts` — chamar cada uma das 18 funções com id de outra organização e exigir exceção. Ver a lista em `vertice-isolamento` (skill) e a query usada para gerá-la, abaixo.
5. Um caso específico em `cartoes`, que tem política de papel permissiva (`is_quadro_membro`) por cima do eixo — é o único jeito de pegar o erro de "restrictive vs permissive" descrito na skill `vertice-isolamento`.

## Como a lista de tabelas e funções foi levantada

```sql
select tablename from pg_tables where schemaname='public' order by 1;

select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;
```

Rode de novo antes de fechar a Fase 0 de verdade — o schema muda mais rápido que este arquivo.
