# Operação do Vértice no Coolify

**Status: concluída e em operação desde 18/08/2026.** Este documento substitui o plano de migração como referência operacional. O histórico da decisão de sair da Vercel permanece no Git; não deve ser usado como instrução de deploy.

## Topologia ativa

| Ambiente | Branch | Aplicação Coolify | Domínio |
|---|---|---|---|
| Produção | `main` | aplicação Vértice de produção | `https://vertice.teralabs.cloud` |
| Staging | `develop` | aplicação Vértice de desenvolvimento | `https://dev.vertice.teralabs.cloud` |

As aplicações são independentes: cada uma tem deploy, domínio, variáveis, container e projeto Supabase próprios. Staging nunca usa banco, credenciais, volumes ou filas de produção.

O banco de produção continua no Supabase gerenciado. Esta migração moveu somente a execução do Next.js e o agendamento das rotas cron.

## Fluxo de publicação

```text
feat/* ou fix/* → develop → main
```

- `develop` é staging; alterações chegam por PR e são validadas em `https://dev.vertice.teralabs.cloud`.
- `main` é produção; recebe somente promoção por PR de `develop`.
- `master` é legada e protegida. Não dispara deploy e não deve receber trabalho novo.
- Antes de publicar mudança de código: `npm run lint`, `npm test`, `npm run build` e `git diff --check`.

O Coolify constrói pelo `Dockerfile`. Variáveis `NEXT_PUBLIC_*` são incorporadas no build, portanto uma alteração nelas exige novo build/deploy — reiniciar o container não basta.

## Saúde e deploy

Uma publicação só está concluída quando todas as verificações abaixo passam:

1. O deploy do Coolify termina com o commit esperado.
2. A aplicação fica `running:healthy` no Coolify e `healthy` no Docker.
3. O domínio público responde HTTPS com TLS válido e HTTP 200 em `/login`.
4. O ambiente correto recebeu o commit: `develop` em staging ou `main` em produção.

Não use uma imagem antiga saudável como prova de que o commit atual está implantado. Compare sempre SHA remoto, SHA do deploy e saúde pública.

## OAuth e URLs públicas

O Vértice roda atrás do proxy do Coolify. Redirects OAuth devem usar a origem pública resolvida dos headers confiáveis/proxy, nunca a origem interna do container.

- Produção: `https://vertice.teralabs.cloud`
- Staging: `https://dev.vertice.teralabs.cloud`
- O login Google retorna para `/minha-semana`.
- Alterações de domínio exigem atualizar as allowlists do Supabase Auth e Google OAuth, atualizar `NEXT_PUBLIC_APP_URL` no ambiente correto e rebuildar.

## Crons — Coolify é o único agendador

A Vercel não executa deploys nem crons do Vértice. `vercel.json` foi removido e a integração GitHub da Vercel foi desconectada do repositório.

As sete *Scheduled Tasks* existem **somente na aplicação de produção**. Não crie as mesmas tarefas em staging: isso pode duplicar e-mails, mudanças de ciclo de conta e automações.

Cada tarefa executa dentro do container de produção, sem gravar o segredo na configuração do repositório:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://vertice.teralabs.cloud/api/cron/<rota>
```

| Rota | Agenda UTC | Finalidade |
|---|---|---|
| `lembrete-diario` | `0 21 * * 1-5` | Cobra quem não apontou no dia. |
| `alerta-queda` | `0 11 * * 1-5` | Avisa gestor sobre queda de índice. |
| `relatorio-semanal` | `0 11 * * 1` | Envia consolidado semanal. |
| `kanban-recorrencia` | `0 9 * * *` | Cria cards recorrentes vencidos. |
| `kanban-automacoes` | `0 * * * *` | Avalia atrasos e SLA por hora. |
| `google-calendar-sync` | `15 3 * * *` | Reconcilia cards e Google Agenda. |
| `organizacoes-ciclo` | `0 5 * * *` | Expira períodos de teste e processa ciclo de contas. |

`CRONS_DECLARADOS` em `lib/admin-saude.ts` é a fonte canônica das agendas exibidas em `/console`. Qualquer mudança no Coolify e no código deve ser feita de forma pareada.

### Verificação imediata de cron

Após criar ou editar uma tarefa:

1. Liste as *Scheduled Tasks* da aplicação e compare nome, agenda e `enabled` com `CRONS_DECLARADOS`.
2. Execute cada rota uma vez dentro do container, usando o mesmo comando da tarefa.
3. Confirme HTTP 200 e verifique `cron_execucoes`/`/console`: os sete tipos devem possuir `ultima_execucao`; nenhum pode permanecer como “nunca executado”.

A rota cron sem `Authorization: Bearer $CRON_SECRET` deve responder 401.

## Estado verificado em 18/08/2026

- Produção em `main`, saudável, com TLS válido e `/login` HTTP 200.
- Staging em `develop`, saudável, com TLS válido e `/login` HTTP 200.
- As sete tarefas estão ativas em produção e foram acionadas manualmente com HTTP 200.
- Os sete tipos possuem execução registrada; `/console` não possui cron em estado “nunca executado”.
- A Vercel foi desconectada; uma PR descartável criada após a desconexão não recebeu check da Vercel.

## Segurança operacional

- Não exponha `CRON_SECRET`, chaves Supabase, tokens de deploy ou variáveis de ambiente em commits, logs ou chat.
- Use API/painel do Coolify para alterações de aplicações e variáveis; não escreva diretamente no banco interno do Coolify.
- Antes de alterações de produção, releia a aplicação e confirme repositório, branch e domínio. Produção e staging são alvos diferentes.
