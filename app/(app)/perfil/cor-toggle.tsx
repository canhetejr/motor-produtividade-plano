'use client'

import { useSyncExternalStore } from 'react'
import { Check, Pipette } from 'lucide-react'
import { CHAVE_COR, CORES_PRESET, COR_PADRAO, lerPreferenciaCor } from '@/lib/preferencia-cor'

const EVENTO = 'vertice:cor-primaria'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

export function CorToggle() {
  const bruto = useSyncExternalStore(assinar, () => localStorage.getItem(CHAVE_COR), () => null)
  const cor = lerPreferenciaCor(bruto)
  const personalizada = !CORES_PRESET.some((preset) => preset.valor.toLowerCase() === cor.toLowerCase())

  function definir(novaCor: string) {
    localStorage.setItem(CHAVE_COR, novaCor)
    window.dispatchEvent(new Event(EVENTO))
  }

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold">Cor principal</h4>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">
        A cor de destaque do Vértice — botões, links e a logo seguem essa escolha.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {CORES_PRESET.map((preset) => {
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

        {cor.toLowerCase() !== COR_PADRAO.toLowerCase() && (
          <button
            type="button"
            onClick={() => definir(COR_PADRAO)}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Restaurar padrão
          </button>
        )}
      </div>
    </div>
  )
}
