# Leva de evolução — agosto/2026

> **Estado: executado.** Este documento registra o que foi entregue na leva de 12/08/2026 e, mais importante, *por quê* cada decisão foi tomada. Leia como registro de decisão, não como trabalho pendente. A migração para o Coolify continua sendo o que está aberto no projeto — ver [`CHECKLIST-MIGRACAO.md`](./CHECKLIST-MIGRACAO.md).

## O que esta leva não era

Não havia eixo de organização a construir. `PLANO-PRODUTO.md` registra as Fases 1–7 executadas — `organizacoes`, `organizacao_id` em toda tabela de negócio, políticas RLS restritivas com `org_atual()`, FKs compostas, 18 funções `security definer` corrigidas, assentos, ciclo de vida, console do operador, cadastro público.

Tudo aqui é aditivo sobre essa fundação, e cada migration segue as convenções de `.claude/skills/vertice-isolamento` e `.claude/skills/vertice-migrations`.

## As sete entregas

### 1. Dono da empresa

`organizacoes.dono_colaborador_id`, com FK composta contra `colaboradores(id, organizacao_id)`. Duas RPCs `security definer` — `atualizar_nome_organizacao` e `transferir_propriedade_organizacao` — e o trigger `colaboradores_proteger_dono`. Aba Empresa em `/gestao/sistema`.

**Por que coluna em `organizacoes` e não `colaboradores.dono`:** garante "exatamente um dono" por construção. Um booleano em `colaboradores` dependeria de índice parcial único mais lógica de aplicação — a mesma classe de invariante que este projeto já prefere resolver no schema.

**Por que não `role = 'dono'`:** pelo mesmo motivo que `admin` virou coluna em `20260731100000`. Existem ~33 policies escritas como `auth_role() = 'gestor'`; trocar o role do dono o faria nascer com *menos* acesso que um gestor comum.

**Por que a coluna é nulável:** `criar_organizacao` insere `organizacoes` antes de `colaboradores`, então na primeira instrução o dono ainda não existe. A garantia fica por fora do `NOT NULL`: a coluna só é escrita pelas RPCs e por `criar_organizacao`, a tabela não tem policy de UPDATE para `authenticated`, e o diagnóstico de `/gestao/sistema` monitora zero nulos.

**Por que o dono anterior não é rebaixado na transferência:** evita o cenário "a organização ficou sem nenhum admin" — mesmo cuidado do `ULTIMO_ADMIN` em `definir_admin` — e mantém a troca reversível durante a conversa em que ela aconteceu.

**Bootstrap da Teralabs:** o dono é o colaborador "Luiz | Admin", por decisão de produto, não por heurística de data. O e-mail é procurado numa lista de candidatos (`canhete@teralabs.cloud`, `luizfernando.junior@unicive.edu.br`) porque a conta mudou de domínio uma vez desde o seed do bloco 33 — falha alto se nenhum existir, em vez de deixar a organização sem dono em silêncio. As demais organizações usam "gestor+admin ativo mais antigo por `auth.users.created_at`", que ali não é heurística frouxa: quem passou por `/cadastro` é literalmente o primeiro colaborador da empresa, criado por `criar_organizacao` na mesma transação.

### 2. Troca do próprio e-mail

Sem migration. O e-mail é `auth.users.email`, e o estado "pedido feito, não confirmado" já é `new_email` no Supabase Auth — replicar isso numa coluna nossa criaria uma segunda fonte de verdade que dessincroniza no primeiro link expirado.

`/auth/confirmar` é rota separada de `/auth/callback` de propósito: o callback é o retorno do OAuth, assume `code` PKCE e responde erros que citam o Google literalmente. A rota nova aceita `token_hash` **e** `code`, porque o formato do link depende do template configurado no painel do Supabase — que este código não controla.

**Pendente de conferência em staging:** qual formato de link o projeto de fato envia, e se "Secure email change" (confirmação nos dois endereços) está ativo. A tela já distingue os dois casos; o que falta é confirmar qual acontece.

### 3. Ícones do login

O bug relatado era do login. A causa não era.

Diagnóstico em navegador real, antes de qualquer edit: a 1280px o campo de senha media 32px de altura (não os 52 declarados) e 10px de padding à esquerda (não os 40), com o texto digitado caindo em cima do ícone. A 360px tudo aparecia certo.

A classe base do `Input` trazia `md:px-2.5`. `tailwind-merge` trata `md:px-2.5` e `px-10` como grupos diferentes — o modificador entra na chave de conflito, e com razão — então as duas sobreviviam ao `cn()`, e a partir de 768px a variante vencia por ordem na folha de estilo.

