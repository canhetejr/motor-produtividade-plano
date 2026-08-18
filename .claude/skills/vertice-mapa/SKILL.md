---
name: vertice-mapa
description: Mapa do projeto Vértice — o que o produto é, onde cada coisa mora, quais documentos valem e quais estão desatualizados, e o estado atual do SaaS multi-inquilino. Use no início de qualquer tarefa neste repositório em que você ainda não sabe onde mexer, quando alguém perguntar como o Vértice funciona ou o que ele faz, quando precisar decidir qual arquivo tocar, e sempre que for consultar docs/ — vários documentos de lá contradizem o estado real do banco.
---

# Mapa do Vértice

## O que é

O Vértice (pasta `motor-produtividade-plano`, pacote `motor-produtividade`) é um produto Tera que substituiu a planilha de produtividade de uma equipe. Colaboradores registram apontamentos diários de demandas, o sistema calcula o índice (`tempo entregue / carga horária`), e gestores acompanham em dashboard, com e-mails automáticos de lembrete, alerta e relatório semanal.

Em volta desse núcleo cresceu um Kanban completo: automações, campos personalizados, dependências, aprovações, checklists, anexos, sessões de tempo, templates, formulários públicos e compartilhamento externo por token. Mais dashboards, metas, relatórios em CSV/XLSX/PDF, auditoria, notificações (in-app, e-mail, Web Push), integração com Google Calendar, PWA com fila offline e MFA por e-mail.

**É um SaaS multi-inquilino.** Cada cliente é uma organização isolada, com plano por assento, cadastro público com trial de 14 dias, convite de membros por e-mail e um console de operador da plataforma. A empresa de casa é a organização nº 1, em produção com ~12 colaboradores.

Não há gateway de pagamento. Toda a infraestrutura comercial existe — planos, `limite_assentos`, contagem e bloqueio de assentos, estados da conta — mas a conversão de trial em cliente pagante é **manual**, feita pelo operador em `/console`. Foi decisão consciente (`docs/PLANO-PRODUTO.md`), não pendência esquecida.

## Stack

Next.js 16.2 · React 19 · TypeScript estrito · Turbopack · Supabase (Postgres + Auth + Storage) · Tailwind v4 com shadcn v4 sobre `@base-ui/react` · SMTP com Resend como alternativa · Coolify, com 7 *Scheduled Tasks* de produção.

Produção: Coolify em `main`, `https://vertice.teralabs.cloud`; projeto Supabase `bapufbypqmtjtujfbiai` (região `sa-east-1`). Staging: Coolify em `develop`, `https://dev.vertice.teralabs.cloud`, com projeto Supabase isolado.

A migração para o Coolify está concluída: `vercel.json` saiu, a integração GitHub da Vercel foi desconectada e os sete crons rodam somente como *Scheduled Tasks* da produção. `docs/PLANO-MIGRACAO-COOLIFY.md` é a referência operacional; `docs/CHECKLIST-MIGRACAO.md` é a reconciliação para mudanças futuras.

**O MCP permanece somente leitura.** Escrita MCP não está habilitada: qualquer mudança de escopo ou mutação requer autorização explícita, revisão de isolamento entre organizações e atualização coordenada de `docs/mcp.md` e da documentação de produto.

## Onde as coisas moram

```
app/(app)/            rotas autenticadas (apontamento, kanban, dashboard, gestão…)
app/(marketing)/      landing, /precos e /cadastro — públicas, sem sessão
app/(operador)/console  console do operador da plataforma (não é tela de gestor)
app/api/cron/         7 crons, autenticados por CRON_SECRET
app/q/[token]/        quadro compartilhado, sem sessão
app/formularios/      formulários públicos, sem sessão
app/convite/[token]/  aceite de convite
app/conta/            telas de conta expirada e suspensa
lib/                  lógica de servidor: auth, cron, email, auditoria, push…
utils/supabase/       server, client, admin (service role), middleware
components/ui/        shadcn v4
supabase/migrations/  estado canônico do banco — 86 arquivos (confira com `ls | wc -l`)
__tests__/isolamento/ testes de eixo, catálogo e uso de service role
proxy.ts              sessão e proteção de rota (esta versão do Next não usa middleware.ts)
design.md             contrato de identidade visual
```

## Quais documentos valem

O `docs/` tem dezesseis arquivos, e eles não têm o mesmo peso. O índice comentado é
`docs/README.md`; o resumo:

