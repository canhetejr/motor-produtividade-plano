'use client'

import { useMemo, useState, useEffect } from 'react'
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
  ChevronRight,
  Info,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DOCUMENTACAO, type SecaoDocumentacao } from '@/lib/documentacao'

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
  const [secaoAtiva, setSecaoAtiva] = useState<string>(DOCUMENTACAO[0].id)

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

  useEffect(() => {
    if (busca.trim()) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSecaoAtiva(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px' }
    )

    DOCUMENTACAO.forEach((secao) => {
      const el = document.getElementById(secao.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [busca])

  return (
    <div className="space-y-6">
      {/* Search Header Bar */}
      <div className="bg-card border border-border shadow-xs rounded-md p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na documentação (ex.: SLA, cronômetro, índice, automação, formulário...)"
            className="pl-10 h-11 bg-background text-sm font-medium border-border/80 focus-visible:ring-primary"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground bg-secondary px-2 py-0.5 rounded border border-border"
            >
              Limpar
            </button>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground bg-secondary/50 px-3 py-2 rounded-lg border border-border shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>{secoesFiltradas.length} módulo{secoesFiltradas.length > 1 ? 's' : ''} encontrado{secoesFiltradas.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Main Documentation Grid: Left TOC Sidebar + Right Content Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sticky Table of Contents Sidebar */}
        <aside className="lg:col-span-3 lg:sticky lg:top-20 space-y-3 hidden lg:block">
          <div className="px-2 py-1 flex items-center justify-between text-2xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Índice do Guia</span>
            <span className="text-3xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">12 Capítulos</span>
          </div>

          <nav className="space-y-1 max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1 custom-scrollbar">
            {DOCUMENTACAO.map((secao) => {
              const Icone = ICONES[secao.icone]
              const isSelected = secaoAtiva === secao.id && !busca.trim()
              return (
                <a
                  key={secao.id}
                  href={`#${secao.id}`}
                  onClick={() => setSecaoAtiva(secao.id)}
                  className={cn(
                    'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  )}
                >
                  <Icone className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary-foreground' : 'text-primary/70 group-hover:text-primary')} />
                  <span className="truncate flex-1">{secao.titulo}</span>
                  <ChevronRight className={cn('h-3 w-3 shrink-0 max-md:opacity-100 focus-within:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity', isSelected && 'opacity-100 text-primary-foreground')} />
                </a>
              )
            })}
          </nav>
        </aside>

        {/* Right Content Stream */}
        <main className="lg:col-span-9 space-y-8">
          {secoesFiltradas.length === 0 ? (
            <div className="bg-card rounded-md border border-dashed border-border p-12 text-center space-y-3">
              <Info className="h-8 w-8 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold text-foreground">Nenhum resultado encontrado</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Não encontramos tópicos correspondentes a &ldquo;{busca}&rdquo;. Tente buscar por termos genéricos como <span className="text-primary font-bold">Kanban</span>, <span className="text-primary font-bold">cronômetro</span> ou <span className="text-primary font-bold">relatórios</span>.
              </p>
            </div>
          ) : (
            secoesFiltradas.map((secao) => {
              const Icone = ICONES[secao.icone]
              return (
                <section
                  key={secao.id}
                  id={secao.id}
                  className="relative scroll-mt-24 border-b border-border pb-8 last:border-b-0"
                >
                  {/* Section Header */}
                  <div className="flex items-start gap-3.5 pb-4 border-b border-border mb-6">
                    <div className="h-10 w-10 rounded-md bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <Icone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        {secao.titulo}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {secao.resumo}
                      </p>
                    </div>
                  </div>

                  {/* Topic Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {secao.topicos.map((topico) => (
                      <div
                        key={topico.titulo}
                        className={cn(
                          'rounded-md border border-border/70 bg-secondary/20 p-4 transition-all hover:bg-secondary/40 flex flex-col justify-between',
                          secao.topicos.length === 1 && 'md:col-span-2'
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            <h3 className="text-sm font-semibold text-foreground">
                              {topico.titulo}
                            </h3>
                          </div>
                          <p className="text-sm font-normal leading-relaxed text-muted-foreground">
                            {topico.texto}
                          </p>
                        </div>

                        {/* Visual Dica Tag if topic touches critical business rules */}
                        {(topico.titulo.toLowerCase().includes('banco') || topico.titulo.toLowerCase().includes('cronômetro') || topico.titulo.toLowerCase().includes('índice')) && (
                          <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-primary font-semibold">
                            <Info className="w-3.5 h-3.5 shrink-0 text-primary" />
                            <span>Regra validada no sistema</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )
            })
          )}
        </main>
      </div>
    </div>
  )
}
