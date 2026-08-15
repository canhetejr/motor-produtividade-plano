import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolverWebhookFormulario } from '@/lib/formulario-webhook-auth'
import { buscarFormularioAtivoComCampos, criarCartaoDeFormulario } from '@/lib/formulario-submissao'

// Webhook de criação de card (pedido do produto: automação externa, caso de
// uso citado foi n8n) — fora do matcher de sessão de proxy.ts, igual
// api/mcp e api/cron: autorização por Bearer token
// (lib/formulario-webhook-auth.ts), nunca por cookie.
//
// Corpo esperado: { "respostas": { "<rótulo do campo>": "<valor>", ... } }.
// O rótulo é o mesmo texto que aparece no builder do formulário (kanban ->
// formulários) — é o que a UI mostra como payload de exemplo pra colar no
// n8n, já que o UUID interno do campo não é algo que quem configura o
// workflow tenha como saber.
function cabecalhos(): Headers {
  return new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
}

function respostaErro(status: number, error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: cabecalhos() })
}

export async function POST(request: NextRequest) {
  const sessao = await resolverWebhookFormulario(request.headers.get('authorization'))
  if (!sessao) return respostaErro(401, 'Token inválido, revogado ou ausente.')

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return respostaErro(400, 'Corpo da requisição precisa ser JSON.')
  }

  const respostasPorRotulo = (corpo as { respostas?: unknown } | null)?.respostas
  if (!respostasPorRotulo || typeof respostasPorRotulo !== 'object' || Array.isArray(respostasPorRotulo)) {
    return respostaErro(400, 'Envie {"respostas": {"<rótulo do campo>": "<valor>"}}.')
  }

  const admin = createAdminClient()
  const { data: formulario, error: formularioError } = await buscarFormularioAtivoComCampos(admin, {
    id: sessao.formularioId,
  })
  if (formularioError || !formulario) return respostaErro(404, 'Formulário desativado ou excluído.')

  // O core (lib/formulario-submissao.ts) casa resposta com campo pelo id
  // interno, não pelo rótulo — normaliza aqui pra reaproveitar a mesma regra
  // de negócio da submissão pública em vez de duplicá-la.
  const normalizar = (v: string) => v.trim().toLowerCase()
  const respostasPorId: Record<string, string> = {}
  for (const campo of formulario.formularios_campos ?? []) {
    const entrada = Object.entries(respostasPorRotulo as Record<string, unknown>).find(
      ([rotulo]) => normalizar(rotulo) === normalizar(campo.rotulo)
    )
    if (entrada && typeof entrada[1] === 'string') respostasPorId[campo.id] = entrada[1]
  }

  const resultado = await criarCartaoDeFormulario(admin, formulario, respostasPorId)
  if (!resultado.ok || !resultado.data) return respostaErro(422, !resultado.ok ? resultado.error : 'Falha ao criar o card.')

  return new Response(JSON.stringify({ ok: true, cartaoId: resultado.data.cartaoId }), {
    status: 201,
    headers: cabecalhos(),
  })
}

export async function GET() {
  return respostaErro(405, 'Use POST.')
}
