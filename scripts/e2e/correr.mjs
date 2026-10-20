// Pruebas de extremo a extremo: usa la app como una persona (alta, entreno, comida, progreso, perfil…)
// en un navegador sin ventana, con fecha y conexión simuladas.
//   node scripts/e2e/correr.mjs            → contra el servidor de desarrollo
//   node scripts/e2e/correr.mjs --build    → contra la versión compilada (dist/), incluida la prueba sin conexión
//   node scripts/e2e/correr.mjs entreno    → solo los escenarios cuyo nombre contenga «entreno»
import path from 'node:path'
import { createServer, preview } from 'vite'
import { abrirNavegador } from './navegador.mjs'
import { AYUDANTE, RELOJ } from './pagina.mjs'

const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const args = process.argv.slice(2)
const compilada = args.includes('--build')
const filtro = args.find(a => !a.startsWith('--'))
const esperar = ms => new Promise(r => setTimeout(r, ms))

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
let sinConexion = false
cdp.al('Runtime.exceptionThrown', p => errores.push(`excepción: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`))
cdp.al('Runtime.consoleAPICalled', p => { if (p.type === 'error') errores.push(`console.error: ${p.args.map(a => a.value ?? a.description).join(' ')}`) })
cdp.al('Log.entryAdded', p => { if (p.entry.level === 'error' && !/openfoodfacts|favicon/.test(p.entry.url ?? '')) errores.push(`log: ${p.entry.text} ${p.entry.url ?? ''}`) })
cdp.al('Fetch.requestPaused', async p => {
  const u = p.request.url
  if (sinConexion && !u.startsWith(URL_APP)) return cdp.enviar('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' })
  const m = u.match(/api\/v2\/product\/(\d+)/)
  if (sinConexion || !m) return cdp.enviar('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' })
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
const DESCARGAS = path.join(RAIZ, '.cache', 'e2e-descargas')
const fsx = await import('node:fs')
fsx.rmSync(DESCARGAS, { recursive: true, force: true }); fsx.mkdirSync(DESCARGAS, { recursive: true })
await cdp.enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS }).catch(() => cdp.enviar('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS }))
/** Próximo archivo que se dará cuando la app abra el selector de archivos (fotos, importar copia). */
let archivoParaElegir = null
cdp.al('Page.fileChooserOpened', async p => {
  if (!archivoParaElegir) return
  await cdp.enviar('DOM.setFileInputFiles', { files: [archivoParaElegir], backendNodeId: p.backendNodeId })
})
await movil(390, 844)

async function movil(ancho, alto) {
  await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 2, mobile: true })
  await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: true })
}
async function tema(t) { await cdp.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: t }] }) }

/** Evalúa JS en la página (con await). */
async function js(codigo) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: `(async()=>{${codigo}})()`, awaitPromise: true, returnByValue: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] ?? r.exceptionDetails.text)
  return r.result.value
}
const t = (metodo, ...a) => js(`return await __t.${metodo}(${a.map(x => x instanceof RegExp ? x.toString() : JSON.stringify(x)).join(',')})`)
const pulsar = (texto, donde) => t('pulsar', texto, donde)
const ver = (texto, ms) => t('ver', texto, ms)
const noVer = texto => t('noVer', texto)

