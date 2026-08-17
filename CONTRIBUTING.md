# Contribuindo com o Vértice

Este documento descreve as convenções que o repositório **já pratica**. Ele não propõe
processo novo — se algo aqui divergir do código, o código vale.

## Antes de escrever qualquer código

Duas leituras não são opcionais, e as duas estão no `AGENTS.md`/`CLAUDE.md`:

1. **Esta não é a versão do Next.js que você conhece.** O Next 16 mudou APIs, convenções e
   estrutura de arquivo em relação ao que a maioria das referências descreve. Leia o guia
   correspondente em `node_modules/next/dist/docs/` antes de escrever. O sintoma de ignorar
   isso é código que compila e usa API descontinuada — `proxy.ts` no lugar de `middleware.ts`
   é o exemplo mais visível.
2. **Antes de qualquer mudança em MCP**, leia [`docs/PLANO-MCP-PRODUTO.md`](docs/PLANO-MCP-PRODUTO.md).
   A escrita MCP é autorizada em **quatro ferramentas** e só nelas; ferramenta de escrita nova
   não herda essa autorização.

Para agentes de IA, as skills em `.claude/skills/` são o caminho mais curto: `vertice-mapa`
primeiro, depois `vertice-isolamento`, `vertice-migrations`, `vertice-next` e `vertice-design`
conforme o que a tarefa toca.

## Ambiente

Node **22.x**.

```bash
npm install
# .env.local com as variáveis do README (o .gitignore ignora .env*)
npm run dev
```

## A regra que não pode regredir: isolamento entre organizações

O Vértice é multi-inquilino. Um vazamento aqui não é um bug entre pessoas — é **entre
clientes**. Consulte a skill `vertice-isolamento` antes de escrever `create policy`,
`security definer`, `createAdminClient()` ou um `.from()` em código de servidor.

O mínimo, para qualquer coisa que toque o banco:

- Tabela de negócio nova precisa de `organizacao_id NOT NULL` e ao menos uma política
  **`restrictive`** amarrada a `org_atual()`. Permissiva *amplia* acesso — não serve para eixo.
  Tabela nova sem isso quebra `__tests__/isolamento/catalogo-eixo.test.ts`.
- FKs são **compostas** (`(id, organizacao_id)`).
- Função `SECURITY DEFINER` bypassa RLS por construção: **toda função nova precisa checar a
  organização explicitamente.**
- Uso novo de `createAdminClient()` (service role) tem que entrar na allowlist de
  `__tests__/isolamento/admin-client-estatico.test.ts`, explicitamente. Sob service role não
  existe `auth.uid()`, então o filtro por organização é manual e derivado de fonte confiável —
  nunca de parâmetro de entrada.

## Migrations

Fluxo completo na skill `vertice-migrations`. O essencial:

- O estado canônico é `supabase/migrations/`, aplicado **em ordem de nome**.
- Migrations são **novas e estreitas**. Nunca reescreva uma migration já aplicada.
- Ensaie em branch antes da produção, regenere `lib/database.types.ts`
  (`npm run tipos:gerar`) e rode `get_advisors` depois.
- **Não use `supabase/schema.sql`** para criar ambiente novo — ver o aviso no README.

## Testes

O projeto usa Vitest. Testes unitários ficam **ao lado do código** (`lib/*.test.ts`,
`app/**/*.test.ts`); só os de isolamento moram em `__tests__/isolamento/`.

```bash
npm test                 # suíte inteira; o que exige banco PULA sem credencial
npm run test:isolamento  # só os de isolamento
npm run lint
npm run build
```

Para mudança comportamental, o repositório pratica **TDD estrito**, e é o que
`docs/PLANO-MCP-PRODUTO.md` exige nos gates: teste falhando → implementação mínima → teste
verde → suíte/lint/build.

Os testes de integração rodam **exclusivamente** contra o projeto Supabase de integração,
jamais produção. Cada suíte reserva um prefixo de slug para as próprias fixtures e limpa só o
que é dela — mas apontar isso para produção significa criar e apagar linhas no banco que
atende clientes reais. Confira a URL antes de exportar. Ver
[`__tests__/isolamento/README.md`](__tests__/isolamento/README.md).

## Segredos

- Token, chave e header **jamais** entram em Git, log, documentação, teste ou mensagem — nem
  "só para confirmar que copiou certo".
- `.env*` e `.mcp.json` já estão no `.gitignore`. Mantenha assim.
- `GOOGLE_TOKEN_ENCRYPTION_KEY` é a única variável irrecuperável do sistema: trocá-la torna os
  refresh tokens já gravados indecifráveis, sem erro óbvio. Nunca regenere — restaure.

## Interface

Qualquer coisa com cor, fonte, espaçamento, layout ou marca segue `design.md` e a skill
`vertice-design`. Uma ação primária por tela.

Muita funcionalidade deste repositório entrou sem ninguém abrir no navegador. Se sua mudança
tem efeito visual, **olhe a tela** — e se algo parecer quebrado, considere que pode já estar
quebrado desde antes, o que muda o diagnóstico.

## Commits e branches

Mensagens de commit em português, no imperativo, com escopo entre parênteses quando ajuda —
como no histórico:

```
ci(mcp): rodar a suíte de isolamento no PR, não depois do merge
docs(mcp): registrar a execução verde da suíte de integração
```

Trabalhe em branch, nunca direto em `master`. Um PR que toque
`lib/mcp/**`, `lib/mcp-auth.ts`, `lib/mcp-escopos.ts`, `app/api/mcp/**`, migrations com `mcp`
no nome ou `__tests__/isolamento/**` dispara a CI de isolamento
(`.github/workflows/mcp-integracao.yml`) — que **falha de propósito** se os secrets do banco
de integração não estiverem configurados, incluindo em PR vindo de fork.

Não existe workflow que rode `npm test`, `npm run lint` e `npm run build` para o repositório
inteiro: isso continua sendo responsabilidade de quem abre o PR, localmente, antes de dar
qualquer coisa por pronta.
