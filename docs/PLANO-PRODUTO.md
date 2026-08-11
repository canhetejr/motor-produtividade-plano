# Vértice: de app interno a produto com plano por assento

> **Status: fases 1–7 executadas** (08–09/08/2026). O multi-inquilino saiu do papel —
> `organizacoes`, `organizacao_id` em toda tabela de negócio, políticas restritivas com
> `org_atual()`, FKs compostas, funções `SECURITY DEFINER` reescritas, assentos e ciclo
> de vida, `/console` do operador, landing/preços/cadastro e convite por e-mail.
> A Fase 8 (storage e e-mail por organização) entrou apenas em parte: existe
> `organizacoes.email_remetente`; a separação de Storage por organização **não**.
>
> **Leia este documento como registro de decisão, não como trabalho pendente.** Ele
> continua sendo a melhor explicação de *por que* o isolamento é como é — e as
> restrições de §Riscos continuam valendo para código novo. O que está de fato aberto
> no projeto é a migração para o Coolify (`CHECKLIST-MIGRACAO.md`).
>
> Os números abaixo (43 tabelas, 556 apontamentos, 11 colaboradores) são de 08/08 e já
> envelheceram. Pergunte ao banco quando importar.

## Contexto

Hoje o `motor-produtividade-plano` é um app **de uma empresa só**. 43 tabelas, 95 políticas RLS, 11 colaboradores, 556 apontamentos. Nenhuma tabela tem eixo de cliente: o isolamento existente é entre *pessoas* dentro de uma empresa (`is_quadro_membro`, `auth_role() = 'gestor'`), nunca entre empresas. Não existe cadastro público (contas são criadas pela gestão), nem noção de plano, assento ou cobrança.

O objetivo é transformar o Vértice num produto real da Tera: **SaaS multi-inquilino, cadastro público com trial de 14 dias, plano por assento, landing e preços dentro do próprio app**.

Decisões já tomadas:
- Multi-inquilino de verdade — **uma pessoa pertence a UMA empresa** (`colaboradores.id` continua sendo `auth.users.id`; as ~24 políticas com `= auth.uid()` sobrevivem intactas).
- **Sem integração de pagamento nesta leva.** Constrói-se toda a infraestrutura comercial — planos, `limite_assentos`, contagem e bloqueio de assentos, estados da conta — mas o gateway fica para depois.
- Cadastro público + trial de 14 dias + convite de membros por e-mail.
- Landing/pricing pública na rota `/` do próprio app.

**Consequência a assumir de olhos abertos:** com trial aberto e sem cobrança, o trial vence para `expirada` e a conversão em cliente pagante é **manual**, feita pelo operador (você) no console. Isso é sustentável para dezenas de contas, não para centenas. O momento de plugar o gateway é quando a conversão manual virar trabalho.

Este plano **corrige e substitui** `docs/PLANO-SAAS.md` em quatro pontos (ver §9).

---

## Ordem de execução

```
Fase 0   Rede de segurança: testes de isolamento (falhando)
Fase 1   organizacoes/planos/convites/operadores + eixo nas 4 raízes + migração do dado
Fase 2   organizacao_id nas 39 tabelas restantes + FKs compostas
Fase 3   Reescrever as 95 políticas RLS com o eixo
Fase 3b  Reescrever as 18 funções SECURITY DEFINER      ← ausente do plano original
Fase 4   App: lib/auth.ts, os 25 usos de createAdminClient, os 6 crons
─────────  Fases 1→4 vão ao ar JUNTAS, num único deploy
Fase 5   Assentos e ciclo de vida (planos, limite, triggers, status)
Fase 6   Separar /admin: console do operador × tela do gestor
Fase 7   Landing pública, preços, cadastro, convite por e-mail
─────────  Fases 5→7 vão ao ar JUNTAS — é este deploy que abre a porta da rua
Fase 8   Storage e e-mail por organização
```

Por que 1→4 juntas: entre a Fase 2 e a 3 o banco tem coluna de org mas políticas antigas — seguro **enquanto só existir a org nº 1**, catastrófico se houver cadastro aberto. Por que 5→7 juntas: abrir cadastro sem enforcement de assento é dar produto sem teto; sem console do operador é ficar sem como suspender cliente.

---

## Fase 0 — Rede de segurança

`vitest` já está configurado (`package.json`). Criar `__tests__/isolamento/` **antes de qualquer DDL**; os testes falham todos no início, e é esse o ponto.

