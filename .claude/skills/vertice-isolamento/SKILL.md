---
name: vertice-isolamento
description: Regras de isolamento entre empresas (multi-inquilino) do Vértice — política RLS restritiva com org_atual(), FK composta, funções SECURITY DEFINER, e uso seguro do client de service role. Use SEMPRE que o trabalho tocar em política RLS, migration SQL, função do banco, cron, client de service role (createAdminClient), rota pública com token, ou qualquer consulta que leia dado de negócio — mesmo que o pedido não mencione multi-inquilino, isolamento ou organização. Se você está prestes a escrever `create policy`, `security definer`, `createAdminClient()` ou um `.from()` em código de servidor, leia isto antes.
---

# Isolamento entre empresas no Vértice

O Vértice está virando SaaS multi-inquilino. Cada empresa é uma organização isolada, e **uma pessoa pertence a exatamente uma organização** (`colaboradores.id` continua sendo `auth.users.id`).

O que torna este domínio diferente de permissão comum: num app de uma empresa só, um erro de permissão mostra dado demais para um colega. Aqui, mostra dado de um cliente para outro — e isso não se conserta com `git revert`. Some-se a isso que **quase todo erro de isolamento é silencioso**: não lança exceção, não quebra build, não falha teste de fumaça. Ele só devolve linhas a mais.

Por isso as regras abaixo são pouco negociáveis, e cada uma existe por causa de um modo de falha concreto.

## Estado atual

Confira antes de assumir: o eixo (`organizacao_id`) pode ainda não existir nas tabelas. `docs/PLANO-PRODUTO.md` tem o plano de execução por fases e é a fonte de verdade. Se a coluna não existe ainda na tabela que você está tocando, diga isso em vez de inventar filtro.

## 1. A política do eixo é `restrictive`, nunca permissiva

```sql
create policy "<tabela>_org" on public.<tabela>
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));
```

**Por que restritiva.** As políticas de papel que já existem no projeto (`is_quadro_membro()`, `auth_role() = 'gestor'`) são permissivas, e políticas permissivas combinam com `OR`. Se o eixo entrar como mais uma permissiva, o resultado é:

```
is_quadro_membro(quadro_id)  OR  organizacao_id = org_atual()
```

que **amplia** o acesso em vez de restringi-lo — exatamente o inverso do pretendido. Uma restritiva entra com `AND` sobre todas as permissivas, que é a semântica que se quer: "além de tudo o que já era exigido, tem que ser da minha organização".

Este é um erro de uma palavra que não emite aviso, não quebra teste de fumaça e amplia acesso. Se você encontrar uma política de eixo escrita como permissiva, corrija.

**Por que `(select ...)` em volta da função.** Sem isso o Postgres chama a função uma vez por linha. A migration `20260802130000_rls_initplan_e_metas.sql` corrigiu 17 avisos de `auth_rls_initplan` exatamente por isso. O `(select ...)` faz o planner içar a chamada para um InitPlan, executado uma vez.

**Por que uma política `for all` em vez de quatro.** O eixo é a mesma pergunta para select/insert/update/delete. Quatro políticas idênticas são quatro lugares para esquecer de atualizar.

Não desfaça o trabalho de `20260802140000_rls_consolidar_permissivas.sql`, que consolidou as permissivas existentes.

## 2. `org_atual()` devolve NULL para organização inativa

```sql
create or replace function public.org_atual() returns uuid
language sql stable security definer set search_path = public as $$
  select c.organizacao_id
  from public.colaboradores c
  join public.organizacoes o on o.id = c.organizacao_id
  where c.id = auth.uid()
    and c.ativo = true
    and o.status in ('trialing','ativa')
$$;
```

O join com `status` é defesa em profundidade, não redundância. Organização suspensa → `org_atual()` devolve `NULL` → `organizacao_id = NULL` é `NULL`, nunca `true` → toda tabela devolve zero linhas. Se o gate da aplicação for esquecido em algum caminho, o pior resultado é tela vazia, não dado de outro cliente.

Mesmo raciocínio que `20260722015000_auth_role_ativo.sql` já aplicou ao embutir `ativo = true` dentro de `auth_role()`.

## 3. FK composta, e nunca `MATCH FULL`

Toda tabela filha aponta para o pai levando a organização junto:

```sql
alter table public.<pai> add constraint <pai>_id_org unique (id, organizacao_id);

alter table public.<filha>
  add constraint <filha>_<pai>_org
  foreign key (<pai>_id, organizacao_id)
  references public.<pai> (id, organizacao_id) on delete cascade;

create index on public.<filha> (organizacao_id);
```

