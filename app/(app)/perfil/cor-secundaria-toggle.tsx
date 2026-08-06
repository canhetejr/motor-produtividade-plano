'use client'

import { useSyncExternalStore } from 'react'
import { Check, Pipette } from 'lucide-react'
import {
  CHAVE_COR_SECUNDARIA,
  CORES_SECUNDARIAS_PRESET,
  COR_SECUNDARIA_PADRAO,
  lerPreferenciaCorSecundaria,
} from '@/lib/preferencia-cor-secundaria'

const EVENTO = 'vertice:cor-secundaria'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

export function CorSecundariaToggle() {
  const bruto = useSyncExternalStore(assinar, () => localStorage.getItem(CHAVE_COR_SECUNDARIA), () => null)
  const cor = lerPreferenciaCorSecundaria(bruto)
  const personalizada = !CORES_SECUNDARIAS_PRESET.some((preset) => preset.valor.toLowerCase() === cor.toLowerCase())

  function definir(novaCor: string) {
    localStorage.setItem(CHAVE_COR_SECUNDARIA, novaCor)
    window.dispatchEvent(new Event(EVENTO))
  }

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold">Cor secundária</h4>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">
        A cor de destaque das métricas — calendário de ritmo, metas atingidas e as partículas do fundo.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {CORES_SECUNDARIAS_PRESET.map((preset) => {
          const ativo = cor.toLowerCase() === preset.valor.toLowerCase()
          return (
            <button
              key={preset.valor}
              type="button"
              title={preset.nome}
              aria-label={preset.nome}
              aria-pressed={ativo}
              onClick={() => definir(preset.valor)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 transition-transform hover:scale-105"
              style={{ backgroundColor: preset.valor }}
            >
              {ativo && <Check className="size-4 text-white drop-shadow" />}
            </button>
          )
        })}

        <label
          title="Cor personalizada"
          className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-transform hover:scale-105"
          style={personalizada ? { backgroundColor: cor, borderStyle: 'solid' } : undefined}
        >
          {personalizada ? <Check className="size-4 text-white drop-shadow" /> : <Pipette className="size-3.5" />}
          <input
            type="color"
            value={cor}
            onChange={(e) => definir(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Escolher cor personalizada"
          />
        </label>

        {cor.toLowerCase() !== COR_SECUNDARIA_PADRAO.toLowerCase() && (
          <button
            type="button"
            onClick={() => definir(COR_SECUNDARIA_PADRAO)}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Restaurar padrão
          </button>
        )}
      </div>
    </div>
  )
}