1. **Seed** de duas organizações completas, com uma linha em **cada uma das 43 tabelas**. O seed é a parte cara; o teste é trivial.
2. **Um teste por tabela**, com a lista lida de `information_schema.tables` — assim uma tabela nova sem eixo quebra o teste na hora, em vez de escapar em silêncio.
3. **Teste de escrita cruzada**: org A tentando inserir/atualizar apontando para um id da org B tem que falhar. É aqui que as FKs compostas provam que existem.
4. **Teste das 18 RPCs `security definer`**: chamar cada uma com id de outra org e exigir exceção. Elas não passam por RLS — nenhum teste de `select` as tocaria.
5. **Um teste específico numa tabela com política de papel permissiva** (`cartoes`, com `is_quadro_membro`), para pegar o erro de permissiva-vs-restritiva descrito em §9.

**Antes da Fase 1: abrir o app numa tela.** 20 funcionalidades entraram sem verificação visual (`docs/PLANO-SAAS.md:203-208`). Uma passada manual pelas rotas principais, anotando o que funciona, custa uma tarde e é o que torna a Fase 3 depurável — sem isso, quando algo quebrar não há como distinguir "política nova errada" de "já estava quebrado".

---

## Fases 1–2 — O eixo de isolamento

### Tabelas novas

**`planos`** — catálogo global, fora do eixo. `codigo` (`trial`/`essencial`/`time`), `nome`, `assentos_inclusos`, `preco_mensal_centavos`, `ativo`, `ordem`. `select` liberado para `anon`: a página de preços renderiza do banco, não de valores em JSX — é a coluna que evita reescrever a landing quando o pagamento entrar.

**`organizacoes`** — `nome`, `slug` (citext único), `plano_id`, `limite_assentos`, `status`, `trial_expira_em`, `suspensa_em`, `excluir_em`, `criado_em`. Constraints:
- `status in ('trialing','ativa','suspensa','expirada','excluindo')`
- `(status = 'trialing') = (trial_expira_em is not null)` — sem isto aparece a org "em trial para sempre" que ninguém percebe.

`limite_assentos` é **copiado** do plano, não lido por join: editar a linha de um plano não pode mudar retroativamente o teto de quem já contratou.

**`convites`** — `organizacao_id`, `email`, `role`, `area_id`, `token_hash`, `convidado_por`, `expira_em` (7 dias), `aceito_em`, `revogado_em`. Guardar **SHA-256 do token**, nunca o token cru — este token concede escrita e assento, diferente do `/q/[token]` que só concede leitura. Índice parcial `unique (organizacao_id, email) where aceito_em is null and revogado_em is null`, para permitir reconvite depois de revogar.

**`operadores`** — `user_id → auth.users`, sem `organizacao_id`, RLS ligada e **sem política nenhuma** (só service role lê). Mesmo padrão de `cron_execucoes` em `supabase/migrations/20260722040000_cron_execucoes.sql`. Operador **não** é `colaborador` com flag: se fosse, pertenceria a uma empresa.

### Eixo nas 43 tabelas

Padrão por tabela filha, aplicado sem exceção:

```sql
alter table public.<pai> add constraint <pai>_id_org unique (id, organizacao_id);

alter table public.<filha> add column organizacao_id uuid;
update public.<filha> f set organizacao_id = p.organizacao_id
  from public.<pai> p where p.id = f.<pai>_id;
alter table public.<filha> alter column organizacao_id set not null;

alter table public.<filha>
  drop constraint <filha>_<pai>_id_fkey,
  add constraint <filha>_<pai>_org
    foreign key (<pai>_id, organizacao_id)
    references public.<pai> (id, organizacao_id) on delete cascade;

create index on public.<filha> (organizacao_id);
```

Duas armadilhas:
- **Nunca `MATCH FULL`.** `cartoes.demanda_id` é nulo em cartão sem demanda. Com o `MATCH SIMPLE` padrão a FK composta não valida nada quando a coluna é nula — que é o desejado. Com `MATCH FULL`, cartão sem demanda passa a exigir `organizacao_id` nulo e tudo quebra.
- O índice `(organizacao_id)` isolado é o que serve à política. Os índices de FK de `20260802120000_indices_fk.sql` não cobrem isso.

