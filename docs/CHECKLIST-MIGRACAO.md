# Checklist operacional — Vértice no Coolify

**Estado em 18/08/2026: concluído.** Este arquivo é uma lista de reconciliação para futuras alterações, não um plano pendente de migração.

Referência operacional: [`PLANO-MIGRACAO-COOLIFY.md`](./PLANO-MIGRACAO-COOLIFY.md).

## Topologia

- [x] Produção é uma aplicação Coolify independente em `main`.
- [x] Staging é uma aplicação Coolify independente em `develop`.
- [x] Produção usa exclusivamente `https://vertice.teralabs.cloud`.
- [x] Staging usa exclusivamente `https://dev.vertice.teralabs.cloud`.
- [x] Produção e staging possuem variáveis, containers e projetos Supabase separados.
- [x] `master` foi mantida como branch legada/protegida, sem deploy.

## Publicação

- [x] Fluxo ativo: `feat/*` ou `fix/*` → `develop` → `main`.
- [x] O Dockerfile foi construído e implantado pelo Coolify.
- [x] Produção e staging foram verificadas como `running:healthy`.
- [x] Os dois domínios respondem `/login` com HTTPS/TLS válido e HTTP 200.
- [x] Redirect OAuth preserva o domínio público atrás do proxy Coolify.
- [x] Login Google retorna para `/minha-semana`.

## Vercel

- [x] `vercel.json` foi removido do repositório.
- [x] A integração GitHub da Vercel foi desconectada de `canhetejr/vertice`.
- [x] PR de verificação criada após a desconexão não recebeu check da Vercel.
- [ ] Excluir o projeto/domínios remanescentes na Vercel, **somente se isso for solicitado explicitamente**. Não é necessário para deploy ou cron do Vértice.

## Os 7 crons de produção

As tarefas existem somente na aplicação Coolify de produção. Cada uma usa:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://vertice.teralabs.cloud/api/cron/<rota>
```

| Situação | Rota | Agenda UTC |
|---|---|---|
| [x] | `lembrete-diario` | `0 21 * * 1-5` |
| [x] | `alerta-queda` | `0 11 * * 1-5` |
| [x] | `relatorio-semanal` | `0 11 * * 1` |
| [x] | `kanban-recorrencia` | `0 9 * * *` |
| [x] | `kanban-automacoes` | `0 * * * *` |
| [x] | `google-calendar-sync` | `15 3 * * *` |
| [x] | `organizacoes-ciclo` | `0 5 * * *` |

- [x] As sete agendas batem exatamente com `CRONS_DECLARADOS` em `lib/admin-saude.ts`.
- [x] As sete tarefas foram acionadas manualmente com HTTP 200 após a criação.
- [x] Os sete tipos possuem registro em `cron_execucoes`.
- [x] `/console` não possui cron em “nunca executado”.

## Checklist para mudanças futuras

### Antes de publicar código

- [ ] Confirmar o ambiente alvo: `develop` para staging, `main` para produção.
- [ ] `npm run lint`.
- [ ] `npm test`.
- [ ] `npm run build`.
- [ ] `git diff --check`.

### Depois do deploy

- [ ] Confirmar que o commit do deploy é o SHA esperado da branch remota.
- [ ] Confirmar `running:healthy` no Coolify e health check Docker saudável.
- [ ] Confirmar HTTPS/TLS e HTTP 200 em `/login` do domínio do ambiente.
- [ ] Se mudou `NEXT_PUBLIC_*`, confirmar que houve novo build, não apenas restart.
- [ ] Se mudou cron, reconciliar Coolify com `CRONS_DECLARADOS`, executar a rota e verificar `cron_execucoes`/`/console`.

## Regras de segurança

- Nunca reutilize banco, credenciais, volumes ou filas de produção em staging.
- Não grave segredos no repositório, nos comandos versionados ou em logs.
- Use o painel/API do Coolify; não altere diretamente o banco de dados interno da plataforma.
- A rota cron sem `CRON_SECRET` deve retornar HTTP 401.
