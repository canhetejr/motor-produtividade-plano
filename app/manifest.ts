import type { MetadataRoute } from 'next'

// Convenção Next 16: app/manifest.ts gera manifest.webmanifest automaticamente
// (ver node_modules/next/dist/docs/.../file-conventions/01-metadata/manifest.md).
// /apontamento é a tela mais usada no dia a dia (mobile-first) — é ela que abre
// ao instalar na tela inicial, não a raiz (que só redireciona).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vértice · Motor de Produtividade',
    short_name: 'Vértice',
    description: 'Controle diário de apontamentos',
    start_url: '/apontamento',
    display: 'standalone',
    background_color: '#130B33',
    theme_color: '#130B33',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/vertice-logos-svg/vertice-appicon-roxo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/vertice-logos-svg/vertice-appicon-roxo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
