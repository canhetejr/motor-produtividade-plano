'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Play, Pause, RotateCcw, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  decorrido,
  estaRodando,
  formatarRelogio,
  iniciar,
  lerEstado,
  paraMinutos,
  pausar,
  zerar,
  type EstadoCronometro,
} from '@/lib/cronometro'

const CHAVE = 'vertice:cronometro-apontamento'
const EVENTO = 'vertice:cronometro'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

function gravar(estado: EstadoCronometro) {
  localStorage.setItem(CHAVE, JSON.stringify(estado))
  window.dispatchEvent(new Event(EVENTO))
}

/**
 * Cronômetro para demanda variável, onde o tempo é digitado à mão.
 *
 * O que fica guardado é o INSTANTE DE INÍCIO, não o contador. Guardar o contador
 * perderia o tempo decorrido enquanto a aba esteve fechada — e no celular a aba
 * fecha o tempo todo.
 */
export function Cronometro({ onAplicar }: { onAplicar: (minutos: number) => void }) {
  const bruto = useSyncExternalStore(
    assinar,
    () => localStorage.getItem(CHAVE),
    () => null
  )
  const estado = lerEstado(bruto)
  const rodando = estaRodando(estado)

  // Date.now() nao pode ser lido durante o render (react-hooks/purity, e com
  // razao: torna o render nao determinístico). O relogio vive em estado,
  // atualizado fora do render — o valor de verdade continua sendo derivado do
  // instante de inicio guardado, nunca de um contador incrementado.
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    const atualizar = () =>
      setSegundos(decorrido(lerEstado(localStorage.getItem(CHAVE)), Date.now()))
    // Agendado, e nao chamado no corpo do efeito, para nao encadear render
    // durante o commit.
    const inicial = setTimeout(atualizar, 0)
    const id = rodando ? setInterval(atualizar, 1000) : null
    return () => {
      clearTimeout(inicial)
      if (id) clearInterval(id)
    }
    // `bruto` entra na dependencia para o mostrador reagir a pausar/zerar na
    // hora, sem esperar o proximo tique.
  }, [rodando, bruto])

  const minutos = paraMinutos(segundos)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/20 p-2">
      <span
        className="font-mono text-lg font-bold tabular-nums"
        role="timer"
        aria-live="off"
        aria-label={`Tempo cronometrado: ${minutos} minutos`}
      >
        {formatarRelogio(segundos)}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {rodando ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => gravar(pausar(estado, Date.now()))}
            className="h-9 gap-1.5 md:h-8"
          >
            <Pause className="h-3.5 w-3.5" /> Pausar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => gravar(iniciar(estado, Date.now()))}
            className="h-9 gap-1.5 md:h-8"
          >
            <Play className="h-3.5 w-3.5" /> {segundos > 0 ? 'Retomar' : 'Iniciar'}
          </Button>
        )}

        {segundos > 0 && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onAplicar(minutos)
                gravar(zerar())
              }}
              className="h-9 gap-1.5 md:h-8"
            >
              <Check className="h-3.5 w-3.5" /> Usar {minutos} min
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Zerar cronômetro"
              onClick={() => gravar(zerar())}
              className="text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
