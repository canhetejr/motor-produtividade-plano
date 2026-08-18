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
// PR, com `versao` semântica e `publico` (`equipe` ou `gestao`): este arquivo
// é o que a pessoa lê em /documentacao, e ele já ficou doze dias atrás do
// produto uma vez. `VERSAO_ATUAL` vem sempre da primeira entrada.

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
  // 'Organização' e 'Conta' nasceram com a leva de agosto/2026 (dono da
  // empresa, troca de e-mail, separação Perfil/Configurações). Sem elas essas
  // entradas cairiam em 'Admin' ou 'Plataforma', que descrevem mal o que
  // mudou: nenhuma delas é infraestrutura nem poder de administrador.
  | 'Organização'
  | 'Conta'

export type ChangelogPublico = 'equipe' | 'gestao'

export type ChangelogEntrada = {
  id: string
  /** Toda entrega publicada precisa declarar uma versão semântica. */
  versao: string
  /** `gestao` é exibido somente para gestor/admin; `equipe`, para todos. */
  publico: ChangelogPublico
  data: string
  titulo: string
  resumo: string
  categorias: ChangelogCategoria[]
  itens: string[]
}

export const CHANGELOG: ChangelogEntrada[] = [
  {
    id: 'versionamento-semver-beta',
    versao: '0.26.2',
    publico: 'equipe',
    data: '2026-08-18',
    titulo: 'A numeração de versão passou a seguir o padrão de pré-lançamento',
    resumo:
      'A versão exibida na Central de ajuda usava 1.x/2.x, o que não condiz com semver: nada abaixo de 1.0.0 é considerado estável, e é isso que "beta" comunica. Todo o histórico foi renumerado para a faixa 0.x.',
    categorias: ['Plataforma'],
    itens: [
      'Toda versão publicada até aqui foi renumerada para 0.x.y — o antigo major.minor virou o novo minor (ex.: 2.6.1 → 0.26.1), preservando a ordem cronológica das entregas',
      'O Vértice chega a 1.0.0 quando o produto for considerado estável para saída da fase beta',
    ],
  },
  {
    id: 'identificacao-beta',
    versao: '0.26.1',
    publico: 'equipe',
    data: '2026-08-18',
    titulo: 'O Vértice está em beta',
    resumo: 'A Central de ajuda agora identifica corretamente o estágio atual do produto.',
    categorias: ['Plataforma'],
    itens: [
      'A versão atual passa a aparecer como Beta na Central de ajuda',
      'O estágio de release é definido em um único lugar, junto da versão publicada',
    ],
  },
  {
    id: 'changelog-por-publico-e-versao',
    versao: '0.26.0',
    publico: 'equipe',
    data: '2026-08-18',
    titulo: 'Novidades ficaram mais fáceis de acompanhar',
    resumo:
      'O histórico agora mostra versões de release e separa as mudanças da equipe das informações de gestão.',
    categorias: ['Qualidade', 'Admin'],
    itens: [
      'Cada novidade mostra a versão em que foi publicada, e a Central de ajuda exibe automaticamente a versão mais recente',
      'Colaboradores veem somente as mudanças que afetam o uso do Vértice no dia a dia',
      'Gestores e administradores têm uma visão adicional para mudanças de gestão, operação e administração',
    ],
  },
  {
    id: 'operacao-coolify-e-crons',
    versao: '0.25.0',
    publico: 'gestao',
    data: '2026-08-18',
    titulo: 'O Vértice passou a operar integralmente no Coolify',
    resumo:
      'Produção e desenvolvimento agora têm deploys independentes, e as rotinas automáticas voltaram a executar pelo agendador da própria plataforma.',
    categorias: ['Plataforma', 'Automação'],
    itens: [
      'Produção roda em vertice.teralabs.cloud a partir da branch main; desenvolvimento roda em dev.vertice.teralabs.cloud a partir de develop',
      'As sete rotinas automáticas passaram para o Coolify, incluindo a checagem horária de atraso e SLA das automações do Kanban e o encerramento de períodos de teste',
      'O console de operação passa a acompanhar as execuções reais das sete rotinas; todas foram verificadas depois da migração',
      'A Vercel deixou de participar do deploy e dos agendamentos do Vértice, eliminando checks de deploy em pull requests',
    ],
  },
  {
    id: 'convite-sem-senha-e-exclusao-definitiva',
    versao: '0.24.0',
    publico: 'equipe',
    data: '2026-08-13',
    titulo: 'Entrar ficou mais curto, e sair ficou possível',
    resumo:
      'Quem é convidado só informa o nome. Demanda e colaborador que não servem mais podem ser excluídos de vez, sem apagar o trabalho já lançado.',
    categorias: ['Conta', 'Catálogo', 'Organização'],
    itens: [
      'Convite: o formulário pede só o nome. A pessoa entra na hora e escolhe a senha na primeira tela, em vez de criar uma senha antes de provar que é ela',
      'Nova tela de primeiros passos, em /setup: gestor e colaborador conectam a própria conta Google (Calendar e Drive) ao entrar pela primeira vez, e podem pular para depois',
      'Demanda pode ser excluída definitivamente, em vez de acumular linha inativa no catálogo',
      'Colaborador pode ser excluído definitivamente por um admin — cadastro e acesso somem juntos. O dono da empresa e o último admin continuam protegidos',
      'Os apontamentos das exclusões vão para Gestão › Arquivo, com nome de pessoa, demanda e área congelados. Eles saem do índice e dos relatórios, mas continuam consultáveis',
      'Comentários, anexos, quadros e a trilha de auditoria de quem foi excluído continuam onde estavam, com o nome de quem escreveu preservado em texto',
    ],
  },
  {
    id: 'minha-semana-hub',
    versao: '0.23.0',
    publico: 'equipe',
    data: '2026-08-12',
    titulo: 'Minha semana virou a tela do dia',
    resumo:
      'Lançar o trabalho e ver o que vence eram duas telas separadas, e nenhuma sozinha bastava para começar o dia. Agora são uma.',
    categorias: ['Apontamento'],
    itens: [
      'O lançamento diário passou a ser o topo de Minha semana, com o modo em lote no mesmo lugar',
      'Minha semana é o destino ao entrar no sistema, o que o link do lembrete diário abre e o que o app instalado no celular abre',
      'Histórico continua tela própria: é onde se edita e exclui lançamento, e é outra tarefa',
      'Links antigos para Novo apontamento continuam funcionando — eles levam para cá',
      'Novo: pedir lançamento de um dia anterior. Você explica por que não lançou no dia, e um gestor aprova ou recusa. A regra de só lançar no próprio dia continua valendo — a aprovação é o que cria o lançamento retroativo',
    ],
  },
  {
    id: 'perfil-e-configuracoes',
    versao: '0.23.0',
    publico: 'equipe',
    data: '2026-08-12',
    titulo: 'Perfil e Configurações viraram duas telas',
    resumo:
      'O Perfil acumulava identidade, preferências e integrações numa página só. Agora cada coisa tem seu lugar.',
    categorias: ['Conta'],
    itens: [
      'Perfil: seus dados, seu e-mail de acesso, senha, verificação em duas etapas e tokens de API',
      'Configurações (novo item no menu Conta): aparência, notificações, notificações no celular, Google Workspace e calendário .ics',
      'Nada foi perdido, só realocado — e as duas telas apontam uma para a outra',
    ],
  },
  {
    id: 'quadros-arquivados',
    versao: '0.23.0',
    publico: 'gestao',
    data: '2026-08-12',
    titulo: 'Quadros arquivados ganharam lugar próprio',
    resumo:
      'A lista de quadros passou a mostrar só os quadros em uso. Os arquivados moraram para uma tela dedicada.',
    categorias: ['Kanban'],
    itens: [
      'Quadros mostra apenas os ativos — antes os arquivados ficavam na mesma grade, só apagados, empurrando os ativos para baixo',
      'Nova tela Quadros → Arquivados, para gestores, com o botão de desarquivar em cada um',
      'Desarquivar devolve o quadro à lista principal com tudo o que havia nele',
    ],
  },
  {
    id: 'exportar-demandas',
    versao: '0.23.0',
    publico: 'gestao',
    data: '2026-08-12',
    titulo: 'Exportar o catálogo de demandas em CSV',
    resumo: 'O catálogo já podia ser importado em massa; agora também sai em planilha.',
    categorias: ['Catálogo', 'Relatórios'],
    itens: [
      'Botão "Exportar CSV" na aba Demandas do Catálogo, para gestores',
      'Traz nome, área, tempo padrão, se é variável, blocos totais, se é finita e se está ativa',
      'Abre com acentuação correta no Excel e no Google Sheets, e nome de demanda que começa com sinal de igual não é interpretado como fórmula',
    ],
  },
  {
    id: 'campos-com-icone',
    versao: '0.23.0',
    publico: 'equipe',
    data: '2026-08-12',
    titulo: 'Campos de formulário voltaram a respeitar o ícone',
    resumo:
      'No computador, o texto digitado caía em cima do ícone dos campos — no login, no cadastro, no aceite de convite e em toda busca do sistema.',
    categorias: ['Qualidade'],
    itens: [
      'Corrigido o espaço reservado ao ícone dentro do campo: o texto começa depois dele, em qualquer tamanho de tela',
      'Campos das telas de entrada voltaram à altura projetada no computador — estavam achatados para menos de dois terços do tamanho',
      'A causa era única e afetava 13 telas ao mesmo tempo; a correção foi feita no componente de campo, não tela por tela',
    ],
  },
  {
    id: 'troca-de-email',
    versao: '0.23.0',
    publico: 'equipe',
    data: '2026-08-12',
    titulo: 'Trocar o próprio e-mail de acesso',
    resumo:
      'Quem muda de endereço não depende mais do gestor: dá para pedir a troca no próprio perfil, com confirmação por link.',
    categorias: ['Conta', 'Segurança'],
    itens: [
      'Novo bloco "E-mail de acesso" no Perfil, com o endereço atual e o botão de troca',
      'A troca só vale depois que o link enviado é aberto — até lá você continua entrando com o endereço antigo, e a sessão atual nunca cai',
      'Enquanto o pedido está pendente, o perfil mostra qual endereço está esperando confirmação. Pedir de novo substitui o pedido anterior',
      'Mensagem específica quando o e-mail já pertence a outra conta do Vértice, inclusive de outra empresa',
      'O pedido fica registrado na auditoria (o pedido, não a troca — elas acontecem em momentos diferentes)',
    ],
  },
  {
    id: 'dono-da-empresa',
    versao: '0.23.0',
    publico: 'gestao',
    data: '2026-08-12',
    titulo: 'A empresa passou a ter dono',
    resumo:
      'Toda empresa no Vértice agora tem uma pessoa que responde por ela — a única que edita o nome da empresa e que pode passar essa responsabilidade adiante.',
    categorias: ['Organização', 'Segurança'],
    itens: [
      'Nova aba Empresa em Área do Gestor → Sistema: nome da empresa e dono atual, visíveis para qualquer admin',
      'Só o dono edita o nome da empresa. O nome aparece no cabeçalho, nos convites e nos e-mails automáticos',
      'Transferência de propriedade para outro gestor da mesma empresa, com confirmação. Quem recebe vira admin automaticamente; quem transfere continua admin, então nada fica sem responsável',
      'O dono não pode ser desativado nem perder o acesso de admin sem que a propriedade seja transferida antes — a trava é do banco, não da tela',
      'As duas ações ficam registradas na auditoria da empresa, com quem fez e quando',
    ],
  },
  {
    id: 'paleta-tera',
    versao: '0.22.0',
    publico: 'equipe',
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
    versao: '0.21.0',
    publico: 'equipe',
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
    versao: '0.20.0',
    publico: 'equipe',
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
    versao: '0.19.0',
    publico: 'equipe',
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
    versao: '0.18.0',
    publico: 'gestao',
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
    versao: '0.17.0',
    publico: 'equipe',
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
    versao: '0.16.0',
    publico: 'equipe',
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
    versao: '0.15.0',
    publico: 'equipe',
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
    versao: '0.10.0',
    publico: 'equipe',
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

export const VERSAO_ATUAL = CHANGELOG[0].versao
export const ESTAGIO_ATUAL = 'Beta'

/**
 * A página do servidor usa este filtro antes de entregar dados ao navegador.
 * Assim, o bundle de um colaborador nunca recebe as entradas de gestão.
 */
export function entradasDoChangelog(publico: ChangelogPublico): ChangelogEntrada[] {
  return publico === 'gestao' ? CHANGELOG : CHANGELOG.filter((entrada) => entrada.publico === 'equipe')
}

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
  'Organização',
  'Conta',
]
