'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Compass,
  Clock,
  FolderKanban,
  Kanban,
  CreditCard,
  Flag,
  Timer,
  Zap,
  FileText,
  Bell,
  FileSpreadsheet,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DOCUMENTACAO, type SecaoDocumentacao } from '@/lib/documentacao'

// Guia do sistema: busca + navegação por seção sobre o conteúdo estático de
// lib/documentacao.ts. Mesmo desenho do ChangelogViewer ao lado — filtro por
// `includes` num texto achatado, sem estado além da busca.

const ICONES: Record<SecaoDocumentacao['icone'], LucideIcon> = {
  Compass,
  Clock,
  FolderKanban,
  Kanban,
  CreditCard,
  Flag,
  Timer,
  Zap,
  FileText,
  Bell,
  FileSpreadsheet,
  ShieldCheck,
}

export function DocumentacaoViewer() {
  const [busca, setBusca] = useState('')

  // A busca filtra TÓPICOS, não seções inteiras: quem procura "SLA" quer o
  // parágrafo sobre SLA, não a seção de Kanban completa.
  const secoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return DOCUMENTACAO

    return DOCUMENTACAO.map((secao) => {
      const secaoBate = `${secao.titulo} ${secao.resumo}`.toLowerCase().includes(termo)
      const topicos = secaoBate
        ? secao.topicos
        : secao.topicos.filter((t) => `${t.titulo} ${t.texto}`.toLowerCase().includes(termo))
      return { ...secao, topicos }
    }).filter((secao) => secao.topicos.length > 0)
  }, [busca])

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar no guia — ex.: SLA, entregar, índice, automação..."
          className="pl-9"
        />
      </div>

      {/* Atalhos de seção — âncoras, não filtros: a página inteira continua lá. */}
      {!busca.trim() && (
        <div className="flex flex-wrap gap-2">
          {DOCUMENTACAO.map((secao) => (
            <a
              key={secao.id}
              href={`#${secao.id}`}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {secao.titulo}
            </a>
          ))}
        </div>
      )}

      {secoesFiltradas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Nada encontrado para &ldquo;{busca}&rdquo;.
        </p>
      ) : (
        <div className="space-y-6">
          {secoesFiltradas.map((secao) => {
            const Icone = ICONES[secao.icone]
            return (
              // scroll-mt compensa qualquer header fixo ao navegar por âncora
              <section key={secao.id} id={secao.id} className="scroll-mt-20 rounded-xl border border-border bg-card p-5">
                <div className="mb-1 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icone className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold tracking-tight">{secao.titulo}</h2>
                    <p className="text-xs text-muted-foreground">{secao.resumo}</p>
                  </div>
                </div>

                <div className={cn('mt-4 grid gap-4', secao.topicos.length > 1 && 'sm:grid-cols-2')}>
                  {secao.topicos.map((topico) => (
                    <div key={topico.titulo} className="rounded-lg border border-border/60 bg-secondary/20 p-3.5">
                      <h3 className="mb-1 text-sm font-semibold text-foreground">{topico.titulo}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{topico.texto}</p>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
