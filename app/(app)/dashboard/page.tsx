import { redirect } from 'next/navigation'

import { comSearchParams, type SearchParams } from '@/lib/preservar-search-params'

export default async function DashboardRedirect({ searchParams }: { searchParams: Promise<SearchParams> }) {
  redirect(comSearchParams('/gestao', await searchParams))
}
