// Pruebas de seguridad de extremo a extremo contra la versión compilada, en Edge sin ventana y en WebKit (Safari).
//   npx vite build --outDir .cache/seg-arreglos/dist && node scripts/e2e/seguridad.mjs [carpeta] [puerto]
// Comprueba:
// - la Content-Security-Policy no rompe nada (landing, app, copia, escáner con Open Food Facts simulado, sus
//   imágenes, el wasm del escáner y el service worker) y no sale ningún aviso de CSP;
// - la CSP sí corta una imagen de un servidor ajeno («píxel espía»);
// - la landing arranca entera con un ancla mal codificada (#%E0%A4%A);
// - con datos rotos en el móvil sale «Algo ha ido mal» (nunca en blanco) y desde ahí se recupera una copia o
//   se borra todo (y el contador de claves agotado se arregla);
// - las copias de ataque se rechazan sin tocar nada.
// Puerto propio (5181 por defecto): no choca con la batería normal (5198/5199).
import fs from 'node:fs'
import path from 'node:path'
import { preview } from 'vite'
import { chromium, webkit } from '@playwright/test'

const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const SALIDA = process.argv[2] ?? '.cache/seg-arreglos/dist'
const PUERTO = Number(process.argv[3] ?? 5181)
const URL_BASE = `http://127.0.0.1:${PUERTO}/`
const COPIA_REAL = [path.join(RAIZ, '.cache', 'JowyFit-mis-datos.jowyfit'), path.join(RAIZ, '.cache', 'seg-copias', 'copias', 'base.jowyfit')].find(f => fs.existsSync(f))
const ATAQUES = path.join(RAIZ, '.cache', 'seg-copias', 'copias')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const WASM = fs.readdirSync(path.join(RAIZ, SALIDA, 'assets')).find(f => f.endsWith('.wasm'))
if (!COPIA_REAL) throw new Error('Falta una copia buena (.cache/JowyFit-mis-datos.jowyfit)')

const servidor = await preview({ root: RAIZ, logLevel: 'error', build: { outDir: SALIDA }, preview: { port: PUERTO, strictPort: true, host: '127.0.0.1' } })
const resultados = []
let fallos = 0
const esperar = ms => new Promise(r => setTimeout(r, ms))
function comprobar(cond, msg) { if (!cond) throw new Error(msg) }

async function abrir(motor, nombre) {
  const navegador = motor === 'edge' ? await chromium.launch({ channel: 'msedge', headless: true }) : await webkit.launch({ headless: true })
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'allow' })
  const v = { csp: [], errores: [], fuera: [], espia: [], off: [] }
  // Open Food Facts simulado: el producto trae una imagen buena (de OFF) y otra de un servidor ajeno.
  await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/(\d+)/, route => {
    v.off.push(route.request().url())
    return route.fulfill({
      contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 1, product: { product_name: 'Arroz al curry con pollo', brands: 'Hacendado', serving_quantity: 360, nutriments: { 'energy-kcal_100g': 167, proteins_100g: 6.1 }, image_front_small_url: 'https://seguimiento.invalid/pixel.gif?quien=jowyfit', image_front_url: 'https://images.openfoodfacts.org/images/products/848/000/012/3458/front_es.3.400.png' } }),
    })
  })
  await ctx.route(/images\.openfoodfacts\.org/, route => { v.off.push(route.request().url()); return route.fulfill({ contentType: 'image/png', body: PNG }) })
  await ctx.route(/seguimiento\.invalid/, route => { v.espia.push(route.request().url()); return route.abort() })
  // En Safari la app enseña al empezar cómo instalarla: ya vistas (la prueba no va de eso).
  await ctx.addInitScript(() => { try { localStorage.setItem('jf-instalar-visto', '2026-10-20T00:00:00.000Z'); localStorage.setItem('jf-tutorial-ofrecido', '1') } catch { /* nada */ } })
  const page = await ctx.newPage()
  page.on('console', m => {
    const t = m.text()
    if (/Content Security Policy|Content-Security-Policy|Refused to/i.test(t)) v.csp.push(t.slice(0, 300))
    else if (m.type() === 'error' && !/Failed to load resource|net::ERR|seguimiento\.invalid|JowyFit: fallo al pintar|The above error occurred|React will try to recreate|Minified React error|at [A-Za-z]/.test(t)) v.errores.push(t.slice(0, 300))
  })
  page.on('pageerror', e => v.errores.push(`excepción: ${String(e.message).slice(0, 300)}`))
  page.on('request', r => { const u = r.url(); if (!u.startsWith(URL_BASE) && !/^(data|blob):/.test(u) && !/openfoodfacts\.org|seguimiento\.invalid/.test(u)) v.fuera.push(u) })
  return { navegador, ctx, page, v, nombre }
}

