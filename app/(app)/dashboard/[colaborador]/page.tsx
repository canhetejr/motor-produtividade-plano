import { redirect } from 'next/navigation'

import { comSearchParams, type SearchParams } from '@/lib/preservar-search-params'

export default async function ColaboradorRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ colaborador: string }>
  searchParams: Promise<SearchParams>
}) {
  const { colaborador } = await params
  redirect(comSearchParams('/gestao/equipe/' + colaborador, await searchParams))
}
