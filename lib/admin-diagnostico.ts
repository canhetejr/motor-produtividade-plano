// Diagnóstico da operação — a parte do /admin que existe para contar algo que
// você ainda não sabia.
//
// Lógica pura de propósito (nada de banco, nada de 'server-only'): a página
// junta os números, isto decide o que vira achado, com que gravidade e em que
// ordem. Assim o vitest cobre as regras sem subir nada.
//
// Princípio ao adicionar achado novo: só entra o que tem CONSEQUÊNCIA
// concreta e um lugar para resolver. Um painel que acende sem que ninguém
// possa fazer nada vira ruído, e ruído se aprende a ignorar.

export type Severidade = 'alta' | 'media' | 'baixa'

export type Achado = {
  id: string
  severidade: Severidade
  titulo: string
  /** Por que isso importa — o que quebra se ninguém mexer. */
  consequencia: string
  quantidade: number
  /** Onde se resolve. */
  comoResolver: string
  link?: { href: string; rotulo: string }
  /** Nomes dos itens afetados, quando ajudam a agir (máx. alguns). */
  exemplos?: string[]
}

export type DadosDiagnostico = {
  cartoesSemDemanda: number
  quadrosSemEtapaFinal: string[]
  quadrosSemMembros: string[]
  demandasSemTempoPadrao: string[]
  /** Sessões de cronômetro ainda abertas que já passaram da carga do dono. */
  sessoesEstouradas: { colaborador: string; horas: number; cargaHoras: number }[]
  sessoesAbertas: number
  naoApontaramHoje: string[]
  ehDiaUtil: boolean
  /** Hora cheia em Maringá (0-23) — decide se "ainda não apontou" já é sinal. */
  horaMaringa: number
}

const PESO: Record<Severidade, number> = { alta: 0, media: 1, baixa: 2 }

/**
 * A partir de que hora do dia "ainda não apontou" deixa de ser normal.
 * Antes disso a maioria simplesmente não teve tempo de lançar, e o painel
 * acenderia todo santo dia de manhã sem informar nada.
 */
export const HORA_COBRANCA_APONTAMENTO = 15

function listar(nomes: string[], max = 4): string[] {
  return nomes.slice(0, max)
}

/**
 * Plural explícito em vez de concatenar sufixo: "cartão" + "es" produz
 * "cartãoes", e o TypeScript acha ótimo. Passar as duas formas é chato uma
 * vez e correto sempre.
 */
function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export function montarAchados(d: DadosDiagnostico): Achado[] {
  const achados: Achado[] = []

  // Alta: quebra silenciosamente o número que a diretoria olha.
  if (d.cartoesSemDemanda > 0) {
    achados.push({
      id: 'cartoes-sem-demanda',
      severidade: 'alta',
      titulo: `${plural(d.cartoesSemDemanda, 'cartão', 'cartões')} sem demanda vinculada`,
      consequencia:
        'O tempo cronometrado neles não vira apontamento e não conta no índice de produtividade. A pessoa trabalha e o número não sobe.',
      quantidade: d.cartoesSemDemanda,
      comoResolver: 'Abra o cartão e escolha a demanda no campo "Demanda", na barra lateral.',
      link: { href: '/kanban', rotulo: 'Ver quadros' },
    })
  }

  if (d.quadrosSemEtapaFinal.length > 0) {
    achados.push({
      id: 'quadros-sem-etapa-final',
      severidade: 'alta',
      titulo: `${plural(d.quadrosSemEtapaFinal.length, 'quadro', 'quadros')} sem etapa de entrega`,
      consequencia:
        'Nenhum cartão desses quadros pode ser entregue: a entrega é carimbada ao entrar numa coluna marcada como etapa final, e não existe nenhuma.',
      quantidade: d.quadrosSemEtapaFinal.length,
      comoResolver: 'No quadro, edite a última coluna e marque "Etapa final".',
      exemplos: listar(d.quadrosSemEtapaFinal),
      link: { href: '/kanban', rotulo: 'Ver quadros' },
    })
  }

  if (d.sessoesEstouradas.length > 0) {
    achados.push({
      id: 'sessoes-estouradas',
      severidade: 'alta',
      titulo: `${plural(d.sessoesEstouradas.length, 'cronômetro esquecido', 'cronômetros esquecidos')} rodando`,
      consequencia:
        'A sessão já passou da carga horária diária de quem a abriu. Ao pausar, ela será recusada como apontamento (a trava existe para um timer esquecido a noite toda não gerar 14h e destruir o índice) — ou seja, o trabalho real do dia se perde.',
      quantidade: d.sessoesEstouradas.length,
      comoResolver:
        'Peça para a pessoa pausar e usar "Ajustar horas" no cartão para lançar o tempo que de fato trabalhou.',
      exemplos: d.sessoesEstouradas.map(
        (s) => `${s.colaborador} — ${Math.floor(s.horas)}h corridas (carga: ${s.cargaHoras}h)`
      ),
    })
  }

  // Média: some da vista sem avisar, mas não corrompe número.
  if (d.demandasSemTempoPadrao.length > 0) {
    achados.push({
      id: 'demandas-sem-tempo',
      severidade: 'media',
      titulo: `${plural(d.demandasSemTempoPadrao.length, 'demanda ativa', 'demandas ativas')} sem tempo padrão`,
      consequencia:
        'Elas não aparecem no formulário de apontamento — quem faz esse trabalho não tem onde lançar, e ele fica invisível no índice.',
      quantidade: d.demandasSemTempoPadrao.length,
      comoResolver: 'Defina o tempo padrão em Catálogo → Demandas, ou desative a demanda.',
      exemplos: listar(d.demandasSemTempoPadrao),
      link: { href: '/catalogo?tab=demandas', rotulo: 'Abrir catálogo' },
    })
  }

  if (d.quadrosSemMembros.length > 0) {
    achados.push({
      id: 'quadros-sem-membros',
      severidade: 'media',
      titulo: `${plural(d.quadrosSemMembros.length, 'quadro ativo', 'quadros ativos')} sem membros`,
      consequencia:
        'Só gestores conseguem abrir. Nenhum colaborador vê esse quadro na lista, então ninguém trabalha nele.',
      quantidade: d.quadrosSemMembros.length,
      comoResolver: 'Vincule colaboradores ao quadro, ou arquive-o se não estiver mais em uso.',
      exemplos: listar(d.quadrosSemMembros),
      link: { href: '/admin?tab=quadros', rotulo: 'Ver quadros' },
    })
  }

  // Baixa: informativo, e só quando já faz sentido cobrar.
  if (d.ehDiaUtil && d.horaMaringa >= HORA_COBRANCA_APONTAMENTO && d.naoApontaramHoje.length > 0) {
    achados.push({
      id: 'nao-apontaram',
      severidade: 'baixa',
      titulo: `${plural(d.naoApontaramHoje.length, 'pessoa ainda não apontou', 'pessoas ainda não apontaram')} hoje`,
      consequencia:
        'O índice do dia delas fica zerado até lançarem. O lembrete automático sai às 18h.',
      quantidade: d.naoApontaramHoje.length,
      comoResolver: 'O cron de lembrete cobra sozinho no fim do dia; isto aqui é só antecedência.',
      exemplos: listar(d.naoApontaramHoje, 6),
    })
  }

  return achados.sort((a, b) => PESO[a.severidade] - PESO[b.severidade] || b.quantidade - a.quantidade)
}
