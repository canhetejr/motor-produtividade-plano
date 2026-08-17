# Servidor MCP do Vértice

Referência operacional do endpoint `/api/mcp`: o que ele expõe, como conectar um cliente e
quais são os limites. As **decisões de desenho** estão em [`PLANO-MCP.md`](./PLANO-MCP.md);
os **gates de segurança, TDD e publicação** estão em
[`PLANO-MCP-PRODUTO.md`](./PLANO-MCP-PRODUTO.md) — leia esse antes de alterar qualquer coisa
de MCP, é exigência do `CLAUDE.md`.

Atualizado em 16/08/2026, conferido contra `lib/mcp/`, `lib/mcp-auth.ts` e `lib/mcp-escopos.ts`.

## O que é

Um servidor MCP (Model Context Protocol) que deixa um agente de IA — Claude Code, Claude
Desktop, MCP Inspector — consultar e alterar dados do Vértice **em nome de um colaborador**,
sem receber a senha dele. O agente age sempre como a pessoa dona do token: nunca vê dado de
outra organização, nunca vê dado de outro colaborador.

- **Transporte:** Streamable HTTP, `POST` apenas, stateless (sem `sessionIdGenerator`).
  Resposta em JSON simples, não SSE — cada chamada é curta e a resposta não depende de uma
  conexão longa sobreviver ao ciclo de vida de uma function.
- **Versão do contrato:** `0.2.0` (`lib/mcp/server.ts`). É a versão do **contrato MCP**, não
  do app: um cliente que guarde a lista de ferramentas usa esse número para saber que ela mudou.
- **Autorização:** Bearer token pessoal, nunca cookie de sessão. O endpoint fica fora do
  matcher de `proxy.ts`, igual a `/api/cron`.

## Escopos

Quatro escopos, definidos em `lib/mcp-escopos.ts` e validados no banco por
`mcp_escopos_validos()` (migration `20260815140000_mcp_escrita.sql`).

| Escopo | Dá acesso a |
|---|---|
| `apontamento:leitura` | Listar os próprios apontamentos e demandas ativas |
| `apontamento:escrita` | Registrar apontamento de hoje |
| `kanban:leitura` | Listar quadros, cartões pendentes e detalhe de cartão |
| `kanban:escrita` | Criar, mover e comentar cartão |

Leitura e escrita são escopos **separados de propósito**: um token de leitura já emitido nunca
ganha poder de escrita por atualização de servidor. Para escrever, é preciso emitir um token
novo com o escopo explícito.

## Ferramentas

Cinco de leitura e quatro de escrita. Todas restritas ao colaborador do token.

### Leitura

| Ferramenta | Escopo | O quê |
|---|---|---|
| `apontamentos_listar` | `apontamento:leitura` | Apontamentos num período; sem parâmetro, últimos 7 dias |
| `demandas_minhas` | `apontamento:leitura` | Demandas ativas da área do colaborador |
| `cartoes_meus_pendentes` | `kanban:leitura` | Cartões em que o colaborador é responsável |
| `quadros_listar` | `kanban:leitura` | Quadros acessíveis, com colunas — é daqui que sai o `coluna_id` |
| `cartao_detalhe` | `kanban:leitura` | Detalhe de um cartão |

### Escrita

| Ferramenta | Escopo | Efeito |
|---|---|---|
| `apontamento_registrar` | `apontamento:escrita` | Apontamento de **hoje**, via `registrar_apontamento_para` |
| `cartao_criar` | `kanban:escrita` | Cartão na coluna informada, com quem chamou como responsável |
| `cartao_mover` | `kanban:escrita` | Move dentro do **mesmo** quadro; dispara as automações |
| `cartao_comentar` | `kanban:escrita` | Comentário `tipo = 'usuario'`, assinado pelo colaborador |

Três propriedades valem saber:

- **Idempotência.** Toda ferramenta de escrita aceita `chave_idempotencia` opcional. Repetir a
  chamada com a mesma chave não cria um segundo registro — a reserva é gravada em
  `mcp_escritas` *antes* do efeito, e um índice único decide o vencedor de duas chamadas
  simultâneas. Falha de regra apaga a reserva, para não queimar a chave.
- **Confirmação.** A descrição de cada ferramenta de escrita diz, em texto, que ela escreve e
  que o agente deve confirmar com a pessoa antes de chamar. É orientação ao modelo, **não trava
  técnica** — não substitui o consentimento no cliente MCP.
- **Regra de negócio reusada.** Nenhuma regra foi reescrita em TypeScript: o apontamento passa
  por `registrar_apontamento_para`, e as regras de movimentação continuam nos triggers do banco.

Fora de alcance, e continua proibido: demandas, administradores, planos, assinaturas e Console.
**Ferramenta de escrita nova não herda essa autorização** — passa pelo mesmo desenho (escopo,
idempotência, regra reusada, trilha e teste cross-organização).

## Resources

Recortes fixos pela identidade do token, sem parâmetro — cobrem o caso comum "meu dia, minha
semana, meus pendentes" sem o agente precisar formular argumento nenhum.

```
vertice://apontamentos/hoje
vertice://apontamentos/semana-atual
vertice://demandas/minhas
vertice://quadros/meus
vertice://cartoes/meus-pendentes
```

