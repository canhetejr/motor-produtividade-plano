import type { NextConfig } from "next";

// Versão do service worker: alimenta o ?v= do registro, muda a cada deploy e
// é isso que faz o CACHE_NAME mudar e o activate descartar o cache anterior.
//
// Cada host expõe o commit com um nome diferente (Vercel: VERCEL_GIT_COMMIT_SHA;
// Coolify: SOURCE_COMMIT). O fallback com timestamp mantém a garantia mínima —
// "muda a cada build" — em qualquer lugar; o commit é preferido só porque
// rebuild do mesmo código gera a mesma versão, e aí o cache do usuário
// sobrevive a um redeploy que não mudou nada.
const versaoServiceWorker =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
  process.env.SOURCE_COMMIT?.slice(0, 8) ??
  String(Date.now());

const politicaDeSeguranca = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ')

const nextConfig: NextConfig = {
  // Empacota em .next/standalone com só o node_modules que o trace provou
  // necessário — é o que permite uma imagem Docker sem `npm install` no
  // runtime. Sem efeito no deploy da Vercel, que ignora a pasta.
  output: "standalone",
  env: {
    NEXT_PUBLIC_SW_VERSION: versaoServiceWorker,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: politicaDeSeguranca },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
