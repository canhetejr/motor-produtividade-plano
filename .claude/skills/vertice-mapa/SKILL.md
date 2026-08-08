---
name: vertice-mapa
description: Mapa do projeto Vértice — o que o produto é, onde cada coisa mora, quais documentos valem e quais estão desatualizados, e o estado atual da transformação em SaaS multi-inquilino. Use no início de qualquer tarefa neste repositório em que você ainda não sabe onde mexer, quando alguém perguntar como o Vértice funciona ou o que ele faz, quando precisar decidir qual arquivo tocar, e sempre que for consultar docs/ — vários documentos de lá contradizem o estado real do banco.
---

# Mapa do Vértice

## O que é

O Vértice (pasta `motor-produtividade-plano`, pacote `motor-produtividade`) é um produto Tera que substituiu a planilha de produtividade de uma equipe. Colaboradores registram apontamentos diários de demandas, o sistema calcula o índice (`tempo entregue / carga horária`), e gestores acompanham em dashboard, com e-mails automáticos de lembrete, alerta e relatório semanal.

Em volta desse núcleo cresceu um Kanban completo: automações, campos personalizados, dependências, aprovações, checklists, anexos, sessões de tempo, templates, formulários públicos e compartilhamento externo por token. Mais dashboards, metas, relatórios em CSV/XLSX/PDF, auditoria, notificações (in-app, e-mail, Web Push), integração com Google Calendar, PWA com fila offline e MFA por e-mail.

Hoje é **um app de uma empresa só**, em produção, com ~12 colaboradores. Está sendo transformado em SaaS multi-inquilino com plano por assento.

## Stack

Next.js 16.2 · React 19 · TypeScript estrito · Turbopack · Supabase (Postgres + Auth + Storage) · Tailwind v4 com shadcn v4 sobre `@base-ui/react` · Resend para e-mail · Vercel, com 6 crons em `vercel.json`.

Produção: projeto Supabase `bapufbypqmtjtujfbiai` (região `sa-east-1`), projeto Vercel `vertice`.

## Onde as coisas moram

```
app/(app)/          rotas autenticadas (apontamento, kanban, dashboard, gestão…)
app/api/cron/       6 crons, autenticados por CRON_SECRET
app/q/[token]/      quadro compartilhado, sem sessão
app/formularios/    formulários públicos, sem sessão
lib/                lógica de servidor: auth, cron, email, auditoria, push…
utils/supabase/     server, client, admin (service role), middleware
components/ui/      shadcn v4
supabase/migrations/  estado canônico do banco — 45 arquivos
proxy.ts            sessão e proteção de rota (esta versão do Next não usa middleware.ts)
design.md           contrato de identidade visual
```

## Quais documentos valem

O `docs/` tem sete arquivos, e eles não têm o mesmo peso:

| Documento | Confiança |
|---|---|
| `docs/PLANO-PRODUTO.md` | **Atual.** O plano de transformação em SaaS com plano por assento. Fonte de verdade para o trabalho em andamento. |
| `docs/PLANO-GLOBAL.md` | Bom histórico. Roadmap de 02/08, com estado de execução e SHAs. Quase tudo entregue. |
| `docs/PLANO-SAAS.md` | **Superado** por `PLANO-PRODUTO.md`. O diagnóstico continua válido; o plano de execução tem quatro erros conhecidos, listados no aviso no topo do arquivo. |
| `docs/PLANO.md` | Especificação original, escrita contra Next.js 14. Desatualizado. |
| `docs/MELHORIAS-FUTURAS.md` | Backlog de ideias, parcialmente já implementado. |
| `docs/SEGURANCA.md`, `docs/RELATORIO-CONFERENCIA.md` | Notas de auditoria, úteis como contexto. |

**Nenhum documento é fonte confiável para números.** As contagens em `docs/` já divergiram da produção — o plano fala em 43 tabelas e 556 apontamentos; o banco tem 45 e 481. Quando o número importa, pergunte ao banco:

```sql
select count(*) from pg_tables where schemaname='public';
```

Documentação do produto para o usuário final é servida em `/documentacao` via `lib/documentacao.ts` e `lib/changelog.ts`.

## O que é verdade sobre o modelo de dados

- `colaboradores.id` é **ao mesmo tempo** chave primária e FK para `auth.users.id`. A identidade da pessoa *é* a conta de login. É isso que faz `colaborador_id = auth.uid()` funcionar em ~24 políticas.
- Papéis: `role ∈ {colaborador, gestor}` mais a flag booleana `admin`, com a constraint `colaboradores_admin_exige_gestor` garantindo que admin ⊃ gestor.
- 45 tabelas, todas com RLS. 95 políticas. **18 funções `SECURITY DEFINER`** — que bypassam RLS por construção e são o maior risco aberto do projeto.
- Ainda **não existe** `organizacoes` nem coluna `organizacao_id`. Isso é o trabalho planejado, não o estado atual. Confira antes de assumir.

## Qual skill usar

- Mexer em SQL, política, função do banco, cron ou service role → **`vertice-isolamento`**, antes de escrever.
- Criar ou aplicar migration → **`vertice-migrations`**.
- Escrever código em `app/`, `lib/`, `components/` → **`vertice-next`**.
- Qualquer coisa com cor, fonte, layout ou marca → **`vertice-design`**.

## Duas coisas que valem saber de antemão

**Esta não é a versão do Next que você conhece.** O `AGENTS.md` avisa e está certo: leia `node_modules/next/dist/docs/` antes de escrever código. O sintoma de ignorar isso é código que compila e usa API descontinuada.

**Muita funcionalidade entrou sem ninguém abrir no navegador.** Vinte features entraram numa leva só. Se sua mudança tem efeito visual, olhe a tela — e se algo parecer quebrado, considere que pode já estar quebrado desde antes, o que muda o diagnóstico.
