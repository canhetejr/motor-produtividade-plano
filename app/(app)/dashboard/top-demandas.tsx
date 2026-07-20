'use client'

import { motion } from 'framer-motion'
import { Briefcase, TrendingUp } from 'lucide-react'

type DemandaAgg = {
  nome: string
  quantidade: number
}

export function TopDemandas({ data }: { data: DemandaAgg[] }) {
  // Take top 5
  const top5 = [...data].sort((a, b) => b.quantidade - a.quantidade).slice(0, 5)
  const maxQtd = top5.length > 0 ? top5[0].quantidade : 1

  if (top5.length === 0) {
    return (
      <div className="bg-card/80 border border-border shadow-lg rounded-2xl p-6 backdrop-blur-xl h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-linear-to-br from-indigo-500/20 to-indigo-500/5 rounded-xl flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/20">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Top Demandas</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic bg-muted/20 rounded-xl border border-dashed border-border/50">
          Nenhum apontamento registrado no período.
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card/80 border border-border shadow-xl rounded-3xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden flex flex-col h-full"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[60px] pointer-events-none -z-10" />

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-linear-to-br from-indigo-500/20 to-indigo-500/5 rounded-xl flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/20">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight">Top Demandas</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Tarefas mais executadas no período</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {top5.map((demanda, idx) => {
          const percentage = (demanda.quantidade / maxQtd) * 100
          
          return (
            <motion.div
              key={demanda.nome}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="group relative"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-foreground/90 truncate pr-4 flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground/50" />
                  {demanda.nome}
                </span>
                <span className="text-xs font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  {Math.round(demanda.quantidade)}x
                </span>
              </div>
              
              <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden border border-border/50">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, delay: 0.5 + idx * 0.1, ease: "easeOut" }}
                  className="h-full bg-linear-to-r from-indigo-500/80 to-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
