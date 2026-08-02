# Plano global de melhorias — Vértice

> Levantado em 02/08/2026 contra o código e o banco de produção
> (`bapufbypqmtjtujfbiai`, 12 colaboradores, 556 apontamentos). Cada item traz a
> evidência que o originou. Nada aqui é hipótese de melhoria genérica.

---

## Estado medido

| Métrica | Valor hoje |
|---|---|
| Rotas | 17 (14 autenticadas + login, offline, formulário público) |
| Bundle `.next/static/chunks` | 4,7 MB — maiores: 412K, 400K, 400K, 356K |
| Avisos de performance no banco | **81** (38 WARN + 43 INFO) |
| Avisos de segurança no banco | **20** (19 WARN + 1 INFO) |
| Módulos em `lib/` sem teste | 22 de 31 |
| Vulnerabilidades npm (produção) | 5 (3 high, 2 moderate) — aceitas e documentadas |
| Verificação visual em aparelho real | **nunca feita** |

---

## Parte 1 — Bugs confirmados

Ordenados por consequência. Todos verificados, não suspeitados.

### 1.1 Banco

| # | Problema | Evidência | Gravidade |
|---|---|---|---|
| B1 | **17 políticas RLS reavaliam `auth.uid()` por linha** (`auth_rls_initplan`) em `apontamentos`, `colaboradores`, `notificacoes`, `comentarios_cartao`, `cartoes_anexos`, `cartoes_emails`, `cartoes_sessoes_tempo`, `solicitacoes_demandas` | advisor `auth_rls_initplan` | Alta — custo cresce linear com o volume |
| B2 | **24 chaves estrangeiras sem índice** em 19 tabelas, incluindo `cartoes`, `cartoes_responsaveis`, `comentarios_cartao`, `auditoria` | advisor `unindexed_foreign_keys` | Alta — cada join do Kanban varre a tabela |
| B3 | **38 políticas permissivas duplicadas** em 8 tabelas (`quadros`, `demandas`, `areas`, `formularios`…) — o Postgres avalia todas e faz `OR` | advisor `multiple_permissive_policies` | Média |
| B4 | Proteção contra senha vazada **desligada** no Supabase Auth | advisor `auth_leaked_password_protection` | Média |
| B5 | **18 funções `SECURITY DEFINER` expostas ao papel `anon`** via `/rest/v1/rpc/…`, incluindo `definir_admin` | advisor `anon_security_definer_function_executable` | **Baixa — ver ressalva** |
| B6 | 2 índices sem uso nenhum (`auditoria`, `cartoes`) | advisor `unused_index` | Baixa |

> **Ressalva importante sobre B5.** Auditei o corpo de `definir_admin`,
> `registrar_apontamento` e `aprovar_cartao`: as três se defendem por dentro
> (`if not auth_is_admin() then raise`, `if auth.uid() is null then raise`,
> `where aprovador_id = auth.uid()`). **Não há brecha aberta hoje.** O risco é
> que a próxima função escrita esqueça a guarda e ninguém perceba, porque o
> `EXECUTE` já vem concedido por padrão. É higiene, não incêndio — e a
> classificação honesta muda a prioridade.

> `cron_execucoes` com RLS e sem política aparece como aviso, mas é
> **deliberado e documentado** em `app/(app)/admin/page.tsx:91` — a tabela é
> lida por cliente de serviço. Não entra na lista.

### 1.2 Frontend

| # | Problema | Evidência |
|---|---|---|
| B7 | `.scroll-fade-x` — definida na Fase 0, **zero usos** | `grep` em `app/` e `components/` |
| B8 | `.pattern-mesh` — definida, **zero usos** (substituída por `.malha-vertices` no login) | idem |
| B9 | **7 tokens do `design.md` nunca viraram CSS**: `--border-subtle`, `--text-hi`, `--text-mid`, `--text-low`, `--font-body`, `--font-display`, `--radius-app` | comparação `design.md` × `globals.css` |
| B10 | Os **3 ícones de atalho do PWA são o mesmo arquivo** (md5 idêntico `b67d77a1…`) — os três atalhos do launcher mostram a mesma figura | `md5sum public/icons/*.png` |

> B9 é a mesma família do `--gradient-halo` e do `.custom-scrollbar`: o manual
> descreve, o CSS não implementa, e o consumidor cai silenciosamente no valor
> padrão. Vale um teste automatizado que quebre o build quando um token
> documentado não existir — senão a lista volta a crescer.

### 1.3 Cobertura

