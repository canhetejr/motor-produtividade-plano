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
  indice: number
}

function getIndicatorColor(indice: number) {
  if (indice >= 1) return 'bg-green-500'
  if (indice >= 0.7) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function DashboardTable({ data }: { data: DataRow[] }) {
  if (data.length === 0) {
    return <div className="p-8 text-center border rounded-lg bg-card">Nenhum dado encontrado para o período/área selecionado.</div>
  }

  // Sort by indice desc
  const sortedData = [...data].sort((a, b) => b.indice - a.indice)

  return (
    <div className="border rounded-md bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead className="text-right">Carga Horária (min)</TableHead>
            <TableHead className="text-right">Entregue (min)</TableHead>
            <TableHead className="text-right">Índice</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row) => (
            <TableRow key={row.colaborador_id}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/${row.colaborador_id}`} className="text-blue-600 hover:underline">
                  {row.nome}
                </Link>
              </TableCell>
              <TableCell className="text-right">{row.carga_total}</TableCell>
              <TableCell className="text-right">{row.tempo_total}</TableCell>
              <TableCell className="text-right">{(row.indice * 100).toFixed(1)}%</TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center">
                  <div className={`w-4 h-4 rounded-full ${getIndicatorColor(row.indice)}`} title={`Índice: ${row.indice}`} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
