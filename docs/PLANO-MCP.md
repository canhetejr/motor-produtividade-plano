# Servidor MCP para o Vértice

## Contexto

O Vértice hoje só é operável por humanos, via sessão de navegador (cookie do Supabase Auth) — apontamentos, kanban, dashboard, tudo passa por `app/(app)/**/actions.ts` protegidas por `requireUser/requireGestor/requireAdmin` (`lib/auth.ts`) e por RLS no Postgres, sempre ancorada em `auth.uid()`. Não existe hoje nenhum caminho para um agente de IA (Claude Desktop, Claude Code, outro cliente MCP) consultar ou agir no sistema em nome de um colaborador. O objetivo deste plano é adicionar um servidor MCP funcional que exponha um subconjunto do Vértice (apontamentos e kanban, para começar) a esses agentes, autenticado por um token de API novo, sem duplicar as regras de negócio e isolamento que já vivem nas RPCs `SECURITY DEFINER` e na RLS.

## Descoberta que define o desenho: identidade é sempre `auth.uid()`

As RPCs de negócio (`registrar_apontamento`, `atualizar_apontamento`, `aprovar_cartao` etc.) e várias actions do kanban (`moverCartao`, que faz `.from('cartoes').update(...)` puro) não recebem `colaborador_id`/`organizacao_id` como parâmetro — leem `auth.uid()` dentro do Postgres e dependem de RLS/`org_atual()`. Um guard que resolvesse o token e chamasse `createAdminClient()` (service role) obrigaria reimplementar, em `lib/mcp/`, toda checagem de organização que já existe espalhada em ~15 RPCs — exatamente a duplicação que a skill `vertice-isolamento` proíbe, e superfície fértil para vazamento entre organizações.

**Decisão: impersonação via JWT de curta duração**, não bypass via service role. O guard do MCP resolve o token de API, encontra o `colaborador_id` dono, assina um JWT (`sub = colaborador_id`, `role/aud = authenticated`, expiração de 60–120s) com o JWT secret do projeto Supabase, e cria um client `@supabase/supabase-js` comum usando esse JWT como `Authorization: Bearer`. Do ponto de vista do Postgres/PostgREST isso é indistinguível de uma sessão de cookie normal: `auth.uid()` resolve, RLS e as RPCs continuam sendo a única fonte de verdade. `createAdminClient()` só é usado no ponto único de resolver o token em si (não há sessão ainda para RLS avaliar) — mesmo padrão de `lib/operador-auth.ts::requireOperador()`, que já acopla checagem + client de forma que não existe caminho de obter o client sem passar pelo guard.

**Fase 0, bloqueante:** confirmar em Supabase → Settings → API → JWT Settings que o projeto do Vértice ainda expõe o legacy JWT secret (HS256). Projetos mais novos migraram para chaves assimétricas; se o modo legado estiver desligado, é preciso reativá-lo (convive com o modo novo) antes de escrever qualquer código de auth do MCP. Sem isso validado primeiro, todo o resto do plano de autenticação muda.

## Transporte e localização

- Pacote `@modelcontextprotocol/sdk`, transporte **Streamable HTTP** (SSE é legado no protocolo).
- Rota nova: `app/api/mcp/route.ts` (`POST`), ao lado de `app/api/cron`. Route Handlers do Next 16 já são Web Fetch API nativa, compatível com o transporte do SDK.
- `proxy.ts` precisa excluir `api/mcp` do matcher, igual já faz com `api/cron` — senão `updateSession()` redireciona para `/login` por falta de cookie antes mesmo do guard do MCP rodar.
- CORS: não necessário no MVP (cliente MCP roda localmente no agente, não é fetch de browser).

## Autenticação: tabela `mcp_tokens` + guard novo

Migration nova (seguir `vertice-migrations`): `mcp_tokens` com `organizacao_id not null`, FK composta `(colaborador_id, organizacao_id) references colaboradores(id, organizacao_id) match simple`, `token_hash` (SHA-256, o segredo em claro nunca é persistido, só mostrado uma vez na UI), `token_prefixo` (para a UI listar sem expor o segredo), `escopos text[]` (ex.: `apontamento:leitura`, `apontamento:escrita`, `kanban:leitura`, `kanban:escrita`), `expira_em`, `revogado_em`, `ultimo_uso_em`. RLS restritiva: `colaborador_id = auth.uid() and organizacao_id = (select org_atual())` — cada colaborador só vê/gerencia os próprios tokens, mesmo dentro da mesma organização.