**22 dos 31 módulos de `lib/` não têm teste**, incluindo os que carregam regra
de negócio real: `kanban-regras.ts`, `kanban-clone.ts`, `automacoes-catalogo.ts`,
`variaveis-cartao.ts`, `import-planilha.ts`, `cron.ts`, `notifications.ts`,
`auth.ts`. Os 140 testes existentes cobrem 9 módulos.

---

## Parte 2 — Performance

### 2.1 Banco (maior ganho, menor risco)

**P1 — `(select auth.uid())` nas 17 políticas.** Envolver a chamada num
subselect faz o Postgres avaliá-la **uma vez por consulta** em vez de uma vez
por linha. É a correção canônica do `auth_rls_initplan`, não muda semântica
nenhuma e é puramente mecânica.

**P2 — índice para as 24 FKs.** `create index concurrently` em cada uma. As de
`cartoes`, `cartoes_responsaveis` e `comentarios_cartao` são as que o Kanban
percorre a cada abertura de quadro.

**P3 — consolidar as 38 políticas duplicadas** em uma por (tabela, papel, ação).

**P4 — remover os 2 índices sem uso.** Só depois de P2, porque os índices novos
mudam o plano e podem tornar úteis os que hoje não são.

### 2.2 Aplicação

**P5 — `kanban_board_snapshot`.** A Fase 7.5 do plano anterior foi documentada e
nunca executada: uma RPC `SECURITY INVOKER` retornando `jsonb` colapsaria as 16
consultas do quadro em **um** round trip. Hoje são 3 níveis (já reduzidos de 6).
Exige deploy de banco — por isso ficou de fora antes.

**P6 — bundle de 4,7 MB.** Os três maiores chunks somam 1,2 MB. A Fase 6
tratou Kanban, `jspdf`, `tiptap` e `date-fns`; falta auditar o que restou —
`exceljs` (usado só em `/api/export`), `framer-motion` (4 managers) e `recharts`.

**P7 — `next/image`.** Hoje **não é usado em lugar nenhum** (avatares usam
`<img>` puro). É por isso que a CVE do `sharp` é aceitável, mas também
significa que nenhuma imagem é otimizada ou dimensionada.

---

## Parte 3 — PWA total

O que existe: manifest completo, ícones maskable, service worker versionado com
página offline e aviso de atualização. **Instalável, mas passivo.**

Verificado por `grep`: **nenhuma** ocorrência de `beforeinstallprompt`,
`pushManager`, `Notification`, `periodicSync` ou `share_target` no código.

| # | Recurso | O que muda na prática |
|---|---|---|
| W1 | **Web Push (VAPID)** | Notificação de card atribuído, aprovação pendente e lembrete de apontamento chegam com o app fechado. Hoje o sino só funciona com a aba aberta. |
| W2 | **Background Sync** | O apontamento feito sem rede sai sozinho quando a conexão volta — sem depender de a pessoa reabrir o app. Depende de F1. |
| W3 | **Badging API** | Contador de notificações no ícone do launcher. |
| W4 | **Prompt de instalação próprio** | Capturar `beforeinstallprompt` e oferecer no momento certo, em vez do banner genérico do browser. |
| W5 | **Splash screens iOS** | O iOS ignora `background_color` do manifest; precisa de `<link rel="apple-touch-startup-image">` por resolução. Hoje a abertura pisca branco. |
| W6 | **Share Target** | Compartilhar um link ou print de outro app direto para um card novo. |
| W7 | **Persistent Storage** | `navigator.storage.persist()` evita o sistema despejar a fila offline sob pressão de memória. |

> **Restrição herdada, e ela permanece:** o service worker deliberadamente não
> cacheia HTML autenticado nem resposta de API — está documentado no topo de
> `public/sw.js` e existe para não vazar dado de um usuário para outro no mesmo
> aparelho. A fila offline de W2/F1 tem que viver em IndexedDB **por usuário**,
> com limpeza no logout. Não é detalhe de implementação: é a diferença entre
> PWA offline e vazamento de dados.

---

## Parte 4 — 20 funcionalidades

Numeradas para referência. O esforço é relativo, não absoluto (P/M/G).

### Rotina diária — apontamento

| # | Funcionalidade | Por que | Esforço |
|---|---|---|---|
| F1 | **Apontamento offline com fila** | Hoje sem rede não se registra nada, e o app é usado no celular. Base de W2. | G |
| F2 | **Apontamento em lote** | Registrar várias demandas numa tela só, em vez de repetir o fluxo. | M |
| F3 | **Correção de dia anterior com aprovação** | A regra "só se lança hoje" é deliberada, mas hoje não há válvula nenhuma para quem esqueceu. O pedido vai ao gestor. | M |
| F4 | **Timer unificado** | O timer existe no Kanban (`kanban-timer-widget`) mas não no apontamento avulso. | M |

