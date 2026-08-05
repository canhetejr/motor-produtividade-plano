'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { criarCartao } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Destino = {
  id: string
  nome: string
  codigo: string | null
  primeiraColuna: { id: string; nome: string } | null
}

export function ReceberCompartilhamento({
  destinos,
  tituloInicial,
  descricaoInicial,
}: {
  destinos: Destino[]
  tituloInicial: string
  descricaoInicial: string
  userId: string
}) {
  const router = useRouter()
  // Um título vazio é comum: alguns apps compartilham só a URL. Nesse caso a
  // primeira linha do texto serve melhor que deixar a pessoa digitar do zero.
  const [titulo, setTitulo] = useState(tituloInicial || descricaoInicial.split('\n')[0].slice(0, 120))
  const [descricao, setDescricao] = useState(descricaoInicial)
  const [quadroId, setQuadroId] = useState(destinos[0]?.id ?? '')
  const [salvando, setSalvando] = useState(false)

  const destino = destinos.find((d) => d.id === quadroId)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!destino?.primeiraColuna) return

    setSalvando(true)
    const dados = new FormData()
    dados.set('titulo', titulo.trim())
    dados.set('descricao', descricao.trim())
    dados.set('prioridade', 'media')

    const resultado = await criarCartao(destino.primeiraColuna.id, destino.id, dados)
    setSalvando(false)

    if (!resultado.ok || !resultado.data) {
      toast.error(resultado.ok ? 'Card criado, mas sem retorno do id.' : resultado.error)
      // Sem o id não dá para abrir o card; mandar para o quadro é melhor que
      // deixar a pessoa parada no formulário de um card que já existe.
      if (resultado.ok) router.replace(`/kanban/${destino.id}`)
      return
    }
    toast.success('Card criado')
    router.replace(`/kanban/${destino.id}?cartao=${resultado.data.id}`)
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="quadro">Quadro</Label>
        <select
          id="quadro"
          value={quadroId}
          onChange={(e) => setQuadroId(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {destinos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo ? `${d.codigo} · ` : ''}
              {d.nome}
            </option>
          ))}
        </select>
        {destino?.primeiraColuna && (
          <p className="text-xs text-muted-foreground">
            Entra em <strong className="font-medium">{destino.primeiraColuna.nome}</strong>.
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          autoFocus
          className="h-10 text-base"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={5}
          className="text-base"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={salvando || !titulo.trim()} className="h-10">
          {salvando ? 'Criando…' : 'Criar card'}
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={() => router.replace('/kanban')}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
