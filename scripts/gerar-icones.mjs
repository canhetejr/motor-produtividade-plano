// Gera os PNGs do PWA a partir dos SVGs da marca.
//
// Por que PNG, se já temos SVG: o Chrome no Android só oferece a instalação
// quando o manifest declara ícones com `sizes` numérico — na prática o par
// 192/512 —, e a convenção `apple-icon` do Next 16 aceita apenas jpg/jpeg/png
// (ver node_modules/next/dist/lib/metadata/is-metadata-route.js). SVG sozinho
// não instala.
//
// Os PNGs gerados são commitados: o build da Vercel não deve depender deste
// script. Rode `npm run icons` só quando a marca mudar.

import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = (nome) => resolve(raiz, 'public/vertice-logos-svg', nome)

// `flatten` preenche os pixels transparentes com cor sólida. Importa em dois
// lugares:
//  - maskable: o SVG já traz `rect rx=225`. Sem fundo sólido o Android aplica a
//    própria máscara por cima do canto já arredondado ("ícone dentro de ícone").
//  - apple-icon: o iOS ignora alpha e aplica máscara própria; PNG com
//    transparência vira preto na tela inicial.
const SAIDAS = [
  { de: 'vertice-appicon-roxo.svg', para: 'public/icons/icon-192.png', tamanho: 192 },
  { de: 'vertice-appicon-roxo.svg', para: 'public/icons/icon-512.png', tamanho: 512 },
  { de: 'vertice-appicon-roxo.svg', para: 'public/icons/maskable-192.png', tamanho: 192, fundo: '#820AD1' },
  { de: 'vertice-appicon-roxo.svg', para: 'public/icons/maskable-512.png', tamanho: 512, fundo: '#820AD1' },
  { de: 'vertice-appicon-ios.svg', para: 'app/apple-icon.png', tamanho: 180, fundo: '#130B33' },
  // Um SVG diferente por atalho. Os tres saiam do mesmo arquivo e o launcher
  // mostrava a mesma figura nos tres — indistinguiveis na pratica (md5 igual).
  // Sao variantes oficiais da marca, entao a distincao e so cromatica; dar a
  // cada atalho um pictograma proprio e trabalho de design, nao de codigo.
  { de: 'vertice-simbolo-roxo.svg', para: 'public/icons/shortcut-apontar.png', tamanho: 96 },
  { de: 'vertice-simbolo-duotone.svg', para: 'public/icons/shortcut-kanban.png', tamanho: 96 },
  { de: 'vertice-simbolo-mint.svg', para: 'public/icons/shortcut-dashboard.png', tamanho: 96 },
]

// Splash screens do iOS. O Safari ignora `background_color` do manifest: sem
// estas imagens a abertura do app instalado pisca branco antes de renderizar.
// Cada uma so e usada se o `media` bater exatamente com o aparelho, por isso a
// lista precisa cobrir as resolucoes em uso — o iOS nao redimensiona.
// Retrato apenas: em paisagem o iOS cai no fundo solido, que ja e o certo.
const APARELHOS_IOS = [
  { largura: 1170, altura: 2532, dpr: 3 }, // iPhone 12/13/14, 15/16 base
  { largura: 1179, altura: 2556, dpr: 3 }, // iPhone 14 Pro, 15/16
  { largura: 1284, altura: 2778, dpr: 3 }, // iPhone 12/13/14 Pro Max
  { largura: 1290, altura: 2796, dpr: 3 }, // iPhone 14 Pro Max, 15/16 Plus
  { largura: 1125, altura: 2436, dpr: 3 }, // iPhone X/XS/11 Pro
  { largura: 828, altura: 1792, dpr: 2 }, // iPhone XR/11
  { largura: 750, altura: 1334, dpr: 2 }, // iPhone SE
  { largura: 1536, altura: 2048, dpr: 2 }, // iPad 9.7"
  { largura: 1668, altura: 2388, dpr: 2 }, // iPad Pro 11"
  { largura: 2048, altura: 2732, dpr: 2 }, // iPad Pro 12.9"
]

// Mesmo Deep Space do manifest e do themeColor dark — a splash tem que ser a
// mesma cor que a tela que vem depois, senao pisca na transicao.
const FUNDO_SPLASH = '#09090E'

for (const { largura, altura, dpr } of APARELHOS_IOS) {
  const destino = resolve(raiz, `public/icons/splash-${largura}x${altura}.png`)
  await mkdir(dirname(destino), { recursive: true })

  // O simbolo ocupa ~28% da menor dimensao: proporcao que o iOS usa nas
  // proprias splash screens, sem encostar nas bordas em nenhum aparelho.
  const simbolo = Math.round(Math.min(largura, altura) * 0.28)
  const marca = await sharp(await readFile(svg('vertice-simbolo-duotone.svg')), { density: 400 })
    .resize(simbolo, simbolo, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const png = await sharp({
    create: {
      width: largura,
      height: altura,
      channels: 4,
      background: FUNDO_SPLASH,
    },
  })
    .composite([{ input: marca, gravity: 'centre' }])
    .png()
    .toBuffer()

  await writeFile(destino, png)
  console.log(`public/icons/splash-${largura}x${altura}.png  (@${dpr}x)`)
}

for (const { de, para, tamanho, fundo } of SAIDAS) {
  const destino = resolve(raiz, para)
  await mkdir(dirname(destino), { recursive: true })

  // density alto no rasterizador: sem isso o SVG é renderizado a 72dpi e
  // ampliado, saindo borrado nos tamanhos maiores.
  let pipeline = sharp(await readFile(svg(de)), { density: 400 }).resize(tamanho, tamanho, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  if (fundo) pipeline = pipeline.flatten({ background: fundo })

  await writeFile(destino, await pipeline.png().toBuffer())
  console.log(`${para}  ${tamanho}x${tamanho}${fundo ? ` (fundo ${fundo})` : ''}`)
}
