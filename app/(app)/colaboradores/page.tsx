import { redirect } from 'next/navigation'
import { requireGestor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Gerir pessoas mora em /gestao/acessos, junto de assentos e convites — a
// rota antiga segue viva como redirect para não quebrar link ou atalho já
// salvo. (Antes apontava para a aba de colaboradores do Catálogo, que saiu:
// duas telas para a mesma coisa era o problema, não a solução.)
export default async function ColaboradoresPage() {
  await requireGestor()
  redirect('/gestao/acessos')
}
