# Leva de evolução — agosto/2026

> **Estado: executado.** Este documento registra o que foi entregue na leva de 12/08/2026 e, mais importante, *por quê* cada decisão foi tomada. Leia como registro de decisão, não como trabalho pendente. A migração para o Coolify continua sendo o que está aberto no projeto — ver [`CHECKLIST-MIGRACAO.md`](./CHECKLIST-MIGRACAO.md).

## O que esta leva não era

Não havia eixo de organização a construir. `PLANO-PRODUTO.md` registra as Fases 1–7 executadas — `organizacoes`, `organizacao_id` em toda tabela de negócio, políticas RLS restritivas com `org_atual()`, FKs compostas, 18 funções `security definer` corrigidas, assentos, ciclo de vida, console do operador, cadastro público.

Tudo aqui é aditivo sobre essa fundação, e cada migration segue as convenções de `.claude/skills/vertice-isolamento` e `.claude/skills/vertice-migrations`.

## As sete entregas

### 1. Dono da empresa

`organizacoes.dono_colaborador_id`, com FK composta contra `colaboradores(id, organizacao_id)`. Duas RPCs `security definer` — `atualizar_nome_organizacao` e `transferir_propriedade_organizacao` — e o trigger `colaboradores_proteger_dono`. Aba Empresa em `/gestao/sistema`.

**Por que coluna em `organizacoes` e não `colaboradores.dono`:** garante "exatamente um dono" por construção. Um booleano em `colaboradores` dependeria de índice parcial único mais lógica de aplicação — a mesma classe de invariante que este projeto já prefere resolver no schema.

**Por que não `role = 'dono'`:** pelo mesmo motivo que `admin` virou coluna em `20260731100000`. Existem ~33 policies escritas como `auth_role() = 'gestor'`; trocar o role do dono o faria nascer com *menos* acesso que um gestor comum.

**Por que a coluna é nulável:** `criar_organizacao` insere `organizacoes` antes de `colaboradores`, então na primeira instrução o dono ainda não existe. A garantia fica por fora do `NOT NULL`: a coluna só é escrita pelas RPCs e por `criar_organizacao`, a tabela não tem policy de UPDATE para `authenticated`, e o diagnóstico de `/gestao/sistema` monitora zero nulos.

**Por que o dono anterior não é rebaixado na transferência:** evita o cenário "a organização ficou sem nenhum admin" — mesmo cuidado do `ULTIMO_ADMIN` em `definir_admin` — e mantém a troca reversível durante a conversa em que ela aconteceu.

**Bootstrap da Teralabs:** o dono é o colaborador "Luiz | Admin", por decisão de produto, não por heurística de data. O e-mail é procurado numa lista de candidatos (`canhete@teralabs.cloud`, `luizfernando.junior@unicive.edu.br`) porque a conta mudou de domínio uma vez desde o seed do bloco 33 — falha alto se nenhum existir, em vez de deixar a organização sem dono em silêncio. As demais organizações usam "gestor+admin ativo mais antigo por `auth.users.created_at`", que ali não é heurística frouxa: quem passou por `/cadastro` é literalmente o primeiro colaborador da empresa, criado por `criar_organizacao` na mesma transação.

### 2. Troca do próprio e-mail

Sem migration. O e-mail é `auth.users.email`, e o estado "pedido feito, não confirmado" já é `new_email` no Supabase Auth — replicar isso numa coluna nossa criaria uma segunda fonte de verdade que dessincroniza no primeiro link expirado.

`/auth/confirmar` é rota separada de `/auth/callback` de propósito: o callback é o retorno do OAuth, assume `code` PKCE e responde erros que citam o Google literalmente. A rota nova aceita `token_hash` **e** `code`, porque o formato do link depende do template configurado no painel do Supabase — que este código não controla.

**Pendente de conferência em staging:** qual formato de link o projeto de fato envia, e se "Secure email change" (confirmação nos dois endereços) está ativo. A tela já distingue os dois casos; o que falta é confirmar qual acontece.

### 3. Ícones do login

O bug relatado era do login. A causa não era.

Diagnóstico em navegador real, antes de qualquer edit: a 1280px o campo de senha media 32px de altura (não os 52 declarados) e 10px de padding à esquerda (não os 40), com o texto digitado caindo em cima do ícone. A 360px tudo aparecia certo.

A classe base do `Input` trazia `md:px-2.5`. `tailwind-merge` trata `md:px-2.5` e `px-10` como grupos diferentes — o modificador entra na chave de conflito, e com razão — então as duas sobreviviam ao `cn()`, e a partir de 768px a variante vencia por ordem na folha de estilo.

**Não era um bug do login: 13 telas** passavam `pl-*` para abrir espaço de ícone e perdiam esse espaço no desktop (busca de colaboradores, auditoria, catálogo, áreas, documentação, changelog, cadastro, convite). Por isso a correção foi no componente. `components/ui/input.test.ts` trava a regra.

