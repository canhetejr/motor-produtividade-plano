'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Target } from 'lucide-react'
import { format, parseISO, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Apontamento = {
  id: string
  quantidade: number
  demandas: {
    nome: string
  }
}

export function DailyProgressBlocks({ 
  apontamentos, 
  selectedDate 
}: { 
  apontamentos: Apontamento[]
  selectedDate: string 
}) {
  const blocos = apontamentos.flatMap((ap) => 
    Array.from({ length: Math.ceil(ap.quantidade) }).map((_, i) => ({
      id: `${ap.id}-${i}`,
      nome: ap.demandas.nome
    }))
  )

  const emptyBlocks = Math.max(0, 10 - blocos.length)
  const isSelectedToday = isToday(parseISO(selectedDate))

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card/80 border border-border shadow-xl rounded-3xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[60px] pointer-events-none -z-10" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-linear-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center text-primary shadow-sm">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">
              {isSelectedToday ? 'Progresso Diário' : `Progresso de ${format(parseISO(selectedDate), "dd 'de' MMM", { locale: ptBR })}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isSelectedToday ? 'Suas demandas entregues hoje' : 'Demandas entregues neste dia'}
            </p>
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-black text-primary shadow-inner border border-primary/20">
          {blocos.length}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2.5 mt-2">
        {blocos.length === 0 && emptyBlocks > 0 && (
          <div className="w-full text-center py-6 text-sm text-muted-foreground italic bg-muted/30 rounded-xl border border-dashed border-border/50">
            Nenhuma demanda registrada {isSelectedToday ? 'hoje ainda. Vamos começar!' : 'neste dia.'}
          </div>
        )}

        {blocos.map((bloco, idx) => (
          <motion.div
            key={bloco.id}
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: idx * 0.03 + 0.2 
            }}
            title={bloco.nome}
            className="group relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/80 shadow-md shadow-primary/20 text-primary-foreground cursor-default hover:scale-110 transition-all duration-300"
          >
            <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 opacity-90 drop-shadow-sm" />
            
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20 shadow-xl">
              {bloco.nome}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
            </div>
          </motion.div>
        ))}

        {Array.from({ length: emptyBlocks }).map((_, idx) => (
          <div 
            key={`empty-${idx}`} 
            className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-muted/20 border border-dashed border-border/60 transition-colors hover:bg-muted/40" 
          />
        ))}
      </div>
    </motion.div>
  )
}
