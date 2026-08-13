// De onde sai a URL pública do app quando ela precisa estar certa.
//
// `NEXT_PUBLIC_APP_URL` é a fonte oficial e continua sendo a primeira opção —
// e-mail, .ics e link de convite não têm requisição de onde deduzir nada. Mas
// para OAuth ela é um ponto único de falha silenciosa: se estiver apontando
// para um endereço local (o valor que fica de um `.env` de desenvolvimento
// copiado para produção), o Google devolve a pessoa para `0.0.0.0:3000` e o
// que se vê é o navegador não conseguindo abrir a página, sem erro nenhum do
// lado do app.
//
// Nas rotas OAuth existe a requisição, e ela sabe por qual domínio a pessoa
// chegou. É informação melhor do que uma variável de ambiente que ninguém
// releu desde que foi criada.

const HOSTS_LOCAIS = new Set(['0.0.0.0', 'localhost', '127.0.0.1', '::1', '[::1]'])

function ehLocal(url: string): boolean {
  try {
    return HOSTS_LOCAIS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * Origem por onde a requisição chegou, a partir dos cabeçalhos que o proxy da
 * hospedagem preenche. `null` quando não dá para saber.
 */
export function origemDaRequisicao(request: Request): string | null {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return null
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (HOSTS_LOCAIS.has(host.split(':')[0]) ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * URL base para montar link que o navegador vai seguir de volta.
 *
 * A variável de ambiente ganha, exceto quando ela aponta para um endereço
 * local e a requisição não é local — aí ela está errada por definição, e o
 * domínio por onde a pessoa entrou é o certo. Em desenvolvimento os dois são
 * locais e nada muda.
 */
export function resolverBaseUrl(request: Request): string {
  const daRequisicao = origemDaRequisicao(request)
  const doAmbiente = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || null

  if (!doAmbiente) {
    if (!daRequisicao) throw new Error('NEXT_PUBLIC_APP_URL não configurada e host da requisição ausente.')
    return daRequisicao
  }

  if (daRequisicao && ehLocal(doAmbiente) && !ehLocal(daRequisicao)) return daRequisicao
  return doAmbiente
}
