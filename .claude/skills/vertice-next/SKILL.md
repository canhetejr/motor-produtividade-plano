---
name: vertice-next
description: Convenções de código do Vértice em Next.js 16 — proxy.ts no lugar de middleware.ts, guards requireUser/requireGestor/requireAdmin, server actions com Zod e ActionResult, throwIfError em server components, e onde ficam os clients Supabase. Use SEMPRE que for escrever ou editar código em app/, components/ ou lib/ deste projeto: página, layout, route handler, server action, componente, guard de rota ou tratamento de erro. Use também antes de criar rota nova ou mexer em autenticação/sessão.
---

# Convenções de código do Vértice

Next.js 16.3.1 com React 19, App Router, Turbopack, TypeScript estrito.

**Antes de escrever código, leia o guia relevante em `node_modules/next/dist/docs/`.** Esta versão do Next tem mudanças que quebram o que você provavelmente aprendeu: APIs, convenções e estrutura de arquivo diferem. O `AGENTS.md` do repositório insiste nisso e está certo — o sintoma típico de ignorar esse aviso é código que parece idiomático, compila, e usa uma API descontinuada.

O caso mais visível: **não existe `middleware.ts` neste projeto.** O arquivo é `proxy.ts` na raiz, roda no runtime nodejs e delega para `utils/supabase/middleware.ts:updateSession`.

## Qual client Supabase usar

| Contexto | Client | Arquivo |
|---|---|---|
| Server component, server action, route handler | `createClient()` | `utils/supabase/server.ts` |
| Componente client (`'use client'`) | `createClient()` | `utils/supabase/client.ts` |
| Cron, criação de conta, `cron_execucoes` | `createAdminClient()` | `utils/supabase/admin.ts` |
| Console de admin | `adminClient()` | `lib/admin-guard.ts` |

O client de service role **bypassa RLS**. Antes de usá-lo, leia a skill `vertice-isolamento` — a regra de filtro explícito por organização mora lá, e ela é a maior superfície de risco do projeto.

Nunca importe `utils/supabase/admin` em componente client. O `import 'server-only'` no topo do módulo existe para transformar isso em erro de build, mas conte com o hábito, não com a rede.

## Guards de rota

Em `lib/auth.ts`:

- `getProfile()` — envolvido em `React.cache`, uma query de perfil por request mesmo que layout, página e action chamem. Use à vontade; não custa round trip extra.
- `requireUser()` — redireciona deslogado para `/login`, e **derruba quem está com `ativo = false`**. Desativar alguém precisa cortar acesso na hora, não só parar de contar nas métricas.
- `requireGestor()` — exige `role = 'gestor'`.
- `requireAdmin()` — exige a flag `admin`. Não checa role porque a constraint `colaboradores_admin_exige_gestor` já garante no banco que admin ⊃ gestor.
- `isAdmin()` — versão que não redireciona, para quando a action só precisa *saber* se quem chamou é admin.

Toda rota em `app/(app)/` passa por `requireUser()` no layout. Rota que não pode passar por ele (página pública, tela de conta suspensa) precisa ficar **fora** do route group `(app)` — senão o redirect do guard aponta para a própria página e vira loop infinito.

## Server actions

O padrão do projeto, visível em `app/(app)/colaboradores/actions.ts`:

```ts
'use server'

export async function minhaAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireGestor()          // 1. guard primeiro, sempre
  const supabase = await createClient()

  const parsed = meuSchema.safeParse({ ... })     // 2. Zod na entrada
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const { error } = await supabase.from('x').update(parsed.data).eq('id', id)
  if (error) {
    console.error('Erro ao ...:', error)
    return { ok: false, error: 'Falha ao ...' }   // 3. mensagem legível
  }

  await registrarAuditoria({ ... })               // 4. mudança sensível é auditada
  revalidatePath('/rota')
  return { ok: true }
}
```

Quatro coisas que esse padrão carrega:

**O guard vem antes de tudo.** Não depois do parse, não no meio. É a primeira linha porque é o único ponto em que dá para garantir que ele não foi esquecido em algum caminho de retorno antecipado.

**A validação da action não substitui a do banco.** Onde existe trigger ou constraint que já recusaria a operação, a checagem em TypeScript existe para dar mensagem que explica o motivo, em vez do texto cru da exceção do Postgres. O comentário sobre `trg_colaboradores_proteger_admin` em `colaboradores/actions.ts` diz isso explicitamente. Não remova a checagem do banco achando que a da action basta — ela é a que vale.

**Erro vira `ActionResult`, não exceção.** `lib/action-result.ts`. A UI mostra a mensagem; o `console.error` guarda o detalhe técnico.

**Mudança sensível é auditada** via `lib/auditoria.ts`.

Antes de escrever validação de senha, use `verificarSenhaVazada` e `mensagemDeRecusa` de `lib/senha-vazada.ts` — já implementam checagem contra o HIBP por k-anonymity.

## Server components: `throwIfError`

Server component que faz `select` direto e só desestrutura `data` transforma falha de RLS ou de rede em **lista vazia silenciosa**. Foi para isso que `lib/supabase-error.ts:throwIfError` existe:

```ts
const { data: cartoes, error } = await supabase.from('cartoes').select('*')
throwIfError(error)
```

Sem isso, o erro não aparece no `error.tsx` — a tela renderiza vazia como se não houvesse dado. É um dos jeitos mais fáceis de um bug de isolamento passar despercebido.

## Onde as coisas ficam

```
app/(app)/          rotas autenticadas — layout chama requireUser()
app/api/cron/       7 crons do Coolify, autenticados por CRON_SECRET (lib/cron.ts)
app/q/[token]/      compartilhamento externo, sem sessão
app/formularios/    formulários públicos, sem sessão
lib/                lógica de servidor reutilizável
utils/supabase/     os quatro clients
components/ui/      shadcn v4, estilo base-nova, sobre @base-ui/react
proxy.ts            sessão e proteção de rota (não é middleware.ts)
```

Rotas sem sessão (`/q/[token]`, `/formularios/[slug]`) são superfície pública com service role atrás. O token ou slug é a única autorização que existe ali — trate tudo o que vem de query string ou body como entrada não confiável.

## Crons

Autenticação por `cronAuthorized(request)` de `lib/cron.ts`, que confere `Bearer ${CRON_SECRET}`. Cada rota é acionada por uma *Scheduled Task* na aplicação de produção do Coolify. Idempotência por `tentarReservarExecucao()`, para que retry do host ou hit manual da rota vire no-op em vez de reenviar e-mail.

Rota de cron nova exige entrada correspondente em `CRONS_DECLARADOS` (`lib/admin-saude.ts`) **e** uma *Scheduled Task* equivalente no Coolify. Sem os dois, a rota existe mas não é monitorada ou não roda.

## Antes de dar por pronto

- `npm run lint` e `npm test` (vitest).
- `npm run build` quando mexer em rota, layout ou configuração — é onde erro de tipo e de server/client boundary aparece.
- Se a mudança tem efeito visual, olhe a tela. O projeto tem histórico de funcionalidade que entrou sem ninguém abrir no navegador, e `design.md` é o contrato do que a interface deve parecer.
