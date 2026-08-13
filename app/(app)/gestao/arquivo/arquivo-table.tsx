'use client'

import { useMemo, useState } from 'react'
import { Archive, Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatarDataBR, formatarDataHoraBR } from '@/lib/dates'
import { formatarTempo } from '@/lib/tempo'

export type ApontamentoArquivado = {
  id: string
  colaborador_nome: string
  demanda_nome: string
  area_nome: string | null
  data: string
  quantidade: number
  tempo_manual_min: number | null
  tempo_padrao_snapshot: number | null
  blocos_totais_snapshot: number
  observacoes: string | null
  arquivado_em: string
  arquivado_motivo: string
}

const MOTIVOS: Record<string, string> = {
  demanda_excluida: 'Demanda excluída',
  colaborador_excluido: 'Colaborador excluído',
}

// Mesma conta do apontamento vivo (ver lib/documentacao.ts): demanda variável
// usa o tempo digitado; as demais usam o tempo padrão dividido pelos blocos,
// ambos congelados no instante do lançamento. Repetir a fórmula aqui é o que
// permite ao arquivo mostrar o mesmo número que o relatório mostrava antes.
function minutosDoRegistro(r: ApontamentoArquivado): number | null {
  if (r.tempo_manual_min != null) return r.tempo_manual_min
  if (r.tempo_padrao_snapshot == null) return null
  const blocos = r.blocos_totais_snapshot || 1
  return Math.round((r.tempo_padrao_snapshot / blocos) * Number(r.quantidade))
}

export function ArquivoTable({ registros }: { registros: ApontamentoArquivado[] }) {
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return registros
    return registros.filter(
      (r) =>
        r.colaborador_nome.toLowerCase().includes(termo) ||
        r.demanda_nome.toLowerCase().includes(termo) ||
        (r.area_nome ?? '').toLowerCase().includes(termo)
    )
  }, [registros, busca])

  if (registros.length === 0) {
    return (
      <EmptyState
        icone={Archive}
        titulo="Nada arquivado ainda"
        descricao="Quando você excluir uma demanda ou um colaborador, os apontamentos deles aparecem aqui."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por pessoa, demanda ou área..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9 bg-muted/30 pl-9 pr-8 text-sm"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Demanda</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Qtd.</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Arquivado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum registro para “{busca}”.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((r) => {
                const minutos = minutosDoRegistro(r)
                return (
                  <TableRow key={r.id}>
                    <TableCell label="Data" className="font-mono text-xs">{formatarDataBR(r.data)}</TableCell>
                    <TableCell label="Colaborador" className="font-medium">{r.colaborador_nome}</TableCell>
                    <TableCell label="Demanda">{r.demanda_nome}</TableCell>
                    <TableCell label="Área" className="text-muted-foreground">{r.area_nome ?? '—'}</TableCell>
                    <TableCell label="Qtd." className="font-mono text-xs">{Number(r.quantidade)}</TableCell>
                    <TableCell label="Tempo" className="font-mono text-xs">
                      {minutos == null ? '—' : formatarTempo(minutos)}
                    </TableCell>
                    <TableCell label="Motivo">
                      <Badge variant="outline">{MOTIVOS[r.arquivado_motivo] ?? r.arquivado_motivo}</Badge>
                    </TableCell>
                    <TableCell label="Arquivado em" className="text-xs text-muted-foreground">
                      {formatarDataHoraBR(r.arquivado_em)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