async function prueba(nombre, fn) {
  const t0 = Date.now()
  try { await fn(); resultados.push(`  ✓ ${nombre} (${((Date.now() - t0) / 1000).toFixed(1)} s)`) }
  catch (e) { fallos++; resultados.push(`  ✗ ${nombre}: ${String(e.message).split('\n').slice(0, 4).join(' / ')}`) }
  console.log(resultados.at(-1))
}

const visible = (page, texto, ms = 10_000) => page.getByText(texto).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: ms })
const raizVacia = page => page.evaluate(() => (document.getElementById('raiz')?.innerHTML.length ?? 0) === 0)
async function elegirArchivo(page, archivo, pulsar) {
  // Edge avisa con «filechooser»; en WebKit el <input type=file> escondido de la app se rellena directamente.
  let hecho = false
  const porEvento = page.waitForEvent('filechooser', { timeout: 10_000 }).then(async fc => { if (!hecho) { hecho = true; await fc.setFiles(archivo) } }).catch(() => {})
  const porInput = page.waitForSelector('input[type=file]', { state: 'attached', timeout: 10_000 }).then(async () => {
    await new Promise(r => setTimeout(r, 400))
    if (!hecho) { hecho = true; await page.setInputFiles('input[type=file]', archivo) }
  }).catch(() => {})
  await pulsar()
  await Promise.race([porEvento, porInput])
  if (!hecho) throw new Error('No se ha podido elegir el archivo')
}
/** Escribe en la base del navegador (como si ya estuviera así de antes de los arreglos). */
const tocarBase = (page, tabla, fila) => page.evaluate(([t, f]) => new Promise((ok, mal) => {
  const r = indexedDB.open('jowyfit')
  r.onerror = () => mal(r.error)
  r.onsuccess = () => { const tx = r.result.transaction(t, 'readwrite'); tx.objectStore(t).put(f); tx.oncomplete = () => { r.result.close(); ok(true) }; tx.onerror = () => mal(tx.error) }
}), [tabla, fila])
const leerTabla = (page, tabla) => page.evaluate(t => new Promise((ok, mal) => {
  const r = indexedDB.open('jowyfit')
  r.onerror = () => mal(r.error)
  r.onsuccess = () => { const q = r.result.transaction(t).objectStore(t).getAll(); q.onsuccess = () => { r.result.close(); ok(q.result) } }
}), tabla)
const anadirSinClave = (page, tabla, fila) => page.evaluate(([t, f]) => new Promise(ok => {
  const r = indexedDB.open('jowyfit')
  r.onsuccess = () => { const q = r.result.transaction(t, 'readwrite').objectStore(t).add(f); q.onsuccess = () => { r.result.close(); ok(`ok ${q.result}`) }; q.onerror = e => { e.preventDefault(); r.result.close(); ok(`error ${q.error?.name}`) } }
}), [tabla, fila])

async function sinAvisos(s, donde) {
  comprobar(!s.v.csp.length, `${donde}: avisos de CSP: ${s.v.csp.slice(0, 3).join(' | ')}`)
  comprobar(!s.v.fuera.length, `${donde}: peticiones fuera: ${s.v.fuera.slice(0, 3).join(' | ')}`)
}

