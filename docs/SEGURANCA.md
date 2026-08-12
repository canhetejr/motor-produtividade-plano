# Segurança — decisões registradas

## Servidor MCP por token pessoal (12/08/2026)

O endpoint `POST /api/mcp` aceita token MCP pessoal criado em `/perfil`, sempre com escopos explícitos. O segredo é mostrado apenas na criação, armazenado somente como hash SHA-256 e deve ficar em configuração local ignorada pelo git (por exemplo, `.mcp.json`); nunca em documentação, commits ou variáveis `NEXT_PUBLIC_*`.

O projeto usa JWT Signing Keys assimétricas. A impersonação por JWT HS256 foi abandonada: `SUPABASE_JWT_SECRET` não deve ser configurada para o MCP. Sem sessão web, o acesso MCP usa `service_role` somente em `lib/mcp-auth.ts` e `lib/mcp/queries.ts`; as tools não recebem cliente livre e as consultas filtram organização e colaborador derivados do token validado.

O MVP é exclusivamente de leitura (`apontamentos_listar`, `demandas_minhas`, `cartoes_meus_pendentes`). Escrita permanece bloqueada até existirem testes reais de isolamento cross-organização. Tokens revogados, expirados, de colaborador inativo ou de organização fora de `trialing`/`ativa` são rejeitados.

## Atualização do Next 16.2.10 → 16.2.12 (01/08/2026)

O `npm audit` passou a acusar 9 advisories no **core do Next 16.2.10**, não só nas
transitivas já aceitas abaixo. Três batiam direto na arquitetura daqui:

- *Unauthenticated disclosure of internal Server Function endpoints* (o app é todo
  Server Actions)
- *Denial of Service in App Router using Server Actions*
- *Middleware / Proxy bypass em App Router com Turbopack* — mitigado por defesa em
  profundidade (`requireUser()`/`requireGestor()` nas páginas e actions, não só no
  `proxy.ts`), mas ainda assim vale fechar

Corrigido com bump de patch (`next` e `eslint-config-next` de `16.2.10` para `16.2.12`,
versões exatas no `package.json`) + `npm audit fix` sem `--force`, que resolveu
`brace-expansion` (high, DoS). Build, `tsc --noEmit`, lint e os 140 testes passaram
depois da atualização.

Restam **5 vulnerabilidades em produção** (3 high / 2 moderate): `postcss` e `sharp`
(transitivas do `next`, sem versão não-major que corrija) e `uuid` (via `exceljs`) —
os mesmos itens já analisados e aceitos abaixo, pelas mesmas razões. O `npm audit fix
--force` continua propondo downgrades que quebram o app (`next@9.3.3`, `exceljs@3.4.0`)
e segue não sendo aplicado.

## `npm audit` — vulnerabilidades transitivas aceitas (22/07/2026)

Estado inicial: 9 vulnerabilidades (`npm audit --omit=dev`), 3 high / 6 moderate.
Depois da remediação nesta sessão: **5 vulnerabilidades em produção** (3 high / 2
moderate; as outras 3 eram só de `shadcn`, movido pra `devDependencies` — CLI de
scaffolding, nunca importado em runtime, então some do `npm install --omit=dev`
de um deploy real).

O que foi corrigido (sem quebrar nada):
- `npm audit fix` (sem `--force`) resolveu `fast-uri` (3.1.3 → 3.1.4, patch dentro
  da mesma major).
- `shadcn` movido de `dependencies` pra `devDependencies` em `package.json` —
  reduz a superfície instalada em produção e reflete a intenção real de uso
  (só CLI, nunca `import`ado pelo app).

O que ficou como **risco aceito e documentado**, e por quê (todas as correções
sugeridas pelo `npm audit fix --force` são downgrades major que quebrariam o
projeto — `next@9.3.3`, `exceljs@3.4.0` — e não foram aplicadas):

| Pacote | Origem | Por que o risco é aceitável |
|---|---|---|
| `sharp` (high) | `next` (pipeline de `next/image`) | **`next/image` não é usado em lugar nenhum do projeto** (avatares usam `<img>` puro, confirmado por grep). O código vulnerável nunca é exercitado em runtime. |
| `postcss` (moderate, XSS em CSS stringify) | `next` (interno, `postcss@8.4.31`) | Só relevante se o app processasse CSS não confiável vindo de usuário — aqui é só Tailwind/CSS estático, gerado em build. |
| `uuid` (moderate, "missing bounds check quando `buf` é fornecido") | `exceljs` | `exceljs` chama `uuidv4()` sem argumento em todo o código-fonte (confirmado por grep em `node_modules/exceljs/lib`) — o vetor específico da CVE (passar um buffer) nunca é exercitado pelo uso atual. |
| `@hono/node-server` / `@modelcontextprotocol/sdk` / `shadcn` (moderate/high) | `shadcn` (CLI de scaffolding) | Não roda em produção — só usado manualmente via `npx shadcn` durante desenvolvimento. Já não entra mais no `npm install --omit=dev` de um deploy real. |

Revisar de novo quando `next`, `exceljs` ou `shadcn` publicarem uma versão
compatível (não-major) que já traga as dependências corrigidas — não vale a pena
rodar `npm audit fix --force` só por esses 5 itens dado o custo de quebrar o app.
