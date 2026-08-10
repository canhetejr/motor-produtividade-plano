# Deploy do Vértice no Coolify

> **SUPERSEDIDO em parte — leia `PLANO-MIGRACAO-COOLIFY.md` primeiro.**
>
> Este documento foi escrito assumindo **Supabase auto-hospedado**. Essa
> decisão foi revista: o banco **continua no Supabase gerenciado**, e só o app
> Next vai para o Coolify.
>
> Continua válido aqui: a seção de build, a das variáveis, a dos 7 crons e o
> raciocínio de por que não trocar o Supabase por outro banco. **Ignore** tudo
> que trata de subir o stack do Supabase, restaurar dump e PITR — e note que a
> lista de variáveis abaixo está incompleta (faltam as três do Google e três
> de e-mail; a tabela completa está no plano novo).

## A decisão, e o que ela exclui

O app Next vai para o Coolify. O banco vai para **Supabase auto-hospedado** —
não para "outro banco".

Trocar o Supabase por Postgres puro seria reescrever o produto, não migrá-lo:

| O que depende do Supabase | Quantidade |
|---|---|
| `auth.uid()` nas políticas RLS | 106 ocorrências nas migrations |
| Chamadas RPC via PostgREST | 19 |
| Arquivos importando `@supabase/*` | 10 |
| Usos de Storage | 3 |

Autenticação (incluindo MFA), sessão, as 95 políticas de isolamento entre
empresas e a camada de dados inteira assumem GoTrue + PostgREST + RLS. O
Supabase auto-hospedado roda **esse mesmo código sem alteração** — muda o
`NEXT_PUBLIC_SUPABASE_URL` e as chaves, nada mais.

O momento é bom porque nada está em uso real. Aprender a operar Postgres,
GoTrue e Storage com dado de teste custa zero; aprender depois custa cliente.

### Duas condições antes do primeiro cliente pagante

1. **PITR testado com restore de verdade** — WAL archiving contínuo
   (pgBackRest ou wal-g), e um restore ensaiado até o fim. `pg_dump` num cron
   não é point-in-time. O plano já condiciona a automação do purge de
   organizações a isso (`PLANO-PRODUTO.md`, risco 5), e auto-hospedar deixa
   esse requisito mais longe, não mais perto.
2. **Um segundo stack Supabase como staging.** Foi ensaiando as migrations em
   branch que a transformação multi-inquilino não quebrou produção. Esse
   hábito não pode morrer na mudança de host — no Coolify ele vira um segundo
   stack, não um recurso do provedor.

Também se perde o `get_advisors` do Supabase gerenciado, que ainda esta
semana apontou a proteção contra senha vazada desligada. Os lints são open
source (projeto `splinter`) e rodam como SQL contra qualquer Postgres — vale
transformar num script antes de migrar, senão a verificação simplesmente
deixa de acontecer.

## O que prende no Vercel (quase nada)

Auditado: **zero** dependências `@vercel/*`, **zero** usos de `next/image`
(o otimizador de imagem é a dor clássica fora do Vercel — aqui não existe).

Sobraram dois pontos, ambos já resolvidos neste repositório:

- `next.config.ts` lia `VERCEL_GIT_COMMIT_SHA` para versionar o service
  worker. Agora aceita também `SOURCE_COMMIT` (o nome que o Coolify usa), com
  o mesmo fallback de timestamp.
- Os crons dependiam da Vercel mandar `Authorization: Bearer ${CRON_SECRET}`
  sozinha. **O código não muda** — muda quem chama (abaixo).

## Build

O Dockerfile é multi-estágio e usa `output: 'standalone'`. Verificado: a saída
sobe com `node server.js`, serve a landing, `/precos`, os assets estáticos e o
`manifest.webmanifest`, e a rota de cron devolve 401 sem o header.

As `NEXT_PUBLIC_*` são inlineadas **no build**, não lidas em runtime — elas
precisam ser **build args**, não só variáveis do serviço. Declará-las apenas
como variáveis de ambiente do container produz um app que sobe e não conecta
no Supabase. No Coolify: *Build Variables*, com "Available at build time"
marcado.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

(A anon key não é segredo: quem protege o dado é a RLS.)

## Variáveis de runtime

Ver `lib/admin-saude.ts` (`ENVS_ESPERADAS`) — é a mesma lista que o `/console`
confere e mostra em **Infraestrutura**. Depois de subir, essa tela é a
verificação: se algo aparecer como ausente, está ausente de verdade.

Obrigatórias: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
E-mail: o grupo SMTP (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`) **ou**
`RESEND_API_KEY` — `lib/email.ts` tenta SMTP e cai para o Resend. Sem nenhum
dos dois, o convite cria o registro e gera o link, mas **nenhum e-mail sai**.

## Os 7 crons

O Coolify não tem a convenção da Vercel de mandar o header sozinho. Cada um
vira uma *Scheduled Task* no serviço, com o header explícito:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/<rota>
```

| Rota | Agenda (UTC) | O que para de acontecer sem ela |
|---|---|---|
| `lembrete-diario` | `0 21 * * 1-5` | Ninguém é cobrado por não apontar |
| `alerta-queda` | `0 11 * * 1-5` | Gestor não sabe que alguém caiu |
| `relatorio-semanal` | `0 11 * * 1` | Consolidado de segunda não sai |
| `kanban-recorrencia` | `0 9 * * *` | Cards recorrentes não se recriam |
| `kanban-automacoes` | `0 10 * * *` | Atraso e SLA nunca disparam |
| `google-calendar-sync` | `15 3 * * *` | Agenda desincroniza |
| `organizacoes-ciclo` | `0 5 * * *` | **Teste vencido nunca expira** |

As agendas precisam bater com `CRONS_DECLARADOS` em `lib/admin-saude.ts` —
é contra elas que o `/console` decide se um cron está atrasado. Divergiu, o
painel passa a avaliar contra uma agenda que não roda.

A idempotência é do app, não do agendador (`cron_execucoes`): chamar a rota
duas vezes no mesmo dia não reenvia e-mail. Pode chamar à mão sem medo.

## Na frente

Vale um Cloudflare na frente do Coolify. A landing é página de venda e sai de
um servidor único em vez de uma borda global — é o que se perde saindo da
Vercel, e é o mais fácil de compensar.

## Ordem sugerida

1. Subir o stack Supabase (produção) no Coolify e restaurar o dump.
2. Rodar as migrations e conferir contagens e RLS com sessão simulada —
   `set_config('request.jwt.claims', ...)`, o mesmo método usado na
   transformação multi-inquilino.
3. Subir o app apontando para o Supabase novo.
4. Configurar as 7 tarefas agendadas e chamar cada uma à mão uma vez.
5. Abrir `/console` → **Infraestrutura**: os 7 crons devem sair de "nunca" e
   nenhuma env obrigatória pode estar ausente.
6. Só então apontar o DNS.
7. Subir o stack de staging.
