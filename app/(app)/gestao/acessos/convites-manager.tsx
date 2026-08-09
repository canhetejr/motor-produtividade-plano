'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, Loader2, Mail, MailPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EstadoBadge } from '@/components/ui/estado-badge'
import { convidar, revogarConvite } from './actions'

export type ConvitePendente = {
  id: string
  email: string
  role: string
  areaNome: string | null
  expiraEm: string
  diasRestantes: number
}

type Area = { id: string; nome: string }

export function ConvitesManager({
  convites,
  areas,
  isAdmin,
  semAssentoLivre,
}: {
  convites: ConvitePendente[]
  areas: Area[]
  isAdmin: boolean
  /** Trava o formulário antes de o trigger do banco recusar — a mensagem
   *  aqui explica o que fazer, a exceção do Postgres não. */
  semAssentoLivre: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)

  const copiar = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  const enviar = (formData: FormData) => {
    startTransition(async () => {
      const res = await convidar(formData)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setLinkGerado(res.data?.link ?? null)
      setAberto(false)
      toast.success(
        res.data?.emailEnviado
          ? 'Convite enviado por e-mail.'
          : 'Convite criado. O e-mail não pôde ser enviado — copie o link e mande você mesmo.'
      )
    })
  }

  const revogar = (id: string, email: string) => {
    startTransition(async () => {
      const res = await revogarConvite(id)
      if (res.ok) toast.success(`Convite de ${email} revogado. O assento voltou a ficar livre.`)
      else toast.error(res.error)
    })
  }

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Convites pendentes</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quem foi convidado e ainda não entrou. Cada convite pendente ocupa um assento.
          </p>
        </div>
        {!aberto && (
          <Button size="sm" onClick={() => setAberto(true)} disabled={semAssentoLivre}>
            <MailPlus className="size-4" /> Convidar pessoa
          </Button>
        )}
      </div>

      {semAssentoLivre && !aberto && (
        <p className="mt-3 text-sm text-warning-texto">
          Sem assento livre no plano. Desative alguém que não usa mais o sistema
          {convites.length > 0 ? ', revogue um convite abaixo' : ''} ou fale com a gente para aumentar o plano.
        </p>
      )}

      {aberto && (
        <form action={enviar} className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required placeholder="pessoa@empresa.com" autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="area_id">Área</Label>
            {/* SelectValue não deriva o rótulo do item sozinho — sem a função
                de formatação o gatilho mostra o valor cru (o uuid da área). */}
            <Select name="area_id" required defaultValue={areas[0]?.id}>
              <SelectTrigger id="area_id" className="w-full sm:w-40">
                <SelectValue placeholder="Área">
                  {(valor) => areas.find((a) => a.id === valor)?.nome ?? 'Área'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role">Perfil</Label>
            <Select name="role" defaultValue="colaborador">
              <SelectTrigger id="role" className="w-full sm:w-36">
                <SelectValue>{(valor) => (valor === 'gestor' ? 'Gestor' : 'Colaborador')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                {/* Convidar já como gestor é conceder poder sobre o catálogo e
                    a equipe inteira — mesma regra de /colaboradores, só admin. */}
                {isAdmin && <SelectItem value="gestor">Gestor</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Enviar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {linkGerado && (
        <div className="mt-3 rounded-md border border-primary/25 bg-primary/5 p-3">
          <p className="text-sm font-medium">Link do convite</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vale por 7 dias. Se o e-mail não chegar, mande este link direto para a pessoa.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm bg-muted px-2 py-1.5 font-mono text-xs">{linkGerado}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(linkGerado)}>
              <Copy className="size-3.5" /> Copiar
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-border">
        {convites.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.email}</p>
              <p className="text-xs text-muted-foreground">
                {c.role === 'gestor' ? 'Gestor' : 'Colaborador'}
                {c.areaNome ? ` · ${c.areaNome}` : ''}
              </p>
            </div>
            <EstadoBadge estado={c.diasRestantes <= 2 ? 'atencao' : 'neutro'} tamanho="sm">
              {c.diasRestantes <= 0
                ? 'expira hoje'
                : `expira em ${c.diasRestantes} dia${c.diasRestantes === 1 ? '' : 's'}`}
            </EstadoBadge>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => revogar(c.id, c.email)}
              disabled={isPending}
              aria-label={`Revogar convite de ${c.email}`}
            >
              <X className="size-3.5" /> Revogar
            </Button>
          </li>
        ))}
      </ul>

      {convites.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum convite pendente. Convide alguém para a pessoa criar a própria senha, em vez de você definir uma
          temporária.
        </p>
      )}
    </section>
  )
}
