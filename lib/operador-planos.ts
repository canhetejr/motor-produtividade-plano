import { z } from 'zod'

const inteiro = (minimo: number, maximo: number) =>
  z.coerce.number().int().min(minimo).max(maximo)

const esquemaPlanoOperador = z.object({
  codigo: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,31}$/, 'Use 2 a 32 caracteres: letras minúsculas, números ou hífen.'),
  nome: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(80),
  assentosInclusos: inteiro(1, 100_000),
  precoMensalCentavos: inteiro(0, 100_000_000),
  ordem: inteiro(0, 9_999),
})

export type DadosPlanoOperador = z.infer<typeof esquemaPlanoOperador>

export type ResultadoValidacaoPlano =
  | { ok: true; data: DadosPlanoOperador }
  | { ok: false; error: string }

/** Validação compartilhável para entradas não confiáveis das ações do console. */
export function validarDadosPlano(entrada: unknown): ResultadoValidacaoPlano {
  const resultado = esquemaPlanoOperador.safeParse(entrada)
  if (resultado.success) return { ok: true, data: resultado.data }
  return { ok: false, error: resultado.error.issues[0]?.message ?? 'Dados do plano inválidos.' }
}
