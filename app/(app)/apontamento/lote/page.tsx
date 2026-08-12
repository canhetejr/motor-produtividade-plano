import { redirect } from 'next/navigation'

// Aponta direto para o destino final. Antes ia para /apontamento?modo=lote,
// que agora também redireciona — dois saltos para chegar ao mesmo lugar.
export default function LoteRedirect() {
  redirect('/minha-semana?modo=lote')
}
