// Variáveis de texto ({{titulo}}, {{link_da_tarefa}}, …) — o catálogo, a
// gramática do token e as funções puras que a UI e o servidor compartilham.
//
// Existe porque automação e formulário precisam escrever texto que só é
// conhecido na hora de rodar: o assunto do e-mail cita o card que disparou,
// a descrição do card cita a resposta que o visitante deu. Sem isso, cada
// automação só consegue mandar um texto fixo, e o destinatário recebe
// "Uma tarefa mudou de etapa" sem saber qual.
//
// Fica fora de lib/variaveis-cartao.ts (que lê o banco e é 'server-only')
// porque o builder de automações roda no browser: ele importa o catálogo pra
// montar o menu "Inserir variável" e o realce dos chips, e os testes importam
// a substituição sem precisar de banco.
//
// GRAMÁTICA: `{{chave}}`, chave em [a-z0-9_]. Espaço interno é tolerado
// (`{{ titulo }}`) porque quem edita à mão acaba digitando assim.

export type GrupoVariavel = 'Tarefa' | 'Pessoas' | 'Datas' | 'Links' | 'Respostas' | 'Formulário'

export type DefinicaoVariavel = {
  chave: string
  rotulo: string
  grupo: GrupoVariavel
  /** Texto de apoio no menu — só quando o rótulo sozinho engana. */
  nota?: string
}

/** Novo objeto a cada chamada: RegExp com /g guarda `lastIndex` entre usos. */
function padrao(): RegExp {
  return /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
}

/** Monta o token como ele é gravado no banco. */
export function token(chave: string): string {
  return `{{${chave}}}`
}

// --- Catálogo do card (automações) ---------------------------------------

/**
 * O que uma automação consegue citar sobre o card que a disparou.
 *
 * Toda chave daqui precisa ter resposta em `valoresDoCartao`
 * (lib/variaveis-cartao.ts) — um teste guarda esse pareamento, senão uma
 * variável nova apareceria no menu e sairia em branco no e-mail.
 */
export const VARIAVEIS_CARTAO: DefinicaoVariavel[] = [
  { chave: 'titulo', rotulo: 'Título', grupo: 'Tarefa' },
  { chave: 'codigo', rotulo: 'Código', grupo: 'Tarefa', nota: 'Ex.: UX-12' },
  { chave: 'descricao', rotulo: 'Descrição', grupo: 'Tarefa', nota: 'Sai como texto puro, sem formatação' },
  { chave: 'tipo', rotulo: 'Tipo', grupo: 'Tarefa' },
  { chave: 'prioridade', rotulo: 'Prioridade', grupo: 'Tarefa' },
  { chave: 'etapa_atual', rotulo: 'Etapa atual', grupo: 'Tarefa' },
  { chave: 'quadro', rotulo: 'Quadro', grupo: 'Tarefa' },
  { chave: 'centro', rotulo: 'Centro', grupo: 'Tarefa' },
  { chave: 'tag_referencia', rotulo: 'TAG (Ref)', grupo: 'Tarefa' },
  { chave: 'tags', rotulo: 'Tags', grupo: 'Tarefa', nota: 'Todas as etiquetas, separadas por vírgula' },

  { chave: 'alocados', rotulo: 'Alocados', grupo: 'Pessoas' },
  { chave: 'seguidores', rotulo: 'Seguidores', grupo: 'Pessoas' },
  { chave: 'criada_por', rotulo: 'Criada por', grupo: 'Pessoas' },
  { chave: 'emails_alocados', rotulo: 'E-mails dos alocados', grupo: 'Pessoas', nota: 'Serve no campo "Para"' },
  { chave: 'email_criador', rotulo: 'E-mail de quem criou', grupo: 'Pessoas', nota: 'Serve no campo "Para"' },

  { chave: 'prazo', rotulo: 'Prazo', grupo: 'Datas' },
  { chave: 'inicio_desejado', rotulo: 'Início desejado', grupo: 'Datas' },
  { chave: 'criada_em', rotulo: 'Criada em', grupo: 'Datas' },
  { chave: 'na_etapa_desde', rotulo: 'Na etapa desde', grupo: 'Datas' },

  { chave: 'link_da_tarefa', rotulo: 'Link da tarefa', grupo: 'Links', nota: 'Abre o card já aberto no quadro' },
]

/** Chaves que custam uma consulta ao Auth — resolvidas só quando usadas. */
export const CHAVES_EMAIL = ['emails_alocados', 'email_criador'] as const

// --- Catálogo do formulário público --------------------------------------

/**
 * O que o formulário sabe sem depender das perguntas que o gestor criou.
 * `todas_respostas` é o corpo padrão da descrição do card — deixá-lo como
 * variável permite reordenar ("Recebido de {{formulario}}" antes da lista)
 * em vez de aceitar o texto fixo que o código montava.
 */
export const VARIAVEIS_FORMULARIO_FIXAS: DefinicaoVariavel[] = [
  { chave: 'formulario', rotulo: 'Nome do formulário', grupo: 'Formulário' },
  { chave: 'enviado_em', rotulo: 'Data do envio', grupo: 'Formulário' },
  {
    chave: 'todas_respostas',
    rotulo: 'Todas as respostas',
    grupo: 'Formulário',
    nota: 'Uma linha por pergunta, com o rótulo na frente',
  },
]

/**
 * Rótulo da pergunta → chave de variável ("Seu Nome Completo" →
 * `seu_nome_completo`).
 *
 * A chave vem do RÓTULO e não do id porque `atualizarFormulario` apaga e
 * reinsere os campos a cada salvamento: os uuids mudam, e um template que
 * apontasse pra eles apagaria sozinho a cada edição do formulário. O preço é
 * o oposto — renomear a pergunta quebra o template —, e ele é visível: o
 * builder mostra a variável desconhecida em vermelho.
 */