**Fora do eixo:** `planos`, `operadores`, `config_push` (chaves VAPID do servidor). `cron_execucoes` **entra** no eixo — ver §"crons".

### `org_atual()`

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

O join com `status` é deliberado: **suspensão vira defesa no banco**. Org suspensa → `NULL` → `organizacao_id = NULL` nunca é `true` → toda tabela devolve zero linhas. Um esquecimento no gate de aplicação vira app vazio, não app de outro cliente. Espelha `20260722015000_auth_role_ativo.sql`, que embutiu `ativo = true` dentro de `auth_role()` pelo mesmo raciocínio.

### Padrão de política (Fase 3)

```sql
create policy "<t>_org" on public.<t>
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));
```

- **`as restrictive`** — as políticas de papel existentes são permissivas e combinam com `OR`. Se o eixo entrar permissivo, `is_quadro_membro(...) OR organizacao_id = org_atual()` **amplia** o acesso. Restritiva entra com `AND` sobre todas. Isto contradiz `docs/PLANO-SAAS.md:89-91` e é o erro mais perigoso do documento original.
- **`(select ...)`** envolvendo a função — o hoisting de InitPlan de `20260802130000_rls_initplan_e_metas.sql`. Sem ele, chamada de função por linha em 43 tabelas.
- Uma política `for all` em vez de quatro: o eixo é a mesma pergunta para select/insert/update/delete.
- Não desfazer `20260802140000_rls_consolidar_permissivas.sql`.

`organizacoes` tem política própria (`id = (select org_atual())`, só leitura); `convites` exige o eixo **mais** `auth_role() = 'gestor'`.

---

## Fase 3b — As 18 funções SECURITY DEFINER

**Este é o buraco que o plano original não menciona.** 13 arquivos de migration definem 18 funções `security definer` — `registrar_apontamento`, `atualizar_apontamento`, `aprovar_cartao`, os RPCs de solicitação, `registrar_apontamento_timer` etc. Elas **bypassam RLS por construção**. `registrar_apontamento_timer` faz `select ... from cartoes where id = v_sessao.cartao_id` sem noção nenhuma de organização.

Cada uma ganha checagem explícita de `organizacao_id` contra `org_atual()`, com exceção nomeada em caso de divergência. Reescrever as 95 políticas sem isto deixa 18 caminhos de escrita cross-tenant abertos — a Fase 3 fica decorativa.

**Se algo precisar sair do escopo por prazo, não pode ser este item.**

Arquivos: `supabase/migrations/20260722020000_apontamentos_registrar_rpc.sql`, `20260722030000_solicitacoes_aprovar_rejeitar_rpc.sql`, `20260729150000_kanban_aprovacoes.sql`, `20260803150000_timer_blocos_finitos.sql`, entre outros.

---

## Fase 4 — O que quebra na aplicação

### `lib/auth.ts`
`getProfile()` já é `cache()`d por request; estender o `select` existente para trazer a organização junto — sem round trip novo:

```ts
.select('id, nome, role, admin, area_id, …, organizacao_id, organizacoes!inner(status, trial_expira_em, limite_assentos, nome)')
```

`requireUser()` ganha o desvio logo depois da checagem de `ativo`: status fora de `trialing`/`ativa` → `redirect('/conta/' + status)`. O comentário de `requireAdmin()` ("Admin global") vira falso: `colaboradores.admin` passa a significar **admin da empresa**. Criar `lib/operador-auth.ts` com `requireOperador()` lendo `operadores` via service role, separado.

### `createAdminClient()` — 25 arquivos

Substituir por `createOrgScopedAdminClient(organizacaoId)`, um wrapper cujo `.from()` já aplica `.eq('organizacao_id', orgId)`. Onde não der (RPC, `auth.admin`, storage), forçar o cliente cru sob um nome deliberadamente feio — `createUnscopedAdminClient()` — restrito a uma allowlist explícita verificada por teste.

