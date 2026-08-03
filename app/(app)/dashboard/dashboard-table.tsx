'use client'

import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { formatarTempo } from '@/lib/tempo'

type DataRow = {
  colaborador_id: string
  nome: string
  carga_total: number
  tempo_total: number
  dias_apontados: number
  dias_uteis: number
  indice: number
}

function getIndicatorStyle(indice: number, semExpectativa: boolean) {
  if (semExpectativa) {
    return {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      border: 'border-border',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: 'Sem expectativa'
    }
  }
  if (indice >= 1) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-500',
      border: 'border-emerald-500/20',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: 'Excelente'
    }
  }
  if (indice >= 0.7) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      border: 'border-amber-500/20',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: 'Atenção'
    }
  }
  return {
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    border: 'border-rose-500/20',
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: 'Crítico'
  }
}

export function DashboardTable({ data, semExpectativa = false }: { data: DataRow[]; semExpectativa?: boolean }) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center border border-border rounded-xl bg-card shadow-xs italic text-xs text-muted-foreground">
        Nenhum dado encontrado para o período ou área selecionada.
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => b.indice - a.indice)

  return (
    <div className="border border-border rounded-xl bg-card shadow-xs overflow-hidden">
      <div className="md:overflow-x-auto custom-scrollbar">
        <Table stacked>
          <TableHeader>
            <TableRow className="border-b border-border bg-secondary/40 hover:bg-secondary/40">
              <TableHead className="py-3 pl-6 font-semibold text-xs text-foreground uppercase tracking-wider min-w-[200px]">
                Colaborador
              </TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider w-24">
                Carga
              </TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider w-24">
                Entregue
              </TableHead>
              <TableHead className="font-semibold text-xs text-foreground uppercase tracking-wider min-w-[220px] px-4">
                Progresso Visual
              </TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider w-28">
                Dias Lançados
              </TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider pr-6 w-24">
                Índice
              </TableHead>
              <TableHead className="text-center font-semibold text-xs text-foreground uppercase tracking-wider w-32">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => {
              const status = getIndicatorStyle(row.indice, semExpectativa)
              const pct = Math.round(row.indice * 100)
              const pctBar = Math.min(100, Math.max(0, pct))
              const restante = Math.max(0, row.carga_total - row.tempo_total)
              const excedente = Math.max(0, row.tempo_total - row.carga_total)
              const bateuMeta = row.tempo_total >= row.carga_total && row.carga_total > 0

              let barColorClass = 'bg-muted-foreground/30'
              if (pct >= 100) barColorClass = 'bg-[#00FFCE]'
              else if (pct >= 70) barColorClass = 'bg-primary'
              else if (pct > 0) barColorClass = 'bg-amber-500'

              return (
                <TableRow 
                  key={row.colaborador_id} 
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors group"
                >
                  {/* Colaborador Avatar + Nome */}
                  <TableCell stack="header" className="pl-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nome={row.nome} tamanho="sm" aria-label={row.nome} />
                      <Link href={`/dashboard/${row.colaborador_id}`} className="font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors truncate max-w-[170px]" title={row.nome}>
                        {row.nome}
                      </Link>
                    </div>
                  </TableCell>

                  {/* Carga */}
                  <TableCell stack="hide" className="text-right text-xs text-muted-foreground font-mono font-medium">
                    {formatarTempo(row.carga_total)}
                  </TableCell>

                  {/* Entregue */}
                  <TableCell stack="hide" className="text-right text-xs font-bold font-mono text-foreground">
                    {formatarTempo(row.tempo_total)}
                  </TableCell>

                  {/* Barra de Progresso Visual */}
                  <TableCell stack="full" className="px-4 py-3">
                    <div className="w-full space-y-1 md:min-w-[180px]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 text-primary inline" />
                          {formatarTempo(row.tempo_total)} <span className="text-muted-foreground font-normal">/ {formatarTempo(row.carga_total)}</span>
                        </span>
                        <span className={`text-[10px] font-semibold ${bateuMeta ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {semExpectativa ? '—' : bateuMeta ? `+${formatarTempo(excedente)}` : `Faltam ${formatarTempo(restante)}`}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden border border-border/40 p-0.5">
                        <div
                          style={{ width: `${pctBar}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {/* Dias Lançados */}
                  <TableCell label="Dias" className="text-right text-xs text-muted-foreground font-medium">
                    <span className="text-foreground font-semibold">{row.dias_apontados}</span> / {row.dias_uteis}
                  </TableCell>

                  {/* Índice */}
                  <TableCell label="Índice" className="text-right pr-6 font-mono">
                    <span className="font-bold text-xs sm:text-sm text-foreground">{(row.indice * 100).toFixed(1)}%</span>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell label="Status" className="text-center">
                    <div className="flex justify-center">
                      <div 
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border shadow-2xs ${status.bg} ${status.text} ${status.border}`}
                        title={`Índice: ${(row.indice * 100).toFixed(1)}%`}
                      >
                        {status.icon}
                        {status.label}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
