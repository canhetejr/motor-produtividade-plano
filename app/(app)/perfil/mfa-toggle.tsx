'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'

import { alternarMfaEmail } from './actions'
import { Button } from '@/components/ui/button'

export function MfaToggle({ ativoInicial }: { ativoInicial: boolean }) {
  const [ativo, setAtivo] = useState(ativoInicial)
  const [pendente, startTransition] = useTransition()

  function alternar() {
    const proximo = !ativo
    startTransition(async () => {
      const r = await alternarMfaEmail(proximo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setAtivo(proximo)
      toast.success(
        proximo
          ? 'Segundo fator ativado. No próximo acesso pediremos um código.'
          : 'Segundo fator desativado.'
      )
    })
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Verificação em duas etapas</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ao entrar, além da senha pediremos um código de 6 dígitos enviado ao seu
        e-mail. Protege a conta mesmo se alguém descobrir sua senha.
      </p>
      <Button
        onClick={alternar}
        disabled={pendente}
        variant={ativo ? 'outline' : 'default'}
        className="mt-3 h-9 gap-2"
      >
        {ativo ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {pendente ? 'Aguarde…' : ativo ? 'Desativar' : 'Ativar verificação em duas etapas'}
      </Button>
    </section>
  )
}
