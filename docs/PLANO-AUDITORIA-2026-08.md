# Auditoria do Vértice — segurança, arquitetura, velocidade, SEO e banco

**Data do levantamento:** 14/08/2026 · **Base:** `master` em `d387b41` · **Banco:** `bapufbypqmtjtujfbiai` (Postgres 17.6, `sa-east-1`)

Este documento é um **plano de execução**, não um relatório para arquivar. Ele existe para ser
consumido por agentes, uma trilha por sessão, com um agente validando o trabalho do anterior antes
da próxima etapa começar.

---

## Como este plano é executado

Cada workflow abaixo é uma **sessão isolada de um agente**. A regra é:

1. O agente **executor** lê só a sua ficha (`WF-xx`), faz o trabalho, roda os critérios de aceite e
   entrega em uma branch própria.
2. Um agente **validador** — outro, com contexto limpo — confere os critérios de aceite sem ter
   visto o raciocínio de quem implementou, e só ele aprova a passagem para o workflow seguinte.
3. Se o validador reprova, o executor recebe o motivo e corrige. O próximo workflow **não começa**.

O motivo de quebrar assim é o mesmo que motivou o pedido: uma sessão longa mistura contextos e o
agente começa a aceitar o próprio trabalho como validado. Um validador sem histórico não tem esse
viés.

### Contrato de não-regressão (vale para TODOS os workflows)

Este é o texto que deve ser colado no prompt de cada agente, executor ou validador:

> Nenhuma mudança deste plano pode alterar funcionalidade, recurso ou aparência do aplicativo.
> Concretamente, ao terminar:
>
> - `npm test` verde, com **o mesmo número de testes passando** de antes (novos testes podem ser
>   somados; nenhum pode sumir ou virar `skip`).
> - `npm run lint` sem erro.
> - `npm run build` sem erro, e **a tabela de rotas do build idêntica** à do baseline — mesma lista,
>   mesmo marcador `○`/`ƒ` em cada rota. Uma rota que muda de estático para dinâmico é regressão.
> - Nenhuma alteração em `design.md`, `app/globals.css` (tokens), `components/ui/**` ou em qualquer
>   JSX que mude o que a tela renderiza. Refatoração que preserva a árvore renderizada é permitida;
>   mudar espaçamento, cor, texto visível ou ordem de elementos não é.
> - Nenhuma mudança em contrato de server action (nome, assinatura, formato de retorno) sem que
>   todos os chamadores sejam atualizados no mesmo commit.
>
> Se alguma tarefa da sua ficha só puder ser cumprida quebrando esta regra, **pare e reporte** em vez
> de decidir sozinho.

### Ordem obrigatória

```
WF-00 baseline
   └─> WF-01 CI ──> WF-02 isolamento executável
                          │
        ┌─────────────────┼─────────────────┬──────────────┐
        ▼                 ▼                 ▼              ▼
   TRILHA A          TRILHA B          TRILHA C       TRILHA D
   segurança          banco            velocidade        SEO
   A1→A2→A3→A4      B1→B2→B3→B4       C1→C2→C3        D1→D2
        └─────────────────┴─────────────────┴──────────────┘
                                │
                                ▼
                           TRILHA E (arquitetura)
                            E1 → E2 → E3
```

WF-00, WF-01 e WF-02 são pré-requisito de tudo. As trilhas A–D podem correr em paralelo por agentes
diferentes **se** cada uma sair de `master` atualizado e mexer em arquivos disjuntos (as fichas
listam os arquivos). A trilha E vem por último de propósito: ela move código, e mover código antes
das outras trilhas transforma cada diff seguinte em conflito.

---

# Parte 1 — O que foi encontrado

## 1.1 Sumário honesto

Vale dizer isto antes de listar problema: **este código não parece "escrito por IA" no sentido
pejorativo.** A revisão encontrou decisões de segurança deliberadas, comentadas com o motivo, e um
modelo multi-inquilino que se sustenta. Isso muda a natureza do trabalho: não é resgate, é
endurecimento e acabamento.

O que está sólido — e que **nenhum workflow pode quebrar**:

| Propriedade | Estado verificado |
|---|---|
| Isolamento entre empresas | 46 de 53 tabelas com política `restrictive` citando `org_atual()`. As 7 restantes (`organizacoes`, `planos`, `operadores`, `operadores_acoes`, `cron_execucoes`, `config_push`, `assinaturas_manuais`) são de plataforma, não de inquilino — a ausência é correta. |
| Funções `SECURITY DEFINER` | 33 funções, **todas** com `search_path` fixado. Nenhuma exposta a `search_path` sequestrado. |
| Views | 3 views, **todas** `security_invoker=true` — RLS da tabela de baixo continua valendo. |
| Políticas RLS | 146 políticas, **todas** com `auth.uid()`/`org_atual()` dentro de subselect. Zero ocorrências do problema de reavaliação por linha (`auth_rls_initplan`). |
| Integridade referencial | 136 FKs, a maioria **compostas** `(id, organizacao_id)` — é o que impede uma organização apontar para linha de outra. 41 constraints `CHECK`. |
| XSS | Um único `dangerouslySetInnerHTML`, e ele passa pelo sanitizador. O sanitizador **é** o schema do editor TipTap (não há allowlist paralela para envelhecer). Resposta de formulário público é escapada antes de virar HTML. |
| Injeção em planilha | `sanitizeFormula` + `escapeCsv` aplicados no export. |
| Segundo fator | 6 dígitos com `randomInt`, hash SHA-256 com sal por desafio, comparação em tempo constante, teto de 5 tentativas contado no banco, validade de 10 min. |
| OAuth Google | `state` CSRF em cookie `httpOnly`/`sameSite=lax`/`path=/api/google`/600 s; `refresh_token` cifrado em AES-256-GCM. |
| Link público de quadro | Token de 64 hex validado por regex **antes** de tocar o banco; projeção por lista de permissão (`paraPublico`), não de exclusão. |
| Cadastro público | Honeypot + tempo mínimo + janela global de 20 cadastros/5 min. |
| Senha vazada | Verificação contra o Have I Been Pwned (k-anonimato) em 4 dos 5 caminhos que definem senha. |
| Anexos | Bucket privado, caminho derivado do `organizacao_id` obtido **via RLS**, URL assinada de 10 min. |
| Segredos | Nada versionado. `.gitignore` cobre `.env*`. Varredura por padrão de chave: limpa. |
| Estado da suíte | 595 testes passando, `lint` limpo, `build` verde. |

## 1.2 Segurança — o que falta

Ordenado por risco real, não por gravidade teórica.

---

### S1 · Não existe nenhum cabeçalho HTTP de segurança — **Alto**

`next.config.ts` não tem `headers()`. O app responde sem `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`,
`Referrer-Policy` nem `Permissions-Policy`.

O efeito prático mais direto: **qualquer site pode embutir o Vértice autenticado em um `<iframe>`**.
Com o app renderizado dentro de uma página hostil, um clique enganado do usuário logado vira uma ação
real (aprovar cartão, desativar colaborador, marcar entrega). É clickjacking clássico, e a defesa é
um cabeçalho.

O CSP é defesa em profundidade: hoje a sanitização de HTML está correta, mas ela é a **única** camada.
Um bug futuro no sanitizador vira execução de script sem nada para segurar.

→ **WF-A1**

---

### S2 · A suíte que garante o isolamento não roda em lugar nenhum — **Alto**

