import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Alimenta o ?v= do registro do service worker. Muda a cada deploy, o que
    // faz o CACHE_NAME mudar e o activate descartar o cache da versão anterior.
    NEXT_PUBLIC_SW_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? String(Date.now()),
  },
};

export default nextConfig;
