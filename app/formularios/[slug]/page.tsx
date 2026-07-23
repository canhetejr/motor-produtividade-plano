import { createAdminClient } from '@/utils/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { FormClient } from './form-client'

export const dynamic = 'force-dynamic'

export default async function FormularioPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let formulario: {
    id: string
    titulo: string
    descricao: string | null
    slug: string
    mensagem_sucesso: string
    mostrar_marca: boolean
    formularios_campos: {
      id: string
      rotulo: string
      tipo: string
      placeholder: string | null
      obrigatorio: boolean
      posicao: number
      opcoes: string[]
    }[]
  } | null = null

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('formularios')
      .select('id, titulo, descricao, slug, mensagem_sucesso, mostrar_marca, formularios_campos(*)')
      .eq('slug', slug.trim().toLowerCase())
      .eq('ativo', true)
      .maybeSingle()
    formulario = data
  } catch (err) {
    console.error('Erro ao carregar formulário público:', err)
  }

  if (!formulario) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle>Formulário indisponível</CardTitle>
            <CardDescription>Este link está incorreto ou o formulário foi desativado.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const campos = formulario.formularios_campos
    .slice()
    .sort((a, b) => a.posicao - b.posicao)
    .map((c) => ({ ...c, placeholder: c.placeholder ?? '' }))

  return (
    <div className="flex items-center justify-center min-h-dvh bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{formulario.titulo}</CardTitle>
          {formulario.descricao && <CardDescription>{formulario.descricao}</CardDescription>}
        </CardHeader>
        <CardContent>
          <FormClient
            slug={formulario.slug}
            campos={campos}
            mensagemSucesso={formulario.mensagem_sucesso}
            mostrarMarca={formulario.mostrar_marca}
          />
        </CardContent>
      </Card>
    </div>
  )
}
