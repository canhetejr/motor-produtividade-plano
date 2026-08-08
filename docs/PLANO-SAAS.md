# Plano — Vértice como SaaS multi-inquilino

> **Superado por [`PLANO-PRODUTO.md`](./PLANO-PRODUTO.md) (08/08/2026).** O diagnóstico
> abaixo continua válido, mas o plano de execução foi corrigido em quatro pontos:
> as 18 funções `security definer` (que bypassam RLS e não estavam previstas aqui);
> a política do eixo tem que ser `restrictive`, não permissiva (permissiva **amplia**
> o acesso em vez de restringi-lo); `cron_execucoes` entra no eixo, senão só uma
> organização recebe e-mail; e entram plano por assento, trial de 14 dias e landing
> pública. Ler o novo documento antes de executar qualquer coisa daqui.

> Levantado em 03/08/2026 contra o banco de produção. Decisões do usuário:
> **SaaS multi-inquilino de verdade** (cada cliente é uma empresa isolada) e
> **sem cobrança por enquanto**.

---

## O que existe hoje

| | |
|---|---|
| Tabelas em `public` | **43**, todas com RLS |
| Políticas RLS | **95** |
| Organizações | **1**, implícita — não existe como entidade |
| Colaboradores | 11, numa única empresa |

Nenhuma tabela tem eixo de cliente. O isolamento hoje é entre *pessoas* dentro
de uma empresa (`is_quadro_membro`, `auth_role() = 'gestor'`), nunca entre
empresas.

### O achado que define o tamanho da obra

```sql
colaboradores.id  →  PK  E  FK para auth.users.id
```

A identidade da pessoa **é** a conta de login. É isso que faz
`colaborador_id = auth.uid()` funcionar em 24 políticas, e é elegante enquanto
existe uma empresa só.

Num SaaS, isso força uma escolha:

| | Consequência |
|---|---|
| **Uma pessoa pertence a uma empresa** | `colaboradores` ganha `organizacao_id` e mais nada muda na identidade. As 24 políticas continuam válidas. |
| **Uma pessoa pode pertencer a várias** | A PK de `colaboradores` tem que virar substituta, e **~25 tabelas** que apontam para `colaborador_id` passam a apontar para outra coisa. Toda política com `= auth.uid()` quebra. |

**Recomendo a primeira**, e o operador (você) resolve-se por fora — ver Parte 3.
Um SaaS que começa com pessoa-em-várias-empresas paga o custo antes de saber se
precisa dele. Migrar depois é caro, mas é caro *uma vez*, quando já houver
evidência de que faz falta.

---

## Parte 1 — O eixo de isolamento

### 1.1 As quatro raízes

O grafo de chaves estrangeiras mostra que tudo desce de quatro tabelas:

```
areas          (sem FK — raiz)
colaboradores  → areas, auth.users
quadros        → colaboradores
demandas       → areas
```

As outras 39 herdam escopo por FK. Em tese bastaria pôr `organizacao_id` nessas
quatro.

**Não vou fazer isso.** Com o eixo só nas raízes, a política de uma tabela folha
vira `EXISTS` encadeado até a raiz — e foi exatamente esse padrão que produziu os
17 avisos de `auth_rls_initplan` que corrigimos ontem. Pior: um `EXISTS` errado
não falha, ele **vaza**.

### 1.2 `organizacao_id` em todas as tabelas de negócio

Denormalizado, com garantia de consistência no banco:

```sql
-- Em cada tabela filha, a organização tem que ser a mesma do pai. Uma FK
-- composta obriga isso no banco, em vez de confiar em quem escreve o INSERT.
alter table cartoes
  add constraint cartoes_org_coerente
  foreign key (coluna_id, organizacao_id) references colunas (id, organizacao_id);
```

Isso exige `unique (id, organizacao_id)` na tabela pai — redundante em termos de
unicidade, barato em disco, e é o que torna **impossível** um card de uma empresa
apontar para uma coluna de outra. Sem essa constraint, o dia em que um `INSERT`
esquecer o `organizacao_id` correto, o vazamento existe e ninguém percebe.

**Fora do eixo** (globais do sistema, não de cliente): `config_push`,
`cron_execucoes`.

### 1.3 A política passa a ser uma linha

```sql
create policy x_org on public.x
  for select using (organizacao_id = (select org_atual()));
```

`org_atual()` é `STABLE SECURITY DEFINER`, lê a organização do
`colaboradores` de `auth.uid()`, e entra envolvida em subconsulta — o mesmo
hoisting que aplicamos ontem, desde o primeiro dia desta vez.

As políticas de papel (`gestor`, membro de quadro) continuam existindo **por
cima** do eixo, não no lugar dele: isolamento entre empresas e permissão dentro
da empresa são perguntas diferentes.

---

## Parte 2 — A tela de administração vira duas

Hoje `/admin` mistura duas coisas que num SaaS não podem conviver:

| Hoje em `/admin` | Vira |
|---|---|
| Saúde dos crons, variáveis de ambiente | **Console do operador** — seu, sobre a plataforma |
| Acessos, quadros, automações da empresa | **Tela do gestor** — do cliente, sobre a empresa dele |