Este é o achado mais importante do documento, e ele não é um bug de código.

O projeto declara — em `AGENTS.md`, na skill `vertice-isolamento`, em `docs/PLANO-PRODUTO.md` — que o
isolamento entre clientes é a propriedade que não pode regredir, e que os testes em
`__tests__/isolamento/` existem para travar isso. Medido:

```
88 testes pulados  __tests__/isolamento/catalogo-eixo.test.ts
14 testes pulados  __tests__/isolamento/dono-organizacao.integration.test.ts
 6 testes pulados  __tests__/isolamento/mcp-real.integration.test.ts
 1 teste  pulado   __tests__/isolamento/mcp-tokens.test.ts
```

São **109 dos 704 testes**, e são exatamente os que verificam o eixo de organização tabela por tabela.
Eles pulam porque exigem `SUPABASE_SERVICE_ROLE_KEY` no ambiente e não há banco de teste dedicado.

O plano B seria o CI. O único workflow do repositório
(`.github/workflows/mcp-integracao.yml`) está, por decisão explícita e documentada no próprio
arquivo, **falhando de propósito** — os secrets `MCP_INTEGRATION_*` nunca foram provisionados. E ele
só dispara em `push` para `master` com filtro de caminho em `lib/mcp/**`; não cobre pull request,
não roda `lint`, não roda `build`, não roda o resto de `npm test`.

Resultado: hoje o único teste de isolamento que efetivamente roda é o estático
(`admin-client-estatico.test.ts`), que confere a allowlist de service role. Ele é bom, mas confere
**quem importa o client**, não **o que o banco permite**. Uma migration que esqueça a política
restritiva passa despercebida por toda a esteira.

Não é uma vulnerabilidade encontrada. É a ausência do mecanismo que encontraria a próxima.

→ **WF-01** e **WF-02**

---

### S3 · O formulário público não tem nenhuma proteção contra abuso — **Médio**

`submeterFormulario` (`app/(app)/kanban/actions.ts:1133`) é a única escrita autenticada por nada:
qualquer pessoa com o slug de um formulário insere um cartão no quadro de um cliente, via service
role.

A validação existente confere que o formulário existe, está ativo e que os campos obrigatórios vieram
preenchidos. O que **não** existe:

- nenhum honeypot nem tempo mínimo — ao contrário de `/cadastro`, que tem os dois;
- nenhum teto de submissões por janela;
- nenhum limite de tamanho nas respostas. O título é cortado em 150 caracteres, mas
  `descricao` recebe `todas_respostas` inteiro. Um POST com 5 MB de texto por campo vira uma linha de
  5 MB em `cartoes`.

A assimetria é o que chama atenção: quem escreveu `/cadastro` pensou nisso e deixou o raciocínio
comentado. O formulário público ficou de fora.

Impacto: um script enche o Kanban de um cliente e infla o banco. Não vaza dado, não escala privilégio
— é disponibilidade e custo.

→ **WF-A2**

---

### S4 · Anexo aceita qualquer tipo, com o nome do arquivo indo direto para o caminho — **Médio**

`enviarAnexo` (`app/(app)/kanban/actions-anexos.ts:23`) valida tamanho (15 MB) e nada mais:

```ts
const path = `${cartao.organizacao_id}/${cartaoId}/${Date.now()}-${file.name}`
await admin.storage.from('anexos-cartoes').upload(path, file, {
  contentType: file.type || 'application/octet-stream',
})
```

Dois problemas independentes:

1. **Sem allowlist de MIME.** `file.type` vem do navegador e é usado como `contentType` do objeto.
   Um `.html` ou `.svg` enviado como `text/html` é servido com esse tipo pela URL assinada — o
   conteúdo executa no domínio do Storage do Supabase. Não é o domínio do app (o cookie de sessão
   não vai junto), mas serve muito bem para phishing com um endereço que a vítima reconhece.
2. **`file.name` não é sanitizado** antes de compor o caminho. Quem controla o nome controla parte
   da chave do objeto. O SDK do Storage normaliza a maior parte dos casos, mas depender da
   normalização de uma dependência para a segurança de um caminho é a categoria de aposta que este
   projeto evita em todo lugar — e deveria evitar aqui também.

O acerto que já existe e não pode ser desfeito: `organizacao_id` vem de uma consulta com RLS, nunca
do chamador.

→ **WF-A2**

---

### S5 · Recuperação de senha escapa da verificação de senha vazada — **Médio**

`lib/senha-vazada.ts` consulta o Have I Been Pwned e é chamada em quatro lugares: cadastro, criação
de colaborador, definição de senha padrão e troca no perfil. O quinto caminho não passa por lá:

```ts
// app/auth/redefinir-senha/page.tsx — componente cliente
const { error } = await createClient().auth.updateUser({ password: senha })
```

Isso vai direto do navegador ao Supabase Auth. Nenhum código de servidor do Vértice participa, então
nenhuma verificação do app pode ser aplicada. É justamente o fluxo que alguém usa depois de perder o
acesso — o momento em que reciclar uma senha conhecida é mais provável.

A correção certa **não** é código: é a chave de proteção contra senha vazada no painel do Supabase,
que hoje está desligada (confirmado pelo advisor `auth_leaked_password_protection`). Ela cobre esse
caminho e é a única coisa que cobre.

Junto disso: o comprimento mínimo aceito é 6 caracteres (`cadastroSchema`), abaixo do mínimo de 8
que qualquer referência atual recomenda.

→ **WF-A3**

---

### S6 · Superfície exposta a `anon` maior que o necessário — **Baixo**

- `auth_role()` e `is_quadro_membro(uuid)` são `SECURITY DEFINER` executáveis por `anon` via
  `/rest/v1/rpc/`. Um visitante deslogado pode chamá-las. Elas devolvem `null`/`false` sem sessão,
  então não vazam — mas são superfície que não precisa existir.
- A view `demandas_acumulado` tem `GRANT` para `anon`. Como é `security_invoker`, a RLS da tabela de
  baixo continua barrando, e o retorno é vazio. Mesma leitura: sem impacto hoje, sem motivo para
  estar aberta.

O risco não é o estado atual; é o dia em que alguém acrescentar uma política permissiva na tabela de
baixo e a porta já estiver destrancada.

→ **WF-A3**

---

### S7 · O tempo mínimo do cadastro é um valor que o cliente escolhe — **Baixo**

```ts
const carimbo = Number(formData.get('carimbo'))
if (!Number.isFinite(carimbo) || Date.now() - carimbo < TEMPO_MINIMO_MS) falhar(ERRO_GENERICO)
```

`carimbo` é um campo oculto do formulário. Um script manda `Date.now() - 5000` e a checagem passa
sem esperar nada. O comentário no arquivo já reconhece que as duas primeiras camadas não seguram um
script dedicado — a terceira (janela global) é a que realmente vale.

Não é urgente. Vira relevante quando o cadastro público tiver tráfego real. Assinar o carimbo com
HMAC do servidor resolve em poucas linhas.

→ **WF-A2** (mesma sessão da S3, é o mesmo tipo de trabalho)

---

### S8 · Nenhuma observabilidade — **Baixo (mas amplifica todo o resto)**

Não há Sentry, nem equivalente. O tratamento de erro é `console.error`, e em produção isso vira log
da Vercel, que ninguém lê proativamente.

