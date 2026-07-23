// Service worker mínimo: só cacheia estáticos imutáveis do build
// (_next/static/*). Navegação (HTML), API routes e Server Actions sempre
// vão direto pra rede sem interceptação — a app é toda autenticada e
// dinâmica, cachear página ou dado serviria estado desatualizado (ou pior,
// vazaria dado de um usuário pro cache que outro usuário no mesmo aparelho
// acabaria lendo).

const CACHE_NAME = 'motor-produtividade-static-v1'
const STATIC_PATH_PREFIXES = ['/_next/static/']

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  const isStatic = STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  if (!isStatic) return // não intercepta — deixa a rede cuidar (páginas, APIs, actions)

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached
      const response = await fetch(event.request)
      if (response.ok) cache.put(event.request, response.clone())
      return response
    })
  )
})