/** Carga la app de cero (base vacía) a una fecha y hora concretas. */
async function deCero(fechaHora) {
  await cdp.enviar('Page.navigate', { url: PAGINA_APP })
  await esperar(300)
  await js(`
    sessionStorage.setItem('__e2e_fecha', String(new Date(${JSON.stringify(fechaHora)}).getTime() - Date.__real()));
    localStorage.clear();
    for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r });
    for (const r of await navigator.serviceWorker?.getRegistrations?.() ?? []) await r.unregister();
    for (const k of await caches?.keys?.() ?? []) await caches.delete(k);
  `)
  await recargar()
}
async function recargar() {
  await cdp.enviar('Page.reload', { ignoreCache: true })
  await esperar(400)
  await t('ver', /JOWYFIT|Buenos|Buenas|Hoy te toca|Inicio/i, 15000)
}
/** Cambia la fecha simulada sin borrar datos (como si pasaran los días). */
async function irA(fechaHora) {
  await js(`sessionStorage.setItem('__e2e_fecha', String(new Date(${JSON.stringify(fechaHora)}).getTime() - Date.__real()))`)
  await recargar()
}
async function hacerEntreno({ ocupado = false } = {}) {
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  let vueltas = 0
  while (!(await t('hay', 'Entreno terminado')) && vueltas++ < 90) {
    if (await t('hay', /Saltar/)) await pulsar(/^Saltar$/).catch(() => {})
    if (ocupado && vueltas === 2) { await pulsar(/^Ocupado$/); await pulsar(/Hacer esta|Hacerlo ahora/, '.sheet'); continue }
    await ponerPesoSiFalta()
    await pulsar(/^Hecho$/)
    await esperar(120)
  }
  if (vueltas >= 90) throw new Error('No se llega al final del entreno')
  await pulsar('Guardar')
  await ver(/hecho/i, 8000)
}
async function alta() {
  await pulsar('Empezar')
  // Sobre ti: fecha, sexo, altura y peso son obligatorios (antes venían rellenos con valores inventados).
  await t('elegir', 'select[aria-label="Día de nacimiento"]', 20)
  await t('elegir', 'select[aria-label="Mes de nacimiento"]', 5)
  await t('elegir', 'select[aria-label="Año de nacimiento"]', 1990)
  await pulsar('Hombre')
  await t('escribir', 'input[aria-label="Altura en centímetros"]', '175')
  await t('escribir', 'input[aria-label="Peso en kilos"]', '75')
  for (let i = 0; i < 12 && !(await t('hay', /Creando tu rutina|Tu rutina está lista/)); i++) {
    await t('nombreSiHace', 'Joel')
    // Tus horarios: no viene nada marcado. Martes, jueves y viernes a las 5:30, con el sábado de extra.
    if (await js(`return !!document.querySelector('select[aria-label="Hora de entreno"]')`)) {
      for (const d of ['martes', 'jueves', 'viernes']) await t('pulsarSel', `[aria-label="${d}"]`)
      await t('elegir', 'select[aria-label="Hora de entreno"]', '05:30')
      await t('pulsarSel', '[aria-label="Extra el sábado"]')
    }
    await pulsar('Siguiente')
  }
  await ver('Tu rutina está lista', 15000)
  await pulsar('Ir a Inicio')
  await ver('Hoy te toca', 8000).catch(() => ver(/descansas|no entrenaste|Próximo/, 3000))
}
/** En la primera sesión el peso empieza vacío: sube el stepper hasta tener un peso. */
async function ponerPesoSiFalta() {
  await js(`const g = [...document.querySelectorAll('.stp')].find(x => /peso/i.test(x.getAttribute('aria-label') || '') || /kg/i.test(x.closest('div')?.previousElementSibling?.textContent || ''))
    const v = g?.querySelector('.val')?.textContent || ''
    if (g && (v.includes('—') || v.includes('?') || v.trim() === '')) for (let i = 0; i < 8; i++) g.querySelector('button[aria-label="Más"]')?.click()`)
}
/** Botón de volver de la cabecera (o de la galería de la ficha). */
const volver = () => js(`const b = [...document.querySelectorAll('button[aria-label]')].filter(b => /^(Volver|Atrás)$/.test(b.getAttribute('aria-label')) && b.getBoundingClientRect().width > 0).pop(); if (!b) throw new Error('No hay botón de volver'); b.click(); await new Promise(r => setTimeout(r, 300))`)
const seg = async n => { await pulsar(n, '.seg'); await t('listo') }
/** Lee una tabla entera de la base local de la app. */
const tabla = nombre => js(`return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => { const g = q.result.transaction('${nombre}').objectStore('${nombre}').getAll(); g.onsuccess = () => ok(g.result); g.onerror = mal } })`)
/** Mete filas en una tabla de la base local (para preparar historiales largos sin tocar 6 semanas). */
const meter = (nombre, filas) => js(`const filas = ${JSON.stringify(filas)}; return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => { const tx = q.result.transaction('${nombre}', 'readwrite'); for (const f of filas) tx.objectStore('${nombre}').put(f); tx.oncomplete = () => ok(filas.length); tx.onerror = mal } })`)

const pestana = async n => { await pulsar(new RegExp(`^${n}$`, 'i'), '.tabbar'); await t('listo') }

// ---------- escenarios ----------
const ESCENARIOS = []
const escenario = (nombre, f) => ESCENARIOS.push({ nombre, f })

escenario('alta y rutina', async () => {
  await deCero('2026-10-13T05:20:00') // martes, día de entreno
  await ver('Tu fuerza y tu comida')
  await alta()
  await ver('Empezar rutina')
  // Guía para quien llega nuevo: se ve y se puede quitar.
  await ver('Primeros pasos')
  await pulsar('Ya lo sé')
  await noVer('Primeros pasos')
  await pestana('Rutina')
  await ver('Cuerpo completo')
  await ver(/Semana de (calibración|prueba)/i)
})

