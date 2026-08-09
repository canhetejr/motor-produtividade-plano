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

const nextConfig: NextConfig = {
  // Empacota em .next/standalone com só o node_modules que o trace provou
  // necessário — é o que permite uma imagem Docker sem `npm install` no
  // runtime. Sem efeito no deploy da Vercel, que ignora a pasta.
  output: "standalone",
  env: {
    NEXT_PUBLIC_SW_VERSION: versaoServiceWorker,
  },
};

export default nextConfig;