Consequência concreta e já materializada no histórico do projeto: um cron que falha em silêncio, um
embed do PostgREST que quebra e derruba o login de todo mundo (aconteceu em 12/08). Nos dois casos, o
sintoma foi percebido por gente, não por instrumentação.

Sem isso, cada correção deste plano é entregue sem meio de saber se funcionou em produção.

→ **WF-A4**

## 1.3 Arquitetura e código

Nada aqui é bug. É acabamento — e o critério é: se um desenvolvedor novo abre o arquivo, ele entende
onde mexer?

**A1 · `app/(app)/kanban/actions.ts` tem 1.250 linhas e 24 server actions.** O módulo já foi fatiado
em 13 irmãos (`actions-anexos`, `actions-tempo`, `actions-regras`…), então a convenção existe e está
funcionando — este arquivo é só o resíduo que não acompanhou. Ele carrega quadros, colunas, cartões,
formulários e a submissão pública no mesmo lugar. O segundo maior é
`app/(operador)/console/actions.ts`, com 756 linhas e 17 actions.

**A2 · Não existe uma fronteira única de server action.** São 148 actions; 21 dos 30 arquivos usam
Zod, 9 não. Os 9 fazem validação à mão (e fazem bem — `definirLimiteAssentos` confere inteiro,
mínimo, e ainda compara com assentos ocupados). O problema não é a qualidade de cada uma, é que
guard + validação + auditoria + `ActionResult` são recompostos 148 vezes. A 149ª é onde alguém
esquece um pedaço.

**A3 · Agregação acontece em JavaScript, sobre tabelas inteiras.** `app/(app)/gestao/page.tsx` puxa
`cartoes` sem `limit` e reduz em Node para montar heatmap e top-demandas. Com 26 cartões é
instantâneo; com 200 mil é uma página que não abre. O Postgres faz isso melhor e devolve dezenas de
linhas em vez de centenas de milhares.

**A4 · `getEmailsPorId` faz uma chamada HTTP por pessoa.** Em `lib/cron.ts`:

```ts
await Promise.all(ids.map(async (id) => {
  const { data, error } = await admin.auth.admin.getUserById(id)
  ...
}))
```

É `N` requisições ao Auth por cron, por organização. A implementação anterior (listar tudo) foi
trocada por esta justamente porque vazava e-mail entre inquilinos — a decisão foi certa, o custo é
que sobrou N+1. Com 12 pessoas não dói; com 50 clientes de 20 pessoas são mil chamadas por execução
de cron.

**A5 · `lib/` é plano, com 130 arquivos.** Módulo de domínio, utilitário de formatação, cliente de
integração e regra de negócio dividem o mesmo nível. Funciona, mas a navegação depende de conhecer os
nomes.

**A6 · Não há `app/global-error.tsx`.** Existe `error.tsx`, que não cobre erro no próprio layout
raiz. Um erro ali entrega a tela branca padrão do Next, sem a marca.

**A7 · Resíduos no repositório.** `Kamban/` (projeto de referência, já ignorado no ESLint e no
TypeScript), `Qualidade EAD.csv` na raiz, `supabase/APLICAR_PENDENTES.sql` (116 KB, superado pelas 83
migrations) e os SVGs de boilerplate do Next em `public/` (`next.svg`, `vercel.svg`, `file.svg`,
`globe.svg`, `window.svg`).

## 1.4 Velocidade

Medições reais deste build:

```
build:            verde, TypeScript em 23,9 s
rotas:            76, sendo 17 estáticas e 59 dinâmicas
JS de cliente:    4,8 MB somando todos os chunks (não comprimidos)
maior chunk:      409 KB
CSS:              150 KB em um único arquivo
```

**C1 · Toda requisição autenticada paga duas idas ao Supabase Auth.** O `proxy.ts` chama
`updateSession()`, que chama `supabase.auth.getUser()` — uma requisição de rede ao Auth. Logo depois,
a página chama `requireUser()` → `getProfile()` → `supabase.auth.getUser()` **de novo**. O
`React.cache` deduplica dentro de um render, mas o proxy roda antes e fora dele.

Então cada navegação é: `getUser` (rede) → `getUser` (rede) → `select` em `colaboradores` (rede),
tudo em série, tudo para `sa-east-1`, antes de qualquer HTML sair. É o custo fixo de toda tela do app.

Existe saída limpa e específica deste projeto: as sessões são assinadas com **JWT Signing Keys
assimétricas (ECC P-256)** — está documentado em `lib/mcp-auth.ts`. Com chave assimétrica,
`getClaims()` verifica a assinatura **localmente**, sem rede. O proxy pode validar a sessão sem sair
da máquina, e a ida ao Auth acontece uma vez só, no `getProfile()`.

**C2 · Zero cache de dados.** Nenhum `unstable_cache`, nenhum `revalidateTag` no projeto inteiro.
Toda página é `force-dynamic`. Dados que praticamente não mudam — `areas`, `demandas` ativas, lista de
colaboradores, `planos` — são reconsultados em cada render. A página do Kanban dispara 11 consultas
em paralelo, quatro delas de dados de referência.

**C3 · 150 KB de CSS em um arquivo só.** É o Tailwind v4 gerando tudo em um bundle único, carregado
por qualquer rota — inclusive a landing estática, que usa uma fração.

**C4 · `/cadastro` renderiza dinâmico.** É página de marketing e deveria ser estática; provavelmente
é o `carimbo` gerado no servidor que a torna dinâmica. Custa TTFB na rota que recebe o tráfego pago.

**C5 · 43 FKs sem índice de cobertura** (advisor de performance). Praticamente todas as compostas
`(x_id, organizacao_id)`. Hoje é irrelevante — a maior tabela tem 472 KB — mas é dívida que só
aparece com volume, e aparece de uma vez.

> ⚠️ **Atenção ao advisor de índice não utilizado.** Ele lista 28 índices "nunca usados". Nesse banco
> isso **não significa nada**: as tabelas estão praticamente vazias e as estatísticas refletem um
> ambiente sem carga real. Derrubar índice com base nisso é como concluir que um freio é inútil
> porque o carro está na garagem. Nenhum workflow deste plano remove índice.

**C6 · `next/image` não é usado em lugar nenhum** e não há `optimizePackageImports` configurado para
os pacotes grandes (`lucide-react`, `recharts`, `date-fns`). O que já está certo: `jspdf` e
`jspdf-autotable` entram por `import()` dinâmico, o editor de texto rico tem versão lazy, e o quadro
Kanban usa `next/dynamic`.

## 1.5 SEO

A superfície indexável é pequena por natureza — três páginas públicas (`/`, `/precos`, `/cadastro`).
Isso torna o trabalho barato, não desnecessário: com três páginas, cada uma precisa estar certa.

| Item | Estado |
|---|---|
| `robots.txt` | **Não existe.** Nenhum `app/robots.ts`, nada em `public/`. |
| `sitemap.xml` | **Não existe.** |
| OpenGraph / Twitter Card | **Ausente em todo o projeto.** Link do Vértice colado no WhatsApp, LinkedIn ou Slack aparece como texto cru, sem imagem, sem título formatado. |
| Canonical | Ausente. |
| Dados estruturados (JSON-LD) | Ausentes. Não há `Organization`, `SoftwareApplication` nem `Offer` em `/precos` — que tem tabela de preços e é candidata natural. |
| `metadataBase` | `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`. Se a env faltar em produção, toda URL absoluta de metadado aponta para localhost. |
| `/precos` | Só `title`. Sem `description` — o Google inventa uma a partir do corpo. |
| `noindex` nas rotas privadas | Só `/q/[token]` declara. As demais dependem do redirect para `/login`. |
| Idioma e semântica | `lang="pt-BR"` correto, hierarquia de headings coerente, `alt` presente. Isto está certo. |