escenario('entreno completo', async () => {
  await deCero('2026-10-13T05:20:00')
  await alta()
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  let vueltas = 0
  while (!(await t('hay', 'Entreno terminado')) && vueltas++ < 80) {
    if (await t('hay', /Saltar/)) await pulsar(/^Saltar$/).catch(() => {})
    await ponerPesoSiFalta()
    await pulsar(/^Hecho$/)
    await esperar(150)
  }
  if (vueltas >= 80) throw new Error('No se llega al final del entreno')
  await ver('Entreno terminado')
  // Desde el resumen se puede volver al entreno (antes no: te devolvía al resumen al instante).
  await t('pulsarSel', 'button[aria-label="Volver al entreno"]')
  await ver('Has hecho todos los ejercicios')
  await esperar(800)
  await ver('Has hecho todos los ejercicios')
  await pulsar('Terminar entreno')
  await ver('Entreno terminado')
  await pulsar('Guardar')
  await ver(/Entreno de hoy hecho|hecho/i, 8000)
  const n = await js(`return (await new Promise(r=>{const q=indexedDB.open('jowyfit');q.onsuccess=()=>{const tx=q.result.transaction('sesiones');const g=tx.objectStore('sesiones').getAll();g.onsuccess=()=>r(g.result)}})).filter(s=>s.estado==='hecha').length`)
  if (n !== 1) throw new Error(`Sesiones hechas: ${n}`)
  // Un entreno ya guardado se corrige tocando la serie.
  await pestana('Rutina')
  await pulsar(/Entreno de hoy hecho/)
  await ver('Toca una serie para corregirla')
  await t('pulsarSel', '.ux-det-serie')
  await t('pulsarSel', '.ux-corr-f [aria-label="Repeticiones"] button[aria-label="Más"]')
  await pulsar('Guardar cambio')
  await ver('Serie corregida')
  await pestana('Progreso')
  await seg('Fuerza')
  await ver('Historial')
})

escenario('entreno: minimizar, recargar y seguir', async () => {
  await deCero('2026-10-13T05:20:00')
  await alta()
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  await ponerPesoSiFalta()
  await pulsar(/^Hecho$/)
  await ver('Próxima', 5000)
  await recargar()
  await ver(/En curso|Entrenando|Continuar/, 8000)
  if (!(await t('hay', 'Próxima'))) await pulsar(/Continuar|Entrenando/).catch(() => {})
  // El descanso sigue contando tras recargar.
  await ver('Próxima', 8000)
  await pulsar(/^Saltar$/)
  await ver('Hecho', 6000)
  await pulsar('Lista de la sesión').catch(() => t('pulsarSel', '[aria-label="Lista de la sesión"]'))
  await pulsar('Terminar entreno', '.sheet')
  await ver('Entreno terminado')
})

escenario('entreno: el botón atrás pregunta si acabarlo', async () => {
  await deCero('2026-10-13T05:20:00')
  await alta()
  // Entreno libre: atrás → «Estás en un entreno libre». «Continuar» sigue; «Acabar» sin series lo cierra y sale.
  await pestana('Rutina')
  await pulsar('Otras formas de entrenar')
  await pulsar('Entreno libre')
  await ver('Añade el primer ejercicio', 8000)
  await js('window.__jfAtras()')
  await ver('Estás en un entreno libre')
  await pulsar('Continuar', '.sheet')
  await ver('Añade el primer ejercicio')
  await js('window.__jfAtras()')
  await pulsar('Acabar', '.sheet')
  await ver('Entreno libre cerrado')
  await noVer('Añade el primer ejercicio')
  if ((await tabla('sesiones')).some(s => s.estado === 'curso')) throw new Error('El entreno libre sigue abierto')
  // Entreno de la rutina con una serie hecha: «Acabar» lleva al resumen para guardarlo.
  await pestana('Inicio')
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  await ponerPesoSiFalta()
  await pulsar(/^Hecho$/)
  await js('window.__jfAtras()')
  await ver('Estás entrenando')
  await pulsar('Acabar', '.sheet')
  await ver('Entreno terminado')
})

escenario('entreno: saltar un ejercicio y calorías en reposo y por ejercicio', async () => {
  await deCero('2026-10-13T05:20:00')
  await alta()
  await ver('En reposo')
  await ver('Por ejercicio')
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  await ponerPesoSiFalta()
  await pulsar(/^Hecho$/)
  await pulsar(/^Saltar$/)
  await pulsar('Saltar este ejercicio')
  await ver('Saltado:')
  const s = (await tabla('sesiones')).find(x => x.estado === 'curso')
  if (!s || !s.ejercicios.some(e => e.estado === 'saltado')) throw new Error('No se ha saltado el ejercicio')
  await js('window.__jfAtras()')
  await pulsar('Acabar', '.sheet')
  await ver('Entreno terminado')
  await pulsar('Guardar')
  await ver('Por ejercicio', 8000)
  await ver('por lo saltado')
  await ver(/entreno ~\d+/)
})

