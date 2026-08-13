// Levantado de `select tablename from pg_tables where schemaname='public'`
// em 08/08/2026, contra o projeto bapufbypqmtjtujfbiai. Reconfira antes de
// fechar a Fase 0 de verdade — ver README.md desta pasta.
export const TABELAS_DE_NEGOCIO = [
  'apontamentos',
  'apontamentos_arquivados',
  'apontamentos_correcoes',
  'areas',
  'auditoria',
  'automacoes',
  'automacoes_acoes',
  'automacoes_execucoes',
  'cartoes',
  'cartoes_anexos',
  'cartoes_aprovacoes',
  'cartoes_campos_valores',
  'cartoes_checklist_itens',
  'cartoes_dependencias',
  'cartoes_emails',
  'cartoes_etiquetas',
  'cartoes_predecessores',
  'cartoes_requisitos_status',
  'cartoes_responsaveis',
  'cartoes_seguidores',
  'cartoes_sequencia_responsaveis',
  'cartoes_sessoes_tempo',
  'cartoes_templates',
  'colaboradores',
  'colunas',
  'colunas_requisitos',
  'comentarios_cartao',
  'demandas',
  'desafios_mfa',
  'etiquetas',
  'formularios',
  'formularios_campos',
  'google_calendar_eventos',
  'google_workspace_conexoes',
  'metas',
  'notificacoes',
  'push_inscricoes',
  'quadros',
  'quadros_campos',
  'quadros_compartilhamentos',
  'quadros_membros',
  'relatorios_agendados',
  'relatorios_agendados_destinatarios',
  'solicitacoes_demandas',
] as const

// Fora do eixo, de propósito — ver vertice-isolamento (skill) §"Fora do eixo".
// cron_execucoes ENTRA no eixo (ganha organizacao_id) apesar de global hoje:
// sem isso a idempotência por (tipo, chave) vaza entre organizações.
// operadores_acoes tem uma coluna organizacao_id, mas ela é o ALVO da ação do
// operador, não o eixo de isolamento — a tabela é da plataforma, não de
// inquilino, e por isso é anulável e sem política (só service role).
export const FORA_DO_EIXO = [
  'config_push',
  'planos',
  'operadores',
  'operadores_acoes',
  'organizacoes',
] as const

// As que recebem id (não gatilho/helper sem argumento) — as que importam
// para o teste de bypass de RLS via SECURITY DEFINER.
export const RPCS_SECURITY_DEFINER_COM_ID = [
  { nome: 'aprovar_cartao', args: { p_id: 'uuid' } },
  { nome: 'aprovar_correcao_apontamento', args: { p_id: 'uuid' } },
  { nome: 'aprovar_solicitacao', args: { p_id: 'uuid' } },
  {
    nome: 'atualizar_apontamento',
    args: {
      p_id: 'uuid',
      p_demanda_id: 'uuid',
      p_quantidade: 'numeric',
      p_tempo_manual_min: 'integer',
      p_motivo: 'text',
      p_observacoes: 'text',
    },
  },
  { nome: 'avancar_sequencia_cartao', args: { p_cartao_id: 'uuid' } },
  { nome: 'definir_admin', args: { p_colaborador_id: 'uuid', p_admin: 'boolean' } },
  {
    nome: 'registrar_apontamento_timer',
    args: { p_sessao_id: 'uuid', p_data: 'date', p_minutos: 'integer' },
  },
  { nome: 'rejeitar_cartao', args: { p_id: 'uuid', p_comentario: 'text' } },
  { nome: 'rejeitar_correcao_apontamento', args: { p_id: 'uuid', p_motivo: 'text' } },
  { nome: 'rejeitar_solicitacao', args: { p_id: 'uuid' } },
  {
    nome: 'solicitar_aprovacao_cartao',
    args: { p_cartao_id: 'uuid', p_aprovador_id: 'uuid' },
  },
  {
    nome: 'registrar_apontamento',
    args: {
      p_demanda_id: 'uuid',
      p_quantidade: 'numeric',
      p_tempo_manual_min: 'integer',
      p_motivo: 'text',
      p_observacoes: 'text',
    },
  },
] as const
