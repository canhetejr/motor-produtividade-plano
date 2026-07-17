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

type DataRow = {
  colaborador_id: string
  nome: string
  carga_total: number
  tempo_total: number
  dias_apontados: number
  dias_uteis: number
  indice: number
}

function getIndicatorColor(indice: number) {
  if (indice >= 1) return 'bg-success'
  if (indice >= 0.7) return 'bg-warning'
  return 'bg-danger'
}

export function DashboardTable({ data }: { data: DataRow[] }) {
  if (data.length === 0) {
    return <div className="p-8 text-center border rounded-lg bg-card">Nenhum dado encontrado para o período/área selecionado.</div>
  }

  const sortedData = [...data].sort((a, b) => b.indice - a.indice)

  return (
    <div className="border rounded-md bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead className="text-right">Carga do Período (min)</TableHead>
            <TableHead className="text-right">Entregue (min)</TableHead>
            <TableHead className="text-right">Dias Apontados</TableHead>
            <TableHead className="text-right">Índice</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row) => (
            <TableRow key={row.colaborador_id}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/${row.colaborador_id}`} className="text-primary hover:underline">
                  {row.nome}
                </Link>
              </TableCell>
              <TableCell className="text-right">{row.carga_total}</TableCell>
              <TableCell className="text-right">{Math.round(row.tempo_total)}</TableCell>
              <TableCell className="text-right">{row.dias_apontados}/{row.dias_uteis}</TableCell>
              <TableCell className="text-right">{(row.indice * 100).toFixed(1)}%</TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center">
                  <div className={`w-4 h-4 rounded-full ${getIndicatorColor(row.indice)}`} title={`Índice: ${(row.indice * 100).toFixed(1)}%`} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
