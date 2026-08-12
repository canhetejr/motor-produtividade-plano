# Finalização do plano do servidor MCP

Registro de encerramento do [`PLANO-MCP.md`](./PLANO-MCP.md): o que aquele documento afirmava,
o que o repositório passou a dizer depois, e o que foi mudado para reconciliar os dois.

Escrito em 12/08/2026, na branch `claude/mcp-funcional-plano-ezzdyd`.

## Contexto

O trabalho do servidor MCP terminou, mas `docs/PLANO-MCP.md` parou no meio do caminho: ele
ainda se lia como um plano em execução e listava como pendências coisas que já tinham sido
feitas depois que o documento foi escrito.

Três divergências concretas entre o documento e o repositório:

| O documento dizia | O que aconteceu |
|---|---|
| "Regenerar `lib/database.types.ts` — a versão no repo é editada à mão" (item 3) | Feito no commit `3eaca94` (`chore(supabase): regenerar tipos do schema`) |
| "Validar com o MCP Inspector antes de conectar um cliente real" (item 4) | O servidor já responde a um cliente real em `https://dev.vertice.teralabs.cloud/api/mcp` — `initialize` devolve 200 com `serverInfo: {name: "vertice", version: "0.1.0"}` e capabilities `tools` + `resources` |
| Nada sobre `.mcp.json` | Commit `84c717a` colocou `.mcp.json` no `.gitignore` — é config local de cliente e carrega o token de API em claro |

O que o documento **acertava** e foi preservado: a decisão de auth (JWT de impersonação
abandonado, service role confinado a dois arquivos), o escopo só-leitura, e a pendência de
teste de isolamento cross-organização. Isso foi conferido contra o código — `lib/mcp/tools/`
tem só as três tools de leitura descritas, e `lib/mcp-auth.ts` expõe apenas os escopos
`apontamento:leitura` e `kanban:leitura`.

Resultado pretendido: o documento deixa de ser um plano com pendências vencidas e passa a ser
o registro de decisão + estado final do servidor MCP, com só as pendências que ainda são reais.

**Alcance:** só documentação. Não entraram nesta rodada o guia de conexão de cliente, o índice
em `docs/README.md`, a seção API do `README.md` da raiz, nem uma entrada em `docs/SEGURANCA.md`.

## Mudanças em `PLANO-MCP.md`

### 1. Cabeçalho — mudar o gênero do documento

Abrir com uma linha dizendo o que o documento é agora ("registro de decisão e estado do
servidor MCP", não plano aberto) e a data de atualização, no mesmo formato que
`docs/README.md` usa ("Atualizado em DD/MM/AAAA"). O título e a seção `## Contexto` ficam.

### 2. Seções que ficam como estão

`## Decisão de auth abandonada`, `## Decisão de auth atual`, `## Escopo funcional`,
`## Transporte e localização`, `## Tabela mcp_tokens` — conferidas contra o código, estão
corretas. Não reescrever.

### 3. Bloco `## Arquivos` — dois ajustes

- Tirar de `lib/database.types.ts` o comentário `# editado à mão; regenerar do schema real
  após a próxima migration` — já foi regenerado.
- Acrescentar `.gitignore  # ignora .mcp.json (config local de cliente, token em claro)`.

### 4. `## O que falta` — reduzir a duas pendências

Sai o item 3 (tipos regenerados) e o item 4 (Inspector — superado por conexão real). Ficam:

1. **Testes de isolamento cross-organização com dado real** — mantido como está, incluindo a
   ressalva de que é condição de saída antes de reativar qualquer tool de escrita.
2. **Índice composto (`20260812160000`)** — o plano original deixava a aplicação em aberto. Depois desta rodada, a migration foi aplicada e o índice `idx_mcp_tokens_colaborador_organizacao` foi confirmado no banco; o Advisor não retornou alerta de segurança referente a `mcp_tokens`.

### 5. `## Verificação já feita nesta rodada` — acrescentar o handshake real

Manter os itens existentes (`npm test`/`lint`/`build`, cobertura de `mcp-tokens.test.ts`,
`admin-client-estatico.test.ts`) e somar a evidência de que o servidor está de pé em dev:
`POST /api/mcp` com `Authorization: Bearer vrt_mcp_…` e `Accept: application/json,
text/event-stream` responde ao `initialize` com `protocolVersion 2025-06-18` e capabilities
`tools` + `resources`.

**Sem token em claro no documento** — o header é descrito como `Bearer vrt_mcp_<segredo>`. O
token que vive no `.mcp.json` local é credencial viva e não entra em arquivo versionado.

## Decisões em aberto

- **`docs/README.md`**: o índice existe justamente para dizer em qual documento confiar, e
  nem `PLANO-MCP.md` nem este arquivo têm linha lá — nascem invisíveis para quem chega pelo
  índice. É uma linha de tabela cada. Ficou de fora do alcance combinado.
- **`lib/mcp/server.ts:13`**: o comentário ainda diz "evita reter o client impersonado (com
  JWT de ~90s)", resquício do desenho de impersonação que o `PLANO-MCP.md` marca como
  cancelado. Contradiz o doc para quem ler o código primeiro. É uma linha de comentário; ficou
  de fora porque o alcance desta rodada é documentação.

## Verificação

1. `git diff master...HEAD -- docs/PLANO-MCP.md` — conferir que nenhuma seção de decisão foi
   reescrita por acidente e que nenhum token aparece no diff.
2. Reler o documento inteiro procurando contradição interna entre a seção
   `## Tabela mcp_tokens` e `## O que falta` sobre o índice composto.
3. `grep -n "vrt_mcp_[0-9a-f]" docs/PLANO-MCP.md` — precisa não retornar nada.
4. Confirmar que cada pendência restante tem um comando ou critério de saída explícito, não só
   uma descrição.
5. Nenhum código muda, então `npm test`/`lint`/`build` não precisam rodar de novo — mas os
   commits vão só com arquivos de doc, então vale um `git status` antes de commitar.
