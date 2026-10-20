// Capturas de todas las pantallas en el motor de Safari (WebKit) con pantalla de iPhone 13, en claro y en oscuro,
// con la muesca simulada (47 px arriba y 34 px abajo, como un iPhone de verdad) para ver que nada queda debajo.
//   npx vite build --outDir .cache/dist-iphone --emptyOutDir
//   node scripts/e2e-webkit/capturas.mjs        → .cache/iphone/capturas/
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { preview } from 'vite'
import { devices, webkit } from 'playwright'
import { AYUDANTE } from '../e2e/pagina.mjs'

const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const SALIDA = path.join(RAIZ, '.cache', 'iphone', 'capturas')
fs.rmSync(SALIDA, { recursive: true, force: true })
fs.mkdirSync(SALIDA, { recursive: true })

const servidor = await preview({ root: RAIZ, logLevel: 'error', build: { outDir: '.cache/dist-iphone' }, preview: { port: 5194, strictPort: true, host: '127.0.0.1' } })
const URL = 'http://127.0.0.1:5194/'

const RELOJ = `(() => { const R = Date; const off = () => Number(sessionStorage.getItem('__e2e_fecha')) || 0
  class D extends R { constructor(...a) { if (!a.length) super(R.now() + off()); else super(...a) } static now() { return R.now() + off() } }
  D.__real = () => R.now(); globalThis.Date = D })();`
// Muesca y barra de inicio: los huecos de un iPhone 13 y una franja que se ve en la captura.
const MUESCA = `(() => {
  const css = ':root{--sb-h:47px!important;--sa-b:34px!important}'
    + '#jf-muesca{position:fixed;left:50%;top:0;width:162px;height:32px;margin-left:-81px;border-radius:0 0 20px 20px;background:#000;z-index:9999;pointer-events:none}'
    + '#jf-inicio{position:fixed;left:50%;bottom:8px;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:rgba(127,127,127,.8);z-index:9999;pointer-events:none}'
  const poner = () => { if (document.getElementById('jf-muesca') || !document.body) return
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s)
    for (const id of ['jf-muesca', 'jf-inicio']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d) } }
  document.addEventListener('DOMContentLoaded', poner)
})();`
function imitar(instalada) {
  if (instalada) Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true })
  Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined })
}

const OFF = { status: 1, product: { product_name: 'Arroz al curry con pollo', brands: 'Hacendado', serving_quantity: 360, nutriments: { 'energy-kcal_100g': 167, proteins_100g: 6.1, carbohydrates_100g: 23, fat_100g: 5 } } }
const esperar = ms => new Promise(r => setTimeout(r, ms))
const lista = []

async function abrir(tema, instalada = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jowyfit-capturas-'))
  const ctx = await webkit.launchPersistentContext(dir, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block', baseURL: URL })
  const page = ctx.pages()[0] ?? await ctx.newPage()
  await page.addInitScript(RELOJ + AYUDANTE + MUESCA)
  await page.addInitScript(imitar, instalada)
  await page.route(/openfoodfacts\.org\/api\/v2\/product\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OFF) }))
  const t = (m, ...a) => page.evaluate(([m, a]) => window.__t[m](...a.map(x => (x && x.re ? new RegExp(x.re, x.f) : x))), [m, a.map(x => (x instanceof RegExp ? { re: x.source, f: x.flags } : x))])
  const js = c => page.evaluate(c => new Function(`return (async () => { ${c} })()`)(), c)
  /** Captura la pantalla; si la pantalla tiene scroll, también lo de más abajo (hasta 4 trozos). */
  const foto = async nombre => {
    await esperar(450)
    const base = `${String(lista.length + 1).padStart(3, '0')}-${tema === 'light' ? 'claro' : 'oscuro'}-${nombre}`
    await page.screenshot({ path: path.join(SALIDA, `${base}.png`) })
    lista.push(base)
    const scroll = await js(`const s = [...document.querySelectorAll('.sheet, .screen')].filter(x => x.getBoundingClientRect().height > 0).pop(); return s ? [s.scrollHeight, s.clientHeight] : [0, 0]`)
    for (let i = 1; i < 4 && scroll[0] > scroll[1] * i + 40; i++) {
      await js(`const s = [...document.querySelectorAll('.sheet, .screen')].filter(x => x.getBoundingClientRect().height > 0).pop(); s.scrollTop = ${i} * (s.clientHeight - 120)`)
      await esperar(250)
      await page.screenshot({ path: path.join(SALIDA, `${base}-${i + 1}.png`) })
      lista.push(`${base}-${i + 1}`)
    }
    await js(`for (const s of document.querySelectorAll('.sheet, .screen')) s.scrollTop = 0`)
  }
  const fecha = async (f, ruta = 'app.html') => {
    await page.goto('privacypolicy.html')
    await page.evaluate(f => sessionStorage.setItem('__e2e_fecha', String(new Date(f).getTime() - Date.__real())), f)
    await page.goto(ruta)
    await esperar(1500)
  }
  return { ctx, page, t, js, foto, fecha, cerrar: async () => { await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }) } }
}

