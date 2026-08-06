import type { Metadata, Viewport } from 'next'
import { Sora, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'], variable: '--font-sans' })
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })

import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ConviteDeInstalacao } from '@/components/pwa/instalacao'
import { ArmazenamentoPersistente } from '@/components/pwa/armazenamento-persistente'
import { PreferenciaRaioApplier } from '@/components/preferencia-raio-applier'
import { PreferenciaCorApplier } from '@/components/preferencia-cor-applier'
import { PreferenciaCorSecundariaApplier } from '@/components/preferencia-cor-secundaria-applier'

// Espelha a lista de scripts/gerar-icones.mjs — os dois lados têm que
// concordar, senão o arquivo referenciado aqui não existe (ou o gerado nunca é
// pedido). Um teste em lib/pwa-splash.test.ts trava a divergência.
const APARELHOS_IOS = [
  { largura: 1170, altura: 2532, dpr: 3 },
  { largura: 1179, altura: 2556, dpr: 3 },
  { largura: 1284, altura: 2778, dpr: 3 },
  { largura: 1290, altura: 2796, dpr: 3 },
  { largura: 1125, altura: 2436, dpr: 3 },
  { largura: 828, altura: 1792, dpr: 2 },
  { largura: 750, altura: 1334, dpr: 2 },
  { largura: 1536, altura: 2048, dpr: 2 },
  { largura: 1668, altura: 2388, dpr: 2 },
  { largura: 2048, altura: 2732, dpr: 2 },
]

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: 'Vértice · Motor de Produtividade',
  description: 'Controle diário de apontamentos',
  // As convenções app/icon.png e app/apple-icon.png expõem a marca atual nos
  // navegadores e no iOS sem duplicar configuração de metadata.
  appleWebApp: {
    capable: true,
    title: 'Vértice',
    // Combina com viewportFit:'cover' — a status bar fica sobre o conteúdo e o
    // app ocupa a tela toda, como um app nativo.
    statusBarStyle: 'black-translucent',
    // O iOS ignora `background_color` do manifest: sem estas imagens a abertura
    // do app instalado pisca branco. Cada `media` tem que bater exatamente com
    // o aparelho — o iOS não redimensiona, ou casa ou cai no branco. As medidas
    // são em pontos CSS (pixel físico ÷ dpr).
    startupImage: APARELHOS_IOS.map(({ largura, altura, dpr }) => ({
      url: `/icons/splash-${largura}x${altura}.png`,
      media: `(device-width: ${largura / dpr}px) and (device-height: ${altura / dpr}px) and (-webkit-device-pixel-ratio: ${dpr})`,
    })),
  },
}

export const viewport: Viewport = {
  // viewportFit 'cover' e o que faz env(safe-area-inset-*) valer algo em iOS —
  // sem ele o pb-[env(safe-area-inset-bottom)] da bottom nav resolve pra 0px.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F6F8' },
    { media: '(prefers-color-scheme: dark)', color: '#09090E' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // A cor de base vive no <html>, e nao no <body>. Motivo de ordem de pintura:
    // um elemento com z-index negativo (o fundo de particulas) pinta DEPOIS do
    // fundo do elemento raiz, mas ANTES do fundo de qualquer bloco em fluxo. Com
    // bg-background no body, o canvas ficava atras dele — presente no DOM e
    // invisivel na tela.
    <html
      lang="pt-BR"
      className={`${sora.variable} ${jetBrainsMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="antialiased min-h-screen text-foreground selection:bg-primary/30" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <PreferenciaRaioApplier />
          <PreferenciaCorApplier />
          <PreferenciaCorSecundariaApplier />
          {children}
          <Toaster position="top-center" richColors />
          <ServiceWorkerRegister />
          <ArmazenamentoPersistente />
          <ConviteDeInstalacao />
        </ThemeProvider>
      </body>
    </html>
  )
}