escenario('comida: plantilla, picoteo, nota, editar y borrar', async () => {
  await deCero('2026-10-13T14:10:00')
  await alta()
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  await ver('Añadido: Batido')
  await pulsar('Añadir', '.dock')
  await pulsar('Bolsa de patatas pequeña', '.sheet')
  await pulsar(/^Normal/, '.popup')
  // El aviso no puede tapar el botón principal de abajo.
  const tapaAviso = await js(`const a = document.querySelector('.toast')?.getBoundingClientRect(); const d = document.querySelector('.dock .btn')?.getBoundingClientRect(); return !!(a && d && a.bottom > d.top && a.top < d.bottom)`)
  if (tapaAviso) throw new Error('El aviso tapa el botón «Añadir»')
  await pulsar('Añadir', '.dock')
  await pulsar('Escribir lo que he comido', '.sheet')
  await t('escribir', '.nota-r input', 'Menú del día')
  await pulsar(/^Apuntar$/, '.sheet')
  await ver('Menú del día')
  await pulsar('Menú del día')
  await ver('Editar', 3000)
  await pulsar('Mucho', '.sheet').catch(() => {})
  await pulsar('Guardar', '.sheet')
  await pulsar('Bolsa de patatas pequeña')
  await pulsar('Borrar', '.sheet')
  await ver('Deshacer')
  await pulsar('Deshacer')
  await ver('Bolsa de patatas pequeña')
  await ver('1 día con picoteo')
  // Crear una comida desde Añadir: «Guardar y apuntar» la guarda en Mis comidas y la deja apuntada.
  await pulsar('Añadir', '.dock')
  await pulsar('Crear comida nueva', '.sheet')
  await t('escribir', '.sheet input[aria-label="Nombre de la comida"]', 'Lentejas de mi madre')
  await pulsar('Guardar y apuntar', '.sheet')
  await ver('Apuntado: Lentejas de mi madre')
  // El picoteo guarda la bolsa entera: «Mucho» es toda la bolsa (800 kcal) y «Normal», la mitad.
  await pulsar('Añadir', '.dock')
  // Tocar cualquier comida abre «¿Cuánto?»: se elige y se suma.
  await pulsar('Bolsa de patatas grande', '.sheet')
  await ver('¿Cuánto has tomado?')
  await pulsar(/^Mucho/, '.popup')
  await ver('Añadido: Bolsa de patatas grande')
  const apuntadas = await tabla('comidas')
  if (apuntadas.find(c => c.nombre === 'Lentejas de mi madre')?.kcal !== 600) throw new Error('«Guardar y apuntar» no apunta el plato normal')
  if (apuntadas.find(c => c.nombre === 'Bolsa de patatas grande')?.kcal !== 800) throw new Error('«Mucho» de un picoteo no es la bolsa entera')
  await seg('Mis comidas')
  await ver('Lentejas de mi madre')
  // Desde Mis comidas también se puede apuntar al crear, y borrar al editar.
  await pulsar('Crear comida nueva')
  await ver('Guardar y apuntar')
  await t('pulsarSel', '.sheet button[aria-label="Cerrar"]')
  await t('pulsarSel', 'button[aria-label="Editar Lentejas de mi madre"]')
  await pulsar('Borrar de Mis comidas', '.sheet')
  await ver('Borrado de Mis comidas')
})

escenario('comida: escáner con y sin conexión', async () => {
  await deCero('2026-10-13T14:10:00')
  await alta()
  await pestana('Comida')
  await t('pulsarSel', 'button[aria-label="Escanear"]')
  await pulsar(/Escribir el código/)
  await t('escribir', '.cam-panel input', '8480000123458')
  await pulsar('Buscar')
  await ver('Arroz al curry con pollo', 8000)
  // El escáner ocupa toda la pantalla: la barra de pestañas no puede tapar sus botones.
  const tapa = await js(`const tb = document.querySelector('.tabbar').getBoundingClientRect(); const b = [...document.querySelectorAll('.cam-panel button')].map(x => x.getBoundingClientRect()); return b.some(r => r.bottom > tb.top + 1 && tb.top < innerHeight)`)
  if (tapa) throw new Error('La barra de pestañas tapa los botones del escáner')
  await pulsar('Ver producto')
  await ver('Ficha técnica')
  await pulsar('Mucho', '.chips')
  await pulsar(/^Añadir$/)
  await ver('Añadido: Arroz al curry con pollo')
  // Código desconocido → a mano
  await t('pulsarSel', 'button[aria-label="Escanear"]')
  await pulsar(/Escribir el código/)
  await t('escribir', '.cam-panel input', '1234567890123')
  await pulsar('Buscar')
  await ver('No está en la base de datos', 8000)
  await t('escribir', '.cam-panel input', 'Yogur proteico')
  await pulsar('Añadir a mano')
  await ver('Yogur proteico')
  // Sin conexión → pendiente
  sinConexion = true
  await t('pulsarSel', 'button[aria-label="Escanear"]')
  await pulsar(/Escribir el código/)
  await t('escribir', '.cam-panel input', '5449000000996')
  await pulsar('Buscar')
  await ver('Sin conexión', 8000)
  await pulsar('Vale')
  sinConexion = false
  await seg('Mis comidas')
  await ver(/Coca-Cola|Pendiente de buscar/, 10000)
})

