export function resolverSenhaInicial(senhaInformada: string | null | undefined, senhaPadrao: string | null) {
  const senha = senhaInformada?.trim() || senhaPadrao
  if (!senha) {
    return { erro: 'Defina a senha padrão no Console Admin ou informe uma senha temporária.' } as const
  }
  return { senha } as const
}
