'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, PauseCircle, PlayCircle, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstadoBadge } from '@/components/ui/estado-badge'
import { atualizarPlano, criarPlano, definirAtivacaoPlano } from './actions'
import type { PlanoOperador } from './tipos'

type FormPlano = {
  codigo: string
  nome: string
  assentosInclusos: string
  precoMensalCentavos: string
  ordem: string
}

const vazio: FormPlano = { codigo: '', nome: '', assentosInclusos: '5', precoMensalCentavos: '0', ordem: '0' }
const paraForm = (plano: PlanoOperador): FormPlano => ({
  codigo: plano.codigo,
  nome: plano.nome,
  assentosInclusos: String(plano.assentosInclusos),
  precoMensalCentavos: String(plano.precoMensalCentavos),
  ordem: String(plano.ordem),
})
const paraEntrada = (form: FormPlano) => ({ ...form })
const dinheiro = (centavos: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)

function FormularioPlano({ plano }: { plano?: PlanoOperador }) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormPlano>(plano ? paraForm(plano) : vazio)
  const alterar = (campo: keyof FormPlano, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }))
  const salvar = () => startTransition(async () => {
    const resultado = plano ? await atualizarPlano(plano.id, paraEntrada(form)) : await criarPlano(paraEntrada(form))
    if (resultado.ok) {
      toast.success(plano ? `Plano ${form.nome} atualizado.` : `Plano ${form.nome} criado.`)
      if (!plano) setForm(vazio)
    } else toast.error(resultado.error)
  })

  return (
    <div className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-6">
      <Input value={form.nome} onChange={(e) => alterar('nome', e.target.value)} placeholder="Nome do plano" aria-label="Nome do plano" />
      <Input value={form.codigo} onChange={(e) => alterar('codigo', e.target.value)} placeholder="codigo" aria-label="Código do plano" />
      <Input type="number" min={1} value={form.assentosInclusos} onChange={(e) => alterar('assentosInclusos', e.target.value)} placeholder="Assentos" aria-label="Assentos inclusos" />
      <Input type="number" min={0} value={form.precoMensalCentavos} onChange={(e) => alterar('precoMensalCentavos', e.target.value)} placeholder="Preço em centavos" aria-label="Preço mensal em centavos" />
      <Input type="number" min={0} value={form.ordem} onChange={(e) => alterar('ordem', e.target.value)} placeholder="Ordem" aria-label="Ordem do plano" />
      <Button size="sm" variant={plano ? 'outline' : 'default'} disabled={isPending} onClick={salvar}>
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : plano ? <Save className="size-3.5" /> : <Plus className="size-3.5" />}
        {plano ? 'Salvar' : 'Criar'}
      </Button>
    </div>
  )
}

function LinhaPlano({ plano }: { plano: PlanoOperador }) {
  const [isPending, startTransition] = useTransition()
  const [confirmando, setConfirmando] = useState(false)
  const mudarSituacao = () => {
    if (!confirmando) return setConfirmando(true)
    startTransition(async () => {
      const resultado = await definirAtivacaoPlano(plano.id, !plano.ativo)
      if (resultado.ok) toast.success(`${plano.nome} ${plano.ativo ? 'desativado' : 'ativado'}.`)
      else toast.error(resultado.error)
      setConfirmando(false)
    })
  }

  return (
    <li className="space-y-2 border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">{plano.nome}</span>
        <code className="font-mono text-3xs text-muted-foreground">{plano.codigo}</code>
        <EstadoBadge estado={plano.ativo ? 'sucesso' : 'neutro'} tamanho="sm">{plano.ativo ? 'Ativo' : 'Inativo'}</EstadoBadge>
        <span className="ml-auto font-mono text-2xs text-muted-foreground">{plano.assentosInclusos} assentos · {dinheiro(plano.precoMensalCentavos)}/mês · ordem {plano.ordem}</span>
      </div>
      <FormularioPlano plano={plano} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant={plano.ativo ? 'outline' : 'default'} disabled={isPending} onClick={mudarSituacao}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : confirmando ? <Check className="size-3.5" /> : plano.ativo ? <PauseCircle className="size-3.5" /> : <PlayCircle className="size-3.5" />}
          {confirmando ? `Confirmar ${plano.ativo ? 'desativação' : 'ativação'}` : plano.ativo ? 'Desativar' : 'Ativar'}
        </Button>
        {confirmando && <span className="text-3xs text-warning-texto">{plano.ativo ? 'Não será possível atribuí-lo a novas organizações.' : 'Voltará a poder ser atribuído.'}</span>}
      </div>
    </li>
  )
}

/** Catálogo operacional: preços, franquia, ordem e disponibilidade de venda. */
export function CatalogoPlanos({ planos }: { planos: PlanoOperador[] }) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-2">
        <div>
          <h2 className="text-base font-semibold">Catálogo de planos</h2>
          <p className="mt-1 text-2xs text-muted-foreground">A franquia de assentos será aplicada quando o plano for atribuído a uma organização.</p>
        </div>
        <span className="font-mono text-2xs text-muted-foreground">{planos.filter((p) => p.ativo).length} ativos · {planos.length} no total</span>
      </div>
      <div className="mt-3">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Novo plano</p>
        <FormularioPlano />
        <p className="mt-2 text-3xs text-muted-foreground">Preço em centavos (ex.: 12990 = R$ 129,90). Código: letras minúsculas, números e hífen.</p>
      </div>
      <ul className="mt-4">
        {planos.map((plano) => <LinhaPlano key={plano.id} plano={plano} />)}
      </ul>
    </section>
  )
}