Por risco:
- **Crítico, itera dados de negócio:** os 6 `app/api/cron/*/route.ts`, `lib/notifications.ts`, `lib/push.ts`, `lib/auditoria.ts`, `lib/variaveis-cartao.ts`, `lib/google-calendar.ts`
- **Crítico, superfície pública:** `app/q/[token]/page.tsx` e `app/formularios/[slug]/page.tsx` — rotas sem sessão, onde o token/slug é a única autorização. Precisam derivar `organizacao_id` **do próprio registro do token** e filtrar tudo por ele; qualquer id vindo de query string é entrada não confiável.
- **Médio:** `app/(app)/colaboradores/actions.ts`, `app/(app)/perfil/{actions.ts,page.tsx}`, `app/(app)/kanban/actions.ts`, `actions-anexos.ts`, `app/(app)/minha-semana/page.tsx`, `app/login/mfa-actions.ts`, `app/api/google/{callback,disconnect,calendar/sync}/route.ts`
- **Modelo a replicar:** `lib/admin-guard.ts` já acopla guard e bypass corretamente.

### Os 6 crons + `lib/cron.ts`

Todos passam a iterar `organizacoes where status in ('trialing','ativa')`. Três correções obrigatórias em `lib/cron.ts`:

1. **`tentarReservarExecucao()`** usa único `(tipo, chave)`. Com iteração por org, a primeira reserva `('lembrete-diario','2026-08-08')` e as demais viram no-op: **todo cliente exceto um para de receber e-mail, sem erro nenhum.** A chave vira `(tipo, organizacao_id, chave)` e `cron_execucoes` ganha `organizacao_id`.
2. **`getEmailMap()`** faz `admin.auth.admin.listUsers({ perPage: 1000 })` e monta um mapa global — vazamento de PII entre inquilinos dentro do processo, e quebra silenciosa ao passar de 1000 contas. Passa a receber os ids da org.
3. **Falha numa org não pode abortar o loop.** Hoje o `try/catch` de `lembrete-diario/route.ts:51` engole tudo e retorna 500. Passa a acumular erros por org e seguir: um cliente com dado ruim não pode calar os outros.

`vercel.json` ganha a entrada do novo cron `organizacoes-ciclo`.

---

## Fase 5 — Assentos e ciclo de vida

### O que consome um assento

**Colaborador `ativo = true` + convite pendente e não expirado.** Só colaboradores permite disparar 50 convites num plano de 5; só convites ignora quem foi criado por outro caminho. Função `assentos_ocupados(p_org)` soma as duas parcelas.

Desativar um colaborador (`ativo = false`, o que `app/(app)/colaboradores/actions.ts` já faz) libera o assento e preserva o histórico — ninguém deve ter que apagar dado para caber no plano. Aceitar convite é líquido zero: o assento foi reservado no convite, não no aceite, para o gestor não ser surpreendido por um convite de 6 dias atrás.

### Onde o bloqueio mora

Trigger `AFTER` (não `BEFORE` — em `BEFORE INSERT` a contagem não vê a linha nova e o teto fica sempre um a mais) em `convites` e em `colaboradores` (`insert or update of ativo, organizacao_id`), chamando `assentos_ocupados()` depois de `select ... from organizacoes where id = v_org for update`.

O **`for update` não é opcional**: sem ele, duas transações leem "4 de 5" ao mesmo tempo e ambas passam — o teto vira sugestão. É o mesmo bug que `20260803150000_timer_blocos_finitos.sql` já corrigiu para blocos finitos; o precedente está no repo.

O trigger é o enforcement real; a checagem na server action existe só para mensagem legível. Mapear `LIMITE_ASSENTOS_EXCEDIDO` em `lib/supabase-error.ts`, que já é o lugar desse tipo de tradução.

### Estados

```
cadastro → trialing ──(14 dias)──→ expirada
              │                       │
       (operador ativa)        (operador reativa)
              ↓                       │
            ativa ──(suspende)──→ suspensa ─┘ ──(30 dias)──→ excluindo → purge
```

| Estado | `org_atual()` | O usuário vê |
|---|---|---|
| `trialing` | id | App completo + faixa "Trial: N dias restantes" (tom de alerta a partir de 3) |
| `ativa` | id | App completo |
| `suspensa` | `NULL` | `/conta/suspensa` — dado preservado, contato de suporte |
| `expirada` | `NULL` | `/conta/expirada` — para o gestor, link para os planos |
| `excluindo` | `NULL` | Como suspensa, com a data do purge |

**Três camadas de gate, cada uma respondendo uma pergunta diferente:**
1. `org_atual()` — impede vazamento. Se as outras falharem, o pior caso é tela vazia.
2. `lib/auth.ts:requireUser()` — decide o destino.
3. `app/(app)/layout.tsx` — comunica (a faixa de trial, ao lado de `<BuscaGlobal />`, sem query nova; `requireUser()` já é chamado ali).

