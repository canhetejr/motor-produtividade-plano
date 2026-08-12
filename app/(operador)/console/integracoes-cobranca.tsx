import { Construction } from 'lucide-react'
import { EstadoBadge } from '@/components/ui/estado-badge'

const PROVEDORES = ['Stripe', 'Asaas', 'Mercado Pago', 'Iugu']

/** Transparência de roadmap: não expõe controles que ainda não integram nada. */
export function IntegracoesCobranca() {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Construction className="size-4 text-primary" /> Integrações de cobrança</h2>
          <p className="mt-1 text-2xs text-muted-foreground">Gateways para sincronizar assinaturas, faturas e webhooks.</p>
        </div>
        <EstadoBadge estado="atencao" tamanho="sm">Em construção</EstadoBadge>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Provedores planejados">
        {PROVEDORES.map((provedor) => <li key={provedor} className="rounded-sm border border-border px-2 py-1 font-mono text-3xs text-muted-foreground">{provedor} · em construção</li>)}
      </ul>
      <p className="mt-3 text-3xs leading-4 text-muted-foreground">Nenhum provedor está conectado nesta versão: não há credenciais, cobrança automática, importação ou sincronização simulada.</p>
    </section>
  )
}
