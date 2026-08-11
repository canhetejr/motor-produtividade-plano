export type ValidacaoNovaSenha =
  | { valida: true }
  | { valida: false; mensagem: string }

export function validarNovaSenha(senha: string, confirmacao: string): ValidacaoNovaSenha {
  if (senha !== confirmacao) {
    return { valida: false, mensagem: 'As senhas não coincidem.' }
  }

  return { valida: true }
}
