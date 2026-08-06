'use client'

import { useSyncExternalStore } from 'react'
import { Circle, Square, Squircle } from 'lucide-react'
import { CHAVE_RAIO, lerPreferenciaRaio, type PreferenciaRaio } from '@/lib/preferencia-raio'

const EVENTO = 'vertice:bordas'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

export function BordasToggle() {
  const bruto = useSyncExternalStore(assinar, () => localStorage.getItem(CHAVE_RAIO), () => null)
  const valor = lerPreferenciaRaio(bruto)

  function definir(novoValor: PreferenciaRaio) {
    localStorage.setItem(CHAVE_RAIO, novoValor)
    window.dispatchEvent(new Event(EVENTO))
  }

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold">Cantos da interface</h4>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">Escolha entre linhas retas, cantos arredondados ou o máximo de curvatura em todo o Vértice.</p>
      <div className="grid max-w-sm grid-cols-3 gap-2">
        {([
          { valor: 'reto', label: 'Retos', icon: Square },
          { valor: 'arredondado', label: 'Arredondados', icon: Circle },
          { valor: 'maximo', label: 'Máximos', icon: Squircle },
        ] as const).map((opt) => (
          <button key={opt.valor} type="button" aria-pressed={valor === opt.valor} onClick={() => definir(opt.valor)} className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${valor === opt.valor ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
            <opt.icon className="size-4" />{opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