**Não era um bug do login: 13 telas** passavam `pl-*` para abrir espaço de ícone e perdiam esse espaço no desktop (busca de colaboradores, auditoria, catálogo, áreas, documentação, changelog, cadastro, convite). Por isso a correção foi no componente. `components/ui/input.test.ts` trava a regra.

O `z-10` solto no cadeado do login era resíduo de uma tentativa antiga de consertar isso pelo lado errado.

### 4. Minha semana como hub

O lançamento diário virou o topo de `/minha-semana`. A lógica não mudou de lugar — `actions.ts` e `ApontamentoForm` seguem onde estavam, só a moldura virou componente.

`/apontamento` continua respondendo, como redirect que preserva a query. Não é cortesia: e-mails de lembrete já enviados, favoritos e o atalho do PWA já instalado apontam para lá, e um 404 quebraria o link do cron para todo mundo de uma vez. O `manifest` mantém `id: '/apontamento'` pelo mesmo motivo — mudar o `id` faz o navegador tratar isto como outro app e órfã quem já instalou.

Histórico e o lote em rota própria continuam existindo. Editar e excluir lançamento é outra tarefa, e empilhá-la no hub o transformaria numa tela de tudo.

**Correções ganharam a primeira tela.** As quatro actions (`pedirCorrecao`/`aprovarCorrecao`/`rejeitarCorrecao`/`listarCorrecoes`) e as RPCs existiam desde 02/08/2026 e nunca tiveram consumidor: a capacidade estava completa e inalcançável. Nenhuma regra mudou — a policy de insert em `apontamentos` segue exigindo `data = CURRENT_DATE`, e o pedido só vira lançamento quando um gestor aprova.

### 5. Exportar demandas em CSV

Rota própria (`/api/export/demandas`), não mais um formato no export de apontamentos: aquele arquivo já resolve quatro formatos com filtro de período e área, e o shape de colunas do catálogo não tem nada em comum.

Só as colunas textuais passam por `sanitizeFormula`. Prefixar um número negativo com apóstrofo transformaria a coluna em texto e quebraria a soma na planilha.

### 6. Quadros arquivados

`/kanban` passa a listar só ativos; `/kanban/arquivados` é a contraparte, gestor-only. As duas passam pelo mesmo carregador em vez de repetirem a consulta: a exclusividade mútua é uma propriedade que **não falha alto** — um arquivado aparecendo na lista principal não gera erro, só devolve linhas a mais.

`requireGestor()` na rota, e não só o link escondido: sem isso, digitar a URL levaria um colaborador à lista de quadros arquivados da empresa.

### 7. Perfil e Configurações

Identidade e credencial ficam no Perfil (quem a pessoa é e como ela prova); preferência e integração vão para `/configuracoes`.

Senha e segundo fator seguem no Perfil de propósito — trocar senha é um ato sobre identidade, não uma preferência de uso. **Tokens MCP também ficaram no Perfil**, pela mesma razão e por uma segunda: o escopo desta leva isolava MCP com clareza, e a opção de risco zero era não mexer nem na localização.

Os retornos do OAuth do Google apontavam para `/perfil`, onde o cartão não mora mais — repontados. O teste estático de service role acusou a leitura de `google_workspace_conexoes` mudando de arquivo, que é exatamente o atrito que ele existe para criar.

## Incidente de 12/08/2026 — login derrubado pela migration

Registrado aqui porque a lição é maior que o bug.

Depois de a migration ser aplicada em produção, **ninguém conseguia entrar no sistema**. Os logs do Supabase Auth mostravam login com status 200 o tempo todo; da tela, parecia senha errada.

Causa: `organizacoes_dono_org` é a **segunda** foreign key entre `colaboradores` e `organizacoes` — a primeira, `colaboradores_organizacao_id_fkey`, corre na direção oposta. Com duas relações entre as mesmas tabelas, o PostgREST recusa o embed `organizacoes(...)` com `PGRST201` em vez de escolher uma. `getProfile()` passou a devolver erro, `profile` virou nulo e `requireUser()` mandava todo mundo de volta para `/login`.

Duas consultas afetadas, ambas partindo de `colaboradores`: `lib/auth.ts::getProfile()` (login de todo mundo) e `lib/mcp-auth.ts` (todo token MCP). `assinaturas_manuais` e `convites` embutem `organizacoes` sem problema — elas têm uma FK só.

Correção: nomear a FK no embed — `organizacoes!colaboradores_organizacao_id_fkey(...)`. A constraint fica; ela é o que torna impossível o dono de uma empresa ser colaborador de outra.

**O que teria pegado isso, e não pegou.** Não foi `npm test`, nem `npm run build`, nem `get_advisors` — ambiguidade de embed não é problema de RLS nem de índice, e o TypeScript não modela relações do PostgREST. O único gesto que pegaria era abrir o app e fazer login depois de aplicar a migration. Estava listado como pendente de conferência abaixo, e era o item que importava.

