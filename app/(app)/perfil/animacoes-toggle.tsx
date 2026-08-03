'use client'

import { useSyncExternalStore } from 'react'
import { Sparkles, Zap } from 'lucide-react'

import { CHAVE_ANIMACOES, deveAnimar } from '@/lib/preferencia-animacoes'

const EVENTO = 'vertice:animacoes'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

const SEM_MUDANCA = () => () => {}

export function AnimacoesToggle() {
  const bruto = useSyncExternalStore(
    assinar,
    () => localStorage.getItem(CHAVE_ANIMACOES),
    () => null
  )
  const reduzir = useSyncExternalStore(
    SEM_MUDANCA,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true
  )
  const ligado = deveAnimar(bruto, reduzir)

  function definir(valor: 'ligado' | 'desligado') {
    localStorage.setItem(CHAVE_ANIMACOES, valor)
    // `storage` só dispara em outras abas; sem este, o fundo desta não reage.
    window.dispatchEvent(new Event(EVENTO))
  }

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold">Fundo animado</h4>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">
        Malha de vértices que reage ao cursor. Desligue se o aparelho ficar lento
        ou se o movimento incomodar.
      </p>
      <div className="grid max-w-sm grid-cols-2 gap-2">
        {(
          [
            { valor: 'ligado', label: 'Ligado', icon: Sparkles },
            { valor: 'desligado', label: 'Desligado', icon: Zap },
          ] as const
        ).map((opt) => (
          <button
            key={opt.valor}
            type="button"
            aria-pressed={ligado === (opt.valor === 'ligado')}
            onClick={() => definir(opt.valor)}
            className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
              ligado === (opt.valor === 'ligado')
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <opt.icon className="h-4 w-4" />
            {opt.label}
          </button>
        ))}
      </div>
      {reduzir && (
        <p className="mt-2 text-xs text-muted-foreground">
          Seu sistema pede menos movimento, então isto vem desligado por padrão.
          Ligar aqui vale só para este aparelho.
        </p>
      )}
    </div>
  )
}