export function chaveDeRotulo(rotulo: string): string {
  const base = rotulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira o acento que o NFD separou: "Endereço" → "Endereco"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/, '')
  return base || 'campo'
}

/**
 * Variáveis das perguntas do formulário, **na mesma ordem dos campos
 * recebidos** — o servidor casa resposta com chave por índice, então a ordem
 * é parte do contrato.
 *
 * Dois rótulos que reduzem à mesma chave ("E-mail" e "E mail") ganham sufixo
 * numérico. Sem isso a segunda resposta sobrescreveria a primeira em silêncio.
 */
export function variaveisDeCampos(campos: { rotulo: string }[]): DefinicaoVariavel[] {
  const usadas = new Map<string, number>()
  return campos.map((campo) => {
    const base = chaveDeRotulo(campo.rotulo)
    const repeticoes = usadas.get(base) ?? 0
    usadas.set(base, repeticoes + 1)
    return {
      chave: repeticoes === 0 ? base : `${base}_${repeticoes + 1}`,
      rotulo: campo.rotulo.trim() || 'Pergunta sem título',
      grupo: 'Respostas' as const,
    }
  })
}

/** Catálogo completo de um formulário: perguntas + as fixas. */
export function variaveisDoFormulario(campos: { rotulo: string }[]): DefinicaoVariavel[] {
  return [...variaveisDeCampos(campos), ...VARIAVEIS_FORMULARIO_FIXAS]
}

// --- Substituição --------------------------------------------------------

/**
 * Troca os tokens pelos valores.
 *
 * Token cuja chave NÃO está em `valores` fica como está, de propósito: quem
 * digitou `{{titulo_}}` no lugar de `{{titulo}}` precisa ver o token cru no
 * e-mail pra entender o que corrigir. Apagar em silêncio transformaria o erro
 * num texto faltando sem pista de origem. Chave conhecida com valor vazio
 * (card sem prazo) some — aí a ausência é o dado.
 */
export function aplicarVariaveis(
  texto: string | null | undefined,
  valores: Record<string, string>
): string {
  if (!texto) return ''
  return texto.replace(padrao(), (bruto, chave: string) => {
    const valor = valores[chave.toLowerCase()]
    return valor === undefined ? bruto : valor
  })
}

/** Chaves citadas no texto, sem repetir — usado pra só buscar o que sai. */
export function variaveisUsadas(...textos: (string | null | undefined)[]): string[] {
  const chaves = new Set<string>()
  for (const texto of textos) {
    if (!texto) continue
    for (const achado of texto.matchAll(padrao())) {
      chaves.add(achado[1].toLowerCase())
    }
  }
  return [...chaves]
}

export function contemVariaveis(texto: string | null | undefined): boolean {
  return variaveisUsadas(texto).length > 0
}

// --- Apoio à edição ------------------------------------------------------

export type Segmento =
  | { tipo: 'texto'; texto: string }
  /** `rotulo: null` = chave fora do catálogo; a UI destaca em vermelho. */
  | { tipo: 'variavel'; texto: string; chave: string; rotulo: string | null }

/**
 * Quebra o texto em pedaços literais e tokens, preservando o texto original
 * caractere a caractere: o realce do editor desenha os chips POR CIMA do
 * campo real, então concatenar os segmentos tem que devolver exatamente o
 * que está digitado, senão os chips saem fora de posição.
 */
export function segmentar(texto: string, variaveis: DefinicaoVariavel[]): Segmento[] {
  const catalogo = new Map(variaveis.map((v) => [v.chave, v.rotulo]))
  const segmentos: Segmento[] = []
  let cursor = 0

  for (const achado of texto.matchAll(padrao())) {
    const inicio = achado.index ?? 0
    if (inicio > cursor) segmentos.push({ tipo: 'texto', texto: texto.slice(cursor, inicio) })
    const chave = achado[1].toLowerCase()
    segmentos.push({
      tipo: 'variavel',
      texto: achado[0],
      chave,
      rotulo: catalogo.get(chave) ?? null,
    })
    cursor = inicio + achado[0].length
  }

  if (cursor < texto.length) segmentos.push({ tipo: 'texto', texto: texto.slice(cursor) })
  return segmentos
}

/**
 * Insere um token na posição do cursor (ou por cima da seleção) e diz onde o
 * cursor deve ficar depois — quem chama devolve o foco ao campo.
 */
export function inserirVariavel(
  texto: string,
  inicio: number,
  fim: number,
  chave: string
): { texto: string; cursor: number } {
  const marca = token(chave)
  const inicioSeguro = Math.max(0, Math.min(inicio, texto.length))
  const fimSeguro = Math.max(inicioSeguro, Math.min(fim, texto.length))
  return {
    texto: texto.slice(0, inicioSeguro) + marca + texto.slice(fimSeguro),
    cursor: inicioSeguro + marca.length,
  }
}

/** Agrupa preservando a ordem de declaração — o menu da UI espelha isso. */
export function agruparVariaveis(
  variaveis: DefinicaoVariavel[]
): { grupo: GrupoVariavel; itens: DefinicaoVariavel[] }[] {
  const mapa = new Map<GrupoVariavel, DefinicaoVariavel[]>()
  for (const variavel of variaveis) {
    const lista = mapa.get(variavel.grupo) ?? []
    lista.push(variavel)
    mapa.set(variavel.grupo, lista)
  }
  return [...mapa.entries()].map(([grupo, itens]) => ({ grupo, itens }))
}
