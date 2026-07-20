import type { PostgrestError } from '@supabase/supabase-js'

// Server components fazem select direto (sem passar por uma action) e só
// desestruturam `data`; sem isso, uma falha de RLS/rede vira lista vazia
// silenciosa em vez de aparecer no error.tsx.
export function throwIfError(...errors: (PostgrestError | null)[]) {
  const error = errors.find((e) => e !== null)
  if (!error) return

  console.error(
    'Falha na consulta ao Supabase: code=%s message=%s details=%s hint=%s',
    error.code,
    error.message,
    error.details,
    error.hint
  )
  throw new Error(`Falha ao carregar dados [${error.code}]: ${error.message}`)
}
