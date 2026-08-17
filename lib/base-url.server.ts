import 'server-only'

import { headers } from 'next/headers'

import { origemPorCabecalhos, resolverBaseUrlPorOrigem } from './base-url'

/**
 * Variante para Server Actions: lê os cabeçalhos da requisição atual sem
 * contaminar o módulo compartilhado, que também é importado por componentes
 * de navegador.
 */
export async function resolverBaseUrlDeHeaders(): Promise<string> {
  const cabecalhos = await headers()
  return resolverBaseUrlPorOrigem(origemPorCabecalhos((nome) => cabecalhos.get(nome)))
}
