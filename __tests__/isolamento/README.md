# Testes de isolamento entre organizações

Rede de segurança da Fase 0 de `docs/PLANO-PRODUTO.md`. Dois testes rodam **hoje**, antes de qualquer DDL da Fase 1, e é esperado que falhem — é assim que se mede o antes e o depois.

## O que existe

- **`admin-client-estatico.test.ts`** — varre o código por `createAdminClient()` fora da allowlist. Não depende de banco, roda em qualquer `npm test`. É o único dos dois que já vale a pena manter passando desde já: cada uso novo do client de service role tem que decidir explicitamente se entra na lista.
- **`catalogo-eixo.test.ts`** — para cada tabela de negócio em `public` (lista abaixo, tirada do catálogo real do banco em 08/08/2026), confere se ela tem `organizacao_id NOT NULL` e uma política `restrictive` mencionando `org_atual`. Hoje falha para as 43; depois da Fase 1–3, passa tabela por tabela. Precisa de `SUPABASE_SERVICE_ROLE_KEY` no ambiente — sem ela, pula com aviso em vez de quebrar o resto da suíte.

## Integração MCP real (Gate 1)

- **`mcp-real.integration.test.ts`** — usa exclusivamente o projeto Supabase de integração e só roda quando `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão presentes. A CI `MCP — suíte de isolamento (integração)` falha sem esses secrets e executa especificamente este arquivo.
- Antes de cada execução, remove apenas organizações com slug `mcp-it-%`, uma namespace reservada às fixtures. O cleanup remove dependências em ordem e confirma que as organizações da execução não sobrevivem.
- A fixture cria organizações A/B, Auth users, colaboradores, áreas, demandas, apontamentos, quadro/coluna/cartão/responsável e token MCP efêmero A. O token é gerado por `gerarTokenMcp()`, o mesmo gerador criptográfico usado pela Server Action de Perfil; o teste persiste apenas hash e prefixo, como produção.
- A prova percorre `tools/call`, `resources/read` e `POST /api/mcp` JSON-RPC para todas as leituras atuais, exigindo marcadores A presentes e B ausentes. Nenhum segredo ou token de fixture é logado.

## Propriedade da organização (dono)

- **`dono-organizacao.integration.test.ts`** — cobre as RPCs `atualizar_nome_organizacao` e `transferir_propriedade_organizacao` (migration `20260812200000`). Mesmo critério de execução dos anteriores: pula sem `SUPABASE_SERVICE_ROLE_KEY`, namespace de fixture reservada ao slug `dono-it-%`.
- É o primeiro arquivo daqui que autentica sessões **reais** (`signInWithPassword`) em vez de operar só por service role — as duas RPCs comparam `auth.uid()` com o dono, e o client de service role não tem `auth.uid()` nenhum. Testá-las por ele provaria o oposto do que interessa.
- Cobre os três eixos que a skill `vertice-isolamento` pede: leitura cruzada (org A não vê a linha da org B), escrita cruzada (dono da A transferindo para colaborador da B recebe `COLABORADOR_INVALIDO`) e privilégio dentro da mesma organização (gestor não-dono recebe `APENAS_DONO`). Mais a FK composta `organizacoes_dono_org` exercitada por `update` direto, para o dia em que `organizacoes` ganhar policy de UPDATE por engano.

## Histórico do eixo de organização

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
