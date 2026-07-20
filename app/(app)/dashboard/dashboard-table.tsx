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

type DataRow = {
  colaborador_id: string
  nome: string
  carga_total: number
  tempo_total: number
  dias_apontados: number
  dias_uteis: number
  indice: number
}

function getIndicatorStyle(indice: number) {
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

export function DashboardTable({ data }: { data: DataRow[] }) {
  if (data.length === 0) {
    return (
      <div className="p-12 text-center border rounded-3xl bg-card/50 backdrop-blur-md shadow-lg italic text-muted-foreground">
        Nenhum dado encontrado para o período ou área selecionada.
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => b.indice - a.indice)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="border border-border/50 rounded-3xl bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden"
    >
      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="border-b-border/50 bg-muted/20 hover:bg-muted/20">
              <TableHead className="py-4 pl-6 font-bold text-foreground/80">Colaborador</TableHead>
              <TableHead className="text-right font-bold text-foreground/80">Carga (min)</TableHead>
              <TableHead className="text-right font-bold text-foreground/80">Entregue (min)</TableHead>
              <TableHead className="text-right font-bold text-foreground/80">Dias Lançados</TableHead>
              <TableHead className="text-right font-bold text-foreground/80 pr-6">Índice</TableHead>
              <TableHead className="text-center font-bold text-foreground/80 w-32">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => {
              const status = getIndicatorStyle(row.indice)
              return (
                <TableRow 
                  key={row.colaborador_id} 
                  className="border-b-border/30 hover:bg-muted/30 transition-colors group"
                >
                  <TableCell className="pl-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary group-hover:scale-110 transition-transform">
                        {getInitials(row.nome)}
                      </div>
                      <Link href={`/dashboard/${row.colaborador_id}`} className="font-bold text-sm text-foreground hover:text-primary transition-colors">
                        {row.nome}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-medium">{row.carga_total}</TableCell>
                  <TableCell className="text-right font-bold">{Math.round(row.tempo_total)}</TableCell>
                  <TableCell className="text-right text-muted-foreground font-medium">
                    <span className="text-foreground">{row.dias_apontados}</span> / {row.dias_uteis}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <span className="font-bold text-lg">{(row.indice * 100).toFixed(1)}%</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <div 
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${status.bg} ${status.text} ${status.border}`}
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
    </motion.div>
  )
}