async function alta(a) {
  const { t, js, foto } = a
  await t('pulsar', 'Empezar')
  await foto('alta-1-sobre-ti')
  await t('elegir', 'select[aria-label="Día de nacimiento"]', 20)
  await t('elegir', 'select[aria-label="Mes de nacimiento"]', 5)
  await t('elegir', 'select[aria-label="Año de nacimiento"]', 1990)
  await t('pulsar', 'Hombre')
  await t('escribir', 'input[aria-label="Altura en centímetros"]', '175')
  await t('escribir', 'input[aria-label="Peso en kilos"]', '75')
  for (let i = 0; i < 12 && !(await t('hay', /Creando tu rutina|Tu rutina está lista/)); i++) {
    await t('nombreSiHace', 'Joel')
    if (await js(`return !!document.querySelector('select[aria-label="Hora de entreno"]')`)) {
      for (const d of ['martes', 'jueves', 'viernes']) await t('pulsarSel', `[aria-label="${d}"]`)
      await t('elegir', 'select[aria-label="Hora de entreno"]', '05:30')
      await t('pulsarSel', '[aria-label="Extra el sábado"]')
    }
    if (i < 6) await foto(`alta-${i + 2}`)
    await t('pulsar', 'Siguiente')
  }
  await t('ver', 'Tu rutina está lista', 20000)
  await foto('alta-rutina-lista')
  await t('pulsar', 'Ir a Inicio')
  await t('ver', /Hoy te toca|descansas/, 8000)
}

