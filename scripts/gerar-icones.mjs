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
