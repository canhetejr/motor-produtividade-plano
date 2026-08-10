# Plano de migração: da Vercel para o Coolify

Status: **decidido, não iniciado.** Nenhuma fase foi executada.

## Contexto

O Vértice roda hoje na Vercel (projeto `vertice`, domínio
`vertice.teralabs.cloud`) contra um Supabase gerenciado
(`bapufbypqmtjtujfbiai`, região sa-east-1). Nada está em uso real ainda: duas
organizações, sendo uma a própria Teralabs e outra um teste.

A motivação é sair da Vercel e consolidar no Coolify, que já hospeda outras
coisas da Tera.

**Decisão tomada: migra só o app. O banco continua no Supabase gerenciado.**

Auto-hospedar o Supabase foi considerado e descartado. O que ele levaria junto:
142 políticas RLS que dependem do GoTrue injetar o JWT no Postgres, 27 funções,
2 identidades OAuth do Google já em uso, e a responsabilidade de operar
Postgres + Auth + Storage. O ganho seria consolidação; o custo, virar plantão
de banco de dados. Fica para quando houver motivo — e, se houver, a condição
registrada é PITR testado com restore de verdade antes do primeiro cliente
pagante.

Isso reduz a migração ao que ela realmente é: **trocar quem executa o
processo Node e quem dispara os crons.** Nenhum dado se move.

## O que já está pronto no repositório

Feito em `fa73dc2`, verificado subindo o build e servindo:

- `next.config.ts` com `output: 'standalone'` e `SOURCE_COMMIT` como
  alternativa a `VERCEL_GIT_COMMIT_SHA` (versão do service worker).
- `Dockerfile` multi-estágio (deps → builder → runner), usuário sem
  privilégio, `node server.js`.
- `.dockerignore`.
- `docs/DEPLOY-COOLIFY.md` foi **removido**: tinha sido escrito assumindo
  Supabase auto-hospedado, e o repositório não pode carregar dois documentos
  dizendo coisas opostas sobre onde o banco fica. O que ele tinha de útil
  (build, variáveis, crons) está aqui, corrigido.

Auditado: zero dependências `@vercel/*`, zero `next/image`, zero edge
functions, nenhum uso de runtime edge.

## Estratégia de virada

Escolhida: **subdomínio novo primeiro.** Sobe em `novo.vertice.teralabs.cloud`
(nome a confirmar), valida em produção real contra o mesmo banco, e só depois
troca o DNS de `vertice.teralabs.cloud`.

A consequência a assumir: durante o período de convivência, **os dois deploys
falam com o mesmo banco**. Isso é seguro para leitura e escrita normal, mas
tem um ponto de atenção próprio, tratado na §Riscos: os crons.

---

## Fase 0 — Fechar o buraco do painel ✅ CONCLUÍDA

As 6 variáveis não auditadas entraram em `ENVS_ESPERADAS`
(`lib/admin-saude.ts`). O `/console` passa a conferir 16 em vez de 10, e é
essa tela que serve de lista de conferência nas fases seguintes.

Uma sétima correção apareceu no caminho: `NEXT_PUBLIC_APP_URL` estava marcada
como **opcional** ("os links de e-mail caem no padrão"), mas
`googleRedirectUri()` **lança** sem ela. Passou a `obrigatoria`.

**Efeito esperado no primeiro deploy:** se as três variáveis do Google não
estiverem configuradas hoje na Vercel, o painel vai passar a acusar
"Configuração incompleta". Isso não é regressão — é a integração do Google
já estando quebrada e o painel finalmente dizendo.

## Fase 1 — Staging no Coolify

Serve para ensaiar a receita inteira num lugar onde errar não custa nada, e
sobra depois como o lugar de testar migrations antes da produção.

**O banco do staging não pode ser o de produção.** Testar convite, exclusão de
organização ou mudança de assento escreveria em dado real. Como a organização
do Supabase está no **plano free**, branches não estão disponíveis — então
staging usa um **segundo projeto Supabase free** (`vertice-staging`), com as
migrations do repositório aplicadas do zero e sem dado de produção.

1. Criar o projeto `vertice-staging` no Supabase.
   - Free permite 2 projetos ativos por organização; `RAG` está `INACTIVE`.
     Se o limite barrar, pausar o `RAG` de verdade antes.
2. Aplicar as 40 migrations de `supabase/migrations/` em ordem.
3. Criar o recurso no Coolify a partir do repositório, build por Dockerfile.
4. Configurar build args e variáveis (§Configuração).
5. Subir e validar (§Verificação).

## Fase 2 — Produção no subdomínio novo

1. Recurso novo no Coolify, mesmo Dockerfile, apontando para o Supabase de
   **produção**.
