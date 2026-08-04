import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { comSearchParams, type SearchParams } from '@/lib/preservar-search-params'

export default async function CatalogoRedirect({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { profile } = await requireUser()
  const destino = profile.role === 'gestor' ? '/gestao/catalogo' : '/minhas-demandas'
  redirect(comSearchParams(destino, await searchParams))
}
