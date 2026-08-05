'use client'

import { Briefcase, TrendingUp } from 'lucide-react'

type DemandaAgg = {
  nome: string
  quantidade: number
}

export function TopDemandas({ data }: { data: DemandaAgg[] }) {
  const top5 = [...data].sort((a, b) => b.quantidade - a.quantidade).slice(0, 5)
  const maxQtd = top5.length > 0 ? top5[0].quantidade : 1

  if (top5.length === 0) {
    return (
      <div className="bg-card border border-border shadow-xs rounded-md p-5 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
          <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold border border-primary/20">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground">Top Demandas</h3>
            <p className="text-xs text-muted-foreground">Tarefas mais executadas no período</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic bg-secondary/30 rounded-lg border border-dashed border-border py-8">
          Nenhum apontamento registrado no período.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border shadow-xs rounded-md p-5 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold border border-primary/20">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-bold tracking-tight text-foreground">Top Demandas</h3>
          <p className="text-xs text-muted-foreground">Tarefas mais executadas no período</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-1">
        {top5.map((demanda) => {
          const percentage = (demanda.quantidade / maxQtd) * 100
          
          return (
            <div key={demanda.nome} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground truncate pr-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  {demanda.nome}
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  {Math.round(demanda.quantidade)}x
                </span>
              </div>
              
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border/30">
                <div
                  style={{ width: `${percentage}%` }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