escenario('peso, medidas y cuerpo', async () => {
  await deCero('2026-10-13T07:00:00')
  await alta()
  await pulsar('+ Peso')
  await pulsar('Guardar', '.sheet')
  await ver('Guardado:')
  await pestana('Progreso')
  await seg('Cuerpo')
  await ver('Cintura')
  await pulsar(/Registrar/)
  await pulsar('Guardar')
  await pestana('Progreso')
  await seg('Semana')
  await ver(/Semana|Revisión/)
})

escenario('metas, pasos y trote', async () => {
  await deCero('2026-10-13T19:00:00')
  await alta()
  await pestana('Progreso')
  await seg('Metas')
  await pulsar('Crear una meta')
  await pulsar('Guardar', '.sheet').catch(() => pulsar(/Crear|Guardar/, '.sheet'))
  await ver(/Falta|Ahora/)
  await pestana('Inicio')
  // Mientras se ve «Primeros pasos», la tarjeta de pasos está oculta: se cierra la guía.
  if (await t('hay', 'Primeros pasos')) await pulsar('Ya lo sé')
  await t('pulsarSel', '.kpi.steps')
  await ver('Últimos 7 días')
  await pulsar('+ Trote / carrera')
  await pulsar('Añadir', '.sheet')
  await ver('Añadido: trote')
})

escenario('perfil y ajustes', async () => {
  await deCero('2026-10-13T19:00:00')
  await alta()
  await pestana('Perfil')
  await ver('Tus números')
  await pulsar('Datos personales')
  await t('escribir', 'input[aria-label="Nombre"], input', 'Ana')
  await js(`document.activeElement?.blur()`)
  await volver()
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await ver('Apariencia')
  await pulsar('Oscuro').catch(() => {})
  await pulsar('Grande').catch(() => {})
  await pulsar('Créditos y aviso legal')
  await ver('RepDB')
  await ver('Open Food Facts')
})

if (!compilada) escenario('copia de seguridad: exportar e importar', async () => {
  await deCero('2026-10-13T14:10:00')
  await alta()
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  // Exporta con la función real de la app, borra todo e importa.
  const r = await js(`
    const m = await import('/src/datos/copias.ts').catch(() => null)
    if (!m) return 'sin-modulo'
    const bytes = await m.exportar()
    const { db } = await import('/src/datos/db.ts')
    const antes = await db.comidas.count()
    await Promise.all(db.tables.map(t => t.clear()))
    await m.importar(bytes)
    return antes + '/' + (await db.comidas.count()) + '/' + (await db.perfil.count())
  `)
  if (r !== 'sin-modulo' && r !== '1/1/1') throw new Error(`Copia: ${r}`)
})

escenario('semana: dos entrenos, progresión y día perdido', async () => {
  await deCero('2026-10-12T09:00:00') // lunes: alta
  await alta()
  await ver(/descansas|Próximo/i)
  await irA('2026-10-13T05:20:00') // martes: A
  await hacerEntreno()
  await irA('2026-10-15T05:20:00') // jueves: B, con un ejercicio sustituido
  await hacerEntreno({ ocupado: true })
  await irA('2026-10-17T09:00:00') // sábado: no se hizo C el viernes → ¿al sábado?
  await ver(/no entrenaste|Opcional|Sesión extra/i)
  await irA('2026-10-20T05:20:00') // martes siguiente: A otra vez, con la carga de la semana pasada
  await ver('Hoy te toca')
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver(/La última vez/i)
  await noVer('Primera vez: elige')
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Terminar entreno', '.sheet')
  await pulsar('Guardar')
  await pestana('Progreso')
  await seg('Fuerza')
  await ver('Historial')
  await seg('Semana')
  await ver(/entrenos/i)
})

escenario('semana de prueba completa: 3 entrenos y rutina definitiva', async () => {
  await deCero('2026-10-13T05:20:00') // martes: A
  await alta()
  await hacerEntreno()
  await irA('2026-10-15T05:20:00') // jueves: B
  await hacerEntreno()
  await irA('2026-10-16T05:20:00') // viernes: C, el tercero de la semana de prueba
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  let vueltas = 0
  while (!(await t('hay', 'Entreno terminado')) && vueltas++ < 90) {
    if (await t('hay', /Saltar/)) await pulsar(/^Saltar$/).catch(() => {})
    await ponerPesoSiFalta()
    await pulsar(/^Hecho$/)
    await esperar(120)
  }
  await ver('Semana de prueba terminada')
  await pulsar('Guardar')
  // Se propone la definitiva: la misma rutina, con lo que cambia y sin «Otra variante».
  await ver('Tu rutina definitiva', 8000)
  await ver('Qué cambia')
  await noVer('Otra variante')
  await pulsar('Usar esta rutina')
  await ver('Definitiva', 8000)
  const rutinas = await tabla('rutinas')
  const activa = rutinas.find(r => r.activa)
  if (!activa || activa.calibracion) throw new Error('La rutina activa sigue en semana de prueba')
  if (rutinas.length !== 2) throw new Error('Debería haber 2 rutinas (la de prueba y la definitiva): ' + rutinas.length)
})

