import { TelaConta } from '../tela-conta'

export const metadata = {
  title: 'Conta suspensa — Vértice',
}

// Fora de app/(app): NÃO chama requireUser(). requireUser() redireciona para
// cá quando organizacoes.status é 'suspensa' — se esta página chamasse
// requireUser() de novo, o redirect apontaria para ela mesma e viraria loop
// infinito (ver comentário em lib/auth.ts).
export default function ContaSuspensaPage() {
  return (
    <TelaConta
      titulo="Acesso pausado"
      descricao={
        <>
          O acesso da sua empresa está temporariamente pausado.{' '}
          <strong className="text-white/90">Nenhum dado foi apagado.</strong> Fale com o administrador da sua
          organização ou com a gente para reativar.
        </>
      }
      // Sem CTA de planos aqui: suspensão não se resolve escolhendo plano,
      // se resolve conversando — mandar para /precos seria um beco.
      assuntoContato="Conta suspensa no Vértice — preciso reativar"
    />
  )
}