## 1.6 Banco — estrutura atual

Levantado direto do banco, não de documentação:

```
tabelas                53        políticas RLS       146
views                   3        funções             35  (33 SECURITY DEFINER)
índices               206        triggers             9
foreign keys          136        CHECK constraints   41
tipos enum              3        migrations          83
```

Maior tabela: `apontamentos`, 472 KB. O banco inteiro cabe em poucos megabytes — é um produto em
produção com uma equipe, não com um mercado. Toda recomendação de performance abaixo é preparação,
não remédio.

### Domínios

**Plataforma (7 tabelas, fora do eixo por definição)**
`organizacoes` · `planos` · `assinaturas_manuais` · `operadores` · `operadores_acoes` ·
`cron_execucoes` · `config_push`

**Identidade e acesso (4)**
`colaboradores` · `convites` · `desafios_mfa` · `mcp_tokens`

**Núcleo de produtividade (7 + 3 views)**
`areas` · `demandas` · `apontamentos` · `apontamentos_correcoes` · `apontamentos_arquivados` ·
`solicitacoes_demandas` · `metas`
views: `apontamentos_calculado` · `indicadores_diarios` · `demandas_acumulado`

**Kanban (28)**
`quadros` · `quadros_membros` · `quadros_campos` · `quadros_compartilhamentos` · `colunas` ·
`colunas_requisitos` · `cartoes` e 12 tabelas `cartoes_*` (responsáveis, etiquetas, anexos,
comentários, aprovações, checklist, dependências, predecessores, sequência, sessões de tempo,
campos, e-mails, requisitos) · `etiquetas` · `comentarios_cartao` · `automacoes` ·
`automacoes_acoes` · `automacoes_execucoes` · `formularios` · `formularios_campos` ·
`cartoes_templates`

**Transversal (7)**
`auditoria` · `notificacoes` · `push_inscricoes` · `relatorios_agendados` ·
`relatorios_agendados_destinatarios` · `google_workspace_conexoes` · `google_calendar_eventos`

### O que está certo e não deve ser mexido

O eixo de organização está **completo**. A consulta que procura tabela de negócio sem política
restritiva ligada a `org_atual()` devolve exatamente as 7 de plataforma. As FKs compostas fazem o
trabalho que FK simples não faria. As views são `security_invoker`. As funções têm `search_path`.
As políticas usam subselect.

Isto não é comum e é o resultado de sete fases de trabalho documentadas em `docs/PLANO-PRODUTO.md`.
**A proposta "mais robusta" abaixo não redesenha nada disso** — o desenho está certo. Ela endereça o
que o desenho ainda não cobre: crescimento, custo de consulta e o que acontece quando as tabelas
deixarem de ser pequenas.

### Estrutura proposta — cinco mudanças

#### D1 · Índices de cobertura para as FKs compostas

43 FKs `(x_id, organizacao_id)` sem índice. Toda consulta com filtro por organização — ou seja,
todas — passa por elas. Hoje o planejador faz varredura sequencial porque a tabela cabe em uma
página; quando não couber, o custo aparece de uma vez em todas as telas.

Não é "criar 43 índices". É criar onde a consulta real usa: as tabelas com maior cardinalidade
projetada (`cartoes`, `apontamentos`, `comentarios_cartao`, `auditoria`, `notificacoes`,
`cartoes_sessoes_tempo`) e as com `ON DELETE CASCADE`, onde a ausência de índice transforma a
exclusão de uma organização em varredura completa de cada filha.

Acrescentar também os compostos que as telas realmente pedem, e que não são FK:

```sql
create index on apontamentos (organizacao_id, data desc);
create index on cartoes (organizacao_id, prazo) where entregue_em is null;
create index on auditoria (organizacao_id, criado_em desc);
create index on notificacoes (destinatario_id, lida) where lida = false;
```

Todos com `CREATE INDEX CONCURRENTLY`, que não trava escrita.

#### D2 · Política de retenção — o que hoje só cresce

Cinco tabelas crescem sem nada que as pare:

| Tabela | Escreve | Hoje | Proposta |
|---|---|---|---|
| `auditoria` | toda ação de gestão | 194 linhas | manter 24 meses; acima disso, arquivar |
| `cron_execucoes` | 7 crons × N organizações × todo dia | 51 linhas | manter 90 dias |
| `automacoes_execucoes` | toda automação disparada | 0 | manter 90 dias |
| `notificacoes` | todo evento notificável | 10 | apagar lidas com mais de 90 dias |
| `desafios_mfa` | todo login com MFA | — | apagar verificados/expirados com mais de 7 dias |

Uma função de limpeza e um cron diário. É a diferença entre um banco que se mantém e um que precisa
de intervenção manual no ano que vem.

Ponto de atenção: `auditoria` é registro de conformidade. Apagar é decisão de negócio, não técnica —
a ficha do workflow manda **perguntar antes**, e o padrão é arquivar, não apagar.

#### D3 · E-mail resolvido em uma consulta, não em N chamadas

Hoje `getEmailsPorId` faz `admin.auth.admin.getUserById(id)` por pessoa. Proposta: uma função
`SECURITY DEFINER`, com o mesmo rigor das existentes, que lê `auth.users` uma vez e **filtra por
organização dentro da própria função** — mantendo a propriedade que motivou a implementação atual:

```sql
create or replace function public.emails_por_colaborador(p_organizacao_id uuid, p_ids uuid[])
returns table (colaborador_id uuid, email text)
language sql security definer set search_path = public
as $$
  select c.id, u.email::text
  from colaboradores c
  join auth.users u on u.id = c.id
  where c.organizacao_id = p_organizacao_id
    and c.id = any(p_ids);
$$;
revoke all on function public.emails_por_colaborador(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.emails_por_colaborador(uuid, uuid[]) to service_role;
```

`revoke` de `authenticated` é o ponto central: só o cron chama. N chamadas HTTP viram uma.

#### D4 · Agregação no banco, não em Node

`gestao/page.tsx` e o dashboard puxam tabelas inteiras para reduzir em JavaScript. Proposta: uma RPC
por painel, `SECURITY INVOKER` (para a RLS continuar valendo), devolvendo já agregado. O tráfego cai
de "todos os cartões" para "uma linha por dia".

Sem view materializada nesta fase — ela traz invalidação, e invalidação errada mostra número errado,
que é pior que número lento.

#### D5 · Documentar as tabelas sem política

`assinaturas_manuais`, `config_push`, `cron_execucoes`, `operadores`, `operadores_acoes` aparecem no
advisor como "RLS ligada, nenhuma política". Está **correto** — são intransponíveis de propósito, só
service role lê. Mas o advisor vai repetir isso para sempre, e a cada auditoria alguém vai reabrir a
discussão.

Proposta: `comment on table` explicando a intenção em cada uma. Custa uma migration e encerra a
pergunta de forma permanente, no lugar onde ela é feita.

---

# Parte 2 — Os workflows

Cada ficha é auto-suficiente. O agente recebe: esta ficha + o contrato de não-regressão + o baseline
do WF-00.

---

## WF-00 · Baseline registrado

**Depende de:** nada · **Muda código:** não · **Tempo:** curto

