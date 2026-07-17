import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { CatalogoManager } from './catalogo-manager'

export const dynamic = 'force-dynamic'

export default async function CatalogoPage() {
  await requireGestor()
  const supabase = await createClient()

  const [{ data: areas }, { data: demandas }] = await Promise.all([
    supabase.from('areas').select('*').order('nome'),
    supabase.from('demandas').select('*').order('nome'),
  ])

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Catálogo de Demandas</h1>
      <p className="text-muted-foreground mb-8">
        Gerencie as áreas e os tempos padrão de cada demanda.
      </p>

      <CatalogoManager areas={areas || []} demandas={demandas || []} />
    </div>
  )
}
