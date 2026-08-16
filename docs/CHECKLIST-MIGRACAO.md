# Checklist da migração para o Coolify

Para marcar enquanto executa. O raciocínio por trás de cada item está em
`PLANO-MIGRACAO-COOLIFY.md` — aqui é só a sequência.

**A ordem importa.** Cada passo é reversível até a virada do DNS.

---

## Antes de tudo

- [ ] Copiar `GOOGLE_TOKEN_ENCRYPTION_KEY` da Vercel para um lugar seguro.
      **Única variável irrecuperável**: cifra os refresh tokens do Google que
      estão no banco. Chave diferente = tokens indecifráveis, sem erro óbvio.
- [ ] Copiar as demais variáveis da Vercel (lista completa abaixo).
- [ ] Abrir `/console` → Infraestrutura e anotar o que aparece como ausente.
      Se as três do Google estiverem faltando, a integração já estava quebrada.

## Fase 0 — Painel ✅ concluída

- [x] As 6 variáveis não auditadas entraram em `ENVS_ESPERADAS`.
- [x] `NEXT_PUBLIC_APP_URL` passou de `opcional` para `obrigatoria`.
- [x] `docs/DEPLOY-COOLIFY.md` removido (assumia Supabase auto-hospedado).

## Fase 1 — Staging

- [ ] Criar projeto `vertice-staging` no Supabase.
      Free permite 2 projetos ativos; `RAG` está inativo — se barrar, pausar antes.
- [ ] Aplicar as migrations de `supabase/migrations/` em ordem de nome (são 86 hoje;
      confira `ls supabase/migrations | wc -l` em vez de confiar neste número).
      **Não** use `supabase/schema.sql`: ele parou antes do multi-inquilino e sobe
      um banco sem isolamento.
- [ ] Criar o recurso no Coolify a partir do repositório, build por Dockerfile.
- [ ] Configurar os **build args** (marcados como disponíveis em build time).
- [ ] Configurar as variáveis de runtime.
- [ ] Subir. **Este é o primeiro `docker build` de verdade** — o Dockerfile
      nunca foi construído, só conferido.
- [ ] Rodar a verificação completa (seção final).
- [ ] Testar aqui, e **só aqui**: marcar uma organização para exclusão e
      apagá-la em definitivo.

## Fase 2 — Produção em subdomínio novo

- [ ] Criar o recurso no Coolify apontando para o Supabase de **produção**.
- [ ] Domínio `novo.vertice.teralabs.cloud` com TLS.
- [ ] Supabase → Authentication → URL Configuration: adicionar
      `https://novo.vertice.teralabs.cloud/**` à allowlist de redirect.
- [ ] Google Cloud Console → OAuth client: adicionar
      `https://novo.vertice.teralabs.cloud/api/google/callback`.
- [ ] `NEXT_PUBLIC_APP_URL` = domínio novo.
- [ ] **NÃO** configurar os crons ainda.
- [ ] Rodar a verificação completa.

## Fase 3 — A virada

- [ ] Validar o domínio novo por completo.
- [ ] Remover o bloco `crons` do `vercel.json` e fazer deploy na Vercel.
- [ ] Ligar as 7 tarefas agendadas no Coolify.
- [ ] Trocar o DNS de `vertice.teralabs.cloud` para o Coolify.
- [ ] Trocar `NEXT_PUBLIC_APP_URL` para o domínio definitivo **e rebuildar**
      (é build arg — editar a variável não basta).
- [ ] Ajustar a allowlist do Supabase e do Google para o domínio definitivo,
      mantendo o novo enquanto o antigo ainda resolve.

## Fase 4 — Encerrar a Vercel

Só depois de uma semana verde.

- [ ] Remover os domínios do projeto `vertice`.
- [ ] Apagar o projeto.
- [ ] Remover `vercel.json` do repositório.
- [ ] Ajustar o comentário de `CronDeclarado.agenda` — passa a ser a única
      fonte das agendas.

---

## Variáveis

### Build args — precisam existir em tempo de build

As `NEXT_PUBLIC_*` são inlineadas no bundle. Declaradas só como variáveis do
serviço, o app sobe e não conecta.

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `SOURCE_COMMIT` (o Coolify já expõe)

### Runtime — obrigatórias

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `CRON_SECRET`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_TOKEN_ENCRYPTION_KEY` ⚠️ copiar exatamente, nunca gerar nova

### Runtime — e-mail (basta um caminho completo)

- [ ] `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` **ou** `RESEND_API_KEY`
- [ ] `SMTP_PORT` (padrão 587), `SMTP_SECURE`, `EMAIL_FROM` / `RESEND_FROM_EMAIL`

---

## Os 7 crons

Cada um vira uma *Scheduled Task*:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/<rota>
```

| | Rota | Agenda (UTC) |
|---|---|---|
| [ ] | `lembrete-diario` | `0 21 * * 1-5` |
| [ ] | `alerta-queda` | `0 11 * * 1-5` |
| [ ] | `relatorio-semanal` | `0 11 * * 1` |
| [ ] | `kanban-recorrencia` | `0 9 * * *` |
| [ ] | `kanban-automacoes` | `0 10 * * *` |
| [ ] | `google-calendar-sync` | `15 3 * * *` |
| [ ] | `organizacoes-ciclo` | `0 5 * * *` |

As agendas precisam bater com `CRONS_DECLARADOS` em `lib/admin-saude.ts`.

---

## Verificação

Rodar depois de cada fase, e obrigatoriamente antes da virada.

### Local, antes de qualquer deploy

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `docker build` + `docker run`: landing, `/precos` e um chunk estático
      respondem 200
- [ ] `/api/cron/organizacoes-ciclo` **sem** header responde 401

### No ambiente que subiu

- [ ] Entrar com e-mail e senha
- [ ] Entrar com Google (há 2 identidades OAuth reais)
- [ ] `/console` → Infraestrutura: nenhuma obrigatória ausente, e-mail
      configurado, os 7 crons listados
- [ ] Chamar as 7 rotas de cron à mão e ver cada uma sair de "nunca"
      (idempotentes por dia — pode repetir)
- [ ] Criar um convite e **confirmar que o e-mail chega**, com o link no
      domínio certo
- [ ] Apontar uma hora e ver o número mudar em `/gestao`
- [ ] Subir um anexo num card (Storage privado + URL assinada)
- [ ] Trocar o avatar no `/perfil` (Storage público)

---

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| App sobe mas não conecta no banco | `NEXT_PUBLIC_*` declarada só como runtime, não build arg |
| Login funciona mas volta para o domínio errado | Allowlist de redirect do Supabase |
| Conectar Google Agenda falha | URI de callback não declarada no Google Cloud Console |
| Google Agenda parou para quem já estava conectado | `GOOGLE_TOKEN_ENCRYPTION_KEY` diferente — **não regenerar, restaurar** |
| Convite com link no domínio errado | `NEXT_PUBLIC_APP_URL` mudada sem rebuild |
| E-mail "configurado" mas não chega | `SMTP_PORT` / `SMTP_SECURE` — o painel não os audita como falha |
| Build falha no Coolify e não localmente | Memória do servidor (`next build` com Turbopack) |
