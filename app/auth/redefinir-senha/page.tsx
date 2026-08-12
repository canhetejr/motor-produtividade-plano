'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { createClient } from '@/utils/supabase/client'
import { validarNovaSenha } from '@/lib/recuperacao-senha'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<'verificando' | 'pronto' | 'invalido' | 'enviando' | 'sucesso'>('verificando')
  const [mensagemErro, setMensagemErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function verificarSessaoDeRecuperacao() {
      const { data, error } = await createClient().auth.getSession()
      if (!ativo) return

      if (error || !data.session) {
        setMensagemErro('Este link de recuperação é inválido ou expirou. Solicite um novo link para continuar.')
        setEstado('invalido')
        return
      }

      setEstado('pronto')
    }

    void verificarSessaoDeRecuperacao()
    return () => { ativo = false }
  }, [])

  async function redefinirSenha(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const senha = String(formData.get('password') ?? '')
    const confirmacao = String(formData.get('password_confirm') ?? '')
    const validacao = validarNovaSenha(senha, confirmacao)

    if (!validacao.valida) {
      setMensagemErro(validacao.mensagem)
      return
    }

    setMensagemErro('')
    setEstado('enviando')
    const { error } = await createClient().auth.updateUser({ password: senha })

    if (error) {
      console.error('Erro ao redefinir senha:', error.message)
      setMensagemErro('Não foi possível atualizar sua senha. Solicite um novo link e tente novamente.')
      setEstado('pronto')
      return
    }

    setEstado('sucesso')
    window.setTimeout(() => router.replace('/minha-semana'), 900)
  }

  return (
    <main className="vertice-raio-fixo flex min-h-dvh items-center justify-center bg-[#101010] px-6 py-12 text-white">
      <section className="w-full max-w-[444px] rounded-md border border-white/15 bg-white/5 p-6 shadow-xl sm:p-8">
        <div className="grid justify-items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            {estado === 'sucesso' ? <CheckCircle2 className="size-6" /> : <KeyRound className="size-6" />}
          </div>
          <p className="font-mono text-sm font-medium text-primary">Segurança</p>
          <h1 className="font-heading text-3xl font-medium leading-tight">Defina uma nova senha</h1>
          <p className="text-base leading-6 text-white/70">Escolha uma senha nova para acessar o Vértice.</p>
        </div>

        {estado === 'verificando' && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/70" role="status">
            <Loader2 className="size-4 animate-spin" /> Verificando seu link de recuperação…
          </div>
        )}

        {estado === 'invalido' && (
          <div className="mt-8 grid gap-4">
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{mensagemErro}</p>
            <Link href="/login" className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">
              Voltar para entrar
            </Link>
          </div>
        )}

        {(estado === 'pronto' || estado === 'enviando') && (
          <form onSubmit={redefinirSenha} className="mt-8 grid gap-5">
            {mensagemErro && <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{mensagemErro}</p>}
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-white" htmlFor="nova-senha">Nova senha</Label>
              <PasswordInput id="nova-senha" name="password" autoComplete="new-password" required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-white" htmlFor="confirmar-nova-senha">Confirmar nova senha</Label>
              <PasswordInput id="confirmar-nova-senha" name="password_confirm" autoComplete="new-password" required minLength={6} placeholder="Repita a nova senha" />
            </div>
            <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={estado === 'enviando'} aria-busy={estado === 'enviando'}>
              {estado === 'enviando' ? <><Loader2 className="size-4 animate-spin" /> Atualizando…</> : 'Atualizar senha'}
            </Button>
          </form>
        )}

        {estado === 'sucesso' && (
          <p role="status" className="mt-8 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-center text-sm text-white">
            Senha atualizada com sucesso. Redirecionando para o Vértice…
          </p>
        )}
      </section>
    </main>
  )
}
