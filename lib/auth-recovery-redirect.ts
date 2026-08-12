/** URL segura e canônica para o fluxo de recuperação de senha no navegador. */
export function urlRedefinicaoSenha(origin: string) {
  return `${origin.replace(/\/$/, '')}/auth/redefinir-senha`
}