O `z-10` solto no cadeado do login era resíduo de uma tentativa antiga de consertar isso pelo lado errado.

### 4. Minha semana como hub

O lançamento diário virou o topo de `/minha-semana`. A lógica não mudou de lugar — `actions.ts` e `ApontamentoForm` seguem onde estavam, só a moldura virou componente.

`/apontamento` continua respondendo, como redirect que preserva a query. Não é cortesia: e-mails de lembrete já enviados, favoritos e o atalho do PWA já instalado apontam para lá, e um 404 quebraria o link do cron para todo mundo de uma vez. O `manifest` mantém `id: '/apontamento'` pelo mesmo motivo — mudar o `id` faz o navegador tratar isto como outro app e órfã quem já instalou.

Histórico e o lote em rota própria continuam existindo. Editar e excluir lançamento é outra tarefa, e empilhá-la no hub o transformaria numa tela de tudo.

**Correções ganharam a primeira tela.** As quatro actions (`pedirCorrecao`/`aprovarCorrecao`/`rejeitarCorrecao`/`listarCorrecoes`) e as RPCs existiam desde 02/08/2026 e nunca tiveram consumidor: a capacidade estava completa e inalcançável. Nenhuma regra mudou — a policy de insert em `apontamentos` segue exigindo `data = CURRENT_DATE`, e o pedido só vira lançamento quando um gestor aprova.

### 5. Exportar demandas em CSV

Rota própria (`/api/export/demandas`), não mais um formato no export de apontamentos: aquele arquivo já resolve quatro formatos com filtro de período e área, e o shape de colunas do catálogo não tem nada em comum.

Só as colunas textuais passam por `sanitizeFormula`. Prefixar um número negativo com apóstrofo transformaria a coluna em texto e quebraria a soma na planilha.

### 6. Quadros arquivados

`/kanban` passa a listar só ativos; `/kanban/arquivados` é a contraparte, gestor-only. As duas passam pelo mesmo carregador em vez de repetirem a consulta: a exclusividade mútua é uma propriedade que **não falha alto** — um arquivado aparecendo na lista principal não gera erro, só devolve linhas a mais.

`requireGestor()` na rota, e não só o link escondido: sem isso, digitar a URL levaria um colaborador à lista de quadros arquivados da empresa.

### 7. Perfil e Configurações

Identidade e credencial ficam no Perfil (quem a pessoa é e como ela prova); preferência e integração vão para `/configuracoes`.

Senha e segundo fator seguem no Perfil de propósito — trocar senha é um ato sobre identidade, não uma preferência de uso. **Tokens MCP também ficaram no Perfil**, pela mesma razão e por uma segunda: o escopo desta leva isolava MCP com clareza, e a opção de risco zero era não mexer nem na localização.

Os retornos do OAuth do Google apontavam para `/perfil`, onde o cartão não mora mais — repontados. O teste estático de service role acusou a leitura de `google_workspace_conexoes` mudando de arquivo, que é exatamente o atrito que ele existe para criar.

## O que ficou pendente de conferência

Coisas que este trabalho não conseguiu verificar e que dependem de ambiente com credenciais reais:

1. **A migration `20260812200000_organizacoes_dono.sql` nunca foi aplicada.** Ensaie em branch do Supabase antes de produção — ela adiciona um trigger `BEFORE UPDATE` que roda em toda edição de colaborador da base. Depois: `generate_typescript_types` (os tipos foram editados à mão aqui) e `get_advisors` nos dois tipos.
2. **A lista de e-mails candidatos do bootstrap da Teralabs.** Confirme que um dos dois é colaborador ativo da organização nº 1 antes de aplicar; a migration falha alto se nenhum for, o que é o comportamento desejado mas trava o deploy.
3. **`__tests__/isolamento/dono-organizacao.integration.test.ts` nunca rodou.** Ele pula sem `SUPABASE_SERVICE_ROLE_KEY`. É o primeiro arquivo daquele diretório que autentica sessões reais (`signInWithPassword`), porque as RPCs comparam `auth.uid()` com o dono e o client de service role não tem `auth.uid()` nenhum.
4. **O fluxo de troca de e-mail ponta a ponta**, e a configuração de "Secure email change" no painel do Supabase.
5. **As telas autenticadas renderizadas.** Só `/login` pôde ser aberta no navegador nesta sessão; o resto exige sessão real. O bug dos ícones foi diagnosticado e conferido no navegador; as telas novas (aba Empresa, Configurações, Minha semana com o painel embutido, quadros arquivados) não.
6. **O selo "v2.4 Estável"** em `/documentacao` continua estático e desconectado do changelog. Incrementá-lo é decisão de produto — esta leva entregou sete funcionalidades visíveis.