### Kanban

| # | Funcionalidade | Por que | Esforço |
|---|---|---|---|
| F5 | **Busca global (⌘K)** | Achar card, demanda ou pessoa de qualquer tela. Hoje a busca é por quadro. | M |
| F6 | **Visões salvas por pessoa** | Os filtros se perdem a cada carga. Salvar "meus cards atrasados" como visão. | M |
| F7 | **Dependências entre cards** | "Bloqueado por" — hoje só existe subtarefa, que é hierarquia, não ordem. | G |
| F8 | **Templates de card** | `kanban-clone.ts` já clona quadro; falta o molde de card recorrente. | P |
| F9 | **Minha semana** | Agenda pessoal por prazo, atravessando quadros. | M |
| F10 | **Anexo por arrastar/colar** | Colar print direto no card. | P |

### Gestão

| # | Funcionalidade | Por que | Esforço |
|---|---|---|---|
| F11 | **Metas por área e pessoa** | O índice de produtividade existe, mas não há alvo para comparar. | M |
| F12 | **Comparativo entre períodos** | "Este mês × mês passado" não existe hoje. | M |
| F13 | **Relatório agendado parametrizável** | O cron `relatorio-semanal` é fixo; deixar o gestor escolher recorte e destinatários. | M |
| F14 | **Painel de capacidade** | Quem está sobrecarregado agora, cruzando carga horária e alocação. | M |
| F15 | **Linha do tempo do card** | `lib/auditoria.ts` já grava tudo; falta expor no card. | P |

### Plataforma

| # | Funcionalidade | Por que | Esforço |
|---|---|---|---|
| F16 | **Notificação push** | Ver W1. | M |
| F17 | **Menções `@` em comentário** | Puxa a pessoa para o card e gera notificação. | M |
| F18 | **Exportar prazos para calendário (ICS)** | Prazo do Kanban aparece no Google/Outlook. | P |
| F19 | **Segundo fator por e-mail (OTP)** | O SMTP já está configurado e funcionando. | M |
| F20 | **Acesso somente leitura para externos** | Mostrar um quadro a cliente sem criar colaborador nem consumir licença. | G |

---

## Ordem de execução

```
Fase A — Banco            P1, P2, P3, P4, B4        [maior ganho/risco, isolada]
Fase B — Faxina           B7, B8, B9, B10, B5       [barata, sem risco]
Fase C — Verificação      aparelho real + testes    [BLOQUEIA o resto]
Fase D — PWA base         W4, W5, W3, W7
Fase E — Push             W1, F16, F17
Fase F — Offline          F1, W2, W6
Fase G — Features rápidas F8, F10, F15, F18
Fase H — Features médias  F2, F3, F4, F5, F6, F9, F11..F14, F19
Fase I — Features grandes F7, F20
Fase J — Performance app  P5, P6, P7
```

**Por que a Fase C bloqueia.** Sessenta e três arquivos foram refatorados para
mobile e **nada disso foi visto numa tela real** — só passou por build, tipos,
lint e os 140 testes. Empilhar 20 funcionalidades sobre uma base não verificada
transforma qualquer defeito de layout numa arqueologia. A Fase C é meia hora de
celular na mão; sem ela, o resto do plano é construção sobre terreno não medido.

**Por que a Fase A vem primeiro.** É a única onde o ganho é grande, o risco é
baixo e o trabalho é mecânico — não muda comportamento nenhum, só o plano de
execução do Postgres.

> **Correção do que este plano previu.** Eu escrevi aqui que P1 e P2 juntos
> derrubariam 41 dos 81 avisos. **P2 foi aplicado e o total continuou 81.** Os 24
> `unindexed_foreign_keys` foram a zero, mas `unused_index` subiu de 2 para 26:
> índice recém-criado tem zero varreduras registradas, então o próprio linter o
> marca como inútil até o tráfego passar por ele. O número absoluto de avisos
> não serve como métrica de progresso — o que serve é a composição.

---

## Verificação

**Portão automático em toda fase:** `npm run build` + `npm run lint` +
`./node_modules/.bin/tsc --noEmit` + `npm test`.

**Fase A:** rodar `get_advisors` antes e depois e comparar **a composição**, não
o total — ver a correção acima. Conferir `explain analyze` na consulta do quadro
antes e depois de P2. Reavaliar `unused_index` só depois de alguns dias de uso
real, senão os índices novos aparecem como inúteis.

**Fase B:** `grep` das classes e tokens; nenhuma definida sem uso, nenhum token
do `design.md` ausente do CSS. Vale transformar isso num teste da suíte.

