// Mapeia os códigos que registrar_apontamento()/atualizar_apontamento() (RPC,
// banco) levantam via RAISE EXCEPTION de volta pra mensagem amigável.
// Compartilhado entre app/(app)/apontamento/actions.ts (criar) e
// app/(app)/apontamento/historico/actions.ts (editar) — mesmas regras nos
// dois RPCs.
export const ERROS_RPC_APONTAMENTO: Record<string, string> = {
  CONTA_INATIVA: 'Sua conta está desativada. Fale com o gestor.',
  QUANTIDADE_INVALIDA: 'Quantidade deve ser maior que zero.',
  DEMANDA_INATIVA: 'Demanda não encontrada ou inativa.',
  TEMPO_OBRIGATORIO: 'Informe o tempo gasto.',
  TEMPO_EXCEDE_CARGA: 'Tempo não pode passar da sua carga horária do dia.',
  MOTIVO_INVALIDO: 'Selecione o motivo do lançamento.',
  OBSERVACAO_OBRIGATORIA: 'Descreva o motivo nas observações.',
  DEMANDA_SEM_TEMPO_PADRAO:
    'Esta demanda ainda não tem tempo padrão definido. Peça ao gestor para configurá-la antes de apontar.',
  BLOCOS_EXCEDIDOS: 'Esta demanda não permite apontar mais blocos do que o total definido.',
  BLOCOS_FINITOS_ESGOTADOS: 'Essa demanda já teve todos os blocos apontados por alguém — não há mais blocos disponíveis.',
  APONTAMENTO_NAO_ENCONTRADO: 'Apontamento não encontrado — só é possível editar lançamentos do dia de hoje.',
}
