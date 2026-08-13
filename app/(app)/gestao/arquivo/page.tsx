import { Archive } from 'lucide-react'

import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { ArquivoTable, type ApontamentoArquivado } from './arquivo-table'

export const dynamic = 'force-dynamic'

// Destino dos apontamentos de uma demanda ou de um colaborador excluídos
// definitivamente. Existe para que "excluir" não signifique "sumir com o que
// foi trabalhado": o dado sai do índice e dos relatórios, mas continua
// consultável aqui, com nome de pessoa, demanda e área congelados em texto.
export default async function ArquivoPage() {
  await requireGestor()
  const supabase = await createClient()

  const { data: registros, error } = await supabase
    .from('apontamentos_arquivados')
    .select(
      'id, colaborador_nome, demanda_nome, area_nome, data, quantidade, tempo_manual_min, tempo_padrao_snapshot, blocos_totais_snapshot, observacoes, arquivado_em, arquivado_motivo'
    )
    .order('arquivado_em', { ascending: false })
    .limit(500)
  throwIfError(error)

  return (
    <PageShell contentClassName="space-y-6">
      <PageHeader
        title="Arquivo de apontamentos"
        description="Lançamentos de demandas e pessoas que foram excluídas definitivamente. Ficam fora do índice e dos relatórios — este é o único lugar onde ainda aparecem."
        icon={Archive}
        level={2}
        className="mb-0"
      />

      <ArquivoTable registros={(registros ?? []) as ApontamentoArquivado[]} />
    </PageShell>
  )
}