2. Domínio `novo.vertice.teralabs.cloud`, com TLS emitido pelo Coolify.
3. **Antes de abrir**, liberar o domínio novo nos dois lugares que recusam
   redirecionamento não declarado:
   - **Supabase → Authentication → URL Configuration**: adicionar
     `https://novo.vertice.teralabs.cloud/**` à allowlist de redirect. Sem
     isso, login por OAuth e links de e-mail voltam para o domínio velho.
   - **Google Cloud Console → OAuth client**: adicionar
     `https://novo.vertice.teralabs.cloud/api/google/callback` às URIs
     autorizadas. A URI é derivada de `NEXT_PUBLIC_APP_URL` em tempo de
     execução (`googleRedirectUri()`, `lib/google-workspace.ts:29`) — ou seja,
     ela **muda junto com o domínio**, e o Google recusa o que não estiver
     declarado. Existem 2 identidades OAuth ativas, então isso não é
     hipotético.
4. `NEXT_PUBLIC_APP_URL` aponta para o domínio novo — é o que entra nos links
   de convite e nos e-mails.
5. **Não configurar os crons ainda** (ver §Riscos).

## Fase 3 — Virada

Ordem importa; cada passo é reversível até o último.

1. Validar o domínio novo por completo (§Verificação).
2. **Desligar os crons da Vercel** removendo o bloco `crons` do `vercel.json`
   e fazendo deploy — é o que garante execução única durante a troca.
3. **Ligar as 7 tarefas agendadas no Coolify** (§Crons).
4. Trocar o DNS de `vertice.teralabs.cloud` para o Coolify.
5. Trocar `NEXT_PUBLIC_APP_URL` para `https://vertice.teralabs.cloud` e
   rebuildar (é build arg — não basta mudar a variável).
6. Restaurar a allowlist do Supabase e do Google para o domínio definitivo,
   mantendo o novo enquanto o antigo ainda resolve.

## Fase 4 — Encerrar a Vercel

Só depois de uma semana verde. Remover os domínios do projeto `vertice` e
apagar o projeto. O `vercel.json` pode sair do repositório junto — mas
`CRONS_DECLARADOS` em `lib/admin-saude.ts` passa a ser a única fonte das
agendas, e o comentário do tipo `CronDeclarado` precisa dizer isso.

---

## Configuração no Coolify

### Build args (não são variáveis de runtime)

As `NEXT_PUBLIC_*` são inlineadas no bundle **durante o build**. No Coolify
precisam estar marcadas como disponíveis em build time; declará-las só como
variáveis do serviço produz um app que sobe e não conecta — é a armadilha
número um desta migração.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
SOURCE_COMMIT        (o Coolify já expõe; alimenta a versão do service worker)
```

A anon key não é segredo — quem protege o dado é a RLS.

### Variáveis de runtime

`ENVS_ESPERADAS` em `lib/admin-saude.ts` alimenta o painel **Infraestrutura**
do `/console` — mas **não é a lista completa**, e essa diferença é a maior
armadilha desta migração.

Comparando o que o código lê com o que o painel confere, **6 variáveis reais
não são auditadas**:

| Variável | Onde é lida | O que quebra sem ela |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `lib/google-workspace.ts:38` | Conectar o Google Agenda |
| `GOOGLE_CLIENT_SECRET` | `lib/google-workspace.ts:57` | Troca e renovação de token |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | `lib/google-workspace.ts:24` | **Ver abaixo — crítica** |
| `SMTP_PORT` | `lib/email.ts:43` | Cai no padrão 587 silenciosamente |
| `SMTP_SECURE` | `lib/email.ts:44` | TLS implícito na 465 |
| `RESEND_FROM_EMAIL` | `lib/email.ts:9` | Cai no remetente padrão |

As três do Google escapam de qualquer busca por `process.env.NOME`: são lidas
por índice dinâmico (`process.env[name]`, `lib/google-workspace.ts:18`). Foi
assim que passaram despercebidas — inclusive na minha primeira varredura.

**`GOOGLE_TOKEN_ENCRYPTION_KEY` é a única variável desta migração que não pode
ser regenerada.** É uma chave Base64 de 32 bytes que cifra os refresh tokens do
Google guardados no banco. Como o banco não se move, os tokens cifrados
continuam lá — e se o Coolify subir com uma chave diferente, eles viram lixo
indecifrável e toda conexão com o Google Agenda quebra de vez, sem erro
óbvio. **Copiar exatamente o valor que está na Vercel.**

Consequência prática: hoje o painel pode dizer "nenhuma pendência" com o
Google inteiro sem configurar. **Antes da Fase 1**, incluir as 6 em
`ENVS_ESPERADAS` — as do Google como `obrigatoria`, as de e-mail como
`opcional` (têm fallback embutido). Assim o `/console` vira uma verificação
de verdade, que é exatamente o papel que ele precisa cumprir nas fases
seguintes.

### Crons

O Coolify não tem a convenção da Vercel de mandar o header sozinha. Cada rota
vira uma *Scheduled Task* do serviço:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/<rota>
```

