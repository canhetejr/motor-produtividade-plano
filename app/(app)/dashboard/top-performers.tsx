'use client'

import { motion } from 'framer-motion'
import { Trophy, Medal, Award } from 'lucide-react'
import Link from 'next/link'

type Performer = {
  colaborador_id: string
  nome: string
  indice: number
}

export function TopPerformers({ data }: { data: Performer[] }) {
  // Sort descending by indice and take top 3
  const top3 = [...data]
    .filter(p => p.indice > 0)
    .sort((a, b) => b.indice - a.indice)
    .slice(0, 3)

  if (top3.length === 0) {
    return (
      <div className="bg-card border border-border shadow-xs rounded-none p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
          <div className="h-9 w-9 bg-amber-500/10 text-amber-600 rounded-none flex items-center justify-center font-bold border border-amber-500/20">
            <Trophy className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Top Performers</h3>
            <p className="text-xs text-muted-foreground">Ranking de produtividade do período</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic bg-secondary/30 rounded-none border border-dashed border-border py-8">
          Nenhum dado de produtividade no período.
        </div>
      </div>
    )
  }

  const icons = [
    <Trophy key="1" className="h-5 w-5 text-amber-500 drop-shadow-md" />,
    <Medal key="2" className="h-5 w-5 text-slate-400 drop-shadow-md" />,
    <Award key="3" className="h-5 w-5 text-amber-700 drop-shadow-md" />
  ]

  const getInitials = (name: string) => {
    return name.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div className="bg-card border border-border shadow-xs rounded-none p-6 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
        <div className="h-9 w-9 bg-amber-500/10 text-amber-600 rounded-none flex items-center justify-center font-bold border border-amber-500/20">
          <Trophy className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground">Top Performers</h3>
          <p className="text-xs text-muted-foreground">Ranking de produtividade do período</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-1">
        {top3.map((performer, idx) => (
          <div
            key={performer.colaborador_id}
            className="flex items-center gap-3 p-2.5 rounded-none bg-secondary/50 border border-border/60 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center justify-center w-6 shrink-0 font-bold text-xs">
              {icons[idx]}
            </div>

            <div className="h-8 w-8 rounded-none bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials(performer.nome)}
            </div>

            <div className="flex-1 min-w-0">
              <Link href={`/dashboard/${performer.colaborador_id}`} className="text-xs font-bold text-foreground truncate block hover:text-primary transition-colors">
                {performer.nome}
              </Link>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                {(performer.indice * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
