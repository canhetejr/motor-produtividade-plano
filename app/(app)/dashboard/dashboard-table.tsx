'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
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
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Sem expectativa'
    }
  }
  if (indice >= 1) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-500',
      border: 'border-emerald-500/20',
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Excelente'
    }
  }
  if (indice >= 0.7) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      border: 'border-amber-500/20',
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Atenção'
    }
  }
  return {
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    border: 'border-rose-500/20',
    icon: <XCircle className="h-4 w-4" />,
    label: 'Crítico'
  }
}

const getInitials = (name: string) => {
  return name.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function DashboardTable({ data, semExpectativa = false }: { data: DataRow[]; semExpectativa?: boolean }) {
  if (data.length === 0) {
    return (
      <div className="p-12 text-center border border-border rounded-none bg-card shadow-xs italic text-sm text-muted-foreground">
        Nenhum dado encontrado para o período ou área selecionada.
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => b.indice - a.indice)

  return (
    <div className="border border-border rounded-none bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="py-3 pl-6 font-semibold text-xs text-foreground uppercase tracking-wider">Colaborador</TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider">Carga</TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider">Entregue</TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider">Dias Lançados</TableHead>
              <TableHead className="text-right font-semibold text-xs text-foreground uppercase tracking-wider pr-6">Índice</TableHead>
              <TableHead className="text-center font-semibold text-xs text-foreground uppercase tracking-wider w-32">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => {
              const status = getIndicatorStyle(row.indice, semExpectativa)
              return (
                <TableRow 
                  key={row.colaborador_id} 
                  className="border-b border-border/60 hover:bg-secondary/40 transition-colors group"
                >
                  <TableCell className="pl-6 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {getInitials(row.nome)}
                      </div>
                      <Link href={`/dashboard/${row.colaborador_id}`} className="font-semibold text-xs text-foreground hover:text-primary transition-colors">
                        {row.nome}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-medium">{formatarTempo(row.carga_total)}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-foreground">{formatarTempo(row.tempo_total)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-medium">
                    <span className="text-foreground font-semibold">{row.dias_apontados}</span> / {row.dias_uteis}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <span className="font-bold text-sm text-foreground">{(row.indice * 100).toFixed(1)}%</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <div 
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-bold border ${status.bg} ${status.text} ${status.border}`}
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
