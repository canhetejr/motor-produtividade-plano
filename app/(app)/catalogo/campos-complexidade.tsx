'use client'

import { useState } from 'react'
import { FileDiff, Gauge } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  NIVEIS_COMPLEXIDADE,
  ROTULO_COMPLEXIDADE,
  MINUTOS_PADRAO_COMPLEXIDADE,
  ehNivelComplexidade,
  type NivelComplexidade,
} from '@/lib/produtividade'

/**
 * "Tempo variável" e o nível de complexidade, juntos.
 *
 * Estão no mesmo componente porque a segunda pergunta só existe por causa da
 * primeira: demanda variável não tem tempo esperado, e sem esperado ela fica
 * fora da produtividade para sempre. O nível é o esperado provisório, até a
 * demanda acumular execuções e virar tempo fixo de verdade.
 *
 * Componente próprio, e não mais dois campos soltos no formulário, porque o
 * catálogo usa o mesmo par em dois lugares (criar e editar) e o "mostrar só
 * quando variável" exige estado — que um formulário não controlado não tem.
 */
export function CamposComplexidade({
  idPrefixo,
  defaultVariavel = false,
  defaultComplexidade = null,
  minutosPorNivel = MINUTOS_PADRAO_COMPLEXIDADE,
}: {
  idPrefixo: string
  defaultVariavel?: boolean
  defaultComplexidade?: string | null
  minutosPorNivel?: Record<NivelComplexidade, number>
}) {
  const [variavel, setVariavel] = useState(defaultVariavel)
  const inicial = ehNivelComplexidade(defaultComplexidade) ? defaultComplexidade : ''

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
        <div className="space-y-0.5">
          <Label className="text-base flex items-center gap-2">
            <FileDiff className="h-4 w-4 text-muted-foreground" />
            Tempo Variável
          </Label>
          <p className="text-xs text-muted-foreground">Demanda não tem tempo fixo</p>
        </div>
        <Switch name="variavel" checked={variavel} onCheckedChange={setVariavel} />
      </div>

      {variavel && (
        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
          <Label htmlFor={`${idPrefixo}-complexidade`} className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Nível de complexidade
          </Label>
          <p className="text-xs text-muted-foreground">
            Quanto esta demanda costuma levar. É contra esse tempo que a produtividade é medida,
            até haver execuções suficientes para fixar um tempo padrão.
          </p>
          {/* SelectValue não deriva o rótulo do item sozinho — sem a função de
              formatação o gatilho mostra o valor cru ("muito_alta"). */}
          <Select name="complexidade" defaultValue={inicial}>
            <SelectTrigger id={`${idPrefixo}-complexidade`} className="w-full">
              <SelectValue placeholder="Sem nível definido">
                {(valor) =>
                  ehNivelComplexidade(valor)
                    ? `${ROTULO_COMPLEXIDADE[valor]} · ${minutosPorNivel[valor]} min`
                    : 'Sem nível definido'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* Sair do nível é uma escolha possível: a demanda volta a ser
                  variável pura, só que sem produtividade medida. */}
              <SelectItem value="">Sem nível definido</SelectItem>
              {NIVEIS_COMPLEXIDADE.map((nivel) => (
                <SelectItem key={nivel} value={nivel}>
                  {ROTULO_COMPLEXIDADE[nivel]} · {minutosPorNivel[nivel]} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}
