// Histórico de entregas do produto. Cada entrada corresponde a um marco real,
// não a uma tarefa de backlog.
//
// As entradas de julho foram escritas a partir de docs/TASKS.md e
// docs/RELATORIO-CONFERENCIA.md, quando o histórico do git ainda não cobria
// esse período — os dois documentos são históricos hoje (ver docs/README.md).
// As de agosto vêm de docs/PLANO-GLOBAL.md (§Estado de execução) e
// docs/PLANO-PRODUTO.md.
//
// Ao entregar algo visível para quem usa, acrescente a entrada aqui no mesmo
// PR: este arquivo é o que a pessoa lê em /documentacao, e ele já ficou doze
// dias atrás do produto uma vez.

export type ChangelogCategoria =
  | 'Fundação'
  | 'Apontamento'
  | 'Dashboard'
  | 'Catálogo'
  | 'Kanban'
  | 'Formulários'
  | 'Notificações'
  | 'Relatórios'
  | 'Auditoria'
  | 'Segurança'
  | 'Qualidade'
  | 'Admin'
  | 'Automação'
  | 'Plataforma'

export type ChangelogEntrada = {
  id: string
  data: string
  titulo: string
  resumo: string
  categorias: ChangelogCategoria[]
  itens: string[]
}

export const CHANGELOG: ChangelogEntrada[] = [
  {
    id: 'paleta-tera',
    data: '2026-08-10',
    titulo: 'Identidade visual da Tera',
    resumo: 'O Vértice passou a usar a paleta padrão da Tera, no lugar das cores próprias.',
    categorias: ['Qualidade'],
    itens: [
      'Paleta da marca aplicada em todo o app, com os tokens de tema centralizados',
      'Ajustes de contraste decorrentes da troca, em claro e escuro',
    ],
  },
  {
    id: 'saas-multi-inquilino',
    data: '2026-08-09',
    titulo: 'O Vértice virou produto: empresas isoladas, planos e assentos',
    resumo:
      'A maior mudança desde a fundação. O sistema deixou de atender uma empresa e passou a atender várias, cada uma isolada da outra, com plano por assento, cadastro público e convite de pessoas.',
    categorias: ['Plataforma', 'Segurança', 'Admin'],
    itens: [
      'Cada empresa é uma conta isolada — apontamentos, quadros, catálogo, relatórios e auditoria não atravessam a fronteira. A separação vale no banco (políticas restritivas por organização e chaves estrangeiras compostas), não na tela',
      'As funções internas que rodam com privilégio elevado passaram a checar a organização explicitamente — antes elas ignoravam as regras de acesso por construção',
      'Assentos: o plano define o teto, e ocupam vaga tanto colaborador ativo quanto convite pendente. O limite é aplicado pelo banco, à prova de dois convites simultâneos',
      'Equipe e acessos (`/gestao/acessos`) — uma tela só para pessoas, assentos e convites. Antes, gerir pessoas ficava no Catálogo e assentos só existiam fora do alcance de quem esbarrava no limite',
      'Convite por e-mail com prazo de validade, revogação e aceite por link; mensagem específica quando o e-mail já tem conta',
      'Ciclo de vida da conta: teste, ativa, suspensa, expirada e em exclusão, com rotina diária que faz a transição. A exclusão definitiva continua sendo ação manual, por ser irreversível',
      'Cadastro público com período de teste, landing do produto e página de preços montada a partir do catálogo de planos',
      'Console do operador da plataforma (`/console`), separado da Área do Gestor: acesso, assentos, cortesia, conferência, encerramento de conta e exportações',
      'Testes de isolamento no `npm test`, incluindo verificação que barra tabela nova sem vínculo de empresa e uso indevido de credencial privilegiada',
    ],
  },
  {
    id: 'plano-global',
    data: '2026-08-03',
    titulo: '20 funcionalidades, PWA completo e faxina de desempenho',
    resumo:
      'Execução do plano global levantado em 02/08 contra o código e o banco de produção: 20 de 20 funcionalidades, 7 de 7 itens de PWA e as correções de banco que os relatórios do Supabase apontavam.',
    categorias: ['Apontamento', 'Kanban', 'Relatórios', 'Notificações', 'Segurança', 'Qualidade'],
    itens: [
      'Apontamento: lançamento em lote, correção retroativa (com guarda de papel — a regra "só hoje" não foi afrouxada) e cronômetro',
      'Kanban: dependências entre cards, modelos de card, anexo por arrastar/colar, histórico de edição de campo, menções @ e busca global ⌘K com visões salvas',
      'Minha Semana — agenda semanal e tarefas atribuídas',
      'Gestão: metas, comparativo entre períodos, relatório agendado parametrizável e painel de capacidade',
      'Integração com o Google Agenda, com os tokens cifrados no banco',
      'Segundo fator por e-mail no login, usando o mesmo envio que já rodava',
      'Notificação push (Web Push), com as chaves geradas pelo próprio sistema',
      'PWA completo: fila offline de apontamentos, instalação, distintivo, splash e compartilhamento por link externo de quadro',
      'Banco: 24 índices de chave estrangeira, consolidação de políticas duplicadas e correção do custo de avaliação em 17 políticas — os três relatórios do Supabase zerados',
      'Segurança: verificação de senha vazada no cadastro, por k-anonimato dentro do próprio app, e revogação de execução pública em 16 funções',
      'Cobertura de teste de 140 para 413 testes, de 9 para 32 módulos',
    ],
  },
  {
    id: 'kanban-avancado',
    data: '2026-07-29',
    titulo: 'Kanban: gestão avançada de cards',
    resumo:
      'O quadro kanban (criado em 23/07) ganhou o conjunto completo de metadados e fluxos de um card — paridade com ferramentas de referência como Runrun.it.',
    categorias: ['Kanban'],
    itens: [
      'Campos novos no card: tipo, subtarefas (cartão com pai setado, herda coluna/responsáveis/etiquetas/comentários), datas desejada vs. real, recorrência, tempo estimado, centro de custo (reaproveita `areas`) e tag de referência avulsa',
      'Seguidores (watchers) — recebem notificação sem serem cobrados pela entrega, distintos dos responsáveis',
      'Checklist simples por card',
      '"Requisitos da etapa" — checklist preso à coluna: todo card que passa por ali vê a mesma lista e marca individualmente o que já cumpriu',
      'Aba "Regras": dependências entre cards (pré-requisito/subsequente) e sequência de responsáveis — quando um entrega, avança pro próximo automaticamente via RPC e notifica',
      'Anexos por card em bucket privado — upload/download só via Server Action com client admin, listagem por signed URL de curta duração (nunca URL pública)',
      'Aprovações por card: quem pede escolhe a quem pedir (`aprovador_id`, um membro do quadro) — RPC única `SECURITY DEFINER` muda status e notifica numa transação só',
      'Aba "Emails": envio avulso a partir do card com log persistido (não é caixa de entrada — só registro de "enviei isso, daqui")',
      'Timer de card: sessões com início/fim, uma sessão aberta por colaborador por vez em qualquer card — sustenta o widget flutuante global no layout autenticado, com Realtime entre abas/dispositivos',
    ],
  },
  {
    id: 'relatorios-export',
    data: '2026-07-27',
    titulo: 'Exportação de relatórios e correções de layout',
    resumo: 'Relatórios ganharam mais formatos de saída e a trilha de auditoria foi ampliada.',
    categorias: ['Relatórios', 'Auditoria'],
    itens: [
      'Export de relatórios em CSV, XLSX e PDF (jsPDF), além do CSV já existente',
      'Logs de auditoria ampliados',
      'Correções de layout em telas diversas',
    ],
  },
  {
    id: 'kanban-fundacao',
    data: '2026-07-23',
    titulo: 'Kanban (fundação), formulários públicos e aprovação transacional',
    resumo: 'Primeira versão do módulo kanban e do construtor de formulários, junto da RPC transacional de aprovação de solicitações.',
    categorias: ['Kanban', 'Formulários', 'Catálogo'],
    itens: [
      '`/kanban` e `/kanban/[quadroId]` — quadros, colunas e cards; gestor cria quadros e vincula colaboradores, colaborador só vê os quadros em que foi vinculado (RLS)',
      'Construtor de formulários com link público (`/formularios/[slug]`) — formulário sem marca d’água opcional, mensagem de sucesso configurável',
      'RPC `aprovar_solicitacao`/`rejeitar_solicitacao` — claim + validação + insert/update em `demandas` + notificação numa única transação (fecha a corrida de dois cliques quase simultâneos processando a mesma solicitação duas vezes)',
    ],
  },
  {
    id: 'plano-confiabilidade',
    data: '2026-07-22',
    titulo: 'Plano de confiabilidade — 16 correções do relatório de conferência',
    resumo:
      'Conferência técnica de 22/07 apontou 16 achados (ver docs/RELATORIO-CONFERENCIA.md); todos corrigidos e aplicados no mesmo dia.',
    categorias: ['Segurança', 'Qualidade', 'Apontamento', 'Automação'],
    itens: [
      'RLS de INSERT em `apontamentos` passou a exigir `data = current_date` (fechava o mesmo vetor que UPDATE/DELETE já tinham corrigido)',
      '`auth_role()` passou a exigir `ativo = true`; `requireUser()` derruba sessão de conta desativada na hora',
      'RPC `registrar_apontamento`/`atualizar_apontamento` (`SECURITY DEFINER`) — motivo, teto de blocos, teto de tempo manual e demanda ativa validados no banco, não só na Server Action; INSERT/UPDATE diretos revogados de `authenticated`',
      'Export CSV/XLSX neutraliza formula injection (`sanitizeFormula`, `lib/csv.ts`)',
      'Idempotência dos 3 crons (`cron_execucoes`, `tentarReservarExecucao`)',
      '`npm audit`: 9 → 5 vulnerabilidades em produção (fast-uri corrigido, `shadcn` movido pra devDependencies) — risco residual documentado em `docs/SEGURANCA.md`',
      'Confirmação (AlertDialog) antes de rejeitar solicitação em `/catalogo`',
      'Progresso cumulativo no formulário de apontamento ("já lançado + este lançamento")',
      'Editar apontamento no mesmo dia (`/apontamento/historico`, RPC `atualizar_apontamento`)',
      'Trilha de auditoria (`auditoria`, `/auditoria`, só gestor) — mudança de colaborador e aprovação/rejeição de solicitação',
      'Import em massa CSV/XLSX de demandas e colaboradores em `/catalogo`',
      'Bloco finito — `demandas.finita`, orçamento global (soma de todos os colaboradores), view `demandas_acumulado`',
      'Testes automatizados (`vitest`) cobrindo `lib/dates.ts`, `lib/demandas.ts::prepararDemanda`, `lib/csv.ts`',
      'PWA — `app/manifest.ts`, `public/sw.js` (cache-first só pra `_next/static`), `viewport.themeColor`',
      'Dashboard `top-demandas`/`top-performers` confirmados corretos (já respeitavam os filtros de período/área)',
    ],
  },
  {
    id: 'aprovacao-notificacoes-perfil',
    data: '2026-07-21',
    titulo: 'Aprovação de demandas, central de notificações e autoatendimento de perfil',
    resumo: 'Colaborador ganhou voz ativa no catálogo e controle sobre a própria conta.',
    categorias: ['Catálogo', 'Notificações', 'Admin'],
    itens: [
      '`solicitacoes_demandas` — colaborador sugere demanda nova/alteração; gestor aprova ou rejeita na aba "Aprovações"/"Minhas Sugestões" de `/catalogo`',
      '`notificacoes` — tabela genérica + sino no layout autenticado (polling a cada 60s), dispara em nova solicitação (pro gestor) e em aprovação/rejeição (pro colaborador); Realtime habilitado',
      '`/areas` e `/colaboradores` viraram abas dentro de `/catalogo`, com drill-down entre abas e filtro de área; rotas antigas mantidas só como `redirect()`',
      '`/perfil` — colaborador edita o próprio nome e troca a própria senha; ganhou foto (bucket `avatars`), seletor de tema (claro/escuro/sistema) e preferências de notificação por tipo, respeitadas pelos 3 crons',
    ],
  },
  {
    id: 'fundacao',
    data: '2026-07-17',
    titulo: 'Fundação do produto: apontamento, dashboard, catálogo e automação por e-mail',
    resumo: 'Primeira entrega funcional — do zero ao MVP completo em um único dia de trabalho.',
    categorias: ['Fundação', 'Apontamento', 'Dashboard', 'Catálogo'],
    itens: [
      'Base do projeto: `create-next-app` (TypeScript, App Router, Tailwind), shadcn/ui, schema Supabase + RLS + seed do catálogo',
      'Auth e-mail/senha sem cadastro público (contas nascem em `/colaboradores`, via service role); proteção de rotas por `role` (`proxy.ts` + `requireGestor()`)',
      '`/apontamento` — tela crítica mobile-first: demanda, quantidade, tempo manual (só pra demanda variável), observações; `/apontamento/historico` com exclusão do dia atual',
      '`/dashboard` — índice por colaborador com farol verde/amarelo/vermelho, filtros de período e área; `/dashboard/[colaborador]` com série histórica (Recharts)',
      '`/catalogo` — CRUD de áreas e demandas; `/colaboradores` — CRUD de equipe; `/relatorios` — export CSV do período selecionado',
      '3 crons Vercel (Resend): lembrete diário de quem não apontou, alerta de queda de índice, relatório semanal por área/colaborador',
    ],
  },
]

export const CATEGORIAS_ORDEM: ChangelogCategoria[] = [
  'Fundação',
  'Apontamento',
  'Dashboard',
  'Catálogo',
  'Kanban',
  'Formulários',
  'Notificações',
  'Relatórios',
  'Auditoria',
  'Segurança',
  'Qualidade',
  'Admin',
  'Automação',
  'Plataforma',
]
