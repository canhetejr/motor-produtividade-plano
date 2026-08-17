import { destinoInternoSeguro } from './auth-redirect'
import { resolverBaseUrl } from './base-url'

/**
 * URL final do callback OAuth. O request pode chegar ao Next pela origem
 * interna do container; a origem pública vem dos headers que o proxy informa.
 */
export function urlDestinoCallbackOauth(request: Request, next: string | null): URL {
  const base = resolverBaseUrl(request)
  const destino = destinoInternoSeguro(next, base, '/minha-semana')
  return new URL(destino, base)
}
