# Índice do `docs/`

Estes documentos foram escritos em momentos diferentes do projeto e **não têm o mesmo peso**.
Vários descrevem um Vértice que não existe mais. Este índice diz em qual confiar para quê.

Atualizado em 18/08/2026.

## Comece por aqui

| Documento | Para quê |
|---|---|
| [`mcp.md`](./mcp.md) | **Referência operacional do MCP**: ferramentas, escopos, como conectar um cliente, limites do endpoint. |
| [`PLANO-MCP-PRODUTO.md`](./PLANO-MCP-PRODUTO.md) | **Leitura obrigatória antes de alterar o MCP** (exigência do `CLAUDE.md`). Gates de segurança, TDD e publicação, com o que cada um deixou em aberto. |
| [`CHECKLIST-MIGRACAO.md`](./CHECKLIST-MIGRACAO.md) | Estado concluído e lista de reconciliação para futuras alterações em produção/staging. |
| [`PLANO-MIGRACAO-COOLIFY.md`](./PLANO-MIGRACAO-COOLIFY.md) | **Referência operacional atual**: topologia, deploy, OAuth, crons e verificação no Coolify. |
| [`PLANO-PRODUTO.md`](./PLANO-PRODUTO.md) | **Por que o isolamento é como é.** Fases 1–7 executadas; leia como registro de decisão. A seção §Riscos vale para código novo. |
| [`CHECKLIST-MCP-INTEGRACAO.md`](./CHECKLIST-MCP-INTEGRACAO.md) | Provisionamento do projeto Supabase de integração e dos secrets da CI. Execução humana — cria projeto com custo e emite chave de service role. |

Para o produto em si — rotas, variáveis, crons, deploy — o `README.md` da raiz.

## Registro do MCP

O MCP tem documentos de desenho e operação. Em caso de divergência entre eles, vale o código e
`docs/mcp.md`; escrita permanece desabilitada.

| Documento | O que é | Cuidado |
|---|---|---|
| [`PLANO-MCP-PRODUTO.md`](./PLANO-MCP-PRODUTO.md) | Plano de segurança e gates de publicação. | Consulte antes de alterar autenticação, escopo ou ferramentas. |
| [`PLANO-MCP.md`](./PLANO-MCP.md) | Decisões de desenho: auth, transporte, tabela `mcp_tokens`. | Registro histórico; não autoriza escrita. |
| [`PLANO-MCP-FINALIZACAO.md`](./PLANO-MCP-FINALIZACAO.md) | Reconciliação histórica do plano inicial. | Registro histórico; a política atual é somente leitura. |
| [`PLANO-EVOLUCAO-AGOSTO.md`](./PLANO-EVOLUCAO-AGOSTO.md) | Leva de 12/08: dono da empresa, troca de e-mail, unificação de Minha semana, quadros arquivados, Perfil/Configurações. | Executado — mas a seção final lista o que **ainda não foi conferido**, incluindo a migration `20260812200000`, que o documento registra como nunca aplicada. Confirme no banco antes de assumir qualquer das duas coisas. |

## Registro histórico

Úteis como contexto. Não tome decisão a partir deles sem conferir o estado atual.

| Documento | O que é | Cuidado |
|---|---|---|
| [`PLANO-GLOBAL.md`](./PLANO-GLOBAL.md) | Roadmap de 02/08/2026, com estado de execução e SHAs. | Quase tudo entregue. Anterior ao multi-inquilino. |
| [`PLANO-SAAS.md`](./PLANO-SAAS.md) | Primeiro plano de SaaS, de 03/08. | **Superado** por `PLANO-PRODUTO.md`, com quatro erros conhecidos listados no topo do arquivo. |
| [`PLANO.md`](./PLANO.md) | Spec original do MVP. | Next.js 14, uma empresa só. Modelagem do apontamento e do índice continua de pé; rotas, stack e deploy, não. |
| [`TASKS.md`](./TASKS.md) | Checklist do MVP. | **Não use como checklist** — há itens `[ ]` que foram feitos. `lib/changelog.ts` deriva daqui. |
| [`RELATORIO-CONFERENCIA.md`](./RELATORIO-CONFERENCIA.md) | Conferência de 22/07/2026. | Os bloqueios que ele aponta já foram resolvidos. |
| [`SEGURANCA.md`](./SEGURANCA.md) | Decisões de segurança registradas, com datas. | Cresce por acréscimo; as entradas antigas continuam válidas como registro. |
| [`MELHORIAS-FUTURAS.md`](./MELHORIAS-FUTURAS.md) | Backlog de ideias. | Parcialmente implementado — abre dizendo "zero cobertura de teste", o que já não é verdade (`npm test`, `__tests__/isolamento/`). |

## Duas regras

**Nenhum documento daqui é fonte confiável para números.** As contagens de tabelas,
políticas e apontamentos já divergiram da produção mais de uma vez, e vão divergir de novo.
Quando o número importa, pergunte ao banco:

```sql
select count(*) from pg_tables   where schemaname = 'public';
select count(*) from pg_policies where schemaname = 'public';
```

**Quando `docs/` e o código discordarem, o código vale.** A lista de variáveis de ambiente
está em `lib/admin-saude.ts` (`ENVS_ESPERADAS`); a de crons, no mesmo arquivo
(`CRONS_DECLARADOS`) e nas *Scheduled Tasks* da aplicação de produção no Coolify; o schema, em `supabase/migrations/`.

## Documentação que não vive aqui

- **Produto, para quem usa**: `/documentacao` no app — `lib/documentacao.ts` e `lib/changelog.ts`.
  O MCP é somente leitura; qualquer descrição de escrita deve ser tratada como desatualizada até
  haver autorização explícita e revisão de isolamento entre organizações.
- **Como contribuir**: `CONTRIBUTING.md`, na raiz.
- **Testes de isolamento**: `__tests__/isolamento/README.md` — como rodar e por que nunca
  contra produção.
- **Identidade visual**: `docs/design/system.md` e `docs/design/qa.md`, na raiz.
- **Convenções, para agentes**: `.claude/skills/` — `vertice-mapa` primeiro, depois
  `vertice-isolamento`, `vertice-migrations`, `vertice-next`, `vertice-design`.
