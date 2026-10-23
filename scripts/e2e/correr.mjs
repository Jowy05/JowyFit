// Pruebas de extremo a extremo: usa la app como una persona (alta, entreno, comida, progreso, perfil…)
// en un navegador sin ventana, con fecha y conexión simuladas.
//   node scripts/e2e/correr.mjs            → contra el servidor de desarrollo
//   node scripts/e2e/correr.mjs --build    → contra la versión compilada (dist/), incluida la prueba sin conexión
//   node scripts/e2e/correr.mjs entreno    → solo los escenarios cuyo nombre contenga «entreno»
//   Los escenarios están en escenarios/ (uno por zona) y los ayudantes que usan, en ayudantes.mjs.
import path from 'node:path'
import { createServer, preview } from 'vite'
import { abrirNavegador } from './navegador.mjs'
import { AYUDANTE, RELOJ } from './pagina.mjs'
import { conectar, DESCARGAS, entorno, ESCENARIOS, esperar, js, movil, RAIZ, tema } from './ayudantes.mjs'

const args = process.argv.slice(2)
const compilada = args.includes('--build')
const filtro = args.find(a => !a.startsWith('--'))

// Producto de prueba de Open Food Facts (no se consulta internet).
const OFF = {
  '8480000123458': { status: 1, product: { product_name: 'Arroz al curry con pollo', brands: 'Hacendado', serving_quantity: 360, nutriments: { 'energy-kcal_100g': 167, proteins_100g: 6.1, carbohydrates_100g: 23, fat_100g: 5 } } },
  '5449000000996': { status: 1, product: { product_name: 'Coca-Cola', brands: 'Coca-Cola', serving_quantity: 330, nutriments: { 'energy-kcal_100g': 42, proteins_100g: 0, caffeine_100g: 0.0097 } } },
}

// ---------- arranque ----------
const servidor = compilada
  ? await preview({ root: RAIZ, logLevel: 'error', preview: { port: 5198, strictPort: true, host: '127.0.0.1' } })
  : await createServer({ root: RAIZ, logLevel: 'error', server: { port: 5199, strictPort: true, host: '127.0.0.1' } }).then(s => s.listen())
const URL_APP = compilada ? 'http://127.0.0.1:5198/' : 'http://127.0.0.1:5199/'
// La app está en app.html; index.html es la landing (elige landing o app según el navegador).
const PAGINA_APP = URL_APP + 'app.html'
const nav = await abrirNavegador()
const { cdp } = nav

const errores = []
cdp.al('Runtime.exceptionThrown', p => errores.push(`excepción: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`))
cdp.al('Runtime.consoleAPICalled', p => { if (p.type === 'error') errores.push(`console.error: ${p.args.map(a => a.value ?? a.description).join(' ')}`) })
cdp.al('Log.entryAdded', p => { if (p.entry.level === 'error' && !/openfoodfacts|favicon/.test(p.entry.url ?? '')) errores.push(`log: ${p.entry.text} ${p.entry.url ?? ''}`) })
cdp.al('Fetch.requestPaused', async p => {
  const u = p.request.url
  if (entorno.sinConexion && !u.startsWith(URL_APP)) return cdp.enviar('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' })
  const m = u.match(/api\/v2\/product\/(\d+)/)
  if (entorno.sinConexion || !m) return cdp.enviar('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' })
  const json = OFF[m[1]]
  await cdp.enviar('Fetch.fulfillRequest', {
    requestId: p.requestId, responseCode: json ? 200 : 404,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
    body: Buffer.from(JSON.stringify(json ?? { status: 0 })).toString('base64'),
  })
})
await cdp.enviar('Runtime.enable')
await cdp.enviar('Log.enable')
await cdp.enviar('Page.enable')
await cdp.enviar('Fetch.enable', { patterns: [{ urlPattern: '*openfoodfacts*' }] })
await cdp.enviar('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Madrid' })
await cdp.enviar('Emulation.setLocaleOverride', { locale: 'es-ES' })
await cdp.enviar('Page.addScriptToEvaluateOnNewDocument', { source: RELOJ + AYUDANTE })
await cdp.enviar('DOM.enable')
await cdp.enviar('Page.setInterceptFileChooserDialog', { enabled: true })
const fsx = await import('node:fs')
fsx.rmSync(DESCARGAS, { recursive: true, force: true }); fsx.mkdirSync(DESCARGAS, { recursive: true })
await cdp.enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS }).catch(() => cdp.enviar('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS }))
// El selector de archivos de la app recibe el que diga el escenario (entorno.archivoParaElegir).
cdp.al('Page.fileChooserOpened', async p => {
  if (!entorno.archivoParaElegir) return
  await cdp.enviar('DOM.setFileInputFiles', { files: [entorno.archivoParaElegir], backendNodeId: p.backendNodeId })
})
conectar({ cdp, compilada, paginaApp: PAGINA_APP })
await movil(390, 844)

// ---------- escenarios ----------
// Una zona tras otra; cada archivo registra los suyos con escenario().
for (const zona of ['alta', 'inicio', 'entreno', 'rutina', 'comida', 'progreso', 'perfil', 'copias', 'informe', 'tutorial', 'visual', 'idioma']) await import(`./escenarios/${zona}.mjs`)

// ---------- ejecución ----------
await cdp.enviar('Performance.enable').catch(() => {})
let bien = 0, mal = 0
const inicio = Date.now()
for (const e of ESCENARIOS) {
  if (filtro && !e.nombre.includes(filtro)) continue
  errores.length = 0
  // Cada escenario empieza igual aunque el anterior fallara a medias (tamaño, tema, archivos, conexión).
  await movil(390, 844).catch(() => {}); await tema('light').catch(() => {})
  entorno.archivoParaElegir = null; entorno.sinConexion = false
  const t0 = Date.now()
  try {
    await e.f()
    await esperar(300)
    const propios = errores.filter(x => !/Download the React DevTools|\[vite\]/.test(x))
    if (propios.length) throw new Error(`errores en la consola:\n      ${propios.slice(0, 5).join('\n      ')}`)
    bien++
    console.log(`  ✓ ${e.nombre} (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
  } catch (err) {
    mal++
    const foto = await cdp.enviar('Page.captureScreenshot', { format: 'png' }).catch(() => null)
    const archivo = path.join(RAIZ, '.cache', `e2e-fallo-${e.nombre.replace(/[^a-z0-9]+/gi, '-')}.png`)
    if (foto) { const fs = await import('node:fs'); fs.mkdirSync(path.dirname(archivo), { recursive: true }); fs.writeFileSync(archivo, Buffer.from(foto.data, 'base64')) }
    const pantalla = await js(`return document.querySelector('.sheet')?.innerText?.slice(0,300) || document.querySelector('.screen')?.innerText?.slice(0,300) || document.body.innerText.slice(0,300)`).catch(() => '')
    console.log(`  ✗ ${e.nombre}: ${err.message}\n    pantalla: ${String(pantalla).replace(/\n+/g, ' / ')}\n    captura: ${foto ? archivo : '—'}`)
  }
}
console.log(`\n${bien} bien, ${mal} mal · ${((Date.now() - inicio) / 1000).toFixed(0)} s`)
await nav.cerrar()
await servidor.close?.() ?? servidor.httpServer?.close()
process.exit(mal ? 1 : 0)
