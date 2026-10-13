// Genera el icono de la app (naranja con una barra de pesas, como el logo del diseño).
//   node scripts/iconos.mjs → public/icono.svg, public/iconos/*.png y assets/ (para Android)
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const RAIZ = path.resolve(import.meta.dirname, '..')
const NARANJA = '#FF7A1A'
const GLIFO = '#FFFFFF'

// Barra de pesas centrada en un lienzo de 512 (escala `k` alrededor del centro).
const barra = (k = 1) => {
  const t = (x, y, w, h, r) => {
    const cx = 256, cy = 256
    return `<rect x="${cx + (x - cx) * k}" y="${cy + (y - cy) * k}" width="${w * k}" height="${h * k}" rx="${r * k}"/>`
  }
  return `<g fill="${GLIFO}">${t(128, 241, 256, 30, 10)}${t(116, 168, 44, 176, 14)}${t(76, 204, 34, 104, 12)}${t(352, 168, 44, 176, 14)}${t(402, 204, 34, 104, 12)}</g>`
}

const svg = (fondoRedondo, k) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" ${fondoRedondo ? 'rx="112"' : ''} fill="${NARANJA}"/>${barra(k)}</svg>`

fs.mkdirSync(path.join(RAIZ, 'public', 'iconos'), { recursive: true })
fs.writeFileSync(path.join(RAIZ, 'public', 'icono.svg'), svg(true, 1))
const png = (s, tam, salida) => sharp(Buffer.from(s)).resize(tam, tam).png().toFile(salida)
await png(svg(true, 1), 192, path.join(RAIZ, 'public', 'iconos', 'icono-192.png'))
await png(svg(true, 1), 512, path.join(RAIZ, 'public', 'iconos', 'icono-512.png'))
await png(svg(false, 0.72), 512, path.join(RAIZ, 'public', 'iconos', 'icono-512-mascara.png'))
await png(svg(false, 0.9), 180, path.join(RAIZ, 'public', 'iconos', 'icono-180.png'))

// Para @capacitor/assets (Android): icono 1024, fondo y primer plano adaptativos, splash.
fs.mkdirSync(path.join(RAIZ, 'assets'), { recursive: true })
await png(svg(false, 0.9), 1024, path.join(RAIZ, 'assets', 'icon-only.png'))
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${NARANJA}"/></svg>`)).resize(1024, 1024).png().toFile(path.join(RAIZ, 'assets', 'icon-background.png'))
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${barra(0.62)}</svg>`)).resize(1024, 1024).png().toFile(path.join(RAIZ, 'assets', 'icon-foreground.png'))
const splash = fondo => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="${fondo}"/><g transform="translate(1110 1110) scale(1)"><rect width="512" height="512" rx="112" fill="${NARANJA}"/>${barra(1)}</g></svg>`
await sharp(Buffer.from(splash('#10151C'))).png().toFile(path.join(RAIZ, 'assets', 'splash-dark.png'))
await sharp(Buffer.from(splash('#F2F4F7'))).png().toFile(path.join(RAIZ, 'assets', 'splash.png'))
console.log('Iconos generados')