escenario('rutina: regenerar, biblioteca y gimnasio', async () => {
  await deCero('2026-10-14T18:00:00')
  await alta()
  await pestana('Rutina')
  // Rehacer la rutina está dentro de «Editar plan», con confirmación.
  await pulsar('Editar plan')
  await pulsar('Rehacer la rutina desde cero')
  await pulsar('Ver la rutina nueva', '.sheet')
  // Rehacerla durante la semana de prueba la mantiene en prueba (antes pasaba a «Definitiva»).
  await ver('Empezar con una semana de prueba')
  await pulsar('Usar esta rutina')
  await ver('Cuerpo completo', 6000)
  await ver('Semana de prueba')
  await pestana('Rutina')
  await seg('Ejercicios')
  await t('escribir', 'input[type=search]', 'press banca')
  await ver(/Press de Banca/i)
  await pulsar(/Press de Banca con Barra/i)
  await ver('Músculos que trabaja')
  await ver('Instrucciones')
  await pulsar('Favorito').catch(() => {})
  await volver()
  await pestana('Rutina')
  await seg('Gimnasios')
  await pulsar(/Editar/)
  await ver('Máquinas y material')
  await pulsar('Guardar')
})

escenario('fotos de progreso', async () => {
  await deCero('2026-10-14T18:00:00')
  await alta()
  await pestana('Progreso')
  await seg('Fotos')
  archivoParaElegir = path.join(RAIZ, 'public', 'iconos', 'icono-512.png')
  await pulsar(/Hacer la primera foto|^Foto$/)
  await ver('Foto guardada', 8000)
  await irA('2026-11-11T18:00:00')
  await pestana('Progreso')
  await seg('Fotos')
  await pulsar(/^Foto/)
  await ver('Foto guardada', 8000)
  await ver(/Comparador/i)
  archivoParaElegir = null
})

escenario('copia desde la interfaz: descargar, borrar todo e importar', async () => {
  await deCero('2026-10-14T14:00:00')
  await alta()
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Hacer copia ahora')
  let archivo = null
  for (let i = 0; i < 40 && !archivo; i++) { await esperar(250); archivo = fsx.readdirSync(DESCARGAS).find(f => f.endsWith('.jowyfit')) }
  if (!archivo) throw new Error('No se descargó la copia')
  await pulsar('Borrar todos los datos')
  // Se confirma dos veces: la primera solo cambia el botón a «Sí, borrarlo todo».
  await pulsar(/^Borrar todo/, '.sheet')
  await ver('Sí, borrarlo todo')
  await pulsar('Sí, borrarlo todo', '.sheet').catch(() => {}) // la app se recarga sola
  await esperar(2500)
  await ver('Tu fuerza y tu comida', 10000)
  archivoParaElegir = path.join(DESCARGAS, archivo)
  await pulsar(/Tengo una copia/)
  await esperar(1500)
  if (await t('hay', /¿Restaurar/)) await pulsar(/^Restaurar/)
  await ver(/Buenos|Buenas|Hoy te toca|descansas/, 15000)
  await pestana('Comida')
  await ver('Batido de proteína')
  archivoParaElegir = null
})

escenario('entreno: esfuerzo opcional y final sin preguntas', async () => {
  await deCero('2026-10-13T05:20:00')
  await alta()
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  // La primera vez ya viene un peso de partida: «Hecho» funciona sin tocar nada.
  const pesoInicial = await js(`return [...document.querySelectorAll('.stp')][0]?.querySelector('.val, input')?.textContent || [...document.querySelectorAll('.stp')][0]?.querySelector('input')?.value || ''`)
  if (!/\d/.test(pesoInicial)) throw new Error('No hay peso de partida: «' + pesoInicial + '»')
  await pulsar(/^Hecho$/) // sin tocar el esfuerzo
  await ver('Próxima', 5000)
  await pulsar(/^Saltar$/)
  await pulsar('8', '.effs') // en la segunda, sí
  await pulsar(/^Hecho$/)
  const s = (await tabla('sesiones')).find(x => x.estado === 'curso')
  const series = s.ejercicios[0].series.filter(x => x.hecha)
  if (series[0].rpe !== null) throw new Error('El esfuerzo sin tocar se ha guardado: ' + series[0].rpe)
  if (series[1].rpe !== 8) throw new Error('El esfuerzo marcado no se ha guardado: ' + series[1].rpe)
  if (series[1].peso !== series[0].peso) throw new Error('La segunda serie no mantiene el peso de la primera')
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Terminar entreno', '.sheet')
  await ver('Entreno terminado')
  await noVer('¿Cuánto has tardado de verdad?')
  await noVer('¿Qué estaba ocupado?')
  await ver('¿Alguna molestia?')
})

