import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

import { ThemeProvider } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: 'Motor de Produtividade',
  description: 'Controle diário de apontamentos',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground selection:bg-primary/30">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
