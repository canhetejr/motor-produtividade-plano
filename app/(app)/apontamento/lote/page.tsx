import { redirect } from 'next/navigation'

export default function LoteRedirect() {
  redirect('/apontamento?modo=lote')
}
