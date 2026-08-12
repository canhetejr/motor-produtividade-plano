import { z } from 'zod'

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data no formato AAAA-MM-DD.')

const esquemaAssinaturaManual = z
  .object({
    planoId: z.string().trim().uuid('Plano inválido.'),
    status: z.enum(['ativa', 'pausada', 'cancelada']),
    cicloCobranca: z.enum(['mensal', 'trimestral', 'semestral', 'anual']),
    iniciaEm: dataIso,
    renovaEm: dataIso.nullable(),
    proximaCobrancaEm: dataIso.nullable(),
    valorCentavos: z.coerce.number().int().min(0).max(100_000_000),
    observacoes: z.string().trim().max(2_000).transform((valor) => valor || null),
  })
  .superRefine((dados, contexto) => {
    if (dados.renovaEm && dados.renovaEm < dados.iniciaEm) {
      contexto.addIssue({ code: 'custom', message: 'A renovação não pode ser anterior ao início.', path: ['renovaEm'] })
    }
    if (dados.proximaCobrancaEm && dados.proximaCobrancaEm < dados.iniciaEm) {
      contexto.addIssue({ code: 'custom', message: 'A próxima cobrança não pode ser anterior ao início.', path: ['proximaCobrancaEm'] })
    }
    if (dados.status === 'ativa' && (!dados.renovaEm || !dados.proximaCobrancaEm)) {
      contexto.addIssue({ code: 'custom', message: 'Assinaturas ativas exigem renovação e próxima cobrança.', path: ['status'] })
    }
  })

export type DadosAssinaturaManual = z.infer<typeof esquemaAssinaturaManual>

export type ResultadoValidacaoAssinaturaManual =
  | { ok: true; data: DadosAssinaturaManual }
  | { ok: false; error: string }

/** Valida e normaliza a entrada não confiável antes das mutações comerciais. */
export function validarDadosAssinaturaManual(entrada: unknown): ResultadoValidacaoAssinaturaManual {
  const resultado = esquemaAssinaturaManual.safeParse(entrada)
  if (resultado.success) return { ok: true, data: resultado.data }
  return { ok: false, error: resultado.error.issues[0]?.message ?? 'Dados da assinatura inválidos.' }
}
