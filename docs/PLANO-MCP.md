# Servidor MCP para o Vértice

Não é mais um plano aberto: é o registro das decisões de desenho do servidor MCP e do estado
em que ele ficou. As pendências que sobraram estão em [O que falta](#o-que-falta), cada uma
com o critério para dar por fechada. O caminho até aqui está em
[`PLANO-MCP-FINALIZACAO.md`](./PLANO-MCP-FINALIZACAO.md).

Atualizado em 12/08/2026.

## Contexto

O Vértice hoje só é operável por humanos, via sessão de navegador (cookie do Supabase Auth) — apontamentos, kanban, dashboard, tudo passa por `app/(app)/**/actions.ts` protegidas por `requireUser/requireGestor/requireAdmin` (`lib/auth.ts`) e por RLS no Postgres, sempre ancorada em `auth.uid()`. Não existe hoje nenhum caminho para um agente de IA (Claude Desktop, Claude Code, outro cliente MCP) consultar ou agir no sistema em nome de um colaborador. O objetivo deste plano é adicionar um servidor MCP funcional que exponha um subconjunto do Vértice a esses agentes, autenticado por um token de API novo, sem duplicar as regras de negócio e isolamento que já vivem nas RPCs `SECURITY DEFINER` e na RLS.

## Decisão de auth abandonada: impersonação via JWT

A primeira rodada desta implementação assinava um JWT HS256 de curta duração (`sub = colaborador_id`) com o "legacy JWT secret" do projeto Supabase, para que o Postgres/PostgREST tratasse a chamada MCP como uma sessão `authenticated` comum — RLS e as RPCs continuariam sendo a única fonte de verdade, sem checagem de organização duplicada em `lib/`.

Essa premissa caiu: **o projeto assina sessões com JWT Signing Keys assimétricas (ECC P-256)**, confirmado por quem tem acesso ao painel do Supabase. O legacy secret ainda existe, mas só para *verificar* tokens antigos — usá-lo para *assinar* um JWT novo reintroduziria na infraestrutura um segredo simétrico capaz de forjar sessão de qualquer usuário, exatamente o risco que o desenho tentava evitar. `lib/mcp-jwt.ts` e `utils/supabase/mcp.ts` foram removidos; `SUPABASE_JWT_SECRET` não deve ser configurado em lugar nenhum — não é uma pendência, é uma decisão cancelada.

## Decisão de auth atual: service role confinado, nunca exposto às tools

Sem JWT de impersonação, a única forma de uma chamada MCP (sem cookie de sessão) ler dado protegido por RLS é via `createAdminClient()` (service role, bypassa RLS) — o mesmo padrão de `app/q/[token]/page.tsx` e `lib/operador-auth.ts`. A regra que evita isso virar um acesso genérico perigoso:

- `createAdminClient()` só é chamado em **dois arquivos**: `lib/mcp-auth.ts` (resolve o token) e `lib/mcp/queries.ts` (lê dado já filtrado). Nenhuma tool, nenhum resource, nenhum route handler importa `createAdminClient` diretamente — allowlist reforçada em `__tests__/isolamento/admin-client-estatico.test.ts`.
- `McpSessao` (o que `resolverMcpToken` devolve) carrega só identidade — `{ tokenId, colaboradorId, organizacaoId, escopos }` — nunca um client Supabase. Uma tool não tem como fazer um `.from()` livre; só chama as funções de `lib/mcp/queries.ts`, que recebem `colaboradorId`/`organizacaoId` e devolvem dado já escopado.
- Toda consulta em `lib/mcp/queries.ts` filtra **explicitamente** por `organizacao_id` (e por `colaborador_id`/`area_id` quando o dado é pessoal) — nunca confia em RLS, porque não há `auth.uid()` nenhum aqui. É o padrão que a skill `vertice-isolamento` já descreve para service role: filtro manual, derivado de fonte confiável (o registro do token), nunca de parâmetro de entrada da tool.
- `resolverMcpToken` reproduz à mão a defesa que `org_atual()` dava de graça via RLS: rejeita token de colaborador `ativo = false` ou de organização fora de `trialing`/`ativa`, checando isso a cada resolução (o guard roda em toda chamada — não há cache de sessão para ficar desatualizado).

## Escopo funcional

> **15/08/2026:** a escrita entrou, com desenho próprio — escopos separados,
> idempotência, regra de negócio reusada do banco e trilha em `mcp_escritas`.
> O registro completo (o que foi verificado e o que continua em aberto) está no
> Gate 7 de [`PLANO-MCP-PRODUTO.md`](./PLANO-MCP-PRODUTO.md); a seção abaixo
> descreve só a superfície. Contrato MCP em `0.2.0`.
>
> Histórico, porque explica a forma do código: uma rodada anterior tinha tools
> de escrita com um "core" extraído das Server Actions
> (`registrarApontamentoCore`, `moverCartaoCore`) e foi revertida por falta de
> teste de isolamento real. A volta NÃO refez aquele caminho: em vez de
> duplicar regra em TypeScript, `registrar_apontamento()` foi refatorada para
> delegar a `registrar_apontamento_para(p_colaborador_id, …)` no próprio banco,
> e as Server Actions ficaram intocadas.

**Tools de leitura:**
- `apontamentos_listar` — período parametrizável, padrão 7 dias.
- `demandas_minhas` — demandas ativas da área do colaborador.
- `cartoes_meus_pendentes` — cartões atribuídos, fora de etapa final.
- `quadros_listar` — quadros que a pessoa alcança, com as colunas de cada um.
- `cartao_detalhe` — um cartão: coluna, quadro, prazo, responsáveis, entrega.

**Tools de escrita** (sempre em nome do colaborador do token, nunca de outro):
- `apontamento_registrar` — escopo `apontamento:escrita`; só o dia de hoje.
- `cartao_criar` — escopo `kanban:escrita`.
- `cartao_mover` — escopo `kanban:escrita`; dentro do mesmo quadro.
- `cartao_comentar` — escopo `kanban:escrita`.

**Resources fixos** (mesmos dados, sem parâmetro): `vertice://apontamentos/hoje`, `vertice://apontamentos/semana-atual`, `vertice://demandas/minhas`, `vertice://cartoes/meus-pendentes`, `vertice://quadros/meus`.

**Continua fora do escopo:** edição/exclusão de apontamento, correções retroativas (exigem aprovação de gestor, e o MCP não contorna isso), movimentação entre quadros, fluxos de aprovação, timer, e qualquer função de admin/gestor, billing ou Console.

## Transporte e localização

- Pacote `@modelcontextprotocol/sdk`, transporte **Streamable HTTP** (SSE é legado no protocolo), modo stateless (`sessionIdGenerator: undefined`, `enableJsonResponse: true`).
- Rota `app/api/mcp/route.ts` (`POST`), ao lado de `app/api/cron`.
- `proxy.ts` exclui `api/mcp` do matcher, igual `api/cron` — senão `updateSession()` redireciona para `/login` por falta de cookie antes do guard do MCP rodar.
- CORS: não necessário (cliente MCP roda localmente no agente, não é fetch de browser).

## Tabela `mcp_tokens`

`organizacao_id not null`, FK composta `(colaborador_id, organizacao_id) references colaboradores(id, organizacao_id)`, `token_hash` (SHA-256, o segredo em claro nunca é persistido, só mostrado uma vez na UI), `token_prefixo`, `escopos text[]`, `expira_em`, `revogado_em`, `ultimo_uso_em`. RLS restritiva: `colaborador_id = auth.uid() and organizacao_id = (select org_atual())` — cada colaborador só vê/gerencia os próprios tokens.

**Já aplicada em produção** (`supabase/migrations/20260812150000_mcp_tokens.sql`): tabela criada, RLS habilitada, policy `mcp_tokens_proprio`, FK composta e índices individuais em `colaborador_id` e `organizacao_id` confirmados. Nenhum token foi criado, nenhum acesso MCP foi ativado.

A segunda migration (`20260812160000_mcp_tokens_indice_composto.sql`) adicionou o índice composto `(colaborador_id, organizacao_id)` sugerido pelo Supabase Advisor. Ela foi aplicada e o Advisor não retornou alerta de segurança para `mcp_tokens`; os avisos de índices sem uso são esperados enquanto o recurso ainda não tem tráfego.

## Arquivos

```
app/api/mcp/route.ts
lib/mcp/server.ts                 # registra tools/resources no McpServer do SDK
lib/mcp/tools/apontamentos.ts     # apontamentos_listar, demandas_minhas
lib/mcp/tools/kanban.ts           # cartoes_meus_pendentes
lib/mcp/resources.ts
lib/mcp/queries.ts                # cria seu próprio createAdminClient(), filtra por organizacao_id sempre
lib/mcp/tool-helpers.ts
lib/mcp-auth.ts                   # resolverMcpToken, gerarTokenMcp, requireEscopo — único outro lugar com createAdminClient()

app/(app)/perfil/page.tsx         # seção "Acesso via MCP"
app/(app)/perfil/mcp-actions.ts   # criarMcpToken, revogarMcpToken — client normal, RLS isola por dono
app/(app)/perfil/mcp-tokens-manager.tsx

supabase/migrations/20260812150000_mcp_tokens.sql              # aplicada
supabase/migrations/20260812160000_mcp_tokens_indice_composto.sql  # aplicada; índice composto da FK
lib/database.types.ts             # regenerado do schema real

__tests__/isolamento/mcp-tokens.test.ts
__tests__/isolamento/admin-client-estatico.test.ts   # allowlist: lib/mcp-auth.ts + lib/mcp/queries.ts

proxy.ts                          # exclui api/mcp do matcher
package.json                      # + @modelcontextprotocol/sdk
.gitignore                        # ignora .mcp.json (config local de cliente, token em claro)
vitest.config.ts                  # alias para 'server-only' e '@/*', necessário pra testar lib/ direto
```

## O que falta

1. **Testes de isolamento cross-organização com dado real** — token de colaborador A não lê dado de colaborador B; token de organização A não lê dado de organização B; token sem escopo recebe erro. Exige duas organizações seedadas com colaboradores reais no Supabase, algo que não existe hoje para o projeto inteiro (ver `__tests__/isolamento/README.md`) — não é lacuna específica do MCP, mas é a condição de saída antes de reativar qualquer tool de escrita.

## Verificação já feita nesta rodada

- `npm test`, `npm run lint`, `npm run build` passam.
- `__tests__/isolamento/mcp-tokens.test.ts` cobre o que dá pra testar sem banco seedado: formato do token, rejeição de header ausente/malformado/sem prefixo antes de qualquer round-trip, `requireEscopo` presente/ausente. A parte que depende de `SUPABASE_SERVICE_ROLE_KEY` (RLS de `mcp_tokens` via `isolamento_status_tabela`) pula com aviso, mesmo padrão do resto de `__tests__/isolamento/`.
- `admin-client-estatico.test.ts`: confirma que só `lib/mcp-auth.ts` e `lib/mcp/queries.ts` importam `createAdminClient` no projeto inteiro fora dos usos já existentes — qualquer novo uso (inclusive dentro de `lib/mcp/`) quebra o teste e força revisão explícita.
- O endpoint `POST /api/mcp` está publicado em `https://dev.vertice.teralabs.cloud/api/mcp`: sem Bearer token válido responde `401`, e o deploy passou em `npm test`, `npm run lint` e `npm run build`. A validação de `tools/list` e das leituras com um cliente MCP autenticado permanece a fazer antes de tratar a integração como validada ponta a ponta. A configuração local do cliente vive em `.mcp.json`, ignorado pelo git; o segredo em claro fica apenas na máquina de quem o gerou em `/perfil`.