**Não em `proxy.ts`.** O middleware roda em toda requisição e hoje faz exatamente uma chamada (`utils/supabase/middleware.ts:38`). Somar query de organização é pagar latência em todo asset e prefetch por uma informação que muda uma vez a cada 14 dias — mesma linha do comentário já registrado em `utils/supabase/middleware.ts:7-9`.

**Transições automáticas:** novo `app/api/cron/organizacoes-ciclo/route.ts` (diário) move `trialing` vencido → `expirada` e marca `excluindo`. **O purge NÃO é automático nesta leva** — ver §9.

---

## Fase 6 — `/admin` vira duas telas

| Hoje em `/admin` | Vira |
|---|---|
| Saúde dos crons, variáveis de ambiente, lista de organizações | **Console do operador** — seu, sobre a plataforma |
| Acessos, quadros, automações da empresa | **Tela do gestor** — do cliente, sobre a empresa dele |

O console do operador usa cliente de serviço e nunca RLS, como `/q/[token]` já faz — a RLS correta para ele seria "vê tudo", a política mais perigosa que existe. Melhor não ter política e ter um caminho estreito e auditado. É neste console que a conversão manual de trial → cliente acontece enquanto não houver gateway.

---

## Fase 7 — Landing, preços e cadastro

O caminho já está quase aberto: `utils/supabase/middleware.ts:71` tem `pathname !== '/'` na condição de redirect — `/` já passa deslogado. Só `app/page.tsx` (que hoje é `redirect('/apontamento')`) precisa sair.

```
app/(marketing)/layout.tsx        # header/footer públicos, sem sidebar
app/(marketing)/page.tsx          # a landing, assume '/'
app/(marketing)/precos/page.tsx   # lê `planos` com o cliente anônimo
app/(marketing)/cadastro/{page.tsx,actions.ts}
app/convite/[token]/page.tsx
app/conta/{suspensa,expirada}/page.tsx
```

Route group `(marketing)` porque `app/(app)/layout.tsx` chama `requireUser()` incondicionalmente. **`/conta/*` tem que ficar fora de `(app)` e não pode chamar `requireUser()`** — senão `requireUser()` redireciona para `/conta/suspensa`, que redireciona de novo: loop infinito.

Ampliar as exclusões em `updateSession` (`utils/supabase/middleware.ts`), no mesmo padrão comentado das linhas 43-50, para `/`, `/precos`, `/cadastro`, `/convite/`, `/conta/`. O `config.matcher` de `proxy.ts:22` não muda. Redirect de usuário logado em `/` fica no proxy, que já tem o `user` em mãos de graça — assim a landing continua estática.

**Cadastro:** criar `auth.users` primeiro, depois RPC `criar_organizacao` (`security definer`, transacional) que insere `organizacoes` (`trialing`, `now() + 14 days`), `colaboradores` (`role='gestor'`, `admin=true`) e a área padrão; se a RPC falhar, apagar o usuário no `catch`. Um `auth.users` órfão é benigno — `getProfile()` devolve `null` e `requireUser()` manda para `/login`.

Reaproveitar `lib/senha-vazada.ts` (`verificarSenhaVazada`), já usado em `app/(app)/colaboradores/actions.ts:9`. **Rate limit obrigatório**: é a primeira rota do app que cria linhas sem autenticação nenhuma — sem teto, uma tarde de script gera 10 mil organizações em trial e a tela do operador vira inútil.

---

## Fase 8 — Storage e e-mail por organização

- **`avatars`** é bucket público, path `{user_id}/avatar` (`app/(app)/perfil/actions.ts`). Vira `{org_id}/{user_id}/avatar` — não por segurança (é público), mas para o purge conseguir apagar tudo de um cliente.
- **`anexos-cartoes`** é privado, servido por URL assinada (`actions-anexos.ts`). Path vira `{org_id}/{cartao_id}/{arquivo}`, e a checagem de org acontece **antes** de assinar: uma vez assinada, a URL é acesso puro.
- **E-mail:** `lib/email.ts` tem `FROM` e `APP_URL` como constantes de módulo — viram parâmetros. Sem domínio verificado por cliente, o `from` continua sendo o do Vértice; muda o nome de exibição e a assinatura, o que resolve o essencial. Domínio próprio por cliente é outra leva.

Migração: mover 11 avatares e reescrever `colaboradores.avatar_url`.

