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
      <div className="bg-card/80 border border-border shadow-lg rounded-2xl p-6 backdrop-blur-xl h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-linear-to-br from-amber-500/20 to-amber-500/5 rounded-xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-500/20">
            <Trophy className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Top Performers</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic bg-muted/20 rounded-xl border border-dashed border-border/50">
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card/80 border border-border shadow-xl rounded-3xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden flex flex-col h-full"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none -z-10" />

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-linear-to-br from-amber-500/20 to-amber-500/5 rounded-xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-500/20">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight">Top Performers</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Ranking de produtividade do período</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {top3.map((performer, idx) => (
          <motion.div
            key={performer.colaborador_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
            className="group relative flex items-center gap-4 p-3 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-transparent hover:border-border/50 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex items-center justify-center w-8 shrink-0 relative z-10">
              {icons[idx]}
            </div>

            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 shrink-0 relative z-10">
              {getInitials(performer.nome)}
            </div>

            <div className="flex-1 min-w-0 relative z-10">
              <Link href={`/dashboard/${performer.colaborador_id}`} className="text-sm font-bold truncate block group-hover:text-primary transition-colors">
                {performer.nome}
              </Link>
            </div>

            <div className="text-right shrink-0 relative z-10">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {(performer.indice * 100).toFixed(1)}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