Leitura parametrizada (período arbitrário, filtro) fica só nas ferramentas.

## Conectar um cliente

**1. Gere o token.** No app: **Perfil → Acesso via MCP → Novo token**. Dê um nome que
identifique onde ele vai ser usado ("Claude Code no notebook") e marque só os escopos
necessários. O token aparece **uma única vez**.

**2. Configure o cliente.** Num `.mcp.json` na pasta do projeto:

```json
{
  "mcpServers": {
    "vertice": {
      "type": "http",
      "url": "https://<dominio-do-vertice>/api/mcp",
      "headers": { "Authorization": "Bearer SEU_TOKEN" }
    }
  }
}
```

**3. Reinicie o cliente** dentro daquela pasta. O servidor aparece como `vertice`.

> `.mcp.json` já está no `.gitignore` — ele carrega uma credencial pessoal em claro. Nunca
> mande o token por mensagem, e-mail, print ou commit: quem tiver o token tem os escopos que
> você marcou.

**Para revogar:** Perfil → Acesso via MCP → Revogar. A revogação vale imediatamente — o guard
roda a cada chamada, não há cache de sessão para ficar desatualizado. O acesso também cai
sozinho se o colaborador for desativado ou se a organização sair de `trialing`/`ativa`.

## Limites e proteções do endpoint

| Proteção | Valor | Onde |
|---|---|---|
| Corpo da requisição | 256 KiB → `413` | `lib/mcp/http.ts` |
| Requisições por token | 120 / 60s → `429` com `Retry-After` | `lib/mcp/rate-limit.ts` |
| Requisições por IP | 240 / 60s → `429` | idem, antes de autenticar |
| Método | só `POST` → `405 Allow: POST` | `app/api/mcp/route.ts` |
| `Origin` | sem header passa; com header, só domínios do Vértice → `403` | `lib/mcp/http.ts` |

Os limites são ajustáveis por `MCP_RATE_LIMIT_TOKEN`, `MCP_RATE_LIMIT_IP` e
`MCP_RATE_LIMIT_JANELA_SEGUNDOS`. O contador vive no Postgres, não em memória do processo —
com réplicas, um contador em memória daria o limite configurado *vezes* o número de réplicas,
sem aviso.

A ordem das checagens é deliberada: o que é barato e não toca o banco vem primeiro (origem,
tamanho declarado), depois o limite por IP, depois a resolução do token, e só então o limite
por token. Uma varredura automatizada é descartada antes de custar uma consulta.

A política de `Origin` é a defesa contra DNS rebinding que a especificação do MCP recomenda:
um cliente MCP não manda `Origin` — quem manda é navegador. Então sem `Origin` segue; com
`Origin`, tem que ser do Vértice.

## Isolamento

Não há `auth.uid()` numa chamada MCP, então **RLS não protege nada aqui** — a proteção é
manual e explícita:

- Dentro do MCP, `createAdminClient()` (service role) aparece em **quatro arquivos**:
  `lib/mcp-auth.ts`, `lib/mcp/queries.ts`, `lib/mcp/mutations.ts` e `lib/mcp/rate-limit.ts`.
  Nenhuma ferramenta, resource ou route handler o importa direto. A allowlist do repositório
  inteiro é travada por `__tests__/isolamento/admin-client-estatico.test.ts`: **uso novo tem
  que passar por lá**, explicitamente.
  (`PLANO-MCP.md` e `PLANO-MCP-PRODUTO.md` ainda dizem "dois arquivos" — escreveram antes de
  `mutations.ts` e `rate-limit.ts` existirem. A allowlist do teste é a fonte confiável.)
- `McpSessao` carrega só identidade (`tokenId`, `colaboradorId`, `organizacaoId`, `escopos`),
  **nunca um client Supabase**. Uma ferramenta não tem como fazer um `.from()` livre.
- Toda consulta filtra explicitamente por `organizacao_id`, derivado do **token resolvido** —
  jamais de parâmetro de entrada da ferramenta.
- Toda escrita bem-sucedida grava em `mcp_escritas` e em `auditoria` com `acao: 'mcp.*'` —
  nunca o token, o hash ou o payload bruto.

## Testes

```bash
npm test -- lib/mcp          # unitários, sem banco
npm run test:isolamento      # inclui a integração; PULA sem credencial
```

A suíte de integração (`__tests__/isolamento/mcp-real.integration.test.ts`) roda contra um
projeto Supabase **exclusivo de integração**, nunca produção, e reserva o prefixo de slug
`mcp-it-%` para as próprias fixtures. Ela roda em CI a cada PR que toque MCP — ver
`.github/workflows/mcp-integracao.yml` e o checklist de provisionamento em
[`CHECKLIST-MCP-INTEGRACAO.md`](./CHECKLIST-MCP-INTEGRACAO.md).

## Em aberto

Registrado em `PLANO-MCP-PRODUTO.md`, não resolvido:

- **Gate 4** — auditoria e observabilidade de **leitura** (a de escrita existe).
- **Revisão humana de segurança** antes de publicar.
- Um achado de **fuso horário** do Gate 6 — bug de produto anterior ao MCP, ainda aberto.
- A documentação de produto em `/documentacao` ainda descreve o MCP como somente leitura.
