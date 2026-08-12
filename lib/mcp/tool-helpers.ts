import 'server-only'

export function textoJson(dado: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(dado, null, 2) }] }
}

export function erroFerramenta(mensagem: string) {
  return { content: [{ type: 'text' as const, text: mensagem }], isError: true as const }
}

export function mensagemDeErro(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