O gestor de uma empresa **não pode** ver saúde de cron nem existência de outras
empresas. Hoje `requireAdmin()` protege por `colaboradores.admin`, que passará a
significar "administrador daquela empresa" — não operador da plataforma.

### 2.1 O operador é um papel fora do modelo de cliente

Tabela `operadores` separada, sem `organizacao_id`, referenciando `auth.users`.
Não é um `colaborador` com flag: se fosse, ele pertenceria a uma empresa, e a
primeira consulta que esquecesse o filtro o mostraria como membro dela.

O console do operador usa **cliente de serviço**, como fiz na rota `/q/[token]`,
e nunca RLS — porque a RLS correta para ele seria "vê tudo", que é a política
mais perigosa que existe. Melhor não ter política nenhuma e um caminho estreito
e auditado.

---

## Parte 3 — Onboarding e ciclo de vida

1. **Cadastro de empresa** — cria `organizacoes` + primeiro `colaborador` como
   gestor, numa transação. Hoje não existe caminho de auto-cadastro: contas são
   criadas pelo gestor. Vira o primeiro fluxo público além do login.
2. **Convite de membro** — o gestor convida por e-mail; o convidado cria senha e
   entra já vinculado. Hoje o gestor define a senha da pessoa, o que num SaaS é
   inaceitável.
3. **Suspensão e exclusão** — empresa suspensa perde acesso mas mantém dado;
   excluída, dado apagado com prazo. Sem isso não há como encerrar cliente.
4. **Troca de organização** — só faz sentido se você abrir a mão de "uma pessoa,
   uma empresa". Fica fora desta leva.

**Sem cobrança**, conforme decidido. Mas `organizacoes` já nasce com `plano` e
`limite_colaboradores` — colunas que não fazem nada hoje e evitam uma migração
de tabela grande quando fizerem.

---

## Parte 4 — O que quebra e precisa ser reescrito

| Área | Impacto |
|---|---|
| **95 políticas RLS** | Todas ganham o eixo. ~24 que usam `auth.uid()` continuam válidas (uma pessoa, uma empresa). |
| **Crons** (5 rotas) | Hoje varrem a base inteira. Passam a iterar por organização, e um erro aqui manda e-mail de uma empresa para outra. |
| **`lib/auth.ts`** | `requireUser`/`requireGestor` passam a devolver e exigir organização. É o ponto onde um esquecimento vira vazamento. |
| **Cliente de serviço** | Hoje usado em auditoria, notificações, push, cron, `/q/[token]`. Cada uso ignora RLS — cada um precisa filtrar organização à mão. **É a maior superfície de risco da obra.** |
| **Storage** (avatares, anexos) | Buckets são globais. Caminho passa a incluir a organização, e as policies de storage também. |
| **E-mail** | Remetente e assinatura por empresa, senão o cliente recebe e-mail com a marca de outro. |
| **Dados atuais** | Os 11 colaboradores e 556 apontamentos viram a organização nº 1. Migração de dado, com verificação. |

---

## Ordem de execução

```
Fase 1  organizacoes + organizacao_id nas 4 raízes + migração do dado atual
Fase 2  organizacao_id nas 39 restantes + FKs compostas
Fase 3  reescrever as 95 políticas com o eixo
Fase 4  lib/auth.ts, cliente de serviço, crons
Fase 5  separar /admin em console do operador × tela do gestor
Fase 6  onboarding: cadastro de empresa, convite, suspensão
Fase 7  storage e e-mail por organização
```

**As fases 1 a 4 têm que ir juntas ao ar.** Meio caminho é pior que nenhum: uma
tabela com eixo e a vizinha sem produz consulta que atravessa a fronteira sem
erro nenhum.

---

## Verificação — e aqui está o ponto

Todo o resto deste plano é mecânico. **Isto não é.**

Num app de uma empresa, um erro de permissão mostra dado demais para um colega.
Num SaaS, mostra dado de um cliente para outro — e isso não se conserta com um
`git revert`.

1. **Teste de isolamento automatizado, antes de qualquer código de produto.**
   Duas organizações completas em base de teste, e um teste por tabela que
   assume o papel de cada uma e afirma que a contagem cruzada é zero. São 43
   tabelas: 43 testes que precisam existir *antes*, não depois.
2. **Nenhuma consulta com cliente de serviço sem filtro de organização
   explícito.** Vale um teste que varre o código e falha se `createAdminClient()`
   aparecer sem `organizacao_id` na mesma função.
3. **`explain` nas consultas quentes** depois da Fase 3 — o eixo novo muda todos
   os planos.
4. **Ensaio de migração** numa cópia do banco antes de tocar produção. Os 556
   apontamentos existentes precisam sair do outro lado com a organização certa.

---

## O que eu recomendo antes de começar

**Abrir o app numa tela.** Entraram 20 funcionalidades ontem e nenhuma foi vista
por uma pessoa. Refazer 95 políticas sobre uma base cujo comportamento visual
ninguém conferiu é empilhar uma obra estrutural sobre fundação não medida — e,
quando algo sair errado, não haverá como saber de qual das duas camadas veio.
