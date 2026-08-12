'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Building2, Crown, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { NOME_EMPRESA_MAX } from '@/lib/organizacao-dono'
import { atualizarNomeEmpresa, transferirPropriedade } from './empresa-actions'

export type CandidatoDono = { id: string; nome: string }

export function EmpresaPanel({
  nome,
  souDono,
  donoNome,
  candidatos,
}: {
  nome: string
  /** Gate de apresentação. O gate real é a RPC, que compara auth.uid() com
   *  organizacoes.dono_colaborador_id dentro do banco. */
  souDono: boolean
  donoNome: string | null
  /** Gestores ativos que não são o dono atual — os únicos destinos aceitos
   *  pela RPC (ela recusa colaborador comum com NAO_E_GESTOR). */
  candidatos: CandidatoDono[]
}) {
  const [isPending, startTransition] = useTransition()
  const [novoDono, setNovoDono] = useState<string>('')

  const salvarNome = (formData: FormData) => {
    startTransition(async () => {
      const res = await atualizarNomeEmpresa(formData)
      if (res.ok) toast.success('Nome da empresa atualizado.')
      else toast.error(res.error)
    })
  }

  const transferir = () => {
    startTransition(async () => {
      const res = await transferirPropriedade(novoDono)
      if (res.ok) {
        toast.success('Propriedade transferida. Você continua admin desta empresa.')
        setNovoDono('')
      } else {
        toast.error(res.error)
      }
    })
  }

  const alvo = candidatos.find((c) => c.id === novoDono)

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold">Nome da empresa</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              É o nome que aparece no cabeçalho do sistema, nos convites e nos e-mails automáticos.
            </p>
          </div>
        </div>

        <form action={salvarNome} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="nome-empresa">Nome</Label>
            <Input
              id="nome-empresa"
              name="nome"
              defaultValue={nome}
              maxLength={NOME_EMPRESA_MAX}
              required
              disabled={!souDono || isPending}
              autoComplete="organization"
            />
          </div>
          <Button type="submit" disabled={!souDono || isPending}>
            {isPending ? 'Salvando…' : 'Salvar nome'}
          </Button>
        </form>

        {!souDono && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Só o dono da empresa edita o nome
            {donoNome ? ` — hoje é ${donoNome}.` : '.'}
          </p>
        )}
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <Crown className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold">Dono da empresa</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Quem responde pela conta: é a única pessoa que edita o nome da empresa e que pode passar a
              propriedade adiante.
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm">
          Dono atual: <span className="font-medium">{donoNome ?? 'ninguém definido'}</span>
          {souDono && <span className="ml-1.5 text-sm text-muted-foreground">(você)</span>}
        </p>

        {souDono ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="novo-dono">Transferir para</Label>
              <Select
                name="novo-dono"
                value={novoDono}
                onValueChange={(v) => setNovoDono(String(v ?? ''))}
                disabled={isPending || candidatos.length === 0}
              >
                <SelectTrigger id="novo-dono" className="w-full">
                  <SelectValue placeholder="Escolha um gestor">
                    {(valor) => candidatos.find((c) => c.id === valor)?.nome ?? 'Escolha um gestor'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {candidatos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="outline" disabled={isPending || !alvo}>
                    Transferir propriedade
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Transferir a propriedade para {alvo?.nome}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {alvo?.nome} passa a ser a única pessoa que edita o nome da empresa e que pode transferir a
                    propriedade de novo — inclusive de volta para você. Você continua admin, mas não desfaz isso
                    sozinho.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                  <AlertDialogClose render={<Button onClick={transferir}>Transferir</Button>} />
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Só o dono atual transfere a propriedade.
          </p>
        )}

        {souDono && candidatos.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Não há outro gestor ativo para receber a propriedade. Promova alguém a gestor em Colaboradores
            primeiro.
          </p>
        )}
      </section>
    </div>
  )
}
