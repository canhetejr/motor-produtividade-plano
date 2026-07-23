import { redirect } from 'next/navigation'
import { requireGestor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Colaboradores virou uma aba da tela centralizada de Catálogo — mantém a
// rota antiga como redirect pra não quebrar links/atalhos já salvos.
export default async function ColaboradoresPage() {
  await requireGestor()
  redirect('/catalogo?tab=colaboradores')
}
