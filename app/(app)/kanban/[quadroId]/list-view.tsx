'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Cartao, Coluna, Etiqueta, MembroQuadro } from './types'

const PRIORIDADE_LABEL: Record<Cartao['prioridade'], string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
const PRIORIDADE_CLASSE: Record<Cartao['prioridade'], string> = {
  baixa: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  media: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  alta: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
}

export function ListView({
  cartoes,
  colunas,
  etiquetas,
  membros,
  onSelect,
}: {
  cartoes: Cartao[]
  colunas: Coluna[]
  etiquetas: Etiqueta[]
  membros: MembroQuadro[]
  onSelect: (cartao: Cartao) => void
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-20">Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-40">Coluna</TableHead>
            <TableHead className="w-28">Prioridade</TableHead>
            <TableHead className="w-28">Prazo</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead className="w-32 text-right">Responsáveis</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cartoes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                Nenhum card encontrado.
              </TableCell>
            </TableRow>
          ) : (
            cartoes.map((c) => {
              const coluna = colunas.find((col) => col.id === c.coluna_id)
              const etiquetasCartao = etiquetas.filter((e) => c.etiquetas.includes(e.id))
              const responsaveisCartao = membros.filter((m) => c.responsaveis.includes(m.id))
              return (
                <TableRow key={c.id} onClick={() => onSelect(c)} className="cursor-pointer">
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.codigo}</TableCell>
                  <TableCell className="font-medium">{c.titulo}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs">
                      {coluna?.nome ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', PRIORIDADE_CLASSE[c.prioridade])}>
                      {PRIORIDADE_LABEL[c.prioridade]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.prazo ? new Date(c.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {etiquetasCartao.map((e) => (
                        <span
                          key={e.id}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                          style={{ color: e.cor, borderColor: e.cor, backgroundColor: `${e.cor}1A` }}
                        >
                          {e.nome}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {responsaveisCartao.map((m) => m.nome).join(', ') || '—'}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
