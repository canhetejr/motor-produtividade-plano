'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Sparkles } from 'lucide-react'

import { CHAVE_TOUR, PASSOS_TOUR, tourJaVisto } from '@/lib/tour-boas-vindas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

const EVENTO = 'vertice:tour'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

/**
 * Boas-vindas de primeira visita, uma vez por aparelho.
 *
 * Não há sinal de "primeiro acesso" no banco — quem cadastra a pessoa é o
 * gestor, não um fluxo de auto-cadastro (este não é um SaaS público ainda; ver
 * docs/PLANO-SAAS.md). "Visto" aqui significa "visto NESTE navegador", que é a
 * pergunta certa para uma coisa que só existe pra orientar, não pra controlar
 * acesso.
 */
export function TourBoasVindas() {
  const router = useRouter()
  const [passo, setPasso] = useState(0)

  const bruto = useSyncExternalStore(
    assinar,
    () => localStorage.getItem(CHAVE_TOUR),
    () => '1' // No servidor, assume visto — evita o tour piscar antes da hidratação.
  )
  const aberto = !tourJaVisto(bruto)

  function marcarVisto() {
    localStorage.setItem(CHAVE_TOUR, '1')
    window.dispatchEvent(new Event(EVENTO))
  }

  function avancar() {
    if (passo < PASSOS_TOUR.length - 1) {
      setPasso((p) => p + 1)
      return
    }
    marcarVisto()
  }

  const atual = PASSOS_TOUR[passo]
  const ultimoPasso = passo === PASSOS_TOUR.length - 1

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && marcarVisto()}>
      <DialogContent showCloseButton={false} className="overflow-hidden sm:max-w-sm">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-2xs font-bold uppercase tracking-wider">Bem-vindo ao Vértice</span>
        </div>

        {/* AnimatePresence com mode="wait": o passo anterior sai antes do
            próximo entrar, em vez de os dois animarem por cima um do outro —
            "transição entre estados", não dois textos se sobrepondo. */}
        <div className="relative mt-3 min-h-[104px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={passo}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <h2 className="text-lg font-bold">{atual.titulo}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{atual.descricao}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {PASSOS_TOUR.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === passo ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={marcarVisto}>
              Pular
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (ultimoPasso) router.push(atual.href)
                avancar()
              }}
              className="gap-1.5"
            >
              {ultimoPasso ? (
                <>
                  Começar <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Próximo <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
