// Conteúdo do guia do sistema (/documentacao). Escrito à mão e mantido junto
// com as features: quando um comportamento mudar, o tópico correspondente
// muda no mesmo PR — documentação que mente é pior que nenhuma.
//
// A estrutura é achatada de propósito (seção → tópicos de texto corrido) pra
// busca varrer tudo com um `includes` só, igual ao CHANGELOG.

export type SecaoDocumentacao = {
  id: string
  titulo: string
  /** Nome do ícone do lucide-react — resolvido no viewer. */
  icone: 'Compass' | 'Clock' | 'FolderKanban' | 'Kanban' | 'CreditCard' | 'Flag' | 'Timer' | 'Zap' | 'FileText' | 'Bell' | 'FileSpreadsheet' | 'ShieldCheck'
  resumo: string
  topicos: { titulo: string; texto: string }[]
}

export const DOCUMENTACAO: SecaoDocumentacao[] = [
  {
    id: 'visao-geral',
    titulo: 'Visão geral',
    icone: 'Compass',
    resumo: 'O que é o Vértice e como as partes se conectam.',
    topicos: [
      {
        titulo: 'Um número só de produtividade',
        texto:
          'O Vértice mede produtividade pelo índice diário: tempo entregue dividido pela carga horária de cada pessoa. Todo trabalho registrado — apontamento manual ou cronômetro de card do Kanban — desemboca no mesmo lugar (apontamentos) e alimenta o mesmo índice, o dashboard, os relatórios e os alertas automáticos.',
      },
      {
        titulo: 'Dois jeitos de registrar, um destino',
        texto:
          'Em "Novo Apontamento" você lança trabalho do catálogo manualmente (reunião, treinamento e afins entram pela demanda variável "Outros", com motivo). No Kanban, o cronômetro do card registra sozinho: ao pausar, o tempo vira apontamento na demanda vinculada ao card. Não é preciso lançar duas vezes o mesmo trabalho — e não se deve, porque contaria em dobro.',
      },
      {
        titulo: 'Papéis',
        texto:
          'Colaborador: aponta, usa os quadros em que foi vinculado, sugere demandas novas. Gestor: tudo isso mais dashboard, relatórios, auditoria, cadastro de colaboradores/áreas/demandas, criação de quadros, campos customizados, automações e configuração de etapas.',
      },
    ],
  },
  {
    id: 'apontamentos',
    titulo: 'Apontamentos e índice',
    icone: 'Clock',
    resumo: 'Como o índice diário é calculado e as regras de lançamento.',
    topicos: [
      {
        titulo: 'Cálculo do índice',
        texto:
          'Índice = tempo entregue no dia ÷ carga horária. Demanda comum vale o tempo padrão × quantidade; demanda em blocos divide o tempo padrão pelo total de blocos; demanda variável usa o tempo digitado. Os valores da demanda são congelados no instante do lançamento (snapshot) — editar o catálogo depois não reescreve o histórico.',
      },
      {
        titulo: 'Só se lança hoje',
        texto:
          'Apontamento manual só entra na data atual, e edição/exclusão também só valem para lançamentos do dia. A exceção é o tempo vindo do cronômetro do Kanban, que tem horários reais de início e fim: ele é lançado no dia em que o trabalho de fato aconteceu, mesmo que a sessão cruze a meia-noite.',
      },
      {
        titulo: '"Outros" tem teto e motivo',
        texto:
          'Lançamento em demanda variável exige um motivo da lista (Reunião, Treinamento, Suporte a colega, Retrabalho, Imprevisto, Outro — este último pede observação) e não pode passar da sua carga horária diária. Acima de 50% da carga, o gestor recebe um aviso automático.',
      },
      {
        titulo: 'Blocos e demanda finita',
        texto:
          'Demanda dividida em blocos limita a quantidade por lançamento ao total de blocos. Demanda finita tem orçamento global: quando a soma de todos os lançamentos atinge o total, ela para de aceitar tempo.',
      },
    ],
  },
  {
    id: 'catalogo',
    titulo: 'Catálogo',
    icone: 'FolderKanban',
    resumo: 'Áreas, demandas e o fluxo de sugestão com aprovação.',
    topicos: [
      {
        titulo: 'Estrutura',
        texto:
          'Áreas agrupam demandas; cada colaborador pertence a uma área. Demanda define como o tempo é contado (padrão, em blocos, finita ou variável). Área e demanda podem ser inativadas — somem dos seletores sem perder o histórico.',
      },
      {
        titulo: 'Sugestões',
        texto:
          'Colaborador pode sugerir demanda nova ou alteração numa existente. A sugestão fica pendente até um gestor aprovar ou rejeitar; enquanto pendente, o próprio autor pode cancelá-la. Aprovação e rejeição notificam o autor.',
      },
    ],
  },
  {
    id: 'kanban',
    titulo: 'Kanban — quadros',
    icone: 'Kanban',
    resumo: 'Quadros, membros, colunas e visualizações.',
    topicos: [
      {
        titulo: 'Quadros e membros',
        texto:
          'Gestor cria o quadro (nome + código curto que prefixa os cards, ex.: UX-12) e vincula colaboradores. Quem não é membro não vê o quadro. Tudo é ao vivo: mover, criar e editar aparecem para os outros membros sem recarregar.',
      },
      {
        titulo: 'Colunas (etapas)',
        texto:
          'Arraste pela alça para reordenar. A engrenagem do cabeçalho (gestor) configura: Etapa final — card que chega é marcado como entregue, sair de lá reabre; Limite de WIP — bloqueia mover mais cards para a coluna quando cheia; SLA em horas — alimenta os eventos de prazo das automações e o aviso "SLA estourado" no card.',
      },
      {
        titulo: 'Visualizações',
        texto:
          'Kanban (colunas), Lista (tabela na mesma ordem do quadro), Calendário (por prazo) e Formulários. Busca e filtros de prioridade/responsável valem para as três primeiras.',
      },
    ],
  },
  {
    id: 'card',
    titulo: 'Kanban — o card',
    icone: 'CreditCard',
    resumo: 'Tudo que vive dentro de um card.',
    topicos: [
      {
        titulo: 'Abas',
        texto:
          'Descrição, Requisitos da etapa (checklist da coluna, compartilhado por todo card que passa por ela), Comentários (com histórico de sistema separado), Emails (envio avulso com registro), Anexos, Subtarefas e Regras (dependências e sequência de responsáveis).',
      },
      {
        titulo: 'Demanda do card',
        texto:
          'O campo Demanda liga o card ao catálogo — é ele que faz o tempo cronometrado contar no índice. Card sem demanda cronometra normalmente, mas mostra um aviso âmbar e o tempo não vira apontamento. Subtarefas herdam a demanda do pai ao serem criadas.',
      },
      {
        titulo: 'Campos customizados',
        texto:
          'Gestor define campos por quadro (texto, número, data, seleção, pessoa, sim/não, link) no botão "Campos". Aparecem na lateral de todo card do quadro, salvam sozinhos e podem ser lidos e alterados pelas automações.',
      },
      {
        titulo: 'Subtarefas e dependências',
        texto:
          'Subtarefa é um card de verdade com pai — tem etapa, responsáveis e tempo próprios. Pré-requisito trava: card com dependência não entregue não sai da etapa. A sequência de responsáveis organiza a passagem de bastão, notificando o próximo a cada "Avançar".',
      },
      {
        titulo: 'Aprovações',
        texto:
          'Qualquer membro pede aprovação escolhendo o aprovador. Só o aprovador decide, com motivo opcional na rejeição. O status aparece em banner no card e como badge no quadro; depois de decidida, uma nova rodada pode ser aberta.',
      },
    ],
  },
  {
    id: 'entrega',
    titulo: 'Entrega e regras de movimentação',
    icone: 'Flag',
    resumo: 'O que impede um card de andar e o que significa entregar.',
    topicos: [
      {
        titulo: 'Entregar',
        texto:
          'Card é entregue ao entrar numa coluna marcada como etapa final — arrastando, pelo menu "Entregar card" ou por automação, tanto faz. Sair da etapa final reabre. A data de entrega no card é derivada disso, não editável.',
      },
      {
        titulo: 'O que bloqueia a movimentação',
        texto:
          'Três regras valem no banco (nem automação escapa): pré-requisito não entregue impede o card de sair da etapa; requisito obrigatório da etapa em aberto idem; coluna de destino com WIP cheio recusa a entrada. A mensagem de erro diz exatamente o que falta.',
      },
      {
        titulo: 'Recorrência',
        texto:
          'Card com repetição (diária/semanal/mensal) é recriado na primeira etapa do quadro após ser entregue, na data agendada, por uma rotina diária. Reabrir o card cancela a próxima recorrência.',
      },
    ],
  },
  {
    id: 'tempo',
    titulo: 'Cronômetro e tempo',
    icone: 'Timer',
    resumo: 'Como o timer funciona e vira índice.',
    topicos: [
      {
        titulo: 'Uma sessão por vez',
        texto:
          'Só existe um cronômetro rodando por pessoa em todo o sistema. Iniciar em outro card pausa o anterior automaticamente. O widget flutuante no canto mostra a sessão aberta em qualquer tela e sincroniza entre abas.',
      },
      {
        titulo: 'Pause = apontamento',
        texto:
          'Ao pausar, a sessão vira apontamento na demanda do card, no dia em que o trabalho aconteceu (sessão que cruza a meia-noite é repartida entre os dias). Sessão maior que a carga horária diária NÃO é lançada — cronômetro esquecido não infla o índice; lance o tempo real por "Ajustar horas".',
      },
      {
        titulo: 'Histórico e correção',
        texto:
          '"Ajustar horas registradas" soma tempo declarado (também vira apontamento). O histórico de lançamentos do card lista cada sessão; excluir uma sessão remove junto os apontamentos que ela gerou. Cliques acidentais de menos de um segundo são descartados.',
      },
      {
        titulo: 'Tempo do card',
        texto:
          'O bloco de tempo mostra três medidas: nesta tarefa, nas subtarefas e total, além do progresso contra a estimativa. "Nesta etapa há X" mostra há quanto tempo o card está na coluna atual e avisa quando o SLA estoura.',
      },
    ],
  },
  {
    id: 'automacoes',
    titulo: 'Automações',
    icone: 'Zap',
    resumo: 'Quando X acontecer, faça Y — sem intervenção manual.',
    topicos: [
      {
        titulo: 'Como montar',
        texto:
          'Botão "Automações" no quadro → Nova automação. Escolha o evento (Quando) e uma lista ordenada de ações (Então), que rodam de cima para baixo e param no primeiro erro. Cada automação tem liga/desliga, duplicar (nasce desligada) e a lista pode ser filtrada por status.',
      },
      {
        titulo: 'Eventos',
        texto:
          'Movimentação (entrar/sair de etapa, subtarefa entregue), play do cronômetro, aprovação (solicitada/aprovada/reprovada), tags (adicionada/removida) e os de tempo: tarefa atrasar, perto de atrasar, SLA da etapa estourado ou perto de estourar. Os de tempo são avaliados por uma rotina periódica, não no instante exato — e disparam uma vez só por card enquanto a condição durar.',
      },
      {
        titulo: 'Ações',
        texto:
          'Criar tarefa/subtarefa, mover de etapa, solicitar aprovação, marcar/desmarcar urgente (prioridade alta/média), adicionar/remover alocado ou seguidor, enviar e-mail e alterar campo — fixo ou customizado.',
      },
      {
        titulo: 'Proteções',
        texto:
          'Automação que move card encadeia outras, mas o encadeamento corta em 3 níveis para nunca virar laço infinito — o corte fica registrado com badge próprio. As regras de movimentação (pré-requisito, requisito, WIP) valem para automações também: se o banco recusar, a automação registra erro e para.',
      },
    ],
  },
  {
    id: 'formularios',
    titulo: 'Formulários públicos',
    icone: 'FileText',
    resumo: 'Link externo que cria card sem login.',
    topicos: [
      {
        titulo: 'Como funciona',
        texto:
          'Na aba Formulários do quadro, monte um formulário com campos próprios (texto, seleção, data, prioridade) mapeados para o card, escolha a coluna de destino e compartilhe o link público. Cada envio vira um card naquela coluna — sem o visitante precisar de conta. O formulário pode ser desativado a qualquer momento sem apagar o histórico.',
      },
    ],
  },
  {
    id: 'notificacoes',
    titulo: 'Notificações',
    icone: 'Bell',
    resumo: 'Sino, e-mails automáticos e preferências.',
    topicos: [
      {
        titulo: 'In-app (sino)',
        texto:
          'Chegam em tempo real: virou responsável por card, comentário em card que você segue, aprovação solicitada/decidida, sua vez na sequência de responsáveis, sugestão de demanda decidida. Toda notificação leva direto para a tela certa.',
      },
      {
        titulo: 'E-mails automáticos',
        texto:
          'Lembrete diário de apontamento (fim da tarde, dias úteis), alerta de queda de índice para gestores (abaixo de 70% em dois dias úteis seguidos) e relatório semanal consolidado (segunda de manhã). Cada pessoa liga/desliga os seus no Perfil.',
      },
    ],
  },
  {
    id: 'relatorios',
    titulo: 'Relatórios e exportação',
    icone: 'FileSpreadsheet',
    resumo: 'CSV, XLSX e PDF por período e área.',
    topicos: [
      {
        titulo: 'Exportar',
        texto:
          'Em /relatorios (gestor), escolha o período — com atalhos de hoje a 90 dias — e a área, e exporte em CSV, XLSX ou PDF. O PDF é gerado no navegador com o layout da marca; os valores exportados usam o mesmo snapshot dos apontamentos, então batem com o dashboard.',
      },
    ],
  },
  {
    id: 'seguranca',
    titulo: 'Segurança e auditoria',
    icone: 'ShieldCheck',
    resumo: 'O que o sistema garante por baixo.',
    topicos: [
      {
        titulo: 'Regras no banco, não só na tela',
        texto:
          'As travas importantes (só lançar hoje, teto de blocos, regras de movimentação do Kanban, quem aprova o quê) valem no banco de dados — contornar a interface não as contorna. Conta desativada perde acesso imediatamente.',
      },
      {
        titulo: 'Trilha de auditoria',
        texto:
          'Ações administrativas (cadastros, aprovações de demanda, quadros) ficam registradas em /auditoria com autor, data e o que mudou. Ações de sistema dentro do card (mover, entregar, aprovar, ajustar horas) viram entradas no histórico de comentários do próprio card.',
      },
    ],
  },
]
