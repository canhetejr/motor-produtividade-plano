import { redirect } from 'next/navigation'

import { comSearchParams, type SearchParams } from '@/lib/preservar-search-params'

export default async function AdminRedirect({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams

  if (params.tab === 'pessoas') {
    const demaisParams = { ...params }
    delete demaisParams.tab
    redirect(comSearchParams('/gestao/catalogo', { ...demaisParams, tab: 'colaboradores' }))
  }

  redirect(comSearchParams('/gestao/sistema', params))
}
