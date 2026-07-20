import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { AreasManager } from './areas-manager'

export const dynamic = 'force-dynamic'

export default async function AreasPage() {
  await requireGestor()
  const supabase = await createClient()

  const [
    { data: areas },
    { data: colaboradores },
    { data: demandas }
  ] = await Promise.all([
    supabase.from('areas').select('*').order('nome'),
    supabase.from('colaboradores').select('id, area_id'),
    supabase.from('demandas').select('id, area_id')
  ])

  // Aggregate the statistics
  const areasComStats = (areas || []).map(a => ({
    ...a,
    colaboradoresCount: (colaboradores || []).filter(c => c.area_id === a.id).length,
    demandasCount: (demandas || []).filter(d => d.area_id === a.id).length,
  }))

  return (
    <div className="relative flex flex-col min-h-[calc(100dvh-4rem)] p-4 overflow-x-hidden bg-background">
      {/* Ambient background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-6xl mx-auto mt-8 relative z-10">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Gestão de <span className="text-primary">Áreas</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Crie e gerencie as áreas de atuação, e acompanhe o tamanho de cada equipe e catálogo.
          </p>
        </div>

        <AreasManager areas={areasComStats} />
      </div>
    </div>
  )
}
