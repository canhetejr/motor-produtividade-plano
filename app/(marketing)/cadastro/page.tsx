import { CadastroForm } from './cadastro-form'

export const metadata = {
  title: 'Criar conta — Vértice',
}

export default async function CadastroPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams
  return (
    <div className="flex min-h-[calc(100dvh-4rem-1px)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-[444px]">
        <CadastroForm erro={searchParams?.message} />
      </div>
    </div>
  )
}