Novos arquivos:
- `lib/mcp-auth.ts` — `resolverMcpToken(authorizationHeader)`: extrai o Bearer, hashea, busca em `mcp_tokens` via `createAdminClient()` (único uso de service role no fluxo MCP — precisa entrar na allowlist de `__tests__/isolamento/admin-client-estatico.test.ts`), valida `revogado_em`/`expira_em`, assina o JWT de impersonação e devolve `{ colaboradorId, organizacaoId, escopos, supabase }`. `requireEscopo(sessao, escopo)` barra tools sem a permissão certa antes de tocar em dado.
- `utils/supabase/mcp.ts` — `createImpersonatedClient(jwt)`, client `authenticated` normal com o JWT fixo no header (não é o client admin, não bypassa RLS).
- `lib/mcp-jwt.ts` — isola a assinatura HS256 (`SUPABASE_JWT_SECRET`).

UI mínima de autoatendimento: em vez de uma subrota dedicada, entrou como uma seção ("Acesso via MCP") na própria `app/(app)/perfil/page.tsx`, ao lado das seções de Google Workspace e calendário — mesmo padrão de tela que o resto de "configurações da minha conta" já usa. `app/(app)/perfil/mcp-actions.ts` (`criarMcpToken`, `revogarMcpToken`, padrão `'use server'` + `requireUser()` + `ActionResult<T>`, client normal — RLS já isola por dono, não precisa de service role aqui) e `app/(app)/perfil/mcp-tokens-manager.tsx` (client component). Modal mostrando o token em claro uma única vez, com aviso de que não será exibido de novo.

## Escopo funcional do MVP

Para reusar a lógica de negócio sem duplicá-la, extrair um **core** de cada action alvo — função que recebe `{ supabase, colaboradorId, organizacaoId }` já resolvidos — deixando a action `'use server'` original como casca fina (chama `requireUser()` + client de cookie + core) e a tool MCP como outra casca fina (chama o guard de token + core). As ~100 actions restantes não são tocadas.

**Leitura (Fase 1):**
- `apontamentos_listar` (dia/semana do colaborador — base em `apontamento/historico` / view `apontamentos_calculado`)
- `demandas_minhas`
- `cartoes_meus_pendentes` (base em `minha-semana`)

**Escrita (Fase 2):**
- `apontamento_registrar` — extrai o core de `createApontamento` (`app/(app)/apontamento/actions.ts` → `registrarApontamentoCore`), que já delega à RPC `registrar_apontamento`; com o client impersonado a RPC funciona sem alteração. O schema Zod de validação saiu para `lib/apontamento-schema.ts`: um arquivo `'use server'` só pode exportar funções async (regra do compilador do Next), então o schema não podia continuar em `actions.ts` e ser importado pela tool.
- `cartao_mover` — extrai o core de `moverCartao` (`app/(app)/kanban/actions.ts` → `moverCartaoCore`), preservando os efeitos colaterais existentes (`revalidatePath`, disparo de automações, sincronização de Google Calendar) para não divergir do comportamento visto por um humano na UI. Isso exigiu um segundo ajuste: `dispararEventosDeMovimentacao` abria seu próprio client via `createClient()` (cookie) internamente — inofensivo quando chamado a partir do navegador, mas silenciosamente sem sessão quando chamado a partir do MCP. Passou a receber `supabase` do chamador, como o resto da cadeia já fazia. A tool não recebe `ordens` (contexto de arrasto visual que só existe na UI): o cartão muda de coluna sem reordenar os demais.

**Fora do MVP, fases seguintes:** demais escrita de kanban (criar cartão, comentários, anexos, checklist, dependências, aprovações, automações — 11 arquivos de actions, cada um merece revisão própria); correções de apontamento e qualquer fluxo de aprovação (decisão de negócio sensível, não delegar a agente sem revisão humana ainda); timer de cartão; e tudo de admin/gestor (colaboradores, convites, metas, dashboards agregados) — fica para uma fase com escopo de token restrito a quem já é gestor/admin.

## Resources vs Tools

Leituras fixas por identidade do token, sem parâmetro de negócio, vão como **resources** endereçáveis (`vertice://apontamentos/hoje`, `vertice://cartoes/meus-pendentes`). Qualquer leitura parametrizada (período arbitrário, filtro) e toda escrita vão como **tools** — é o mecanismo do protocolo para argumentos e efeito colateral.

## Estrutura de arquivos