**Objetivo.** Produzir o retrato de "antes" contra o qual todos os validadores vão comparar. Sem
isso, "não mudou a aparência" é opinião.

**Fazer.**
1. `npm ci`, `npm test`, `npm run lint`, `npm run build` — os quatro devem passar.
2. Gravar em `docs/auditoria/BASELINE.md`:
   - número de testes passando / pulados, e a lista dos arquivos com testes pulados;
   - a tabela de rotas do build, na íntegra, com os marcadores `○`/`ƒ`;
   - tamanho total de `.next/static/chunks`, os 10 maiores chunks, tamanho do CSS;
   - saída de `npm run lint`;
   - contagens do banco (tabelas, políticas, funções, índices, triggers, views, FKs, migrations);
   - saída completa de `get_advisors` (segurança **e** performance).
3. Commit em `docs/auditoria/BASELINE.md`. Nenhum outro arquivo.

**Aceite.** O arquivo existe, os quatro comandos passaram, e um terceiro consegue reproduzir cada
número a partir das instruções do próprio arquivo.

---

## WF-01 · CI que roda de verdade

**Depende de:** WF-00 · **Muda código:** só `.github/` · **Tempo:** curto

**Objetivo.** Que `lint`, `test` e `build` rodem sozinhos em todo pull request. É o que torna
validável tudo o que vem depois.

**Fazer.**
1. Criar `.github/workflows/ci.yml`: dispara em `pull_request` e em `push` para `master`; Node 22
   (bate com `engines`); `npm ci`; `npm run lint`; `npm test`; `npm run build`.
