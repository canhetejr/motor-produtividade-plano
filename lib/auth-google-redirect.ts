/** URL de retorno do OAuth após login: a entrada principal é Minha semana. */
export function urlCallbackLoginGoogle(base: string): string {
  return `${base.replace(/\/$/, '')}/auth/callback?next=/minha-semana`
}