```
app/api/mcp/route.ts
lib/mcp/server.ts                 # registra tools/resources no McpServer do SDK
lib/mcp/tools/apontamentos.ts
lib/mcp/tools/kanban.ts
lib/mcp/resources.ts
lib/mcp/queries.ts                # consultas puras, reusadas por tools e resources
lib/mcp/tool-helpers.ts
lib/mcp-auth.ts
lib/mcp-jwt.ts
lib/apontamento-schema.ts         # schema Zod extraído de apontamento/actions.ts
utils/supabase/mcp.ts

app/(app)/perfil/page.tsx         # ganhou a seção "Acesso via MCP"
app/(app)/perfil/mcp-actions.ts
app/(app)/perfil/mcp-tokens-manager.tsx

supabase/migrations/20260812150000_mcp_tokens.sql
lib/database.types.ts             # editado à mão nesta rodada; regenerar após aplicar a migration de verdade

__tests__/isolamento/mcp-tokens.test.ts
__tests__/isolamento/admin-client-estatico.test.ts   # allowlist: só lib/mcp-auth.ts

proxy.ts                          # excluiu api/mcp do matcher
package.json                      # + @modelcontextprotocol/sdk
vitest.config.ts                  # novo — alias para 'server-only' e '@/*', necessário pra testar lib/ direto
```

Extração de cores nas actions existentes: `app/(app)/apontamento/actions.ts` exporta `registrarApontamentoCore` e `app/(app)/kanban/actions.ts` exporta `moverCartaoCore`, ambos usados tanto pela action original quanto pela tool MCP correspondente.

## Fases de entrega

1. **Fase 0 — Spike de viabilidade** (bloqueante, ainda não executado): confirmar HS256/legacy JWT secret disponível no projeto Supabase; validar que um JWT assinado manualmente é aceito como sessão `authenticated` (`auth.uid()` resolve). Esta sessão não tinha acesso ao painel do Supabase para validar isso.
2. **Fase 1 — Infra + leitura** ✅: migration `mcp_tokens` (escrita, não aplicada — ver Verificação), `lib/mcp-auth.ts`, `utils/supabase/mcp.ts`, UI de token em `/perfil`, `app/api/mcp/route.ts`, tools/resources de leitura (`apontamentos_listar`, `demandas_minhas`, `cartoes_meus_pendentes` + 4 resources fixos).
3. **Fase 2 — Escrita essencial** ✅: `registrarApontamentoCore`/`moverCartaoCore` extraídos, tools `apontamento_registrar`/`cartao_mover`, escopos `*:escrita` na tabela de tokens e na UI.
4. **Fase 3 — Kanban ampliado**: criar cartão, comentários, checklist, anexos; avaliar marcar origem (`mcp` vs humano) na auditoria. Não iniciado.
5. **Fase 4 — Admin/gestor**: indicadores, metas, aprovações — escopo de token restrito a gestor/admin, revisão de segurança dedicada. Não iniciado.

## Verificação

- `npm test`, `npm run lint` e `npm run build` passam com as Fases 1 e 2.
- `npx @modelcontextprotocol/inspector` apontando para `http://localhost:3000/api/mcp` com um token de teste — handshake, listagem de tools/resources, chamadas manuais. **Não executado nesta rodada**: exige a migration aplicada e `SUPABASE_JWT_SECRET` configurada, nenhum dos dois disponível nesta sessão.
- `__tests__/isolamento/mcp-tokens.test.ts`: cobre o que dá pra testar sem banco (formato do token, rejeição de header inválido/token malformado antes de qualquer round-trip, checagem de escopo) e, quando `SUPABASE_SERVICE_ROLE_KEY` está no ambiente, confirma via `isolamento_status_tabela` que `mcp_tokens` tem o eixo de organização corretamente aplicado. **Não cobre** leitura/escrita cruzada entre organizações com um token real — exigiria duas organizações seedadas, infraestrutura que não existe hoje para o projeto inteiro (ver `__tests__/isolamento/README.md`).
- `admin-client-estatico.test.ts`: só `lib/mcp-auth.ts` deve precisar entrar na allowlist — qualquer tool que precisar de `createAdminClient()` por engano quebra o teste e força revisão.

## Pendências antes de operar em produção

1. Confirmar o legacy JWT secret no Supabase (Fase 0) e configurar `SUPABASE_JWT_SECRET` no ambiente/Vercel.
2. Aplicar `supabase/migrations/20260812150000_mcp_tokens.sql` (`vertice-migrations`: ensaiar em branch, `apply_migration`, `get_advisors`) e regenerar `lib/database.types.ts` a partir do schema real — a versão no repo agora foi editada à mão para o build passar.
3. Rodar o MCP Inspector contra um ambiente com a migration aplicada antes de conectar um cliente real (Claude Desktop/Code).
