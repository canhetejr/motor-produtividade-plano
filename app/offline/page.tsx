// Página servida pelo service worker quando uma navegação falha por falta de rede.
//
// Duas restrições moldam este arquivo:
//
// 1. Fica FORA do grupo (app), então não passa pelo requireUser() daquele
//    layout — offline não há como validar sessão.
// 2. Não usa classe do Tailwind. O CSS do app vive em /_next/static/css/<hash>.css,
//    e o nome com hash não é conhecível na hora de escrever o precache do sw.js;
//    se esse arquivo não estiver no cache, a página apareceria sem estilo nenhum.
//    Estilo inline é imune a isso.
//
// Pelo mesmo motivo é um link, não um botão com onClick: mantém a página 100%
// estática, sem JS.

export const dynamic = 'force-static'

export const metadata = {
  title: 'Sem conexão · Vértice',
}

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#101010',
        color: '#F5F3EF',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 8 }} />
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Sem conexão</h1>
      <p style={{ margin: 0, maxWidth: '28rem', lineHeight: 1.6, color: 'rgba(246,246,248,.7)', fontSize: '.9rem' }}>
        O Vértice precisa de internet para carregar seus apontamentos. Assim que a
        conexão voltar, é só tentar de novo — nada do que você já lançou se perdeu.
      </p>
      <a
        href="/apontamento"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 44,
          padding: '0 1.25rem',
          borderRadius: 8,
          backgroundColor: '#D7F75B',
          color: '#101010',
          fontWeight: 600,
          fontSize: '.9rem',
          textDecoration: 'none',
        }}
      >
        Tentar novamente
      </a>
    </div>
  )
}
