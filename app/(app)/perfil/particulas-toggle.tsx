'use client'

import { useState, useSyncExternalStore } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  CHAVE_PARTICULAS,
  LIMITES_PARTICULAS,
  PARTICULAS_PADRAO,
  lerPreferenciaParticulas,
  type FormaParticula,
  type PreferenciaParticulas,
} from '@/lib/preferencia-particulas'

const EVENTO = 'vertice:particulas'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

const FORMAS: { valor: FormaParticula; nome: string }[] = [
  { valor: 'circulo', nome: 'Círculo' },
  { valor: 'quadrado', nome: 'Quadrado' },
  { valor: 'triangulo', nome: 'Triângulo' },
  { valor: 'estrela', nome: 'Estrela' },
]

const CAMPOS: {
  chave: keyof typeof LIMITES_PARTICULAS
  rotulo: string
  sufixo: string
  passo: number
}[] = [
  { chave: 'tamanho', rotulo: 'Tamanho dos nós', sufixo: 'px', passo: 0.25 },
  { chave: 'densidade', rotulo: 'Quantidade de nós', sufixo: '×', passo: 0.1 },
  { chave: 'alcance', rotulo: 'Alcance das conexões', sufixo: 'px', passo: 5 },
  { chave: 'velocidade', rotulo: 'Velocidade', sufixo: '×', passo: 0.1 },
  { chave: 'reatividade', rotulo: 'Reatividade ao cursor', sufixo: '×', passo: 0.1 },
  { chave: 'opacidade', rotulo: 'Intensidade', sufixo: '×', passo: 0.1 },
]

export function ParticulasToggle() {
  const [aberto, setAberto] = useState(false)
  const bruto = useSyncExternalStore(assinar, () => localStorage.getItem(CHAVE_PARTICULAS), () => null)
  const preferencia = lerPreferenciaParticulas(bruto)
  const personalizada = JSON.stringify(preferencia) !== JSON.stringify(PARTICULAS_PADRAO)

  function salvar(nova: PreferenciaParticulas) {
    localStorage.setItem(CHAVE_PARTICULAS, JSON.stringify(nova))
    window.dispatchEvent(new Event(EVENTO))
  }

  function atualizarCampo(campo: keyof Omit<PreferenciaParticulas, 'forma'>, valor: number) {
    salvar({ ...preferencia, [campo]: valor })
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <h4 className="text-sm font-semibold">Personalizar partículas</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Controle avançado: tamanho, quantidade, alcance, velocidade, reatividade e forma dos nós.
          </p>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && (
        <div className="mt-3 space-y-4 rounded-md border border-border bg-background/40 p-4">
          {CAMPOS.map(({ chave, rotulo, sufixo, passo }) => {
            const [min, max] = LIMITES_PARTICULAS[chave]
            const valor = preferencia[chave]
            return (
              <div key={chave}>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor={`particulas-${chave}`} className="font-medium text-foreground">
                    {rotulo}
                  </label>
                  <span className="font-mono text-muted-foreground">
                    {valor.toFixed(2)}
                    {sufixo}
                  </span>
                </div>
                <input
                  id={`particulas-${chave}`}
                  type="range"
                  min={min}
                  max={max}
                  step={passo}
                  value={valor}
                  onChange={(e) => atualizarCampo(chave, Number(e.target.value))}
                  className="mt-1.5 w-full accent-primary"
                />
              </div>
            )
          })}

          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Forma dos nós</p>
            <div className="flex flex-wrap gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  aria-pressed={preferencia.forma === f.valor}
                  onClick={() => salvar({ ...preferencia, forma: f.valor })}
                  className={`rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors ${
                    preferencia.forma === f.valor
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {f.nome}
                </button>
              ))}
            </div>
          </div>

          {personalizada && (
            <button type="button" onClick={() => salvar(PARTICULAS_PADRAO)} className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Restaurar padrão
            </button>
          )}
        </div>
      )}
    </div>
  )
}