escenario('semana suave tras 6 semanas', async () => {
  await deCero('2026-10-19T09:00:00') // lunes
  await alta()
  // 6 semanas con dos entrenos cada una (como si se hubieran hecho), con los ejercicios del día A.
  const [rutina] = await tabla('rutinas')
  const dia = rutina.dias[0]
  const sesiones = []
  let id = 1000
  for (let sem = 6; sem >= 1; sem--) for (const dd of [1, 3]) {
    const f = new Date(2026, 9, 19 - sem * 7 + dd)
    const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    sesiones.push({ id: id++, fecha, rutinaId: rutina.id, letra: dia.letra, nombre: dia.nombre, gimnasioId: null, inicio: f.getTime() + 5.5 * 3600e3, version: 'normal', estado: 'hecha', calibracion: false,
      ejercicios: dia.bloques.map(b => ({ uid: b.uid, ejercicio: b.ejercicio, planificado: b.ejercicio, estado: 'hecho', repsMin: b.repsMin, repsMax: b.repsMax, rpe: b.rpe, descanso: b.descanso, registro: b.registro,
        series: Array.from({ length: b.series }, (_, i) => ({ n: i + 1, peso: b.registro === 'peso' ? 20 + (6 - sem) * 2.5 : null, reps: b.repsMin, rpe: 8, calentamiento: false, hecha: true })) })) })
  }
  await meter('sesiones', sesiones)
  await meter('rutinas', [{ ...rutina, calibracion: false }])
  await recargar()
  await ver('¿Semana suave?', 8000)
  await pulsar('Ahora no')
  await noVer('¿Semana suave?')
  // Sigue entrenando la semana aplazada (si no, la racha se corta y ya no hace falta semana suave).
  await meter('sesiones', [{ ...sesiones[sesiones.length - 1], id: id++, fecha: '2026-10-20', inicio: new Date(2026, 9, 20, 5, 30).getTime() }])
  await irA('2026-10-26T09:00:00') // la semana siguiente vuelve a salir
  await ver('¿Semana suave?', 8000)
  await pulsar('Sí, esta semana')
  await ver('Semana suave.', 5000)
  await irA('2026-10-27T05:20:00') // martes: día A, más ligero
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Semana suave: 1 serie menos', 8000)
  const s = (await tabla('sesiones')).find(x => x.estado === 'curso')
  if (!s.suave) throw new Error('La sesión no está marcada como suave')
  const b0 = dia.bloques[0]
  const e0 = s.ejercicios[0]
  if (e0.series.length !== Math.max(2, b0.series - 1)) throw new Error(`Series: ${e0.series.length} (plan ${b0.series})`)
  if (b0.registro === 'peso' && !(e0.series[0].peso < 32.5)) throw new Error('El peso no baja en la semana suave: ' + e0.series[0].peso)
})

escenario('comida: lo de ayer y recientes', async () => {
  await deCero('2026-10-13T08:10:00')
  await alta()
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Escribir lo que he comido', '.sheet')
  await t('escribir', '.nota-r input', 'Tostadas con tomate')
  await pulsar(/^Apuntar$/, '.sheet')
  await ver('Tostadas con tomate')
  await irA('2026-10-14T08:15:00')
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await ver('Lo de ayer: desayuno')
  await ver('Recientes')
  await pulsar(/Lo de ayer/, '.sheet')
  await ver('Añadido: Tostadas con tomate')
  const hoy = (await tabla('comidas')).filter(c => c.fecha === '2026-10-14')
  if (hoy.length !== 1 || hoy[0].franja !== 'desayuno') throw new Error('No se ha repetido lo de ayer: ' + JSON.stringify(hoy))
  // Un reciente también pregunta cuánto: «Poco» es un tercio de lo que era su «Normal».
  await pulsar('Añadir', '.dock')
  await js(`[...document.querySelectorAll('.sheet button.it')].find(b => b.innerText.trim().startsWith('Tostadas con tomate')).click()`)
  await pulsar(/^Poco/, '.popup')
  await ver('Añadido: Tostadas con tomate (poco)')
  const poco = (await tabla('comidas')).filter(c => c.fecha === '2026-10-14').map(c => c.kcal).sort((a, b) => a - b)
  if (poco.length !== 2 || poco[0] !== Math.round(poco[1] / 3)) throw new Error('«Poco» de un reciente no es un tercio: ' + JSON.stringify(poco))
})

