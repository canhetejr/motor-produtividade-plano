import { z } from 'zod'
import { parseTempo } from '@/lib/tempo'

// Extraído de app/(app)/apontamento/actions.ts: um arquivo com 'use server'
// só pode exportar funções async (regra do compilador do Next) — um schema
// Zod não pode viver lá se precisa ser importado por outro módulo, como a
// tool MCP em lib/mcp/tools/apontamentos.ts, que reaplica exatamente esta
// validação em vez de duplicá-la.
export const apontamentoSchema = z.object({
  demanda_id: z.string().uuid('Selecione uma demanda válida'),
  // aceita decimais: demandas em blocos permitem meio bloco (0.5)
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  tempo_manual_min: z
    .preprocess(
      (v) => parseTempo(v as string | number),
      z.number().int('Tempo deve ser um número inteiro de minutos').positive('Tempo deve ser maior que zero').nullable()
    )
    .catch(null),
  motivo: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  observacoes: z
    .string()
    .trim()
    .max(2000, 'Observações muito longas (máx. 2000 caracteres)')
    .optional()
    .transform((v) => v || null),
})
