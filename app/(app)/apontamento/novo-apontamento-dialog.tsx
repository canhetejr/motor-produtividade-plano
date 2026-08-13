'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { ApontamentoForm } from './apontamento-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Demanda = React.ComponentProps<typeof ApontamentoForm>['demandas'][number]

/**
 * O formulário de lançamento atrás de um botão.
 *
 * Ele ocupava metade da tela o tempo todo, mesmo nos dias em que a pessoa só
 * vinha conferir o que vence. Como diálogo, o que fica visível é o resultado
 * (tempo do dia, ritmo) e não o formulário em branco.
 *
 * A moldura vem do próprio ApontamentoForm — `p-0 bg-transparent` no conteúdo
 * e título só para leitor de tela, mesmo arranjo que a edição em
 * /apontamento/historico já usava.
 */
export function NovoApontamentoDialog({
  demandas,
  cargaHorariaMin,
  tempoEntregueHoje,
  usuarioId,
  catalogoHref,
  catalogoLabel,
}: {
  demandas: Demanda[]
  cargaHorariaMin: number
  tempoEntregueHoje: number
  usuarioId: string
  catalogoHref: string
  catalogoLabel: string
}) {
  const [aberto, setAberto] = useState(false)
  // Remonta o formulário a cada lançamento: sem isso, reabrir o diálogo
  // mostraria a demanda e as observações do envio anterior ainda preenchidas
  // (o formulário guarda o estado em useState, não no DOM).
  const [tentativa, setTentativa] = useState(0)
  const router = useRouter()

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <Button onClick={() => setAberto(true)}>
        <Plus className="size-4" aria-hidden="true" /> Registrar atividade
      </Button>
      <DialogContent className="bg-transparent p-0 ring-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Registrar atividade</DialogTitle>
        </DialogHeader>
        <ApontamentoForm
          key={tentativa}
          demandas={demandas}
          cargaHorariaMin={cargaHorariaMin}
          tempoEntregueHoje={tempoEntregueHoje}
          usuarioId={usuarioId}
          catalogoHref={catalogoHref}
          catalogoLabel={catalogoLabel}
          compacto
          // Fecha e recarrega em vez de mandar para o histórico: quem lança
          // daqui está no meio da tela do dia, e sair dela para conferir o que
          // acabou de registrar é justamente o que os números ao lado já
          // respondem.
          aoRegistrar={() => {
            setAberto(false)
            setTentativa((n) => n + 1)
            router.refresh()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
