export const ACAO_LABELS: Record<string, { label: string; categoria: string; variante: 'default' | 'outline' | 'destructive' | 'secondary' }> = {
  'auth.login': { label: 'Login no sistema', categoria: 'Autenticação', variante: 'outline' },
  'colaborador.criar': { label: 'Criou colaborador', categoria: 'Colaboradores', variante: 'default' },
  'colaborador.atualizar': { label: 'Atualizou colaborador', categoria: 'Colaboradores', variante: 'secondary' },
  'colaborador.reset_senha': { label: 'Redefiniu senha de colaborador', categoria: 'Colaboradores', variante: 'outline' },
  'colaborador.importar_csv': { label: 'Importou colaboradores em massa', categoria: 'Colaboradores', variante: 'default' },
  // Exclusão definitiva: apaga a conta de acesso e arquiva os apontamentos.
  // Não tem desfazer, e é o único evento da trilha cujo alvo deixa de existir
  // — por isso o nome da pessoa vai em dados_antes.
  'colaborador.excluir': { label: 'Excluiu colaborador definitivamente', categoria: 'Colaboradores', variante: 'destructive' },
  'area.criar': { label: 'Criou área', categoria: 'Catálogo', variante: 'default' },
  'area.atualizar': { label: 'Atualizou área', categoria: 'Catálogo', variante: 'secondary' },
  'demanda.criar': { label: 'Criou demanda', categoria: 'Catálogo', variante: 'default' },
  'demanda.atualizar': { label: 'Atualizou demanda', categoria: 'Catálogo', variante: 'secondary' },
  'demanda.importar_csv': { label: 'Importou demandas em massa', categoria: 'Catálogo', variante: 'default' },
  'demanda.excluir': { label: 'Excluiu demanda definitivamente', categoria: 'Catálogo', variante: 'destructive' },
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
  'kanban.webhook_criar': { label: 'Gerou webhook de formulário', categoria: 'Kanban', variante: 'default' },
  'kanban.webhook_revogar': { label: 'Revogou webhook de formulário', categoria: 'Kanban', variante: 'destructive' },
  // Concessão de privilégio é o evento mais sensível da trilha — destructive
  // para saltar aos olhos numa varredura da /auditoria.
  'admin.conceder': { label: 'Concedeu acesso de admin', categoria: 'Administração', variante: 'destructive' },
  'admin.revogar': { label: 'Revogou acesso de admin', categoria: 'Administração', variante: 'destructive' },
  'admin.entrou_quadro': { label: 'Admin entrou em quadro', categoria: 'Administração', variante: 'outline' },
  // Ator vem do console do operador (a Tera), não do admin da empresa — por
  // isso aparece na auditoria da organização afetada, não na de quem agiu.
  'operador.organizacao_status': { label: 'Operador mudou status da organização', categoria: 'Plataforma', variante: 'destructive' },
  'organizacao.atualizar_nome': { label: 'Alterou o nome da empresa', categoria: 'Organização', variante: 'secondary' },
  // Transferir a propriedade é o evento mais sensível do domínio: quem
  // transfere perde, na mesma operação, o poder de desfazer sozinho. Mesmo
  // critério de admin.conceder — destructive para saltar aos olhos.
  'organizacao.transferir_propriedade': { label: 'Transferiu a propriedade da empresa', categoria: 'Organização', variante: 'destructive' },
  'perfil.atualizar_nome': { label: 'Atualizou o próprio nome', categoria: 'Perfil', variante: 'secondary' },
  'perfil.atualizar_avatar': { label: 'Atualizou o próprio avatar', categoria: 'Perfil', variante: 'secondary' },
  'perfil.atualizar_senha': { label: 'Atualizou a própria senha', categoria: 'Perfil', variante: 'outline' },
  // Registra o PEDIDO, não a troca: neste ponto o endereço ainda não mudou —
  // ele só muda quando o link de confirmação é aberto.
  'perfil.solicitar_troca_email': { label: 'Pediu troca do próprio e-mail', categoria: 'Perfil', variante: 'outline' },
}

export type NovoEvento = {
  atorId: string
  acao: string
  entidade: string
  entidadeId?: string
  antes?: unknown
  depois?: unknown
}
