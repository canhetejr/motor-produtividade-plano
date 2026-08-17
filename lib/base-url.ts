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

import { headers } from 'next/headers'

const HOSTS_LOCAIS = new Set(['0.0.0.0', 'localhost', '127.0.0.1', '::1', '[::1]'])

/** Domínio de produção, usado quando a variável não serve. */
const DOMINIO_PADRAO = 'https://vertice.teralabs.cloud'

export function ehUrlLocal(url: string): boolean {
  try {
    return HOSTS_LOCAIS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

const ehLocal = ehUrlLocal

/**
 * URL pública para link que sai do app — e-mail, convite, .ics, evento do
 * Google Agenda. Aqui não há requisição de onde deduzir o domínio: quem lê o
 * link está no cliente de e-mail, longe de qualquer sessão.
 *
 * `null` quando não dá para saber. Endereço local em build de produção nunca
 * dá para saber: `http://0.0.0.0:3000` num convite é um link que ninguém no
 * mundo consegue abrir, então vale mais o domínio conhecido do que obedecer
 * a uma variável obviamente errada. Em desenvolvimento localhost é o certo, e
 * continua valendo.
 */
export function urlPublicaOuNulo(): string | null {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || null
  if (!env) return null
  if (ehLocal(env) && process.env.NODE_ENV === 'production') return DOMINIO_PADRAO
  return env
}

/** Como `urlPublicaOuNulo`, para quem precisa de uma string sempre. */
export function urlPublica(): string {
  return urlPublicaOuNulo() ?? DOMINIO_PADRAO
}

function origemDeCabecalhos(get: (nome: string) => string | null): string | null {
  const host = get('x-forwarded-host') ?? get('host')
  if (!host) return null
  const proto = get('x-forwarded-proto') ?? (HOSTS_LOCAIS.has(host.split(':')[0]) ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * Origem por onde a requisição chegou, a partir dos cabeçalhos que o proxy da
 * hospedagem preenche. `null` quando não dá para saber.
 */
export function origemDaRequisicao(request: Request): string | null {
  return origemDeCabecalhos((nome) => request.headers.get(nome))
}

function resolverBaseUrlDe(daRequisicao: string | null): string {
  const doAmbiente = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || null

  if (!doAmbiente) {
    if (!daRequisicao) throw new Error('NEXT_PUBLIC_APP_URL não configurada e host da requisição ausente.')
    return daRequisicao
  }

  if (daRequisicao && ehLocal(doAmbiente) && !ehLocal(daRequisicao)) return daRequisicao
  return doAmbiente
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
  return resolverBaseUrlDe(origemDaRequisicao(request))
}

/**
 * Como `resolverBaseUrl`, para server action — onde não existe `Request`,
 * só os cabeçalhos da requisição atual via `next/headers`. Mesma proteção:
 * `NEXT_PUBLIC_APP_URL` local não sobrevive a uma requisição que chegou de
 * domínio público (era o caso do login com Google, que lia a variável direto
 * e mandava a pessoa para `0.0.0.0:3000`).
 */
export async function resolverBaseUrlDeHeaders(): Promise<string> {
  const cabecalhos = await headers()
  return resolverBaseUrlDe(origemDeCabecalhos((nome) => cabecalhos.get(nome)))
}