escenario('comida: suplementos con su cantidad y el batido suma proteína', async () => {
  await deCero('2026-10-13T18:10:00')
  await alta()
  // En el alta no se eligen suplementos: se ponen en el perfil.
  const perfil = (await tabla('perfil'))[0]
  perfil.suplementos = ['Creatina', 'Batido de proteína']
  await meter('perfil', [perfil])
  await recargar()
  await pestana('Comida')
  await ver('Suplementos de hoy')
  await ver('3-5 g')
  // Cambiar la cantidad de creatina y la proteína del batido.
  await t('pulsarSel', 'button[aria-label="Cambiar cantidad de Creatina"]')
  await t('escribir', '.sheet input', '10 g')
  await pulsar('Guardar', '.sheet')
  await ver('10 g')
  await t('pulsarSel', 'button[aria-label="Cambiar cantidad de Batido de proteína"]')
  for (let i = 0; i < 6; i++) await t('pulsarSel', '.sheet [aria-label="Proteína del batido"] button[aria-label="Más"]')
  await pulsar('Guardar', '.sheet')
  await ver('30 g proteína')
  // Marcar el batido lo apunta y suma 30 g al día; desmarcarlo lo quita.
  await pulsar('Batido de proteína')
  await ver('Apuntado: Batido de proteína · 30 g proteína')
  let hoy = (await tabla('comidas')).filter(c => c.fecha === '2026-10-13')
  if (hoy.length !== 1 || hoy[0].proteina !== 30) throw new Error('El batido no suma su proteína: ' + JSON.stringify(hoy))
  // Pasado el bloqueo contra el doble toque (400 ms), se desmarca.
  await esperar(700)
  await pulsar('Batido de proteína')
  await esperar(500)
  hoy = (await tabla('comidas')).filter(c => c.fecha === '2026-10-13')
  if (hoy.length !== 0) throw new Error('Al desmarcar el batido no se quita')
})

escenario('repaso visual de todas las pestañas', async () => {
  await deCero('2026-10-15T18:00:00')
  await alta()
  for (const [ancho, alto] of [[360, 740], [390, 844], [412, 915]]) {
    await movil(ancho, alto)
    for (const tm of ['light', 'dark']) {
      await tema(tm)
      for (const p of ['Inicio', 'Rutina', 'Comida', 'Progreso', 'Perfil']) {
        await pestana(p)
        const segs = await js(`return [...document.querySelectorAll('.screen .seg button')].map(b=>b.textContent.trim())`)
        for (const s of segs.length ? segs : [null]) {
          if (s) { await pulsar(s, '.seg'); await t('listo') }
          const fallo = await t('revisar')
          if (fallo) throw new Error(`${ancho}px ${tm} ${p}${s ? '/' + s : ''}: ${fallo}`)
        }
      }
    }
  }
  await movil(390, 844)
  await tema('light')
})

escenario('rendimiento de carga', async () => {
  await deCero('2026-10-13T05:20:00')
  await alta()
  const ms = []
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    await cdp.enviar('Page.reload', {})
    await esperar(50)
    await t('ver', 'Hoy te toca', 15000).catch(async () => { await esperar(300); await t('ver', 'Hoy te toca', 15000) })
    ms.push(Date.now() - t0)
  }
  const m = await cdp.enviar('Performance.getMetrics').catch(() => null)
  console.log(`    carga hasta «Hoy te toca»: ${ms.join(' / ')} ms`)
  if (m) { const h = m.metrics.find(x => x.name === 'JSHeapUsedSize'); if (h) console.log(`    memoria JS: ${(h.value / 1048576).toFixed(1)} MB`) }
})

if (compilada) escenario('sin conexión (versión compilada)', async () => {
  await deCero('2026-10-13T05:20:00')
  await alta()
  // Que el service worker termine de guardar toda la app (incluidas las imágenes).
  await js(`for (let i = 0; i < 240; i++) { let n = 0; for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length; if (navigator.serviceWorker.controller && n > 2000) return n; await new Promise(r => setTimeout(r, 500)) } throw new Error('El service worker no terminó de guardar la app')`)
  await cdp.enviar('Network.enable')
  await cdp.enviar('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await cdp.enviar('Page.reload', {})
  await ver('Hoy te toca', 15000)
  await pestana('Rutina')
  await pulsar(/Cuerpo completo A/)
  const img = await js(`await new Promise(r=>setTimeout(r,1500)); const i=[...document.querySelectorAll('img')]; return i.length+'/'+i.filter(x=>x.complete&&x.naturalWidth>0).length`)
  const [a, b] = img.split('/')
  if (a === '0' || a !== b) throw new Error(`Imágenes sin conexión: ${img}`)
  await cdp.enviar('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
})

// ---------- ejecución ----------
await cdp.enviar('Performance.enable').catch(() => {})
let bien = 0, mal = 0
const inicio = Date.now()
for (const e of ESCENARIOS) {
  if (filtro && !e.nombre.includes(filtro)) continue
  errores.length = 0
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
