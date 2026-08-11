// Service worker: cacheia estáticos imutáveis do build (_next/static/*) e
// serve uma página offline quando uma navegação falha por falta de rede.
//
// O que ele deliberadamente NÃO faz: cachear HTML de página, resposta de API
// ou Server Action. A app é toda autenticada e dinâmica — cachear dado serviria
// estado desatualizado ou, pior, vazaria dado de um usuário para o cache que
// outro usuário no mesmo aparelho acabaria lendo. Por isso o branch de
// navegação abaixo é network-first SEM `cache.put`: a resposta boa passa direto
// para a rede e nunca é gravada; só o fallback estático sai do cache.

// A versão vem do ?v= da URL de registro (um sha de commit em produção). Como o
// activate apaga todo cache cujo nome não bate com o atual, cada deploy limpa
// sozinho as entradas da versão anterior.
const VERSAO = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE_NAME = `motor-produtividade-static-${VERSAO}`
const STATIC_PATH_PREFIXES = ['/_next/static/']
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  // Sem skipWaiting() aqui: trocar de service worker no meio da sessão faz o
  // chunk que a página ainda vai pedir sumir (404 de chunk). A troca acontece
  // quando o usuário aceita o aviso de nova versão, via SKIP_WAITING.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192-tera.png']))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Push: chega com o app fechado. O payload vem do servidor como JSON —
// `event.data` pode ser nulo se o navegador acordar o SW sem corpo, entao o
// fallback existe para nao mostrar notificacao vazia.
self.addEventListener('push', (event) => {
  let dados = {}
  try {
    dados = event.data ? event.data.json() : {}
  } catch {
    dados = {}
  }

  const titulo = dados.titulo || 'Vértice'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.mensagem || '',
      icon: '/icons/icon-192-tera.png',
      badge: '/icons/icon-192-tera.png',
      // A tag agrupa: dez avisos do mesmo card viram um, em vez de dez linhas
      // na central de notificacoes do sistema.
      tag: dados.link || 'vertice',
      data: { link: dados.link || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = event.notification.data?.link || '/'

  // Se ja existe uma janela do app aberta, foca ela em vez de abrir outra —
  // abrir uma segunda aba do mesmo app e o comportamento que irrita.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.includes(destino) && 'focus' in janela) return janela.focus()
      }
      if (janelas.length > 0 && 'navigate' in janelas[0]) {
        return janelas[0].navigate(destino).then((j) => j && j.focus())
      }
      return self.clients.openWindow(destino)
    })
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // Navegação: sempre rede. Só quando a rede falha (offline de verdade) é que
  // cai na página estática de fallback, em vez da tela de erro do browser.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL, { ignoreSearch: true }))
    )
    return
  }

  const isStatic = STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  if (!isStatic) return // não intercepta — deixa a rede cuidar (APIs, actions)

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