`lib/auth.embeds.test.ts` trava a regra daqui em diante, varrendo por consulta e não por arquivo.

**Regra geral que fica:** toda migration que adiciona uma FK entre duas tabelas que **já** se relacionam quebra, em silêncio, todo embed do PostgREST entre elas. Antes de adicionar uma FK, procure por embeds existentes do par.

## O que ficou pendente de conferência

Cada item diz **o que falta, o comando e a credencial que destrava**. Nenhum deles é
executável de dentro de uma sessão sem credenciais de Supabase.

### 1. ~~Regenerar `lib/database.types.ts`~~ — feito

Regenerado a partir do schema real em 12/08. O diff contra o arquivo editado à mão foi
de **quatro linhas, todas de reordenação**: os edits manuais estavam corretos.

Armadilha descoberta na regeneração e agora documentada no topo do arquivo: o gerador
**apaga o bloco de aliases de domínio** (`Role`, `StatusSolicitacao`, …). Eles não
existem no schema — são CHECK constraints — e precisam ser recolocados à mão depois de
cada `npm run tipos:gerar`, ou o build quebra em dezenas de arquivos.

### 2. ~~`get_advisors`~~ — feito, sem regressão

**Performance: 75 avisos, todos INFO, e nenhum `auth_rls_initplan`.** Era exatamente o
risco que esta leva corria (o eixo já causou 17 desses de uma vez em agosto) — o trigger
novo e a FK nova não reintroduziram nada. Os 75 são 43 FKs sem índice de cobertura e 32
índices sem uso, todos pré-existentes. `organizacoes_dono_org` não aparece: a tabela tem
punhado de linhas e um índice ali não se paga.

**Segurança: nada novo desta leva.** As duas RPCs adicionadas aparecem como
`authenticated_security_definer_function_executable`, que é o desenho — é assim que RPC
chamada pelo app funciona, e a autorização delas está no corpo.

Dois WARN de `anon` (`auth_role`, `is_quadro_membro`) **não devem ser corrigidos**, e a
razão está escrita em `20260802150000` e `20260809220000`: a policy
`formularios_select_publico` é `(ativo = true) OR is_quadro_membro(...)` e o Postgres não
garante curto-circuito no `OR` — revogar quebraria o formulário público; e `auth_role()`
é maquinário das próprias policies, que são todas `to public`. Sem `EXECUTE`, leitura
anônima trocaria "zero linhas" por "permission denied". Nenhuma das duas vaza: para
`anon`, `auth.uid()` é nulo.

Os cinco INFO de `rls_enabled_no_policy` (`assinaturas_manuais`, `config_push`,
`cron_execucoes`, `operadores`, `operadores_acoes`) também são desenho: são tabelas de
service role, sem policy porque nenhum papel do app as alcança.

### 3. Rodar `dono-organizacao.integration.test.ts`

Nunca rodou: pula sem credenciais. É o único teste que exercita as duas RPCs
`SECURITY DEFINER` contra RLS real, com sessões de usuário de verdade.

```bash
export NEXT_PUBLIC_SUPABASE_URL=<url do projeto vertice-mcp-integracao>
export SUPABASE_SERVICE_ROLE_KEY=<service role do MESMO projeto>
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon do MESMO projeto>
npm run test:isolamento
```

**Nunca aponte para produção**: o arquivo cria e apaga organizações, usuários Auth e
colaboradores. Ver `__tests__/isolamento/README.md`.

### 4. Troca de e-mail ponta a ponta

Falta abrir o fluxo uma vez num ambiente real e observar **qual formato de link** o
Supabase envia (`token_hash` ou `code` — `/auth/confirmar` trata os dois, justamente
porque isso depende de configuração de painel), e se **"Secure email change"** está
ativo em Authentication → Emails. Isso muda o texto que `/perfil` mostra depois do
primeiro clique, não o comportamento da rota.

Recomendação de segurança: manter "Secure email change" **ligado**. Desligado, uma
sessão roubada troca o e-mail da conta sem nenhuma confirmação no endereço antigo.

### 5. As telas autenticadas renderizadas

Só `/login` foi aberta em navegador (foi lá que o bug dos ícones se revelou e foi
conferido). Aba Empresa, `/configuracoes`, Minha semana com o painel embutido e
`/kanban/arquivados` passaram por build, tipos e teste — não por olho humano.

### 6. Selo de versão em `/documentacao`

"v2.4 Estável" continua estático e desconectado do changelog. A contagem de módulos ao
lado já deriva de `DOCUMENTACAO.length`; o selo não. Incrementá-lo é decisão de produto
— esta leva entregou sete funcionalidades visíveis.
