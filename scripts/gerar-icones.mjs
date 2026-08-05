// Gera todos os ativos digitais a partir das artes aprovadas em /logo.
// Os arquivos de saída são commitados para que o build não dependa do Sharp.

import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fonte = (nome) => resolve(raiz, 'logo', nome)

const FONTE_WORDMARK = fonte('vertice-wordmark-transparent.png')
const FONTE_LOCKUP = fonte('vertice-lockup-transparent-wide.png')
const FONTE_SIMBOLO = fonte('vertice-symbol-transparent.png')
const FUNDO_MARCA = '#09090E'
const TRIM = { background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 }

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

async function salvar(caminho, conteudo) {
  const destino = resolve(raiz, caminho)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, conteudo)
  console.log(caminho)
}

async function recortar(caminho) {
  return sharp(await readFile(caminho)).trim(TRIM).png().toBuffer()
}

const wordmark = await recortar(FONTE_WORDMARK)
const lockup = await recortar(FONTE_LOCKUP)
const simbolo = await recortar(FONTE_SIMBOLO)

await salvar(
  'public/brand/vertice-wordmark.png',
  await sharp(wordmark).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(),
)
await salvar(
  'public/brand/vertice-lockup.png',
  await sharp(lockup).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(),
)

async function simboloEmCanvas(tamanho, fundo = { r: 0, g: 0, b: 0, alpha: 0 }, ocupacao = 0.78) {
  const marca = await sharp(simbolo)
    .resize(Math.round(tamanho * ocupacao), Math.round(tamanho * ocupacao), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: fundo },
  })
    .composite([{ input: marca, gravity: 'centre' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

await salvar('public/brand/vertice-symbol.png', await simboloEmCanvas(512))

// Ícones de launcher usam fundo sólido: iOS e alguns launchers Android tratam
// transparência de maneiras diferentes. A ocupação de 66% respeita a safe area
// dos ícones maskable sem reduzir demais o ponto do monograma.
for (const tamanho of [192, 512]) {
  const icone = await simboloEmCanvas(tamanho, FUNDO_MARCA, 0.66)
  await salvar(`public/icons/icon-${tamanho}.png`, icone)
  await salvar(`public/icons/maskable-${tamanho}.png`, icone)
}

await salvar('app/apple-icon.png', await simboloEmCanvas(180, FUNDO_MARCA, 0.66))
await salvar('app/icon.png', await simboloEmCanvas(512, FUNDO_MARCA, 0.66))

for (const nome of ['shortcut-apontar', 'shortcut-kanban', 'shortcut-dashboard']) {
  await salvar(`public/icons/${nome}.png`, await simboloEmCanvas(96, FUNDO_MARCA, 0.66))
}

// O Safari não usa background_color do manifest durante a abertura. As splashes
// mantêm exatamente o fundo do tema escuro e centralizam a nova marca.
for (const { largura, altura, dpr } of APARELHOS_IOS) {
  const lado = Math.min(largura, altura)
  const marca = await sharp(simbolo)
    .resize(Math.round(lado * 0.28), Math.round(lado * 0.28), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const splash = await sharp({
    create: { width: largura, height: altura, channels: 4, background: FUNDO_MARCA },
  })
    .composite([{ input: marca, gravity: 'centre' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  await salvar(`public/icons/splash-${largura}x${altura}.png`, splash)
  console.log(`  @${dpr}x`)
}
