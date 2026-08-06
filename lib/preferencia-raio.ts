/** Preferência estética local: o mesmo usuário pode preferir interfaces mais
 * geométricas no desktop e cantos arredondados em outro dispositivo. */
export const CHAVE_RAIO = 'vertice:bordas'

export type PreferenciaRaio = 'reto' | 'arredondado' | 'maximo'

export function lerPreferenciaRaio(bruto: string | null): PreferenciaRaio {
  if (bruto === 'arredondado' || bruto === 'maximo') return bruto
  return 'reto'
}