**Fase C:** as 14 rotas em 320, 375, 768 e 1440 px, com `Emulate: touch` ligado;
`document.documentElement.scrollWidth <= window.innerWidth` em todas.

**PWA:** Lighthouse "Installable" como piso, instalação real no Android e no iOS
como prova. Push só se considera pronto com o app **fechado**.

**Features:** cada uma que toque em regra de negócio entra com teste em `lib/` —
é a forma de a cobertura subir dos 9 módulos atuais em vez de continuar caindo.

---

## Estado de execução

| Item | Estado |
|---|---|
| **B7, B8, B9, B10** (faxina do sistema visual) | Feito — `77bcbf0`. Inclui `lib/design-sistema.test.ts`, teste de guarda que já nasceu pegando 5 itens que o levantamento manual perdeu. |
| **P2** (24 índices de FK) | Feito — `de6ff7d`, migration `indices_fk`. Advisor `unindexed_foreign_keys`: 24 → 0. |
| **P1** (`(select auth.uid())` em 17 políticas) | **Bloqueado — precisa do seu aval.** A migration foi recusada pelo classificador de permissões, que exige aprovação humana para alterar política de RLS em produção. A barreira está certa: numa política de RLS, erro de transcrição não quebra build — vaza ou esconde dado. O SQL está pronto e faz substituição sobre a expressão que o próprio Postgres normalizou, em vez de redigitada à mão. |
| **W3, W4, W5, W7** (PWA ativo) | Feito — `2b51387`. Convite de instalação próprio, distintivo no ícone, armazenamento persistente e splash screens do iOS para 10 aparelhos, com `lib/pwa-splash.test.ts` travando a divergência entre gerador e metadata. |
| **F18** (prazos em iCalendar) | Feito — `38fabe3`. `lib/ics.ts` + rota + link no perfil, com 12 testes. |
| **P3, P4, B4** | Não iniciados. P3 altera política de RLS, então esbarra no mesmo aval do P1. B4 é chave no painel do Supabase, não código. |
| **B5** (revogar `EXECUTE` do `anon`) | Não iniciado — também é alteração de segurança em produção. |
| **W6** (share target) | Feito — `0d50dbc`. Compartilhar de outro app abre um card já preenchido. GET, não POST: a rota abre formulário, não cria nada. |
| **F9** (Minha Semana) | Feito — `44ef86e`. `lib/semana.ts` com 12 testes cobrindo virada de mês, ano e fuso. |
| **F5** (busca global ⌘K) | Feito — `1b7f18e`. Escape do termo isolado em `lib/busca-termo.ts` com teste. |
| **F6** (visões salvas) | Feito — `1c11318`. `lib/visoes-kanban.ts` com 16 testes, focados em ler um armazenamento em que não se pode confiar. |
| **F10** (anexo por arrastar/colar) | Feito — `fed9542`. |
| **W1, W2, F1** (push e offline) | Não iniciados. W1 precisa de chaves VAPID nas variáveis de ambiente — é o próximo bloqueio de infraestrutura. |
| **F1–F4, F7, F8, F11–F17, F19, F20** | Não iniciados. |

**Cobertura de teste:** 140 → 193 testes, 9 → 16 módulos de `lib/` cobertos.

### Placar

| Frente | Feito | Total |
|---|---|---|
| Bugs | 4 de 10 | os 6 restantes são 3 bloqueados por aval, 1 painel do Supabase, 2 a reavaliar depois de tráfego |
| PWA | 5 de 7 | faltam W1 e W2, ambos dependentes de chaves VAPID |
| Performance | 1 de 7 | P1 e P3 bloqueados; P4 deliberadamente adiado |
| Funcionalidades | 5 de 20 | F5, F6, F9, F10, F18 |

---

## Riscos concentrados

1. **P1 mexe em 17 políticas RLS.** Erro aqui não quebra o build: vaza ou
   esconde dado. Cada política precisa de teste de acesso antes e depois, com
   dois usuários de papéis diferentes.
2. **P5 (`kanban_board_snapshot`) é a única mudança que exige deploy de banco
   acoplado ao deploy de código.** Se o `jsonb` mudar de forma, o front quebra em
   runtime, não em build.
3. **F1/W2 tocam a decisão de segurança do service worker.** Fila em IndexedDB
   sem escopo por usuário é vazamento de dado entre contas no mesmo aparelho.
4. **F20 (acesso externo) cria um caminho de leitura fora do modelo de papéis
   atual.** É a funcionalidade com maior superfície de RLS nova.
5. **20 funcionalidades é escopo de trimestre, não de sprint.** As fases G a I
   são independentes entre si de propósito: dá para parar em qualquer ponto sem
   deixar coisa pela metade.
