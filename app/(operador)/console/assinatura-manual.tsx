'use client'

import { useState, useTransition } from 'react'
import { Loader2, PauseCircle, Save, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstadoBadge } from '@/components/ui/estado-badge'
import { cancelarAssinaturaManual, atualizarAssinaturaManual, criarAssinaturaManual, pausarAssinaturaManual } from './actions'
import type { AssinaturaManualOperador, OrganizacaoOperador, PlanoOperador } from './tipos'

type FormAssinatura = {
  planoId: string
  cicloCobranca: AssinaturaManualOperador['cicloCobranca']
  iniciaEm: string
  renovaEm: string
  proximaCobrancaEm: string
  valorCentavos: string
  observacoes: string
}

const hoje = () => new Date().toISOString().slice(0, 10)
const paraForm = (assinatura: AssinaturaManualOperador | null, planoPadrao: string): FormAssinatura => ({
  planoId: assinatura?.planoId ?? planoPadrao,
  cicloCobranca: assinatura?.cicloCobranca ?? 'mensal',
  iniciaEm: assinatura?.iniciaEm ?? hoje(),
  renovaEm: assinatura?.renovaEm ?? '',
  proximaCobrancaEm: assinatura?.proximaCobrancaEm ?? '',
  valorCentavos: assinatura ? String(assinatura.valorCentavos) : '',
  observacoes: assinatura?.observacoes ?? '',
})
const dinheiro = (centavos: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
const estado = (status: AssinaturaManualOperador['status']) => status === 'ativa' ? 'sucesso' : status === 'pausada' ? 'atencao' : 'neutro'

/** Termos comerciais manuais — nenhum botão aqui chama ou promete um gateway. */
export function AssinaturaManual({ org, planos }: { org: OrganizacaoOperador; planos: PlanoOperador[] }) {
  const assinatura = org.assinaturaManual
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState(() => paraForm(assinatura, org.planoId))
  const alterar = (campo: keyof FormAssinatura, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }))
  const entrada = () => ({
    ...form,
    status: assinatura?.status ?? 'ativa',
    renovaEm: form.renovaEm || null,
    proximaCobrancaEm: form.proximaCobrancaEm || null,
  })
  const planosDisponiveis = planos.filter((plano) => plano.ativo || plano.id === assinatura?.planoId)

  const salvar = () => startTransition(async () => {
    const resultado = assinatura
      ? await atualizarAssinaturaManual(assinatura.id, entrada())
      : await criarAssinaturaManual(org.id, entrada())
    if (resultado.ok) toast.success(assinatura ? 'Termos comerciais atualizados.' : 'Assinatura manual registrada.')
    else toast.error(resultado.error)
  })
  const pausar = () => startTransition(async () => {
    if (!assinatura) return
    const resultado = await pausarAssinaturaManual(assinatura.id)
    if (resultado.ok) toast.success('Assinatura pausada.')
    else toast.error(resultado.error)
  })
  const cancelar = () => startTransition(async () => {
    if (!assinatura || !window.confirm('Cancelar esta assinatura manual? O histórico será preservado.')) return
    const resultado = await cancelarAssinaturaManual(assinatura.id)
    if (resultado.ok) toast.success('Assinatura cancelada; histórico preservado.')
    else toast.error(resultado.error)
  })

  return (
    <section className="grid min-w-0 content-start gap-2 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Assinatura comercial manual</h4>
        {assinatura ? <EstadoBadge estado={estado(assinatura.status)} tamanho="sm">{assinatura.status}</EstadoBadge> : <EstadoBadge estado="neutro" tamanho="sm">sem assinatura</EstadoBadge>}
      </div>
      {assinatura && <p className="text-3xs text-muted-foreground">{assinatura.plano} · {dinheiro(assinatura.valorCentavos)} · próxima cobrança {assinatura.proximaCobrancaEm ? new Date(`${assinatura.proximaCobrancaEm}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</p>}
      <div className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
        <select value={form.planoId} onChange={(e) => alterar('planoId', e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" aria-label={`Plano da assinatura de ${org.nome}`}>
          <option value="">Plano…</option>
          {planosDisponiveis.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome}</option>)}
        </select>
        <select value={form.cicloCobranca} onChange={(e) => alterar('cicloCobranca', e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" aria-label="Ciclo de cobrança">
          <option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option>
        </select>
        <Input type="number" min={0} value={form.valorCentavos} onChange={(e) => alterar('valorCentavos', e.target.value)} placeholder="Valor em centavos" aria-label="Valor em centavos" />
        <Input type="date" value={form.iniciaEm} onChange={(e) => alterar('iniciaEm', e.target.value)} aria-label="Início da assinatura" />
        <Input type="date" value={form.renovaEm} onChange={(e) => alterar('renovaEm', e.target.value)} aria-label="Data de renovação" />
        <Input type="date" value={form.proximaCobrancaEm} onChange={(e) => alterar('proximaCobrancaEm', e.target.value)} aria-label="Próxima cobrança" />
        <Input value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} placeholder="Observações internas" aria-label="Observações da assinatura" className="sm:col-span-2" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" disabled={isPending || !form.planoId} onClick={salvar}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{assinatura ? 'Salvar termos' : 'Registrar assinatura'}
        </Button>
        {assinatura?.status === 'ativa' && <Button size="xs" variant="outline" disabled={isPending} onClick={pausar}><PauseCircle className="size-3.5" /> Pausar</Button>}
        {assinatura && <Button size="xs" variant="ghost" disabled={isPending} onClick={cancelar}><XCircle className="size-3.5" /> Cancelar</Button>}
        <span className="text-3xs text-muted-foreground">Manual e auditada — não altera acesso nem processa cobrança.</span>
      </div>
    </section>
  )
}
