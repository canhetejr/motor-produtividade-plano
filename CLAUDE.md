@AGENTS.md

## Vértice — invariantes

- Produto em **Beta**. Nunca descreva como estável ou pronto para qualquer cliente sem ressalva.
- Repositório `canhetejr/vertice`. Fluxo: `feat/*` | `fix/*` | `docs/*` → PR para `develop` → `main`. `master` é histórico, não é branch de trabalho.
- Único deployer e agendador é o **Coolify**: `main` → produção (`https://vertice.teralabs.cloud`), `develop` → staging (`https://dev.vertice.teralabs.cloud`). A Vercel foi abandonada e desconectada — não é mais alvo de deploy.
- **Produção e staging compartilham hoje o mesmo Supabase/Auth/Storage/credenciais/integrações.** Staging não é ambiente seguro para migration, teste mutável, fixture, upload, e-mail, Google ou qualquer escrita. O único alvo autorizado para teste destrutivo é o projeto Supabase isolado de integração `khaeknegymhygsdofkce`. Nunca use produção para teste mutável.
- Produção mantém exatamente 7 crons (`lib/admin-saude.ts`); staging tem 0 — não crie *Scheduled Task* equivalente lá.
- Identidade visual padrão é **Tera Acid/Ink/Paper**; roxo e mint só existem como uso semântico pontual (ex.: estado de sucesso), nunca como cor de marca principal.
- Next.js `16.3.1`.
- Referência humana de card é `VRT-000001` etc.; UUID continua técnico. Prefixo de quadro (`Q1`, `Q2`…) é código interno, não referência humana.
- Multi-organização é invariante: toda tabela de negócio leva `organizacao_id`, política RLS restritiva, FK composta, e função `SECURITY DEFINER` validando organização explicitamente.

## Qual skill usar

- Não sabe por onde começar, ou vai consultar `docs/` → **`vertice-mapa`**
- Fluxo de trabalho, worktree/branch, PR, gates de CI, staging vs. produção → **`vertice-development`**
- Interface, cor, fonte, layout, marca → **`vertice-design`**
- RLS, política, função do banco, cron, `createAdminClient`, multi-inquilino → **`vertice-isolamento`**
- Criar/aplicar migration, DDL, schema → **`vertice-migrations`**
- Código em `app/`, `lib/`, `components/` → **`vertice-next`**

## MCP — leitura obrigatória antes de alterar

Antes de qualquer mudança em MCP, leia [`docs/PLANO-MCP-PRODUTO.md`](docs/PLANO-MCP-PRODUTO.md). Ele contém os gates de segurança, TDD e publicação. A escrita MCP existe desde 15/08/2026 (Gate 7) e é limitada a quatro ferramentas; ferramenta de escrita nova não herda essa autorização — passa pelo mesmo desenho de escopo, idempotência, regra reusada do domínio, trilha e teste cross-org.