for (const motor of ['edge', 'webkit']) {
  console.log(`\n${motor === 'edge' ? 'Edge sin ventana' : 'WebKit (Safari)'}`)
  const s = await abrir(motor)
  const { page, v } = s

  await prueba(`${motor} · landing con ancla mal codificada arranca entera y sin avisos de CSP`, async () => {
    await page.goto(URL_BASE + '?landing#%E0%A4%A', { waitUntil: 'load' })
    await esperar(800)
    comprobar(await page.evaluate(() => document.documentElement.classList.contains('anim')), 'La landing no ha arrancado (sin animaciones)')
    comprobar(!v.errores.some(e => /URI/i.test(e)), `URIError: ${v.errores.join(' | ')}`)
    const huella = await page.evaluate(() => [...document.querySelectorAll('[data-huella]')].every(e => e.hidden))
    comprobar(huella, 'La huella del APK se ve aunque no hay ninguna publicada')
    await page.goto(URL_BASE + '?landing&plataforma=otro#segura', { waitUntil: 'load' })
    await esperar(500)
    comprobar(await page.evaluate(() => document.getElementById('d-segura')?.open === true), 'El ancla #segura no abre «¿Es seguro instalarla?»')
    comprobar(await page.evaluate(() => /Open Food Facts/.test(document.getElementById('d-segura')?.innerText ?? '')), 'El desplegable no dice que se consulta Open Food Facts')
    await sinAvisos(s, 'landing')
  })

  await prueba(`${motor} · app: recuperar la copia buena de siempre, sin avisos de CSP`, async () => {
    await page.goto(URL_BASE + 'app.html', { waitUntil: 'load' })
    await visible(page, 'Tengo una copia')
    await elegirArchivo(page, COPIA_REAL, () => page.getByRole('button', { name: 'Tengo una copia' }).click())
    await page.locator('.tabbar').waitFor({ timeout: 15_000 })
    await visible(page, 'Hoy te toca', 15_000).catch(() => visible(page, 'Inicio'))
    comprobar(!(await raizVacia(page)), 'La app se ha quedado en blanco')
    await sinAvisos(s, 'app')
  })

  await prueba(`${motor} · escáner: Open Food Facts y su imagen funcionan con la CSP; el píxel espía no sale`, async () => {
    await page.locator('.tabbar button[aria-label="Comida"]').click()
    await page.getByRole('button', { name: 'Escanear' }).first().click()
    await page.getByRole('button', { name: /Escribir el código/ }).click()
    await page.locator('.cam-panel input').fill('8480000123458')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await visible(page, 'Arroz al curry con pollo', 10_000)
    await esperar(800)
    const src = await page.evaluate(() => [...document.querySelectorAll('img')].map(i => i.getAttribute('src')).filter(x => /openfoodfacts|seguimiento/.test(x ?? '')))
    comprobar(src.length && src.every(x => x.startsWith('https://images.openfoodfacts.org/')), `Imágenes pintadas: ${JSON.stringify(src)}`)
    comprobar(v.off.some(u => u.includes('images.openfoodfacts.org')), 'No se ha cargado la imagen de Open Food Facts')
    comprobar(!v.espia.length, `Se ha pedido el píxel espía: ${v.espia[0]}`)
    await page.getByRole('button', { name: 'Ver producto' }).click()
    await visible(page, 'Ficha técnica')
    await sinAvisos(s, 'escáner')
  })

  await prueba(`${motor} · la CSP corta una imagen de un servidor ajeno`, async () => {
    const antes = v.csp.length
    const cortada = await page.evaluate(() => new Promise(ok => {
      document.addEventListener('securitypolicyviolation', e => ok(`${e.violatedDirective} ${e.blockedURI}`), { once: true })
      const i = new Image(); i.src = 'https://seguimiento.invalid/pixel.gif?prueba=csp'; document.body.append(i)
      setTimeout(() => ok(null), 3000)
    }))
    comprobar(cortada && /img-src/.test(cortada), `No la ha cortado (${cortada})`)
    comprobar(!v.espia.some(u => u.includes('prueba=csp')), 'La petición ha salido')
    v.csp.length = antes // este aviso de CSP es el esperado
  })

  await prueba(`${motor} · el wasm del escáner web se puede usar con la CSP`, async () => {
    comprobar(WASM, 'No hay .wasm en la compilación')
    const r = await page.evaluate(async w => {
      try { const m = await WebAssembly.compileStreaming(fetch(`/assets/${w}`)); return `ok ${WebAssembly.Module.exports(m).length}` } catch (e) { return `error ${e}` }
    }, WASM)
    comprobar(r.startsWith('ok'), `wasm: ${r}`)
    await sinAvisos(s, 'wasm')
  })

  if (motor === 'edge') {
    await prueba('edge · el service worker se instala y la app abre sin conexión', async () => {
      const activo = await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(r => !!r.active), new Promise(ok => setTimeout(() => ok(false), 15_000))]))
      comprobar(activo, 'El service worker no se ha activado')
      await esperar(1500)
      await s.ctx.setOffline(true)
      await page.goto(URL_BASE + 'app.html', { waitUntil: 'load' })
      await page.locator('.tabbar').waitFor({ timeout: 15_000 })
      await s.ctx.setOffline(false)
      await sinAvisos(s, 'sin conexión')
    })
  }

  await prueba(`${motor} · datos rotos en una pantalla: «Algo ha ido mal» con salida, nunca en blanco`, async () => {
    await page.goto(URL_BASE + 'app.html', { waitUntil: 'load' })
    await page.locator('.tabbar').waitFor({ timeout: 15_000 })
    const hoy = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
    // Una comida con la hora como número (de una copia de antes de los arreglos) tumbaba Comida.
    await tocarBase(page, 'comidas', { id: 999_001, fecha: hoy, hora: 99, franja: 'comida', nombre: 'Rota', kcal: 1, proteina: 1, racion: 'N', tipo: 'nota' })
    await tocarBase(page, 'comidas', { id: 999_002, fecha: hoy, hora: 98, franja: 'comida', nombre: 'Rota 2', kcal: 1, proteina: 1, racion: 'N', tipo: 'nota' })
    await page.reload({ waitUntil: 'load' })
    await page.locator('.tabbar').waitFor({ timeout: 15_000 })
    await page.locator('.tabbar button[aria-label="Comida"]').click()
    await visible(page, 'Algo ha ido mal')
    comprobar(await page.locator('.tabbar').isVisible(), 'Sin barra de pestañas')
    await page.getByRole('button', { name: 'Volver a Inicio' }).click()
    await visible(page, 'Hoy te toca', 10_000).catch(() => page.locator('.tabbar').waitFor())
    comprobar(!(await page.getByText('Algo ha ido mal').isVisible()), '«Volver a Inicio» no vuelve')
  })

  await prueba(`${motor} · datos rotos en Inicio: «Recuperar una copia» desde la pantalla de error (sin pasar por Ajustes)`, async () => {
    // El nombre de un día de la rutina como objeto (de una copia de antes) dejaba la app en blanco al abrirla.
    const rutinas = await leerTabla(page, 'rutinas')
    const r = rutinas.find(x => x.activa) ?? rutinas[0]
    comprobar(r, 'No hay rutina en la copia')
    await tocarBase(page, 'rutinas', { ...r, dias: r.dias.map(d => ({ ...d, nombre: { a: 1 } })) })
    await page.reload({ waitUntil: 'load' })
    await visible(page, 'Algo ha ido mal')
    comprobar(!(await raizVacia(page)), 'En blanco')
    await elegirArchivo(page, COPIA_REAL, () => page.getByRole('button', { name: 'Recuperar una copia' }).click())
    await page.getByRole('button', { name: 'Sí, recuperar' }).click()
    await page.waitForEvent('load', { timeout: 15_000 })
    await page.locator('.tabbar').waitFor({ timeout: 15_000 })
    comprobar(!(await page.getByText('Algo ha ido mal').isVisible()), 'Sigue el error tras recuperar')
    comprobar((await leerTabla(page, 'rutinas')).every(x => x.dias.every(d => typeof d.nombre === 'string')), 'La copia no ha sustituido la rutina rota')
  })

  await prueba(`${motor} · «Borrar todos los datos» con doble confirmación desde el error, y el contador de claves agotado se arregla`, async () => {
    const rutinas = await leerTabla(page, 'rutinas')
    const r = rutinas.find(x => x.activa) ?? rutinas[0]
    await tocarBase(page, 'rutinas', { ...r, dias: r.dias.map(d => ({ ...d, nombre: { a: 1 } })) })
    await tocarBase(page, 'sesiones', { id: 2 ** 53, fecha: '2020-01-01', rutinaId: null, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 1, version: 'normal', estado: 'hecha', calibracion: false, ejercicios: [] })
    comprobar((await anadirSinClave(page, 'sesiones', { fecha: '2020-01-02' })).startsWith('error'), 'El contador no estaba agotado (la prueba no vale)')
    await page.reload({ waitUntil: 'load' })
    await visible(page, 'Algo ha ido mal')
    await page.getByRole('button', { name: 'Borrar todos los datos' }).click()
    await visible(page, 'No se puede deshacer')
    await page.getByRole('button', { name: 'Borrar todo', exact: true }).click()
    await visible(page, '¿Seguro del todo?')
    await Promise.all([page.waitForEvent('load', { timeout: 15_000 }), page.getByRole('button', { name: 'Sí, borrarlo todo' }).click()])
    await visible(page, 'Tengo una copia', 15_000)
    const tras = await anadirSinClave(page, 'sesiones', { fecha: '2020-01-02' })
    comprobar(tras === 'ok 1', `Después de borrar todo, apuntar da «${tras}»`)
  })

  await prueba(`${motor} · copias de ataque: se rechazan sin tocar nada (o entran limpias)`, async () => {
    await page.goto(URL_BASE + 'app.html', { waitUntil: 'load' })
    await visible(page, 'Tengo una copia')
    for (const [f, esperado] of [['vacia.jowyfit', /vacía o incompleta/], ['clave-2e53.jowyfit', /no son de JowyFit/], ['bomba.jowyfit', /demasiado grande/], ['version-texto.jowyfit', /versión desconocida/], ['roto-nombre-objeto.jowyfit', /no son de JowyFit/], ['roto-fecha.jowyfit', /no son de JowyFit/]]) {
      if (!fs.existsSync(path.join(ATAQUES, f))) continue
      await page.goto(URL_BASE + 'app.html', { waitUntil: 'load' })
      await visible(page, 'Tengo una copia')
      await elegirArchivo(page, path.join(ATAQUES, f), () => page.getByRole('button', { name: 'Tengo una copia' }).click())
      let aviso = ''
      for (let i = 0; i < 80 && !esperado.test(aviso); i++) { await esperar(250); aviso = await page.evaluate(() => document.body.innerText) }
      comprobar(esperado.test(aviso), `${f}: no sale el aviso ${esperado} (sale: ${aviso.split('\n').filter(l => /importar|copia/i.test(l)).join(' | ').slice(0, 200)})`)
      comprobar((await leerTabla(page, 'perfil')).every(p => !p.altaCompleta), `${f}: ha cambiado el perfil`)
      await esperar(300)
    }
    // La de las fotos SVG/HTML entra, pero sin esas fotos.
    if (fs.existsSync(path.join(ATAQUES, 'xss.jowyfit'))) {
      await elegirArchivo(page, path.join(ATAQUES, 'xss.jowyfit'), () => page.getByRole('button', { name: 'Tengo una copia' }).click())
      await page.locator('.tabbar').waitFor({ timeout: 15_000 }).catch(() => {})
      const tipos = (await leerTabla(page, 'fotos')).map(f => f.imagen?.type)
      comprobar(tipos.every(t => /^image\/(jpeg|png|webp|heic)$/.test(t)), `Fotos con tipo raro: ${tipos.join(', ')}`)
      const imgs = (await leerTabla(page, 'productos')).map(p => p.imagen).filter(Boolean)
      comprobar(imgs.every(u => /^https:\/\/[a-z.]*openfoodfacts\.(org|net)\//.test(u)), `Imágenes de producto raras: ${imgs.join(', ')}`)
    }
    comprobar(!v.espia.length, 'Ha salido una petición al servidor espía')
    await sinAvisos(s, 'copias de ataque')
  })

  comprobar(true, '')
  if (v.errores.length) resultados.push(`  · ${motor}: errores en la consola (informativo): ${v.errores.slice(0, 4).join(' | ')}`)
  await s.navegador.close()
}

console.log(`\n${resultados.filter(r => r.includes('✓')).length} bien, ${fallos} mal`)
for (const r of resultados.filter(r => r.startsWith('  ·'))) console.log(r)
await servidor.close()
process.exit(fallos ? 1 : 0)