---

## Migração dos dados atuais

Transação única. `planos` ganha um plano `interno` (100 assentos, R$ 0); `organizacoes` ganha a org nº 1 **`ativa`, não `trialing`** (a constraint de coerência exigiria `trial_expira_em`, e a empresa de casa não está em trial). Backfill `organizacao_id` nas 43 tabelas, depois `set not null`.

Três asserções dentro da mesma transação:
1. Nenhuma linha órfã (`organizacao_id is null`) em nenhuma tabela.
2. Contagens idênticas — os 556 apontamentos e 11 colaboradores saem do outro lado com o mesmo número.
3. **Assumindo o JWT de um colaborador real, a contagem que ele vê é a mesma de antes.** É a asserção que se esquece e a única que importa: as duas primeiras provam que o dado está lá, só esta prova que continua *visível para quem já o via*. Eixo correto + política errada = app vazio para os 11 na segunda de manhã.

**Ensaio obrigatório** numa branch do Supabase com dump de produção, cronometrado. Cada `set not null` pega `ACCESS EXCLUSIVE`; com 556 linhas isso é instantâneo — o ensaio existe para confirmar, não para descobrir.

---

## Verificação

- `npm test` — os 43 testes de isolamento, os de escrita cruzada, os das 18 RPCs, e o de idempotência de cron (duas orgs, um cron, **dois** e-mails).
- **Teste estático** `__tests__/estatico/admin-client.test.ts`, em três regras, a primeira carregando o peso por ser binária: (1) ninguém importa `createUnscopedAdminClient` fora de uma allowlist explícita; (2) todo arquivo em `app/api/cron/` que faz `.from()` menciona `organizacao_id`; (3) nada em `components/` importa `utils/supabase/admin`. Um uso novo exige editar a allowlist — aparece no diff e vira conversa de revisão. É a diferença entre um teste que detecta e um que **obriga a decidir**.
- **Teste SQL de catálogo**: toda tabela em `public` fora das exceções tem `organizacao_id NOT NULL` **e** ao menos uma política `restrictive` mencionando `org_atual` (consulta em `pg_policies`). Pega a tabela nova sem eixo — o modo mais provável de o isolamento apodrecer com o tempo.
- **`get_advisors` do Supabase depois da Fase 3**, não depois da Fase 8: o eixo reintroduz chamada de função em toda política, e `20260802130000_rls_initplan_e_metas.sql` acabou de corrigir 17 avisos de `auth_rls_initplan`.
- **Manual, com duas contas de empresas diferentes em janelas anônimas lado a lado**, percorrendo kanban, apontamento, dashboard e relatórios. Confirmar que nenhuma busca global, nenhum autocomplete de responsável e nenhum e-mail atravessa a fronteira.

---

## Riscos

1. **As 18 funções `security definer`** (Fase 3b) — bypassam RLS por construção e não constam do plano original. Cortá-las por prazo põe o produto no ar com 18 caminhos de escrita cross-tenant abertos.
2. **Permissiva onde devia ser restritiva** — erro de uma palavra, sem aviso, sem quebrar smoke test, e que **amplia** o acesso. Por isso o teste da Fase 0 precisa cobrir `cartoes`, que tem política de papel permissiva por cima.
3. **`colaboradores.id = auth.users.id` amarra o e-mail a uma empresa para sempre.** `auth.users.email` é único globalmente: quem sai do cliente A e é convidado pelo cliente B **não consegue aceitar**, e o erro que aparece é um `23505` cru. Não muda a decisão, mas exige mensagem explícita na tela de aceite — consultor, contador e agência tocam vários clientes.
4. **Idempotência de cron global** — falha silenciosa, descoberta por reclamação semanas depois. Tem teste próprio.
5. **Purge em cascata é irreversível e rodaria sozinho.** `delete from organizacoes` com cascade em 43 tabelas, disparado por cron. Uma data errada e o dado de um cliente some. **Nesta leva o cron só marca `excluindo` e notifica o operador; o `delete` é ação manual e explícita no console.** Automatizar quando houver backup point-in-time verificado.
6. **Contagem de assentos sob concorrência** — sem o `for update`, o teto é violável por corrida.
7. **Regressão de performance depois da Fase 3** — coberta pelo `(select ...)`, mas só se aplicado nas 43 sem exceção.
8. **Ninguém abriu o app numa tela.** Ver Fase 0.