for (const tema of ['light', 'dark']) {
  // Sin instalar: instrucciones y bienvenida.
  {
    const a = await abrir(tema, false)
    await a.fecha('2026-10-13T05:20:00', 'app.html?instalar=1')
    await a.foto('instalar')
    await a.page.goto('index.html')
    await esperar(800)
    await a.foto('landing')
    await a.cerrar()
  }
  const a = await abrir(tema, true)
  const { t, js, foto, page } = a
  const pestana = async n => { await t('pulsar', new RegExp(`^${n}$`, 'i'), '.tabbar'); await t('listo') }
  const cerrarHoja = () => page.locator('.backdrop').tap({ position: { x: 195, y: 10 } })
  await a.fecha('2026-10-13T05:20:00')
  await foto('bienvenida')
  await alta(a)
  await foto('inicio-primeros-pasos')
  await t('pulsar', 'Ya lo sé')
  await foto('inicio')
  await t('pulsar', '+ Peso'); await foto('hoja-peso'); await cerrarHoja()
  // Entreno.
  await t('pulsar', 'Empezar rutina'); await foto('hoja-empezar')
  await t('pulsar', 'Empezar', '.sheet'); await t('ver', 'Hecho', 8000); await foto('entreno-serie')
  await js(`const g = [...document.querySelectorAll('.stp')][0]; const v = g?.querySelector('.val')?.textContent || ''; if (g && (v.includes('—') || !v.trim())) for (let i = 0; i < 8; i++) g.querySelector('button[aria-label="Más"]')?.click()`)
  await t('pulsar', /^Hecho$/); await t('ver', 'Próxima'); await foto('entreno-descanso')
  const s = (await js(`return await new Promise(ok => { const q = indexedDB.open('jowyfit'); q.onsuccess = () => { const g = q.result.transaction('sesiones').objectStore('sesiones').getAll(); g.onsuccess = () => ok(g.result) } })`)).find(x => x.estado === 'curso')
  await page.evaluate(d => sessionStorage.setItem('__e2e_fecha', String((Number(sessionStorage.getItem('__e2e_fecha')) || 0) + d)), s.descansoHasta - await page.evaluate(() => Date.now()) + 200)
  await page.locator('.destello').waitFor({ timeout: 4000 }); await esperar(150)
  await page.screenshot({ path: path.join(SALIDA, `${String(lista.length + 1).padStart(3, '0')}-${tema === 'light' ? 'claro' : 'oscuro'}-entreno-destello.png`) }); lista.push('destello')
  await esperar(2000)
  await t('pulsarSel', 'button[aria-label="Herramientas"]'); await foto('hoja-mas'); await cerrarHoja()
  await t('pulsar', /^Ocupado$/); await foto('hoja-ocupado'); await cerrarHoja()
  await t('pulsarSel', '[aria-label="Lista de la sesión"]'); await foto('hoja-lista'); await cerrarHoja(); await esperar(300)
  await page.evaluate(() => window.__jfAtras()); await foto('hoja-salir-entreno')
  await t('pulsar', 'Acabar', '.sheet'); await t('ver', 'Entreno terminado'); await foto('resumen')
  await t('pulsar', 'Guardar'); await t('ver', /hecho/i, 8000)
  // Rutina.
  await pestana('Rutina'); await foto('rutina')
  for (const sg of ['Ejercicios', 'Gimnasios']) { await t('pulsar', sg, '.seg'); await t('listo'); await foto(`rutina-${sg.toLowerCase()}`) }
  await t('pulsar', /Press de Banca con Barra|Sentadilla/i).catch(() => {}); await t('listo'); await foto('ficha')
  await pestana('Rutina'); await t('pulsar', 'Rutina', '.seg').catch(() => {}); await t('listo')
  await t('pulsar', 'Editar plan'); await t('listo'); await foto('editar-plan')
  // Comida.
  await pestana('Comida'); await foto('comida')
  await t('pulsar', 'Añadir', '.dock'); await foto('hoja-anadir')
  await t('pulsar', 'Batido de proteína', '.sheet'); await foto('cuanto'); await t('pulsar', /^Normal/, '.popup')
  await t('pulsar', 'Añadir', '.dock'); await t('pulsar', 'Crear comida nueva', '.sheet'); await foto('hoja-crear-comida'); await cerrarHoja()
  await t('pulsar', 'Mis comidas', '.seg'); await t('listo'); await foto('mis-comidas')
  await t('pulsarSel', 'button[aria-label="Escanear"]'); await esperar(800); await foto('escaner')
  await t('pulsar', /Escribir el código/); await foto('escaner-escribir')
  await t('escribir', '.cam-panel input', '8480000123458'); await t('pulsar', 'Buscar'); await t('ver', 'Arroz al curry'); await foto('escaner-encontrado')
  await t('pulsar', 'Ver producto'); await t('listo'); await foto('producto')
  // Progreso.
  await pestana('Progreso')
  const segs = await js(`return [...document.querySelectorAll('.screen .seg button')].map(b => b.textContent.trim())`)
  for (const sg of segs) { await t('pulsar', sg, '.seg'); await t('listo'); await foto(`progreso-${sg.toLowerCase()}`) }
  await t('pulsar', 'Cuerpo', '.seg'); await t('listo'); await t('pulsar', /Registrar/); await t('listo'); await foto('registrar')
  await pestana('Inicio'); await t('pulsarSel', '.kpi.steps'); await t('listo'); await foto('pasos')
  // Perfil y ajustes.
  await pestana('Perfil'); await foto('perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]'); await t('listo'); await t('pulsar', 'Más ajustes'); await foto('ajustes')
  await t('pulsar', 'Créditos y aviso legal'); await t('listo'); await foto('creditos')
  await a.cerrar()
}

console.log(`${lista.length} capturas en ${SALIDA}`)
await servidor.close?.() ?? servidor.httpServer?.close()
process.exit(0)