Isto é o que torna **impossível** um cartão de uma empresa apontar para uma coluna de outra. Sem a constraint, o dia em que um `INSERT` esquecer o `organizacao_id` correto, o vazamento existe e ninguém percebe.

**A armadilha:** colunas anuláveis. `cartoes.demanda_id` é nulo em cartão sem demanda. Com o `MATCH SIMPLE` padrão do Postgres, a FK composta simplesmente não valida quando a coluna é nula — que é o comportamento desejado. Com `MATCH FULL`, cartão sem demanda passaria a exigir `organizacao_id` nulo também, e a inserção quebra. Nunca escreva `MATCH FULL` nessas FKs.

O índice isolado em `(organizacao_id)` é o que serve à política. Os índices de FK criados em `20260802120000_indices_fk.sql` não cobrem isso.

## 4. Funções `SECURITY DEFINER` ignoram RLS — sempre

Existem 18 delas em produção (confirmado em `pg_proc`). Elas rodam como owner e **não passam por política nenhuma**. Uma política perfeita não protege nada que seja alcançável por uma dessas funções.

Ao escrever ou editar qualquer função `security definer` que toque dado de negócio, a checagem de organização é sua responsabilidade explícita:

```sql
-- Esta função roda como owner: RLS não vai nos proteger aqui.
-- A verificação de organização precisa ser escrita à mão, ou a função
-- vira um caminho de escrita cross-tenant.
if (select organizacao_id from public.cartoes where id = p_cartao_id)
   is distinct from (select public.org_atual()) then
  raise exception 'ORGANIZACAO_INVALIDA';
end if;
```

Sempre com `set search_path = public` — sem isso, um schema malicioso no path pode sequestrar as referências não qualificadas.

## 5. Service role: o filtro é manual, e é a maior superfície de risco

`createAdminClient()` (`utils/supabase/admin.ts`) bypassa RLS por definição. Cada uso é uma consulta sem rede de proteção.

**A regra:** toda consulta com service role a uma tabela de negócio carrega `organizacao_id` explícito. Sem exceção, e derivado de fonte confiável.

Em rotas públicas (`app/q/[token]/`, `app/formularios/[slug]/`) a organização vem **do próprio registro do token/slug**, nunca de query string ou body — esses são entrada não confiável, e um id vindo de fora é exatamente o vetor.

O modelo a copiar é `lib/admin-guard.ts`: ele acopla guard e bypass, de forma que não existe caminho para obter o client sem antes passar por `requireAdmin()`. O comentário dele explica o raciocínio de escopo — vale ler antes de criar um wrapper novo.

Quando precisar mesmo do client sem escopo (RPC, `auth.admin`, storage), use o nome explícito `createUnscopedAdminClient()` e adicione o arquivo à allowlist do teste estático. O atrito é proposital: força a decisão a aparecer no diff e virar conversa de revisão.

## 6. Crons iteram por organização — três armadilhas conhecidas

`lib/cron.ts` tem três coisas que quebram em silêncio quando existe mais de uma organização:

1. **`tentarReservarExecucao()`** usa único `(tipo, chave)`. Com iteração por org, a primeira reserva `('lembrete-diario','2026-08-08')` e as demais viram no-op: **todo cliente exceto um para de receber e-mail, sem erro nenhum.** A chave precisa ser `(tipo, organizacao_id, chave)`.
2. **`getEmailMap()`** monta um `Map` global de user→email com `perPage: 1000`. É PII de todos os inquilinos junta no mesmo processo, e quebra em silêncio acima de mil contas. Precisa receber os ids daquela organização.
3. **Falha numa organização não pode abortar o loop.** O `try/catch` atual engole tudo e retorna 500. Um cliente com dado ruim não pode calar os outros.

## Como verificar o que você escreveu

Antes de considerar pronto qualquer mudança nesta área:

- **Teste de leitura cruzada**: assumindo o papel da org A, a contagem de linhas da org B é zero — para cada tabela tocada.
- **Teste de escrita cruzada**: org A inserindo/atualizando com id da org B tem que falhar. É aqui que a FK composta prova que existe; o teste de leitura nunca a exercitaria.
- **Teste numa tabela com política de papel permissiva por cima** (`cartoes`, com `is_quadro_membro`). É o único jeito de pegar o erro permissiva-vs-restritiva da regra 1: numa tabela sem política concorrente, ele passa despercebido.
- **`get_advisors` (tipo `security` e `performance`)** depois de mexer em política. O eixo reintroduz chamada de função em toda política de toda tabela.

Se você não consegue rodar o teste, diga isso claramente em vez de afirmar que está isolado.