As 7 rotas e agendas estão em `CRONS_DECLARADOS` (`lib/admin-saude.ts`) e
precisam bater exatamente — é contra elas que o `/console` decide se um cron
está atrasado. Divergiu, o painel avalia contra uma agenda que não roda.

---

## Riscos

1. **Cron duplicado durante a convivência.** Os dois deploys apontam para o
   mesmo banco; se ambos agendarem, cada cron dispara duas vezes. A trava de
   `cron_execucoes` protege 6 dos 7 (o segundo insert bate em 23505 e vira
   no-op). O `google-calendar-sync` **não** tem trava, de propósito — é
   reconciliação e precisa poder repetir. Duplicá-lo é inofensivo, mas a
   regra continua valendo: só um host agenda por vez, e a troca acontece na
   Fase 3 na ordem descrita.

2. **`NEXT_PUBLIC_APP_URL` é build arg.** Mudar o domínio exige **rebuild**,
   não só editar a variável. Esquecer isso gera convites com link para o
   domínio errado — e o link do convite é de uso único.

3. **Redirect allowlist.** Supabase Auth e Google OAuth recusam
   redirecionamento para domínio não declarado. É a falha mais provável da
   Fase 2, e aparece como "login funciona, mas volta para o lugar errado".

4. **Node 24 → 22.** A Vercel roda 24; o Dockerfile fixa 22, que é o que
   `package.json` declara em `engines`. É a versão certa, mas é uma troca de
   runtime — vale rodar a suíte e uma passada manual, não só confiar no build.

5. **Sem CDN de borda.** A landing é página de venda e passa a sair de um
   servidor único. Cloudflare na frente do Coolify compensa e é o passo mais
   fácil; não bloqueia a virada.

6. **Disco e memória do build.** `next build` com Turbopack pede RAM. Se o
   servidor for apertado, o build falha no Coolify e não localmente — daí a
   Fase 1 existir antes da Fase 2.

---

## Verificação

Depois de cada fase, e obrigatoriamente antes da Fase 3:

**Automático (local, antes de qualquer deploy)**
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- Build da imagem e boot: `docker build` + `docker run`, confirmando que a
  landing, `/precos` e um chunk estático respondem 200, e que
  `/api/cron/organizacoes-ciclo` **sem** header responde 401.

> **O `Dockerfile` nunca foi construído.** O que já foi verificado é a saída
> `standalone`: ela sobe com `node server.js` e serve landing, `/precos`,
> chunk estático e manifest, e a rota de cron devolve 401 sem header. As
> instruções do Dockerfile foram conferidas contra o repositório
> (`package-lock.json` existe para o `npm ci`, `public/` existe, os três
> caminhos de `COPY` batem com o que o build gera, e o `.dockerignore` não
> exclui nada necessário) — mas conferir não é construir. **O primeiro
> `docker build` de verdade acontece na Fase 1**, e é por isso que a Fase 1
> existe antes da Fase 2.

**Manual, no ambiente que subiu**
- Entrar com e-mail e senha; entrar com Google (as 2 identidades OAuth).
- `/console` → **Infraestrutura**: nenhuma variável obrigatória ausente, envio
  de e-mail configurado, e os 7 crons listados.
- Chamar cada uma das 7 rotas de cron à mão com o `CRON_SECRET` e confirmar
  que saem de "nunca" no painel. São idempotentes por dia — pode repetir.
- Criar um convite e **conferir que o e-mail chega**, com o link apontando
  para o domínio certo.
- Apontar uma hora no `/apontamento` e ver o número mudar no `/gestao`.
- Abrir um card no Kanban, subir um anexo (exercita o Storage privado e a URL
  assinada) e trocar o avatar no `/perfil` (Storage público).

**Só no staging, nunca em produção**
- Marcar uma organização para exclusão e apagá-la em definitivo, confirmando
  que somem as linhas, as contas de acesso e os arquivos.

## Arquivos a alterar

- ~~`lib/admin-saude.ts` — somar as 6 variáveis não auditadas.~~ **Feito.**
- ~~`docs/DEPLOY-COOLIFY.md` — reescrever.~~ **Removido**, consolidado aqui.
- ~~`lib/admin-saude.ts` — comentário de `CronDeclarado.agenda`.~~ **Feito.**
- `vercel.json` — remover o bloco `crons` na Fase 3; o arquivo sai na Fase 4.
  É a única alteração de repositório que sobrou, e ela é da virada.

Nenhuma mudança de código de aplicação é necessária.
