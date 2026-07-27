export const ACAO_LABELS: Record<string, { label: string; categoria: string; variante: 'default' | 'outline' | 'destructive' | 'secondary' }> = {
  'auth.login': { label: 'Login no sistema', categoria: 'Autenticação', variante: 'outline' },
  'colaborador.criar': { label: 'Criou colaborador', categoria: 'Colaboradores', variante: 'default' },
  'colaborador.atualizar': { label: 'Atualizou colaborador', categoria: 'Colaboradores', variante: 'secondary' },
  'colaborador.reset_senha': { label: 'Redefiniu senha de colaborador', categoria: 'Colaboradores', variante: 'outline' },
  'colaborador.importar_csv': { label: 'Importou colaboradores em massa', categoria: 'Colaboradores', variante: 'default' },
  'area.criar': { label: 'Criou área', categoria: 'Catálogo', variante: 'default' },
  'area.atualizar': { label: 'Atualizou área', categoria: 'Catálogo', variante: 'secondary' },
  'demanda.criar': { label: 'Criou demanda', categoria: 'Catálogo', variante: 'default' },
  'demanda.atualizar': { label: 'Atualizou demanda', categoria: 'Catálogo', variante: 'secondary' },
  'demanda.importar_csv': { label: 'Importou demandas em massa', categoria: 'Catálogo', variante: 'default' },
  'solicitacao.criar': { label: 'Sugeriu solicitação de demanda', categoria: 'Catálogo', variante: 'outline' },
  'solicitacao.aprovar': { label: 'Aprovou solicitação', categoria: 'Catálogo', variante: 'default' },
  'solicitacao.rejeitar': { label: 'Rejeitou solicitação', categoria: 'Catálogo', variante: 'destructive' },
  'solicitacao.cancelar': { label: 'Cancelou solicitação', categoria: 'Catálogo', variante: 'outline' },
  'apontamento.criar': { label: 'Registrou apontamento', categoria: 'Apontamentos', variante: 'default' },
  'apontamento.atualizar': { label: 'Atualizou apontamento', categoria: 'Apontamentos', variante: 'secondary' },
  'apontamento.excluir': { label: 'Excluiu apontamento', categoria: 'Apontamentos', variante: 'destructive' },
  'kanban.quadro_criar': { label: 'Criou quadro Kanban', categoria: 'Kanban', variante: 'default' },
  'kanban.quadro_atualizar': { label: 'Atualizou quadro Kanban', categoria: 'Kanban', variante: 'secondary' },
  'kanban.quadro_arquivar': { label: 'Arquivou/Desarquivou quadro', categoria: 'Kanban', variante: 'outline' },
  'kanban.formulario_criar': { label: 'Criou formulário público', categoria: 'Kanban', variante: 'default' },
  'kanban.formulario_excluir': { label: 'Excluiu formulário público', categoria: 'Kanban', variante: 'destructive' },
  'perfil.atualizar_nome': { label: 'Atualizou o próprio nome', categoria: 'Perfil', variante: 'secondary' },
  'perfil.atualizar_avatar': { label: 'Atualizou o próprio avatar', categoria: 'Perfil', variante: 'secondary' },
  'perfil.atualizar_senha': { label: 'Atualizou a própria senha', categoria: 'Perfil', variante: 'outline' },
}

export type NovoEvento = {
  atorId: string
  acao: string
  entidade: string
  entidadeId?: string
  antes?: unknown
  depois?: unknown
}
