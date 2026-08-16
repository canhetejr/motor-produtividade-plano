import 'server-only'

/**
 * Erro cuja mensagem PODE ser devolvida ao cliente MCP.
 *
 * A regra padrão do servidor é o contrário disso: `mensagemDeErro` troca
 * qualquer exceção por um texto fixo, para que nome de tabela, SQL ou stack
 * nunca cheguem a um agente do outro lado de um Bearer token
 * (docs/PLANO-MCP-PRODUTO.md, Gate 2, fatia 5).
 *
 * Só que escrita sem mensagem útil é escrita inútil: "Falha ao registrar
 * apontamento." não diz ao agente que a demanda exige informar o tempo, e ele
 * repete a chamada errada. Esta classe marca a exceção como um resultado de
 * REGRA DE NEGÓCIO — texto que a interface do Vértice já mostraria ao próprio
 * colaborador, sem nada que ele não pudesse ver.
 *
 * Nunca embrulhe erro de Postgres cru aqui: traduza para uma mensagem escrita
 * à mão (lib/apontamento-erros.ts, lib/kanban-regras.ts) e passe só ela.
 */
export class ErroDeDominioMcp extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroDeDominioMcp'
  }
}
