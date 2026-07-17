import { requireUser } from '@/lib/auth'
import { saudacao } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { ApontamentoForm } from './apontamento-form'

export const dynamic = 'force-dynamic'

export default async function ApontamentoPage() {
  const { profile } = await requireUser()
  const supabase = await createClient()

  const { data: demandas } = await supabase
    .from('demandas')
    .select('id, nome, variavel, tempo_padrao_min, blocos_totais')
    .eq('ativo', true)
    .eq('area_id', profile.area_id ?? '')
    .order('nome')

  const primeiroNome = profile.nome.trim().split(' ')[0]

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] p-4 overflow-hidden bg-background">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg mb-8 text-center relative z-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          {saudacao()}, <span className="text-primary">{primeiroNome}</span>!
        </h1>
        <p className="text-muted-foreground text-lg">Registre sua produção e alcance suas metas.</p>
      </div>

      <div className="w-full max-w-lg relative z-10">
        <ApontamentoForm demandas={demandas || []} />
      </div>
    </div>
  )
}
