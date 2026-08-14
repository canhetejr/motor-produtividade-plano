import { CadastroForm } from './cadastro-form'

export const metadata = {
  title: 'Criar conta — Vértice',
}

export default async function CadastroPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams
  return (
    // O cabeçalho é `fixed` e não ocupa altura: o cartão é centralizado na tela
    // inteira, com folga superior suficiente para não passar por baixo dele.
    <div className="flex min-h-dvh items-center justify-center px-6 pt-28 pb-16">
      <div className="w-full max-w-[444px]">
        <CadastroForm erro={searchParams?.message} />
      </div>
    </div>
  )
}
