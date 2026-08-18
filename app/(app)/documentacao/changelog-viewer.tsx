'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CATEGORIAS_ORDEM, type ChangelogCategoria, type ChangelogEntrada, type ChangelogPublico } from '@/lib/changelog'

type ChangelogViewerProps = {
  entradas: ChangelogEntrada[]
  podeVerGestao: boolean
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function ChangelogViewer({ entradas, podeVerGestao }: ChangelogViewerProps) {
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState<ChangelogCategoria | null>(null)
  const [publicoAtivo, setPublicoAtivo] = useState<ChangelogPublico>(podeVerGestao ? 'gestao' : 'equipe')

  const entradasDaVisao = useMemo(
    () => entradas.filter((entrada) => entrada.publico === publicoAtivo),
    [entradas, publicoAtivo]
  )

  const categoriasDisponiveis = useMemo(
    () => CATEGORIAS_ORDEM.filter((categoria) => entradasDaVisao.some((entrada) => entrada.categorias.includes(categoria))),
    [entradasDaVisao]
  )

  const entradasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return entradasDaVisao.filter((entrada) => {
      if (categoriaAtiva && !entrada.categorias.includes(categoriaAtiva)) return false
      if (!termo) return true
      const alvo = [entrada.titulo, entrada.resumo, ...entrada.itens, ...entrada.categorias].join(' ').toLowerCase()
      return alvo.includes(termo)
    })
  }, [busca, categoriaAtiva, entradasDaVisao])

  function trocarPublico(publico: ChangelogPublico) {
    setPublicoAtivo(publico)
    setCategoriaAtiva(null)
  }

  return (
    <div className="space-y-6">
      {podeVerGestao && (
        <div className="flex flex-wrap gap-2" aria-label="Público das novidades">
          <button
            type="button"
            onClick={() => trocarPublico('gestao')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              publicoAtivo === 'gestao'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            Gestão & administração
          </button>
          <button
            type="button"
            onClick={() => trocarPublico('equipe')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              publicoAtivo === 'equipe'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            Equipe
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por funcionalidade, tela ou palavra-chave..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoriaAtiva(null)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            categoriaAtiva === null
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
          )}
        >
          Tudo
        </button>
        {categoriasDisponiveis.map((categoria) => (
          <button
            type="button"
            key={categoria}
            onClick={() => setCategoriaAtiva((atual) => (atual === categoria ? null : categoria))}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              categoriaAtiva === categoria
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {categoria}
          </button>
        ))}
      </div>

      {entradasFiltradas.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nada encontrado para essa busca.
        </p>
      ) : (
        <ol className="relative space-y-6 border-l border-border pl-6">
          {entradasFiltradas.map((entrada) => (
            <li key={entrada.id} className="relative">
              <span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
              <details className="group rounded-md ring-1 ring-foreground/10 bg-card open:shadow-sm" open>
                <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 select-none">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
                      v{entrada.versao}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {formatarData(entrada.data)}
                    </span>
                    {entrada.categorias.map((categoria) => (
                      <Badge key={categoria} variant="secondary">{categoria}</Badge>
                    ))}
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{entrada.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{entrada.resumo}</p>
                </summary>
                <ul className="space-y-1.5 px-4 pb-4 pl-8 text-sm text-muted-foreground list-disc marker:text-primary">
                  {entrada.itens.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
