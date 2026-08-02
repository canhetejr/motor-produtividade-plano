import type { MetadataRoute } from 'next'

// Convenção Next 16: app/manifest.ts gera manifest.webmanifest automaticamente
// (ver node_modules/next/dist/docs/.../file-conventions/01-metadata/manifest.md).
// /apontamento é a tela mais usada no dia a dia (mobile-first) — é ela que abre
// ao instalar na tela inicial, não a raiz (que só redireciona).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/apontamento',
    name: 'Vértice · Motor de Produtividade',
    short_name: 'Vértice',
    description: 'Controle diário de apontamentos',
    start_url: '/apontamento',
    scope: '/',
    display: 'standalone',
    lang: 'pt-BR',
    dir: 'ltr',
    categories: ['productivity', 'business'],
    // Cor do tema dark, que é o `defaultTheme` do ThemeProvider — é o que a
    // pessoa realmente vê ao abrir. O #130B33 anterior não batia com nenhum dos
    // dois themeColor do viewport, e a splash screen saía de outra cor.
    background_color: '#09090E',
    theme_color: '#09090E',
    // Sem `orientation`: o Kanban se beneficia de landscape e o apontamento de
    // portrait. Travar prejudica um dos dois.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Maskable com fundo sólido: o Android recorta no formato do launcher.
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      // Vetorial como bônus, pra quem suporta.
      { src: '/vertice-logos-svg/vertice-appicon-roxo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    // Share Target: faz o Vertice aparecer na folha de compartilhamento do
    // Android quando o app esta instalado. Metodo GET porque a rota so abre um
    // formulario preenchido — nao cria nada. Um POST aqui criaria card sem a
    // pessoa escolher o quadro, e adivinhar o destino poe o card no lugar
    // errado. iOS ainda nao implementa Share Target; la o recurso simplesmente
    // nao aparece, sem quebrar nada.
    share_target: {
      action: '/kanban/receber',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
    shortcuts: [
      {
        name: 'Novo apontamento',
        short_name: 'Apontar',
        url: '/apontamento',
        icons: [{ src: '/icons/shortcut-apontar.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Kanban',
        short_name: 'Kanban',
        url: '/kanban',
        icons: [{ src: '/icons/shortcut-kanban.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        icons: [{ src: '/icons/shortcut-dashboard.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
  }
}
