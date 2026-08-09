import { TelaConta } from '../tela-conta'

export const metadata = {
  title: 'Trial expirado — Vértice',
}

// Fora de app/(app): NÃO chama requireUser(), pelo mesmo motivo de
// app/conta/suspensa/page.tsx — requireUser() já redireciona pra cá.
export default function ContaExpiradaPage() {
  return (
    <TelaConta
      titulo="Seu teste chegou ao fim"
      descricao={
        <>
          Os 14 dias grátis acabaram, mas <strong className="text-white/90">nada foi apagado</strong>: seus
          apontamentos, quadros e histórico continuam aqui, esperando você voltar.
        </>
      }
      acaoPrincipal={{ rotulo: 'Ver planos', href: '/precos' }}
      assuntoContato="Meu teste do Vértice expirou — quero continuar"
    />
  )
}