2. O build precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` para não quebrar
   na coleta de páginas. Usar valores de placeholder no job — **não** secrets de produção. O build
   não conecta ao banco; só precisa das variáveis existirem.
3. **Não tocar** em `mcp-integracao.yml`. Ele falha de propósito e é WF-02 quem resolve.

**Aceite.** Um PR de teste (uma linha em um comentário) dispara o workflow e ele fica verde. Um PR
com erro de lint proposital fica vermelho. O validador confere os dois casos.

**Rollback.** Apagar o arquivo.

---

## WF-02 · A suíte de isolamento passa a rodar

**Depende de:** WF-01 · **Muda código:** testes e CI · **Tempo:** médio · **Risco:** baixo, alto valor

**Objetivo.** Que os 109 testes pulados executem contra um banco real, em CI, em todo PR que toque
migration ou política.

**Contexto.** O projeto tem um segundo projeto Supabase, `vertice-mcp-integracao`
(`khaeknegymhygsdofkce`), criado em 12/08 exatamente para isto e nunca ligado ao CI. Não é preciso
provisionar nada novo.

**Fazer.**
1. Confirmar que `khaeknegymhygsdofkce` tem o schema em dia (`list_migrations` nos dois projetos,
   comparar). Se estiver atrasado, aplicar as migrations faltantes **nele** — nunca em produção.
2. Registrar `MCP_INTEGRATION_SUPABASE_URL` e `MCP_INTEGRATION_SERVICE_ROLE_KEY` como secrets do
   repositório, apontando para o projeto de integração.
3. Estender `mcp-integracao.yml` (ou criar `isolamento.yml`) para rodar
   `npm run test:isolamento` com essas variáveis mapeadas para `NEXT_PUBLIC_SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY`. Disparar em `pull_request` quando o diff tocar
   `supabase/migrations/**`, `lib/**`, `app/**` ou `__tests__/**`.
4. Documentar em `__tests__/isolamento/README.md` como rodar localmente.

**Aceite (este é o mais importante do plano).**
- No CI, `npm run test:isolamento` reporta **0 pulados** e todos passando.
- O validador cria um PR descartável com uma migration que adiciona tabela de negócio **sem**
  política restritiva. O CI tem que **falhar**. Se passar, o workflow não está pronto — é o único
  teste que prova que a rede pega o que deveria pegar.
- Descartar o PR de prova depois.

**Não fazer.** Apontar o CI para produção. Nunca.

---

## WF-A1 · Cabeçalhos de segurança

**Depende de:** WF-02 · **Arquivos:** `next.config.ts` (e talvez `proxy.ts`) · **Risco:** médio — CSP mal feito quebra tela

**Objetivo.** Fechar S1 sem alterar um pixel.

**Fazer.**
1. Em `next.config.ts`, `async headers()` aplicando a todas as rotas:
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-Frame-Options: DENY`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
2. CSP em **duas etapas**, e a ordem não é negociável:
   - **Etapa 1:** publicar como `Content-Security-Policy-Report-Only`. Navegar por todas as telas
     (Kanban com arrastar, editor de texto rico, gráficos, PWA, upload de anexo, exportação) e
     coletar as violações no console.
   - **Etapa 2:** só depois de zero violação, trocar o cabeçalho para o modo de aplicação.
3. Pontos que vão exigir atenção na diretiva: `img-src` precisa do domínio do Storage do Supabase e
   de `data:`; `connect-src` precisa do domínio do Supabase; `font-src` do Google Fonts (usado via
   `next/font`, que serve do próprio domínio — confirmar no build); `frame-ancestors 'none'`
   duplicando o `X-Frame-Options` para navegador moderno. Next injeta estilo inline — `style-src`
   vai precisar de `'unsafe-inline'` ou de nonce. **Preferir nonce**; se custar mudança de render,
   documentar e ficar com `'unsafe-inline'` só em `style-src`, nunca em `script-src`.

**Aceite.**
- `curl -I` na produção (ou no preview) mostra todos os cabeçalhos.
- Nenhuma violação de CSP no console em: login, `/minha-semana`, `/apontamento`, `/kanban/[id]` com
  arrastar-e-soltar, abrir cartão, editor de texto rico, `/dashboard`, `/gestao`, `/relatorios` com
  geração de PDF, upload de anexo, `/q/[token]`, `/formularios/[slug]`, instalação do PWA.
- Um `<iframe src="…/minha-semana">` em página externa **não** renderiza.
- Contrato de não-regressão cumprido.

**Rollback.** Remover `headers()`. Efeito imediato, sem migration envolvida.

---

## WF-A2 · Superfície pública endurecida

**Depende de:** WF-A1 · **Arquivos:** `app/(app)/kanban/actions.ts`, `app/(app)/kanban/actions-anexos.ts`, `app/formularios/[slug]/form-client.tsx`, `app/(marketing)/cadastro/*`

**Objetivo.** Fechar S3, S4 e S7. **Sem mudar nada visível** — o honeypot é invisível por definição e
as recusas usam os componentes de erro que já existem.

**Fazer.**

*Formulário público (S3):*
1. Honeypot + carimbo de tempo no `form-client.tsx`, exatamente no molde de `/cadastro` (reaproveitar,
   não reescrever).
2. Janela global de submissões, no mesmo espírito do limite de cadastros: um teto por formulário e
   por janela curta. Sem infraestrutura nova — contar em tabela existente ou criar uma pequena de
   controle, o que for menos invasivo.
3. Limite de tamanho por resposta (sugestão: 5.000 caracteres por campo) e no total do corpo.
   Recusa com a mensagem de erro que o componente já sabe exibir.

*Anexos (S4):*
4. Allowlist de MIME. Começar pelo que o produto realmente usa — imagem, PDF, documento de escritório,
   texto simples, arquivo compactado — e recusar o resto com mensagem clara. **Levantar antes** o que
   já está no bucket, para não quebrar anexo existente.
5. Sanitizar `file.name`: manter só `[a-zA-Z0-9._-]`, cortar em ~100 caracteres, preservar a extensão.
   O nome original continua em `cartoes_anexos.nome_arquivo` — é ele que a tela mostra, então **a
   exibição não muda**. Só a chave no Storage muda.
6. Nunca confiar em `file.type` do navegador como `contentType`: derivar da extensão validada.

*Cadastro (S7):*
7. Assinar o `carimbo` com HMAC do servidor e verificar a assinatura antes de comparar o tempo.

**Aceite.**
- Teste novo em `lib/` (não integração) para: honeypot preenchido recusa; carimbo adulterado recusa;
  MIME fora da lista recusa; nome de arquivo sanitizado.
- Submissão legítima pelo navegador continua criando o cartão, com o mesmo texto de sucesso.
- Upload de PNG, PDF e DOCX funciona; upload de `.html` é recusado.
- Anexos já existentes continuam abrindo (a mudança é só na escrita).
- Contrato de não-regressão cumprido.

---

## WF-A3 · Endurecimento do Supabase e dos grants

**Depende de:** WF-A2 · **Muda:** painel do Supabase + uma migration · **Risco:** baixo

**Objetivo.** Fechar S5 e S6.

**Fazer.**
1. **No painel** (Authentication → Policies): ligar *Leaked password protection*. É o único
   mecanismo que cobre `/auth/redefinir-senha`, que roda pelo navegador.
2. **No painel:** subir o comprimento mínimo de senha de 6 para 8. Alinhar `cadastroSchema` e os
   demais schemas de senha ao mesmo número — a mensagem de erro pode mudar de texto (é conteúdo de
   validação, não aparência), mas nenhum layout muda.
3. **Migration:** `revoke execute` de `anon` em `auth_role()` e `is_quadro_membro(uuid)`; `revoke`
   de `anon` na view `demandas_acumulado`.
4. Rodar `get_advisors` de segurança antes e depois, guardando as duas saídas.

**Aceite.**
- Advisor não lista mais `auth_leaked_password_protection`, nem as duas funções como executáveis
  por `anon`.
- Login funciona. Recuperação de senha funciona e **recusa** uma senha conhecidamente vazada
  (testar com `Password123`).
- Cadastro com senha de 7 caracteres é recusado; com 8, aceito.
- `npm run test:isolamento` continua com 0 pulados e 0 falhas (WF-02 já garantiu que isso é
  verificável).

**Atenção.** Passo 3 é migration: seguir `vertice-migrations` — ensaio em branch antes da produção,
regenerar `lib/database.types.ts`, `get_advisors` depois.

---

## WF-A4 · Observabilidade

**Depende de:** WF-A3 · **Arquivos:** novos + `app/global-error.tsx` · **Risco:** baixo

**Objetivo.** Fechar S8 e A6. Saber que algo quebrou sem depender de alguém reclamar.

**Fazer.**
1. Escolher e instalar um coletor de erro (Sentry é o caminho de menor atrito com Next 16). Ligar
   servidor, cliente e edge.
2. **Filtrar o que sai da máquina.** Este ponto é obrigatório e o agente não pode pular: nenhum
   `organizacao_id`, e-mail, nome de colaborador ou conteúdo de cartão pode ir para o coletor. Só
   mensagem, pilha e identificador opaco. É o mesmo cuidado que fez `getEmailsPorId` ser reescrita.
3. `app/global-error.tsx` no padrão visual do `error.tsx` que já existe — reaproveitar os
   componentes, não inventar tela.
4. Instrumentar os 7 crons: reportar falha por organização com o identificador da organização
   **hasheado**, não em claro.

**Aceite.** Um erro provocado de propósito aparece no painel do coletor em menos de um minuto, e o
evento não contém nenhum dado pessoal. `global-error.tsx` renderiza na marca. Contrato cumprido.

---

## WF-B1 · Índices

**Depende de:** WF-02 · **Muda:** uma migration · **Risco:** baixo

**Objetivo.** D1.

**Fazer.**
1. Listar as 43 FKs sem cobertura a partir do advisor de performance (a saída já está em
   `BASELINE.md`).
2. Criar índice **onde a consulta usa**, não em todas. Critério: (a) FK com `ON DELETE CASCADE`, ou
   (b) tabela de alta cardinalidade projetada (`cartoes`, `apontamentos`, `comentarios_cartao`,
   `auditoria`, `notificacoes`, `cartoes_sessoes_tempo`, `automacoes_execucoes`). Registrar na
   migration, em comentário, por que cada índice entrou.
3. Acrescentar os quatro compostos de tela listados em D1.
4. Tudo com `CREATE INDEX CONCURRENTLY`.

**Não fazer.** **Remover índice.** O advisor lista 28 como "não usados" e isso é artefato de um banco
vazio. Qualquer remoção fica fora deste plano.

**Aceite.** Migration aplicada em branch e depois em produção; `get_advisors` de performance com
menos entradas `unindexed_foreign_keys`; `npm run test:isolamento` verde; nenhuma consulta da
aplicação alterada.

---

## WF-B2 · Retenção

**Depende de:** WF-B1 · **Muda:** migration + um cron · **Risco:** médio — apaga dado

**Objetivo.** D2.

**Antes de qualquer código, perguntar ao dono do produto:** por quanto tempo `auditoria` precisa
ser mantida? É decisão de negócio. O padrão deste plano é **24 meses e arquivar, nunca apagar**.
Se não houver resposta, implementar só as outras quatro tabelas e deixar `auditoria` de fora.

**Fazer.**
1. Função `limpar_dados_antigos()` — `SECURITY DEFINER`, `search_path` fixado, `revoke` de
   `anon`/`authenticated`, `grant` só para `service_role`. Mesmo molde das existentes.
2. Rota `app/api/cron/retencao/route.ts`, autenticada por `cronAuthorized()` como as outras 7,
   reservando execução com `tentarReservarExecucaoGlobal()`.
3. Entrada em `vercel.json`, fora do horário das outras.
4. Prazos: `cron_execucoes` 90 dias · `automacoes_execucoes` 90 dias · `notificacoes` lidas 90 dias ·
   `desafios_mfa` verificados/expirados 7 dias · `auditoria` conforme resposta acima.
5. Apagar em lote com `limit`, não em uma transação só — uma exclusão de milhões de linhas trava a
   tabela.

**Aceite.** Rota rejeita chamada sem `CRON_SECRET`. Executada duas vezes seguidas, a segunda é
no-op (idempotência). Contagens antes/depois batem com o esperado. `npm run test:isolamento` verde.

---

## WF-B3 · E-mails em uma consulta

**Depende de:** WF-B2 · **Arquivos:** migration + `lib/cron.ts` · **Risco:** médio — mexe em caminho que já vazou uma vez

**Objetivo.** D3 e A4.

**Ler antes de escrever:** o comentário sobre `getEmailsPorId` em `lib/cron.ts`. Ele descreve
exatamente o vazamento que a implementação atual corrigiu. A nova versão tem que preservar a
propriedade: **e-mail de uma organização nunca visível a outra.**

**Fazer.**
1. Migration com `emails_por_colaborador(p_organizacao_id uuid, p_ids uuid[])` conforme D3. O filtro
   por organização fica **dentro** da função, não no chamador. `revoke` de `authenticated` é
   obrigatório.
2. Reescrever `getEmailsPorId` para uma chamada só, **mantendo a assinatura atual** — nenhum cron
   pode precisar de mudança.
3. Teste que prove: passar um id de outra organização em `p_ids` devolve zero linhas para ele.

**Aceite.** Assinatura de `getEmailsPorId` inalterada. Teste de vazamento cruzado passando. Os três
crons de e-mail continuam entregando (verificar em ambiente de teste). `test:isolamento` verde.
Advisor sem alerta novo.

---

## WF-B4 · Agregação no banco

**Depende de:** WF-B3 · **Arquivos:** migration + `app/(app)/gestao/page.tsx` + dashboard · **Risco:** médio-alto — a tela mostra número

**Objetivo.** D4 e A3, sem alterar **nenhum** número exibido.

**Fazer.**
1. Antes de tocar em qualquer coisa: gravar a saída atual dos painéis (heatmap, top-demandas,
   contadores) com os dados de produção, em arquivo. É esse arquivo que o validador vai comparar.
2. Uma RPC por painel, `SECURITY INVOKER` — a RLS precisa continuar valendo. Devolver já agregado.
3. Trocar a leitura na página, mantendo **exatamente** a mesma forma de dado que o componente já
   recebe. O componente de gráfico não pode ser tocado.

**Aceite.** O validador compara os números renderizados com o arquivo do passo 1 — **têm que ser
idênticos, incluindo arredondamento e ordenação de empates**. Nenhuma mudança em
`components/charts/**`. `test:isolamento` verde.

**Se algum número divergir:** parar e reportar. Divergência aqui significa que a lógica em JS e a
lógica em SQL discordam, e descobrir qual está certa é conversa, não decisão do agente.

---

## WF-C1 · Uma ida ao Auth em vez de duas

**Depende de:** WF-02 · **Arquivos:** `utils/supabase/middleware.ts` · **Risco:** alto — é o gate de sessão de todo o app

**Objetivo.** C1. É a mudança de maior ganho por linha do plano inteiro, e a mais perigosa.

**Contexto que torna isso possível:** o projeto usa JWT Signing Keys assimétricas (ECC P-256),
registrado em `lib/mcp-auth.ts`. Com chave assimétrica, `getClaims()` verifica a assinatura
localmente, sem rede. **Confirmar isso no painel antes de escrever qualquer código** — se o projeto
estiver em segredo simétrico, esta ficha não se aplica e o agente deve parar e reportar.

**Fazer.**
1. Confirmar o tipo de chave no painel do Supabase.
2. Em `updateSession()`, trocar `auth.getUser()` por `auth.getClaims()`, mantendo **exatamente** a
   mesma árvore de decisão: rotas públicas, MFA pendente, redirect para `/login`.
3. Não tocar em `lib/auth.ts`. `getProfile()` continua com `getUser()` — é ele que precisa da
   verificação forte, e agora ela acontece uma vez só.
4. Atualizar o comentário do arquivo explicando por que a verificação local é suficiente **aqui** e
   não em `getProfile()`.

**Aceite — o mais rigoroso do plano.** Percorrer manualmente, e o validador repete:
- login com senha; login com Google; login com MFA ativo (o redirect para `/login/verificar` tem que
  continuar acontecendo, e o app tem que continuar fechado até verificar);
- sessão expirada → redirect para `/login`;
- colaborador desativado → derrubado;
- organização suspensa → `/conta/suspensa`; expirada → `/conta/expirada`;
- rotas públicas deslogado: `/`, `/precos`, `/cadastro`, `/convite/[token]`, `/formularios/[slug]`,
  `/q/[token]`, `/offline`, `/manifest.webmanifest`, `/sw.js`;
- `/api/cron/*` e `/api/mcp` continuam fora do gate;
- registro do service worker e instalação do PWA continuam funcionando.

Medir TTFB de `/minha-semana` antes e depois e registrar no PR. Se não melhorar, a mudança não valeu
o risco e deve ser revertida.

**Rollback.** Reverter o arquivo. Um só.

---

## WF-C2 · Cache dos dados de referência

**Depende de:** WF-C1 · **Risco:** médio — cache errado mostra dado velho

**Objetivo.** C2, sem que ninguém veja informação desatualizada.

**Fazer.**
1. Identificar as leituras de dados de referência que se repetem entre telas: `areas`, `demandas`
   ativas, lista de colaboradores, `planos`.
2. Envolver em `unstable_cache` **com chave incluindo `organizacao_id`**. Este ponto é
   inegociável: chave sem organização é vazamento de cache entre clientes, que é pior que qualquer
   problema que este plano resolve.
3. `revalidateTag` nas actions que escrevem nessas tabelas — `catalogo/actions.ts`,
   `areas/actions.ts`, `colaboradores/actions.ts`. Toda escrita precisa de invalidação; uma faltando
   é dado velho na tela.
4. TTL curto (60 s) como rede de segurança para uma invalidação esquecida.

**Aceite.** Criar uma área e vê-la aparecer imediatamente no seletor de outra tela. Desativar um
colaborador e ver a lista atualizar na hora. Duas organizações abertas em navegadores diferentes
**nunca** enxergam dado uma da outra — o validador testa isso explicitamente. `test:isolamento`
verde.

---

## WF-C3 · Bundle e CSS

**Depende de:** WF-C2 · **Risco:** baixo

**Objetivo.** C3, C4 e C6.

**Fazer.**
1. `optimizePackageImports` para `lucide-react`, `recharts`, `date-fns` em `next.config.ts`.
2. Investigar os 150 KB de CSS: confirmar se é o Tailwind gerando além do usado ou se é
   `globals.css` (488 linhas de tokens) sendo carregado inteiro em toda rota.
3. Tornar `/cadastro` estática movendo a geração do `carimbo` para o cliente (isso combina com o HMAC
   do WF-A2 — coordenar).
4. Trocar o `<img>` de `app/offline/page.tsx` por `next/image`.
5. **Não** converter componente cliente em servidor nesta ficha. É refatoração de arquitetura e
   pertence à trilha E.

**Aceite.** Comparar com `BASELINE.md`: chunks menores ou iguais, `/cadastro` marcada `○` no build
(esta é a **única** mudança de marcador permitida em todo o plano, e ela é intencional — registrar no
PR). Nenhuma diferença visual.

---

## WF-D1 · SEO técnico

**Depende de:** WF-02 · **Arquivos:** `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx`, páginas de marketing · **Risco:** baixo

**Objetivo.** Fechar a base: robots, sitemap, canonical, OpenGraph.

**Fazer.**
1. `app/robots.ts`: permitir `/`, `/precos`, `/cadastro`; bloquear `/api/`, `/q/`, `/formularios/`,
   `/console`, `/convite/` e as rotas do app. Apontar o sitemap.
2. `app/sitemap.ts` com as três públicas.
3. Em `app/layout.tsx`: `openGraph` e `twitter` com `card: 'summary_large_image'`; `alternates.canonical`.
4. Criar a imagem de compartilhamento via `app/opengraph-image.tsx` (`ImageResponse`), usando a marca
   de `design.md` — **sem inventar identidade visual nova**. Consultar a skill `vertice-design`.
5. `description` em `/precos`, tipando os `metadata` como `Metadata`.
6. `robots: { index: false }` nos layouts de `(app)` e `(operador)`.
7. `metadataBase`: falhar alto se `NEXT_PUBLIC_APP_URL` faltar em produção, em vez de cair
   silenciosamente para `localhost`.

**Aceite.** `/robots.txt` e `/sitemap.xml` respondem 200 com conteúdo correto. Validador de
OpenGraph mostra a imagem. `curl` na home traz as tags. Nenhuma mudança no que a página renderiza
para o visitante — metadado não é conteúdo visível.

---

## WF-D2 · Dados estruturados

**Depende de:** WF-D1 · **Risco:** baixo

**Objetivo.** JSON-LD, para as páginas descreverem o que são.

**Fazer.**
1. `Organization` no layout de marketing (nome, logo, URL).
2. `SoftwareApplication` na home — categoria, sistema operacional, faixa de preço.
3. `Product` + `Offer` em `/precos`, alimentado pela **mesma constante `PLANOS`** que a tabela já usa.
   Duas fontes de preço divergindo é pior que não ter dado estruturado.
4. Injetar via `<script type="application/ld+json">` com o JSON serializado. Verificar que o CSP do
   WF-A1 permite — se não permitir, ajustar o CSP, nunca afrouxar `script-src` de forma geral.

**Aceite.** Rich Results Test do Google valida sem erro. Preços do JSON-LD idênticos aos da tela.
Nenhuma mudança visual. CSP continua aplicado.

---

## WF-E1 · Fatiar `kanban/actions.ts`

**Depende de:** todas as trilhas A–D concluídas · **Risco:** médio — muitos imports

**Objetivo.** A1, sem mudar comportamento.

**Fazer.**
1. Separar as 24 actions por assunto, seguindo a convenção que os 13 irmãos já estabeleceram:
   `actions-quadros.ts`, `actions-colunas.ts`, `actions-cartoes.ts`, `actions-formularios.ts`,
   `actions-publico.ts` (a submissão pública — que merece arquivo próprio por ser a única sem sessão).
2. Manter `actions.ts` reexportando tudo, ou atualizar todos os imports. **Preferir atualizar os
   imports** — o barril esconde o acoplamento que o fatiamento tenta expor.
3. Mover código; não reescrever. O diff tem que ser majoritariamente movimentação.
4. Idem para `console/actions.ts` se sobrar fôlego; se não, deixar registrado.

**Aceite.** `git diff --stat` mostra somas e subtrações equilibradas (movimentação, não reescrita).
Nenhuma assinatura de action alterada. `npm test`, `lint`, `build` verdes. Kanban navegado à mão:
criar quadro, criar coluna, criar cartão, mover, entregar, formulário público.

---

## WF-E2 · Fronteira única de server action

**Depende de:** WF-E1 · **Risco:** alto se aplicado de uma vez — por isso não é

**Objetivo.** A2, de forma incremental e reversível.

**Fazer.**
1. Criar `lib/acao-servidor.ts`: um wrapper que compõe guard (`requireUser`/`requireGestor`/
   `requireAdmin`), schema Zod, execução, auditoria e `ActionResult`, com o tratamento de erro que
   hoje é repetido.
2. **Migrar 3 actions**, não 148. Escolher três de arquivos diferentes e comportamentos diferentes.
3. Parar. Entregar. O próximo agente avalia se o wrapper aguentou o contato com a realidade antes de
   qualquer migração em massa.

**Aceite.** As 3 migradas se comportam de forma idêntica — mesmo retorno em sucesso, mesma mensagem
em falha, mesmo registro de auditoria. As outras 145 intocadas. Testes verdes.

**Por que só três.** Um wrapper desenhado contra 3 casos e aplicado a 148 vira 148 exceções ao
wrapper. Três primeiro é o que descobre se a abstração está certa enquanto desfazer ainda é barato.

---

## WF-E3 · Higiene do repositório

**Depende de:** WF-E2 · **Risco:** baixo

**Objetivo.** A7.

**Fazer.**
1. Remover `Kamban/` (já ignorado no ESLint e no `tsconfig`; confirmar que nada em `app/` importa
   dali antes de apagar).
2. Remover `Qualidade EAD.csv` da raiz.
3. Decidir sobre `supabase/APLICAR_PENDENTES.sql` (116 KB) e `RESETAR_APONTAMENTOS_TESTE.sql`: as 83
   migrations são o estado canônico. Se forem histórico, mover para `docs/historico/`; se forem
   mortos, remover. **Perguntar antes de apagar** — um deles pode ser procedimento operacional.
4. Remover os SVGs de boilerplate do Next em `public/` (`next.svg`, `vercel.svg`, `file.svg`,
   `globe.svg`, `window.svg`), confirmando por `grep` que nenhum é referenciado.
5. Atualizar o índice de `docs/` marcando este plano e o estado de cada workflow.

**Aceite.** `grep` prova que nada removido era referenciado. Build verde. Repositório menor.

---

# Parte 3 — Referência rápida

| # | Workflow | Depende | Risco | O que fecha |
|---|---|---|---|---|
| WF-00 | Baseline | — | nulo | base de comparação |
| WF-01 | CI | 00 | baixo | S2 (parcial) |
| WF-02 | Isolamento executável | 01 | baixo | **S2** |
| WF-A1 | Cabeçalhos HTTP | 02 | médio | **S1** |
| WF-A2 | Superfície pública | A1 | médio | **S3, S4, S7** |
| WF-A3 | Supabase + grants | A2 | baixo | **S5, S6** |
| WF-A4 | Observabilidade | A3 | baixo | **S8, A6** |
| WF-B1 | Índices | 02 | baixo | D1, C5 |
| WF-B2 | Retenção | B1 | médio | D2 |
| WF-B3 | E-mails | B2 | médio | D3, A4 |
| WF-B4 | Agregação no banco | B3 | médio-alto | D4, A3 |
| WF-C1 | Uma ida ao Auth | 02 | **alto** | C1 |
| WF-C2 | Cache | C1 | médio | C2 |
| WF-C3 | Bundle e CSS | C2 | baixo | C3, C4, C6 |
| WF-D1 | SEO técnico | 02 | baixo | E1–E7 |
| WF-D2 | Dados estruturados | D1 | baixo | E4 |
| WF-E1 | Fatiar actions | A–D | médio | A1 |
| WF-E2 | Fronteira de action | E1 | alto se em massa | A2 |
| WF-E3 | Higiene | E2 | baixo | A7 |

## Se for para fazer só três

WF-02, WF-A1 e WF-C1 — nessa ordem.

O primeiro devolve ao projeto a rede que ele acha que já tem. O segundo fecha o único buraco de
segurança com exploração direta e trivial. O terceiro é o maior ganho de velocidade por linha
alterada.

---

## O que este documento não cobre

Dito de frente, para ninguém supor que foi coberto:

- **Não houve teste de invasão.** Nada foi explorado; a análise é de leitura de código, do schema e
  dos advisors.
- **Não foi auditada a cadeia de dependências.** `npm audit` não foi executado, e nenhuma CVE de
  pacote foi investigada.
- **Não foi revisado o conteúdo dos 7 crons** em profundidade — só o mecanismo de autenticação, de
  idempotência e de escopo por organização.
- **Não foi revisada a lógica de negócio** de automações, dependências, aprovações ou cálculo do
  índice. O foco foi segurança, estrutura e desempenho.
- **Não foi medido desempenho real** com dados de produção em volume. As tabelas estão praticamente
  vazias; toda projeção é analítica.
- **Não foi avaliado o plano de migração para o Coolify** (`docs/PLANO-MIGRACAO-COOLIFY.md`), que
  segue em aberto e é trabalho independente deste.
