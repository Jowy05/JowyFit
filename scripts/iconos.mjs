// Genera todos los iconos de la app a partir de assets/icono-fuente.png (el «JF» con la barra, 1024×1024,
// esquinas redondeadas transparentes): favicon, iconos de la web instalada (PWA) y los de Android (lanzador y splash).
//   node scripts/iconos.mjs   (o npm run iconos)
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const RAIZ = path.resolve(import.meta.dirname, '..')
const FUENTE = path.join(RAIZ, 'assets', 'icono-fuente.png')
/** El morado del fondo del icono (y el color principal de la app). */
export const MORADO = '#7F26FB'
const RES = path.join(RAIZ, 'android', 'app', 'src', 'main', 'res')
const WEB = path.join(RAIZ, 'public', 'iconos')

const fuente = await sharp(FUENTE).resize(1024, 1024).png().toBuffer()
/** PNG con paleta (el icono es un dibujo de colores planos): pesa mucho menos, sin diferencia a la vista. */
const PNG = { palette: true, quality: 95, compressionLevel: 9 }
/** El icono a sangre: las esquinas transparentes se rellenan de morado (para las máscaras de Android e iOS). */
const lleno = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: MORADO } })
  .composite([{ input: fuente }]).png().toBuffer()
const liso = (w, h, color) => sharp({ create: { width: w, height: h, channels: 4, background: color } }).png(PNG)
/** `img` reducido a `t` px dentro de un lienzo `w`×`h` del color `fondo` (transparente si no se dice). */
const centrado = async (img, t, w, h, fondo = { r: 0, g: 0, b: 0, alpha: 0 }) =>
  sharp({ create: { width: w, height: h, channels: 4, background: fondo } })
    .composite([{ input: await sharp(img).resize(t, t).png().toBuffer(), left: Math.round((w - t) / 2), top: Math.round((h - t) / 2) }])
const circulo = t => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}"><circle cx="${t / 2}" cy="${t / 2}" r="${t / 2}"/></svg>`)

// ---------------------------------------------------------------- web (favicon y PWA)
fs.mkdirSync(WEB, { recursive: true })
await sharp(fuente).resize(32, 32).png(PNG).toFile(path.join(WEB, 'icono-32.png'))
await sharp(fuente).resize(64, 64).png(PNG).toFile(path.join(WEB, 'icono-64.png'))
await sharp(fuente).resize(192, 192).png(PNG).toFile(path.join(WEB, 'icono-192.png'))
await sharp(fuente).resize(512, 512).png(PNG).toFile(path.join(WEB, 'icono-512.png'))
// iPhone redondea él solo: el de la pantalla de inicio va a sangre.
await sharp(lleno).resize(180, 180).png(PNG).toFile(path.join(WEB, 'icono-180.png'))
// «maskable»: Android puede recortarlo en círculo; el dibujo cabe en el 80 % central.
await (await centrado(lleno, 430, 512, 512, MORADO)).png(PNG).toFile(path.join(WEB, 'icono-512-mascara.png'))
fs.rmSync(path.join(RAIZ, 'public', 'icono.svg'), { force: true })

// ---------------------------------------------------------------- Android: icono del lanzador
// Adaptativo (Android 8+): fondo morado y el icono a sangre en los 72 dp centrales de los 108 dp (lo que se ve).
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(DENSIDADES)) {
  const dir = path.join(RES, `mipmap-${d}`)
  const t48 = Math.round(48 * k), t108 = Math.round(108 * k), t72 = Math.round(72 * k)
  await sharp(fuente).resize(t48, t48).png(PNG).toFile(path.join(dir, 'ic_launcher.png'))
  await sharp(lleno).resize(t48, t48).composite([{ input: circulo(t48), blend: 'dest-in' }]).png(PNG).toFile(path.join(dir, 'ic_launcher_round.png'))
  await (await centrado(lleno, t72, t108, t108)).png(PNG).toFile(path.join(dir, 'ic_launcher_foreground.png'))
  await liso(t108, t108, MORADO).toFile(path.join(dir, 'ic_launcher_background.png'))
}
const adaptativo = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptativo)
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptativo)
fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${MORADO}</color>\n</resources>\n`)

// ---------------------------------------------------------------- Android: pantallas de carga (mismo tamaño que las que había)
for (const dir of fs.readdirSync(RES).filter(x => x.startsWith('drawable'))) {
  const f = path.join(RES, dir, 'splash.png')
  if (!fs.existsSync(f)) continue
  const { width: w, height: h } = await sharp(f).metadata()
  const fondo = dir.includes('night') ? '#10151C' : '#F2F4F7'
  const t = Math.round(Math.min(w, h) * 0.3)
  const png = await (await centrado(fuente, t, w, h, fondo)).png(PNG).toBuffer()
  fs.writeFileSync(f, png)
}

// ---------------------------------------------------------------- assets/ (por si se usa @capacitor/assets)
await sharp(lleno).png(PNG).toFile(path.join(RAIZ, 'assets', 'icon-only.png'))
await liso(1024, 1024, MORADO).toFile(path.join(RAIZ, 'assets', 'icon-background.png'))
await (await centrado(lleno, 683, 1024, 1024)).png(PNG).toFile(path.join(RAIZ, 'assets', 'icon-foreground.png'))
await (await centrado(fuente, 800, 2732, 2732, '#F2F4F7')).png(PNG).toFile(path.join(RAIZ, 'assets', 'splash.png'))
await (await centrado(fuente, 800, 2732, 2732, '#10151C')).png(PNG).toFile(path.join(RAIZ, 'assets', 'splash-dark.png'))
console.log('Iconos generados')

// ---------------------------------------------------------------- logo del informe en PDF (va dentro del código del PDF)
const pdf = await sharp(fuente).resize(160, 160).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer()
fs.writeFileSync(path.join(RAIZ, 'src', 'informe', 'pdf', 'icono.ts'),
  `// Icono de la app para el logo del PDF (PNG de 160 px en base64). Lo genera scripts/iconos.mjs: no se edita a mano.\nexport const ICONO_PNG = '${pdf.toString('base64')}'\n`)
console.log('Logo del PDF:', Math.round(pdf.length / 1024), 'KB')