| Documento | Confiança |
|---|---|
| `docs/mcp.md` | **Atual.** Referência operacional do MCP: ferramentas, escopos, conexão de cliente, limites. |
| `docs/PLANO-MCP-PRODUTO.md` | **Atual e obrigatório** antes de mexer em MCP. Gates de segurança, TDD e publicação. Gate 4 e a revisão humana de segurança seguem abertos. |
| `docs/PLANO-MCP.md`, `docs/PLANO-MCP-FINALIZACAO.md` | Histórico do MCP, de 12/08. A política atual é **somente leitura**; não habilite escrita sem autorização explícita e validação de isolamento. |
| `docs/CHECKLIST-MCP-INTEGRACAO.md` | **Atual e em aberto.** Provisionamento do banco de integração e dos secrets da CI. |
| `docs/PLANO-PRODUTO.md` | **Executado** nas fases 1–7. Continua sendo a melhor explicação de *por que* o isolamento é como é. Leia como registro de decisão, não como trabalho pendente. |
| `docs/PLANO-MIGRACAO-COOLIFY.md`, `docs/CHECKLIST-MIGRACAO.md` | **Atuais.** Referência operacional e checklist de reconciliação do Vértice no Coolify. |
| `docs/PLANO-EVOLUCAO-AGOSTO.md` | Leva de 12/08, executada. A seção final lista o que não foi conferido. |
| `docs/PLANO-GLOBAL.md` | Bom histórico. Roadmap de 02/08, com estado de execução e SHAs. Quase tudo entregue. |
| `docs/PLANO-SAAS.md` | **Superado** por `PLANO-PRODUTO.md`. O diagnóstico continua válido; o plano de execução tem quatro erros conhecidos, listados no aviso no topo do arquivo. |
| `docs/PLANO.md`, `docs/TASKS.md` | Spec e checklist do MVP, escritos contra Next.js 14 e um app de uma empresa só. **Históricos.** |
| `docs/MELHORIAS-FUTURAS.md` | Backlog de ideias, parcialmente já implementado. |
| `docs/SEGURANCA.md`, `docs/RELATORIO-CONFERENCIA.md` | Notas de auditoria, úteis como contexto. |

**Nenhum documento é fonte confiável para números.** As contagens em `docs/` já divergiram da produção mais de uma vez — e as contagens deste arquivo também vão envelhecer. Quando o número importa, pergunte ao banco:

```sql
select count(*) from pg_tables where schemaname = 'public';
select count(*) from pg_policies where schemaname = 'public';
```

Documentação do produto para o usuário final é servida em `/documentacao` via `lib/documentacao.ts` e `lib/changelog.ts`.

## O que é verdade sobre o modelo de dados

- **Toda tabela de negócio tem `organizacao_id`, `NOT NULL`,** e ao menos uma política `restrictive` que a amarra a `org_atual()`. Política do eixo é restritiva de propósito: permissiva *amplia* acesso em vez de restringir. Tabela nova sem eixo quebra `__tests__/isolamento/catalogo-eixo.test.ts`.
- `colaboradores.id` é **ao mesmo tempo** chave primária e FK para `auth.users.id`. A identidade da pessoa *é* a conta de login. É isso que faz `colaborador_id = auth.uid()` funcionar em ~24 políticas.
- **Uma pessoa pertence a UMA organização.** `auth.users.email` é único globalmente: quem sai do cliente A e é convidado pelo cliente B não consegue aceitar. É limitação conhecida e assumida.
- Papéis: `role ∈ {colaborador, gestor}` mais a flag booleana `admin`, com a constraint `colaboradores_admin_exige_gestor` garantindo que admin ⊃ gestor. Acima disso, e fora do eixo, existe o **operador da plataforma** (`operadores`), que é quem usa `/console`.
- FKs são **compostas** (`(id, organizacao_id)`), não simples — é o que impede a org A de apontar para uma linha da org B.
- As funções `SECURITY DEFINER` bypassam RLS por construção e foram reescritas na Fase 3b para checar organização. Continuam sendo o ponto mais delicado do projeto: **toda função nova precisa da mesma checagem.**

## Qual skill usar

- Mexer em SQL, política, função do banco, cron ou service role → **`vertice-isolamento`**, antes de escrever.
- Criar ou aplicar migration → **`vertice-migrations`**.
- Escrever código em `app/`, `lib/`, `components/` → **`vertice-next`**.
- Qualquer coisa com cor, fonte, layout ou marca → **`vertice-design`**.

## Três coisas que valem saber de antemão

**Esta não é a versão do Next que você conhece.** O `AGENTS.md` avisa e está certo: leia `node_modules/next/dist/docs/` antes de escrever código. O sintoma de ignorar isso é código que compila e usa API descontinuada.

**O isolamento é a propriedade que não pode regredir.** Antes existia uma empresa só, e um vazamento entre pessoas era um bug. Agora um vazamento é entre clientes. Rode `npm test` antes de dar qualquer coisa por pronta — os testes de isolamento existem exatamente para pegar isso, inclusive o teste estático que barra uso novo de service role sem allowlist.

**Muita funcionalidade entrou sem ninguém abrir no navegador.** Se sua mudança tem efeito visual, olhe a tela — e se algo parecer quebrado, considere que pode já estar quebrado desde antes, o que muda o diagnóstico.
