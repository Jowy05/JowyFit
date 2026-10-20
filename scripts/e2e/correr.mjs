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
/** Hace el entreno de hoy con la interfaz. Con `series`, solo esas series y luego «Terminar entreno» desde la lista. */
async function hacerEntreno({ ocupado = false, series = Infinity } = {}) {
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  let vueltas = 0
  while (!(await t('hay', 'Entreno terminado')) && vueltas++ < 90) {
    if (vueltas > series) { await t('pulsarSel', '[aria-label="Lista de la sesión"]'); await pulsar('Terminar entreno', '.sheet'); await ver('Entreno terminado'); break }
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
async function alta(o = {}) {
  await pulsar('Empezar')
  // Sobre ti: fecha, sexo, altura y peso son obligatorios (antes venían rellenos con valores inventados).
  await t('elegir', 'select[aria-label="Día de nacimiento"]', 20)
  await t('elegir', 'select[aria-label="Mes de nacimiento"]', 5)
  await t('elegir', 'select[aria-label="Año de nacimiento"]', 1990)
  await pulsar('Hombre')
  await t('escribir', 'input[aria-label="Altura en centímetros"]', '175')
  await t('escribir', 'input[aria-label="Peso en kilos"]', '75')
  // Medidas opcionales (cintura y cuello) en «Más medidas».
  if (o.medidas) {
    await pulsar('Más medidas')
    await t('escribir', 'input[aria-label="Cintura en centímetros"]', '95')
    await t('escribir', 'input[aria-label="Cuello en centímetros"]', '38')
  }
  for (let i = 0; i < 12 && !(await t('hay', /Creando tu rutina|Tu rutina está lista/)); i++) {
    await t('nombreSiHace', 'Joel')
    // Gimnasio «lo marco yo»: con nombre y quitando todas las poleas.
    if (o.gimnasioYo && await t('hay', 'Lo marco yo') && !(await js(`return !!document.querySelector('input[aria-label="Nombre del gimnasio"]')`))) {
      await pulsar('Lo marco yo')
      await t('escribir', 'input[aria-label="Nombre del gimnasio"]', 'Gimnasio del barrio')
      await js(`[...document.querySelectorAll('.grp-h')].find(g => /Poleas/.test(g.innerText))?.querySelector('button.lnk')?.click()`)
      await esperar(200)
      await revisarAqui('alta: gimnasio a mano')
    }
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

/** Toda la base local de la app (cada tabla con sus filas). */
const volcar = () => js(`return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = async () => {
  const b = q.result, out = {}
  for (const n of b.objectStoreNames) out[n] = await new Promise(r => { const g = b.transaction(n).objectStore(n).getAll(); g.onsuccess = () => r(g.result) })
  b.close(); ok(out) } })`)
/** Sustituye toda la base local por un volcado (las tablas que no vengan se vacían). */
const reponer = datos => js(`const datos = ${JSON.stringify(datos)}; return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => {
  const b = q.result, tx = b.transaction([...b.objectStoreNames], 'readwrite')
  for (const n of b.objectStoreNames) { const st = tx.objectStore(n); st.clear(); for (const f of datos[n] ?? []) st.put(f) }
  tx.oncomplete = () => { b.close(); ok(true) }; tx.onerror = mal } })`)
/**
 * Alta rápida: la primera vez de cada fecha se hace el alta de verdad (con la interfaz) y se guarda la base;
 * las siguientes se parte de cero y se pone esa base. Así cada escenario no gasta 15 s en el alta.
 */
const altas = new Map()
async function altaRapida(fechaHora) {
  await deCero(fechaHora)
  const foto = altas.get(fechaHora)
  if (!foto) { await alta(); altas.set(fechaHora, await volcar()); return }
  await reponer(foto)
  await recargar()
  await ver(/Hoy te toca|descansas|no entrenaste|Próximo/i, 8000)
}
/** Mete un entreno hecho del día A de la rutina (todas las series a ese peso) y recarga. */
async function meterSesionHecha(fecha, peso, x = {}, letra = 'A') {
  const [r] = (await tabla('rutinas')).filter(r => r.activa)
  const d = r.dias.find(d => d.letra === letra)
  const inicio = new Date(`${fecha}T05:30:00`).getTime()
  await meter('sesiones', [{ id: 5000 + Math.floor(inicio / 1e6) % 1000, fecha, rutinaId: r.id, letra: d.letra, nombre: d.nombre, gimnasioId: null, inicio, fin: inicio + 50 * 60_000, version: 'normal', estado: 'hecha', calibracion: false,
    ejercicios: d.bloques.map(b => ({ uid: b.uid, ejercicio: b.ejercicio, planificado: b.ejercicio, estado: 'hecho', repsMin: b.repsMin, repsMax: b.repsMax, rpe: b.rpe, descanso: b.descanso, registro: b.registro,
      series: Array.from({ length: b.series }, (_, i) => ({ n: i + 1, peso: ['peso', 'mancuerna'].includes(b.registro) ? peso : null, reps: b.registro === 'tiempo' ? null : b.repsMin, segundos: b.registro === 'tiempo' ? 30 : null, rpe: 8, calentamiento: false, hecha: true, ts: inicio + (i + 1) * 120_000 })) })), ...x }])
  await recargar()
}
/** El entreno en curso tal como está en la base. */
const enCurso = async () => (await tabla('sesiones')).find(s => s.estado === 'curso')
/** Falla con un mensaje claro si algo no se cumple. */
function comprobar(cond, msg) { if (!cond) throw new Error(msg) }
/** Revisa la pantalla actual (textos rotos, cosas que se salen) y falla si hay algo. */
async function revisarAqui(donde) { const f = await t('revisar'); if (f) throw new Error(`${donde}: ${f}`) }
/** Tras recargar con un entreno a medias: vuelve a la pantalla del entreno. */
async function volverAlEntreno() {
  const dentro = () => js(`return !!document.querySelector('[aria-label="Lista de la sesión"]')`)
  for (let i = 0; i < 20 && !(await dentro()); i++) {
    if (await js(`return !!document.querySelector('button.minibar')`)) await t('pulsarSel', 'button.minibar').catch(() => {})
    else await pulsar(/^Continuar/).catch(() => {})
    await esperar(300)
  }
  comprobar(await dentro(), 'No se vuelve al entreno')
  await t('listo')
}
/** Quita el foco del campo activo como al tocar fuera (sin ventana, blur() no siempre avisa a React). */
const soltarFoco = async () => { await js(`const el = document.activeElement; if (el && el !== document.body) { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); el.blur() }`); await esperar(250) }
/** Cierra la hoja abierta (botón «Cerrar» de la hoja). */
const cerrarHoja = () => t('pulsarSel', '.sheet button[aria-label="Cerrar"]')

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
  await altaRapida('2026-10-13T05:20:00')
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
  await altaRapida('2026-10-13T05:20:00')
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
  await altaRapida('2026-10-13T05:20:00')
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
  await altaRapida('2026-10-13T05:20:00')
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
  await altaRapida('2026-10-13T14:10:00')
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
  await altaRapida('2026-10-13T14:10:00')
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
  await altaRapida('2026-10-13T07:00:00')
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
  await altaRapida('2026-10-13T19:00:00')
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
  await altaRapida('2026-10-13T19:00:00')
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
  await altaRapida('2026-10-13T14:10:00')
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
  await altaRapida('2026-10-12T09:00:00')
  await ver(/descansas|Próximo/i)
  // Martes: A (ya hecho, puesto en la base para no tardar). Jueves: B con la interfaz y un ejercicio sustituido.
  await meterSesionHecha('2026-10-13', 40, { calibracion: true })
  await irA('2026-10-15T05:20:00')
  await hacerEntreno({ ocupado: true, series: 6 })
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
  await altaRapida('2026-10-13T05:20:00') // martes: A
  // A y B ya hechos (puestos en la base, con la hora de cada serie para medir los tiempos reales).
  await meterSesionHecha('2026-10-13', 40, { calibracion: true })
  await meterSesionHecha('2026-10-15', 40, { calibracion: true }, 'B')
  await irA('2026-10-16T05:20:00') // viernes: C, el tercero de la semana de prueba (con la interfaz)
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
  await altaRapida('2026-10-14T18:00:00')
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
  await altaRapida('2026-10-14T18:00:00')
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
  await altaRapida('2026-10-14T14:00:00')
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
  await altaRapida('2026-10-13T05:20:00')
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
  await altaRapida('2026-10-19T09:00:00')
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
  await altaRapida('2026-10-13T08:10:00')
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
  await altaRapida('2026-10-13T18:10:00')
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

for (const [ancho, alto] of [[360, 740], [390, 844], [412, 915]]) escenario(`repaso visual de todas las pestañas a ${ancho} px`, async () => {
  await altaRapida('2026-10-15T18:00:00')
  {
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
  await altaRapida('2026-10-13T05:20:00')
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
  await altaRapida('2026-10-13T05:20:00')
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

// ---------- batería: cada pantalla y cada botón con efecto (por zonas) ----------
// Cada escenario parte de un alta guardada (altaRapida) y comprueba en la base lo que hace cada botón.

escenario('entreno a fondo: empezar en corta, igual que la anterior, corregir y la hoja «Más»', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pulsar('Empezar rutina')
  // Versión corta y otra hora de salida.
  await pulsar(/^Corta/, '.sheet')
  await pulsar('cambiar', '.sheet')
  await t('escribir', '.sheet input[aria-label="Hora límite"]', '06:30')
  await pulsar(/^Empezar$/, '.sheet')
  await ver('Hecho', 8000)
  let s = await enCurso()
  comprobar(s?.version === 'corta', 'No empieza en la versión corta: ' + s?.version)
  comprobar(s.horaLimite === '06:30', 'No guarda la hora de salida: ' + s.horaLimite)
  await revisarAqui('entreno')
  await ponerPesoSiFalta()
  await pulsar(/^Hecho$/)
  await pulsar(/^Saltar$/)
  // «Igual que la anterior» apunta lo mismo que la serie 1.
  await pulsar(/^Igual que la anterior/)
  s = await enCurso()
  const [s1, s2] = s.ejercicios[0].series.filter(x => x.hecha)
  comprobar(s2 && s2.peso === s1.peso && s2.reps === s1.reps, '«Igual que la anterior» no repite la serie: ' + JSON.stringify([s1, s2]))
  await pulsar(/^Saltar$/).catch(() => {})
  // Tocar una serie hecha la corrige.
  await t('pulsarSel', 'button[aria-label^="Corregir la serie 1"]')
  await t('pulsarSel', '.ux-corr-f [aria-label="Repeticiones"] button[aria-label="Más"]')
  await pulsar('Guardar cambio')
  await ver('Serie corregida')
  s = await enCurso()
  comprobar(s.ejercicios[0].series.filter(x => x.hecha)[0].reps === s1.reps + 1, 'La corrección no cambia las reps')
  // Hoja «Más»: nota, añadir y quitar serie, cómo se hace y marcar de calentamiento.
  const nSeries = s.ejercicios[0].series.length
  await t('pulsarSel', 'button[aria-label="Herramientas"]')
  await ver('Cómo se hace')
  await revisarAqui('hoja Más')
  await pulsar('Apuntar una nota', '.sheet')
  await t('escribir', '.sheet textarea[aria-label="Nota de la serie"]', 'Agarre ancho')
  await pulsar('Molestia', '.sheet')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Nota guardada')
  s = await enCurso()
  comprobar(s.ejercicios[0].series.some(x => x.nota === 'Agarre ancho. Molestia'), 'La nota no se guarda en la serie')
  await t('pulsarSel', 'button[aria-label="Herramientas"]')
  await pulsar('Añadir una serie', '.sheet')
  await ver('Serie añadida')
  comprobar((await enCurso()).ejercicios[0].series.length === nSeries + 1, 'No se añade la serie')
  await t('pulsarSel', 'button[aria-label="Herramientas"]')
  await pulsar('Quitar una serie', '.sheet')
  await ver('Serie quitada')
  comprobar((await enCurso()).ejercicios[0].series.length === nSeries, 'No se quita la serie')
  await pulsar('Deshacer')
  await esperar(300)
  comprobar((await enCurso()).ejercicios[0].series.length === nSeries + 1, '«Deshacer» no devuelve la serie quitada')
  await t('pulsarSel', 'button[aria-label="Herramientas"]')
  await pulsar('Cómo se hace', '.sheet')
  await ver('Instrucciones')
  await ver('Exercise data by RepDB')
  await cerrarHoja()
  await t('pulsarSel', 'button[aria-label="Herramientas"]')
  await pulsar('Otras opciones', '.sheet')
  await t('pulsarSel', '.sheet [role=switch][aria-label="Es de calentamiento"]')
  await ver('Marcada como calentamiento')
  s = await enCurso()
  const actual = s.ejercicios[0].series.find(x => !x.hecha)
  comprobar(actual?.calentamiento === true, 'La serie no queda marcada de calentamiento')
  await t('pulsarSel', '.sheet [role=switch][aria-label="Es de calentamiento"]')
  await ver('Ya no es calentamiento')
  if (await t('hay', 'Calculadora de discos')) {
    await pulsar('Calculadora de discos', '.sheet')
    await ver('Por lado')
    await pulsar('15 kg', '.sheet')
    await ver('barra 15')
    await revisarAqui('calculadora de discos')
    await cerrarHoja()
  } else await cerrarHoja()
})

escenario('entreno a fondo: lista (ir a otro, orden, añadir, recuperar), calentamiento, cambiar y terminar con molestia', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pulsar('Empezar rutina')
  await pulsar(/^Empezar$/, '.sheet')
  await ver('Hecho', 8000)
  let s = await enCurso()
  const n = s.ejercicios.length
  // Lista: ir al segundo ejercicio (reordenar sobre la marcha).
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await ver('Toca un ejercicio para ir a él')
  await revisarAqui('lista de la sesión')
  await js(`[...document.querySelectorAll('.sheet .it.sl button.tx')][1].click()`)
  await esperar(400)
  s = await enCurso()
  comprobar(s.ejercicios[1].estado === 'curso' && s.ejercicios[0].estado === 'pendiente', 'Tocar otro en la lista no lo pone en curso')
  // Calentamiento sugerido del ejercicio en curso (aún sin empezar).
  const idx = 1
  if (['peso', 'mancuerna'].includes(s.ejercicios[idx].registro)) {
    // Con un peso de trabajo de 60 kg salen series de aproximación (con el de partida, a veces ninguna).
    for (const x of s.ejercicios[idx].series) x.peso = 60
    await meter('sesiones', [s])
    await recargar()
    await volverAlEntreno()
    await t('pulsarSel', 'button[aria-label="Herramientas"]')
    await pulsar('Otras opciones', '.sheet')
    await pulsar('Calentamiento sugerido', '.sheet')
    await ver('Para trabajar con 60 kg')
    await revisarAqui('calentamiento sugerido')
    await pulsar('Añadir a la lista', '.sheet')
    await ver('Calentamiento añadido')
    comprobar((await enCurso()).ejercicios[idx].series.some(x => x.calentamiento), 'No se añade el calentamiento')
  }
  // Cambiar el ejercicio por otro parecido.
  await t('pulsarSel', 'button[aria-label="Herramientas"]')
  await pulsar('Cambiar ejercicio', '.sheet')
  await ver('En lugar de')
  await revisarAqui('elegir ejercicio')
  await js(`[...document.querySelectorAll('.sheet .list button.it')][0].click()`)
  await ver('Cambiado por')
  s = await enCurso()
  comprobar(s.ejercicios[idx].ejercicio !== s.ejercicios[idx].planificado && s.ejercicios[idx].motivo === 'cambio', 'No se cambia el ejercicio')
  // Saltar el ejercicio entero y recuperarlo desde la lista.
  await pulsar('Saltar este ejercicio')
  await ver('Lo recuperas desde la lista')
  comprobar((await enCurso()).ejercicios[idx].estado === 'saltado', 'No se salta el ejercicio')
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar(/Toca para recuperarlo/, '.sheet')
  await ver('Recuperado')
  comprobar((await enCurso()).ejercicios[idx].estado === 'pendiente', 'No se recupera el ejercicio saltado')
  // Cambiar el orden con las flechas.
  if (await t('hay', 'Cambiar orden')) {
    const antes = (await enCurso()).ejercicios.map(e => e.uid)
    await pulsar('Cambiar orden', '.sheet')
    await js(`document.querySelector('.sheet button[aria-label="Bajar"]').click()`)
    await esperar(400)
    const despues = (await enCurso()).ejercicios.map(e => e.uid)
    comprobar(JSON.stringify(antes) !== JSON.stringify(despues), 'Las flechas no cambian el orden')
    await pulsar('Listo', '.sheet')
  }
  // Añadir un ejercicio desde la lista.
  await pulsar('Añadir ejercicio', '.sheet')
  await ver('Añadir al entreno')
  await t('escribir', '.sheet input[type=search]', 'curl')
  await esperar(300)
  await js(`[...document.querySelectorAll('.sheet .list button.it')][0].click()`)
  await ver('Añadido:')
  comprobar((await enCurso()).ejercicios.length === n + 1, 'No se añade el ejercicio a la sesión')
  // Terminar con una molestia y una nota.
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Terminar entreno', '.sheet')
  await ver('Entreno terminado')
  await revisarAqui('fin del entreno')
  await pulsar('Sí, te digo dónde')
  await t('escribir', 'input[placeholder^="Hombro derecho"]', 'Rodilla izquierda')
  await t('escribir', 'textarea[aria-label="Nota del entreno"]', 'Buen día')
  await pulsar('Guardar')
  await ver(/Guardado/, 8000)
  const hecha = (await tabla('sesiones')).find(x => x.estado === 'hecha')
  comprobar(hecha?.respuestas?.molestia === 'Rodilla izquierda' && hecha.respuestas.nota === 'Buen día', 'No se guardan la molestia y la nota: ' + JSON.stringify(hecha?.respuestas))
})

escenario('entreno libre y otro día: añadir, salir sin terminar, volver y descartar', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Rutina')
  await pulsar('Otras formas de entrenar')
  await pulsar('Entreno libre')
  await ver('Añade el primer ejercicio', 8000)
  await revisarAqui('entreno libre vacío')
  await pulsar('Añadir ejercicio')
  await t('escribir', '.sheet input[type=search]', 'press')
  await esperar(300)
  await js(`[...document.querySelectorAll('.sheet .list button.it')][0].click()`)
  await ver('Añadido:')
  await ver('Hecho', 6000)
  let s = await enCurso()
  comprobar(s?.letra === 'L' && s.ejercicios.length === 1, 'El entreno libre no tiene el ejercicio añadido')
  // Salir sin terminar: sigue abierto y se vuelve desde la barra de abajo.
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Salir sin terminar', '.sheet')
  await ver('Sigue abierto')
  await t('pulsarSel', 'button.minibar')
  await ver('Hecho', 6000)
  // Descartar: se pide confirmar y no queda nada en curso.
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Descartar entreno', '.sheet')
  await ver('¿Descartar este entreno?')
  await pulsar(/^Descartar$/, '.sheet')
  await esperar(600)
  comprobar(!(await enCurso()), 'Descartar deja el entreno en curso')
  // Otro día de la rutina (hoy toca A; se elige otro).
  await pestana('Rutina')
  await pulsar('Otras formas de entrenar')
  await ver('Empezar otro día')
  await revisarAqui('otras formas de entrenar')
  await js(`[...document.querySelectorAll('.ux-rut-otro .chip')][1].click()`)
  await pulsar(/^Empezar$/, '.sheet')
  await ver('Hecho', 8000)
  comprobar((await enCurso())?.letra === 'B', '«Empezar otro día» no empieza el día elegido')
})

/** La rutina activa y el día A tal como están en la base. */
const rutinaActiva = async () => (await tabla('rutinas')).find(r => r.activa)
const diaA = async () => (await rutinaActiva()).dias.find(d => d.letra === 'A')
/** Pulsa un botón por su texto dentro de la tarjeta n de Editar plan. */
const enTarjeta = (n, texto) => js(`const c = document.querySelectorAll('.edr.card')[${n}]; const b = [...c.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(${JSON.stringify(texto)})); if (!b) throw new Error('No hay «' + ${JSON.stringify(texto)} + '» en la tarjeta ${n}'); b.click(); await new Promise(r => setTimeout(r, 350))`)

escenario('rutina a fondo: día, editar plan (series, reps, prisa, dos seguidos, mover, si está ocupado, cambiar, quitar, añadir)', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Rutina')
  await pulsar(/Cuerpo completo A/)
  await ver('Empezar este entreno')
  await revisarAqui('detalle del día')
  await pulsar('Editar')
  await ver('Editar plan')
  await t('listo')
  await revisarAqui('editar plan')
  let a = await diaA()
  const b0 = a.bloques[0]
  // Series: + 1.
  await js(`document.querySelectorAll('.edr.card')[0].querySelector('[aria-label="Series"] button[aria-label="Más"]').click()`)
  await esperar(350)
  a = await diaA()
  comprobar(a.bloques[0].series === b0.series + 1, 'El + de series no cambia la rutina')
  // Reps: tocar el chip pasa al siguiente rango.
  await js(`document.querySelectorAll('.edr.card')[0].querySelector('.ux-rut-reps')?.click()`)
  await esperar(350)
  a = await diaA()
  comprobar(b0.registro === 'tiempo' || a.bloques[0].repsMin !== b0.repsMin || a.bloques[0].repsMax !== b0.repsMax, 'Tocar las reps no cambia el rango')
  // Más opciones: fuera si hay prisa, dos seguidos y separar, bajar.
  await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Fuera si hay prisa')
  a = await diaA()
  comprobar(a.bloques[0].fueraEnCorta === !b0.fueraEnCorta, '«Fuera si hay prisa» no cambia')
  const libre = a.bloques.findIndex((b, i) => i < a.bloques.length - 1 && !b.superserie && !a.bloques[i + 1].superserie)
  if (libre >= 0) {
    if (libre !== 0) await enTarjeta(libre, 'Más opciones')
    await enTarjeta(libre, 'Dos seguidos')
    a = await diaA()
    comprobar(a.bloques[libre].superserie === a.bloques[libre + 1].uid, '«Dos seguidos» no los junta')
    // El «Separar» de esta pareja (puede haber otras parejas antes).
    const antes = a.bloques.slice(0, libre).filter(b => b.superserie && a.bloques.findIndex(x => x.uid === b.superserie) > a.bloques.indexOf(b)).length
    await js(`document.querySelectorAll('.ss-head button.lnk')[${antes}].click()`)
    await ver('Ya no van seguidos')
    a = await diaA()
    comprobar(!a.bloques[libre].superserie, '«Separar» no los separa')
  }
  const orden = (await diaA()).bloques.map(b => b.uid)
  if (!(await js(`return [...document.querySelectorAll('.edr.card')[0].querySelectorAll('button')].some(b => b.innerText.trim().startsWith('Bajar'))`))) await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Bajar')
  a = await diaA()
  comprobar(a.bloques[1].uid === orden[0] && a.bloques[0].uid === orden[1], '«Bajar» no baja el ejercicio')
  // Si está ocupado: elegir una alternativa.
  if (!(await js(`return [...document.querySelectorAll('.edr.card')[0].querySelectorAll('button')].some(b => b.innerText.trim().startsWith('Si está ocupado'))`))) await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Si está ocupado')
  await ver('Qué hacer si')
  const alt = await js(`const b = document.querySelector('.sheet .list button.it'); const n = b.querySelector('b')?.innerText; b.click(); return n`)
  await ver('Si está ocupado:')
  a = await diaA()
  comprobar(a.bloques[0].alternativas.length > 0, 'La alternativa no se guarda')
  // Cambiar ejercicio.
  const antes = a.bloques[0].ejercicio
  await enTarjeta(0, 'Cambiar ejercicio')
  await ver('En lugar de')
  await js(`document.querySelector('.sheet .list button.it').click()`)
  await ver('Cambiado por')
  a = await diaA()
  comprobar(a.bloques[0].ejercicio !== antes, 'No se cambia el ejercicio del plan (' + alt + ')')
  // Quitar y deshacer.
  const n = a.bloques.length
  if (!(await js(`return [...document.querySelectorAll('.edr.card')[0].querySelectorAll('button')].some(b => b.innerText.trim().startsWith('Quitar'))`))) await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Quitar')
  await ver('Ejercicio quitado')
  comprobar((await diaA()).bloques.length === n - 1, 'No se quita el ejercicio')
  await pulsar('Deshacer')
  await esperar(400)
  comprobar((await diaA()).bloques.length === n, '«Deshacer» no lo devuelve')
  // Añadir un ejercicio al día.
  await pulsar('Añadir ejercicio')
  await t('escribir', '.sheet input[type=search]', 'plancha')
  await esperar(300)
  await js(`document.querySelector('.sheet .list button.it').click()`)
  await ver('Añadido:')
  comprobar((await diaA()).bloques.length === n + 1, 'No se añade el ejercicio al día')
  // Otro día en Editar plan.
  await js(`[...document.querySelectorAll('.screen .chips .chip')].find(c => /^J|jue/i.test(c.innerText.trim()))?.click()`)
  await esperar(300)
  await revisarAqui('editar plan, otro día')
})

escenario('rutina a fondo: ficha (no me gusta, me duele, ajustes, notas, al plan), filtros de la biblioteca y otra variante', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Rutina')
  await seg('Ejercicios')
  await revisarAqui('biblioteca')
  // Filtros: favoritos (sin ninguno), en mi gimnasio, más filtros y quitar filtros.
  const cuenta = () => js(`return Number(document.querySelector('.count b')?.innerText || 0)`)
  const total = await cuenta()
  // «En mi gimnasio» viene puesto; con el gimnasio completo del alta la lista es la misma, solo cambia el chip.
  await t('pulsarSel', '.chip[aria-pressed="true"]:has(.ck)')
  comprobar(await js(`return [...document.querySelectorAll('.chip')].find(c => c.innerText.trim() === 'En mi gimnasio')?.getAttribute('aria-pressed') === 'false'`), '«En mi gimnasio» no se quita')
  const todos = await cuenta()
  comprobar(todos >= total, 'Sin «En mi gimnasio» salen menos ejercicios')
  await pulsar('Más filtros')
  await t('elegir', 'select[aria-label="Equipamiento"]', 'dumbbell')
  await esperar(300)
  comprobar((await cuenta()) < todos, 'El filtro de equipamiento no filtra')
  await pulsar('Quitar filtros').catch(() => pulsar(/^Quitar/))
  await esperar(300)
  await t('escribir', 'input[aria-label="Buscar ejercicio"]', 'press banca')
  await pulsar(/Press de Banca con Barra/i)
  await ver('Músculos que trabaja')
  await revisarAqui('ficha')
  await pulsar('No me gusta')
  await pulsar('Me duele')
  await esperar(300)
  let m = (await tabla('marcas')).find(x => x.odiado)
  const idFicha = m?.id
  comprobar(m?.odiado && m.duele, '«No me gusta» y «Me duele» no se guardan: ' + JSON.stringify(m))
  await pulsar('Me duele')
  await pulsar('Escribir')
  await t('escribir', 'input[placeholder^="Asiento 4"]', 'Banco 3')
  await soltarFoco()
  await t('escribir', 'textarea[placeholder^="Escápulas"]', 'Codos a 45 grados')
  await soltarFoco()
  await esperar(300)
  m = (await tabla('marcas')).find(x => x.id === idFicha)
  comprobar(m?.ajustes === 'Banco 3' && m.notas === 'Codos a 45 grados' && !m.duele, 'Ajustes y notas no se guardan: ' + JSON.stringify(m))
  await pulsar('Listo')
  await ver('Banco 3')
  // Añadir a mi plan (al día B).
  const nB = (await rutinaActiva()).dias.find(d => d.letra === 'B').bloques.length
  await pulsar('Añadir a mi plan')
  await js(`[...document.querySelectorAll('.chips .chip')].find(c => /B|jueves/i.test(c.innerText) && !/Cancelar/.test(c.innerText))?.click()`)
  await ver('Añadido a tu plan')
  comprobar((await rutinaActiva()).dias.find(d => d.letra === 'B').bloques.length === nB + 1, '«Añadir a mi plan» no lo añade')
  // Galería: tocar la imagen cambia de pose (no rompe).
  await js(`document.querySelector('.gal-it')?.click()`)
  await volver()
  // Rehacer la rutina: otra variante.
  await pestana('Rutina')
  await pulsar('Editar plan')
  await pulsar('Rehacer la rutina desde cero')
  await pulsar('Ver la rutina nueva', '.sheet')
  await ver('Usar esta rutina')
  await revisarAqui('rutina nueva')
  await pulsar('Otra variante')
  await ver(/Variante \d de 3 lista/)
})

escenario('gimnasios a fondo: otro gimnasio, nombre y notas, material, mancuernas, discos, máquina propia, usar y borrar', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Rutina')
  await seg('Gimnasios')
  await revisarAqui('gimnasios')
  const n = (await tabla('gimnasios')).length
  await pulsar('Añadir otro gimnasio')
  await ver('Editor de gimnasio')
  await t('listo')
  await t('escribir', 'input[aria-label="Nombre del gimnasio"]', 'Gimnasio del barrio')
  await t('escribir', 'textarea[aria-label="Notas"]', 'Poca gente a las 6')
  // Material: marcar o quitar una máquina.
  const mat0 = (await tabla('gimnasios')).at(-1).material.length
  await js(`document.querySelector('button.mq')?.click()`)
  // Mancuernas: un tramo más y su «hasta».
  await pulsar('+ Añadir tramo')
  await t('pulsarSel', '[aria-label="Tramo 1: hasta"] button[aria-label="Más"]')
  // Discos: quitar el de 0,5 y barra de 15.
  await js(`[...document.querySelectorAll('.sec .chips .chip')].find(c => c.innerText.trim() === '0,5')?.click()`)
  await js(`[...document.querySelectorAll('.sec .chips .chip')].find(c => c.innerText.trim() === '15 kg')?.click()`)
  await revisarAqui('editor de gimnasio')
  // Máquina propia (se guarda antes el gimnasio).
  await pulsar('Añadir una máquina que no sale')
  await ver('Máquina propia')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Ponle un nombre')
  await t('escribir', '.sheet input[aria-label="Nombre de la máquina"]', 'Remo T con apoyo')
  await t('escribir', '.sheet textarea[aria-label="Notas de la máquina"]', 'Al fondo')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Máquina propia guardada')
  await ver('Remo T con apoyo')
  await t('pulsarSel', '.dock .result button')
  await ver('Gimnasio guardado')
  const gs = await tabla('gimnasios')
  comprobar(gs.length === n + 1, 'No se crea el gimnasio')
  const g = gs.find(x => x.nombre === 'Gimnasio del barrio')
  comprobar(g, 'No se guarda el nombre: ' + gs.map(x => x.nombre))
  comprobar(g.notas === 'Poca gente a las 6', 'No se guardan las notas')
  comprobar(g.material.length !== mat0, 'No cambia el material')
  comprobar(g.mancuernas.length === 3, 'No se añade el tramo de mancuernas: ' + JSON.stringify(g.mancuernas))
  comprobar(!g.discos.includes(0.5) && g.barraKg === 15, 'No cambian los discos ni la barra: ' + JSON.stringify([g.discos, g.barraKg]))
  comprobar(g.propias.some(p => p.nombre === 'Remo T con apoyo' && p.notas === 'Al fondo'), 'No se guarda la máquina propia')
  // Usar este gimnasio: pregunta si rehacer la rutina; «Cancelar» la deja como está.
  await t('listo')
  await pulsar('Usar este gimnasio')
  await ver('Ahora usas «Gimnasio del barrio»')
  comprobar((await tabla('ajustes'))[0].gimnasioActivo === g.id, 'No cambia el gimnasio activo')
  await cerrarHoja().catch(() => {})
  // Borrar el gimnasio (con confirmación).
  await pulsar(/^Editar gimnasio$|^Editar$/)
  await t('listo')
  await pulsar('Borrar gimnasio')
  await ver('¿Borrar «')
  await pulsar(/^Borrar$/, '.sheet')
  await esperar(600)
  comprobar((await tabla('gimnasios')).length === n, 'No se borra el gimnasio')
})

const comidas = () => tabla('comidas')
const ajustesBD = async () => (await tabla('ajustes'))[0]

escenario('comida a fondo: otro día, otra franja, editar (nombre, franja, hora), borrar deslizando con deshacer y objetivo de energía', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Comida')
  await revisarAqui('comida: día')
  // Día anterior: se apunta para ese día y esa franja.
  await t('pulsarSel', 'button[aria-label="Día anterior"]')
  await ver(/12/)
  await js(`[...document.querySelectorAll('.screen button.lnk')].filter(b => b.innerText.includes('Añadir')).pop().click()`) // la última franja: cena
  await ver('Para el 12/10')
  await pulsar('Escribir lo que he comido', '.sheet')
  await t('escribir', '.nota-r input', 'Pizza casera')
  await pulsar(/^Apuntar$/, '.sheet')
  await ver('Pizza casera')
  let c = (await comidas()).find(x => x.nombre === 'Pizza casera')
  comprobar(c?.fecha === '2026-10-12' && c.franja === 'cena', 'No se apunta en el día y la franja elegidos: ' + JSON.stringify(c))
  await t('pulsarSel', 'button[aria-label="Día siguiente"]')
  await t('pulsarSel', 'button[aria-label="Día siguiente"]')
  await ver('Mañana aún no ha llegado')
  // Hoy: escribir con tamaño «Mucho» y afinando las kcal.
  await pulsar('Añadir', '.dock')
  await pulsar('Escribir lo que he comido', '.sheet')
  await t('escribir', '.nota-r input', 'Tortilla')
  await pulsar(/^Mucho/, '.sheet')
  await t('pulsarSel', '.sheet [aria-label="kcal aproximadas"] button[aria-label="Más"]')
  await pulsar(/^Apuntar$/, '.sheet')
  await ver('Tortilla')
  c = (await comidas()).find(x => x.nombre === 'Tortilla')
  comprobar(c?.fecha === '2026-10-13' && c.kcal > 500, 'La tortilla no se apunta con su tamaño: ' + JSON.stringify(c))
  // Editar: nombre, franja y hora.
  await pulsar('Tortilla')
  await ver('Editar')
  await revisarAqui('editar comida')
  await t('escribir', '.sheet input[aria-label="Nombre"]', 'Tortilla de patatas')
  await pulsar('Merienda', '.sheet')
  await t('escribir', '.sheet input[aria-label="Hora"]', '17:15')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Guardado')
  c = (await comidas()).find(x => x.id === c.id)
  comprobar(c.nombre === 'Tortilla de patatas' && c.franja === 'merienda' && c.hora === '17:15', 'La edición no se guarda: ' + JSON.stringify(c))
  // Borrar deslizando (el botón rojo de detrás) y deshacer.
  const n = (await comidas()).length
  await js(`const f = [...document.querySelectorAll('.swipe-del')]; f[f.length - 1].click()`)
  await ver('Borrado:')
  comprobar((await comidas()).length === n - 1, 'No se borra la comida')
  await pulsar('Deshacer')
  await esperar(400)
  comprobar((await comidas()).length === n, '«Deshacer» no la devuelve')
  // Objetivo de energía: ver cómo se calcula y ponerlo a mano.
  await t('pulsarSel', '.card.pd.adj')
  await ver('Tu objetivo de energía')
  await revisarAqui('objetivo de energía')
  await pulsar('Ver cómo se calcula')
  await ver('Basal')
  await pulsar('Poner mi objetivo a mano')
  await ver('Ajustes')
  await pulsar('Lo pongo yo')
  await t('pulsarSel', '[aria-label="Kcal al día"] button[aria-label="Más"]')
  await t('pulsarSel', '[aria-label="Proteína al día"] button[aria-label="Más"]')
  await esperar(300)
  let a = await ajustesBD()
  comprobar(a.kcalManual > 0 && a.proteinaManual > 0, 'El objetivo a mano no se guarda: ' + JSON.stringify([a.kcalManual, a.proteinaManual]))
  await volver()
  await ver('puesto a mano')
  await pulsar('Volver a automático')
  await ver('Vuelve a ser automático')
  a = await ajustesBD()
  comprobar(a.kcalManual == null && a.proteinaManual == null, 'No vuelve a automático')
})

escenario('mis comidas a fondo: crear solo guardar, editar (tipo, kcal, proteína, franja), guardar y apuntar ahora, escaneados y producto', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Comida')
  await seg('Mis comidas')
  await revisarAqui('mis comidas')
  // Crear y solo guardar (no se apunta).
  await pulsar('Crear comida nueva')
  await pulsar(/^Guardar y apuntar$/, '.sheet').catch(() => {}) // sin nombre: avisa
  await ver('Ponle un nombre')
  await t('escribir', '.sheet input[aria-label="Nombre de la comida"]', 'Pollo con arroz')
  await t('pulsarSel', '.sheet [aria-label="Proteína"] button[aria-label="Más"]')
  await pulsar('Solo guardar', '.sheet')
  await ver('Creada «Pollo con arroz»')
  const p = (await tabla('plantillas')).find(x => x.nombre === 'Pollo con arroz')
  comprobar(p && !(await comidas()).some(x => x.nombre === 'Pollo con arroz'), '«Solo guardar» apunta la comida o no la guarda')
  // Editar: picoteo, más kcal y franja; guardar cambios.
  await t('pulsarSel', 'button[aria-label="Editar Pollo con arroz"]')
  await ver('Guardar cambios')
  await revisarAqui('editar mis comidas')
  await pulsar('Picoteo', '.sheet')
  await t('pulsarSel', '.sheet [aria-label="kcal"] button[aria-label="Más"]')
  await js(`[...document.querySelectorAll('.sheet .chips .chip')].find(c => c.innerText.trim() === 'Cena')?.click()`)
  await pulsar('Guardar cambios', '.sheet')
  await ver('Cambios guardados')
  const p2 = (await tabla('plantillas')).find(x => x.id === p.id)
  comprobar(p2.tipo === 'picoteo' && p2.kcal === p.kcal + 10, 'Los cambios no se guardan: ' + JSON.stringify(p2))
  // Guardar y apuntar ahora.
  await t('pulsarSel', 'button[aria-label="Editar Pollo con arroz"]')
  await pulsar('Guardar y apuntar ahora', '.sheet')
  await ver('Apuntado: Pollo con arroz')
  comprobar((await comidas()).some(x => x.nombre === 'Pollo con arroz' && x.fecha === '2026-10-13'), '«Guardar y apuntar ahora» no apunta')
  // Tocar una comida guardada apunta con «¿Cuánto?» (Poco).
  await pulsar('Pollo con arroz')
  await pulsar(/^Poco/, '.popup')
  await ver('Apuntado hoy: Pollo con arroz (poco)')
  // Escaneados: escanear uno a mano y verlo en «Escaneados» y en su ficha; guardarlo en Mis comidas y borrarlo.
  await t('pulsarSel', 'button[aria-label="Escanear"]')
  await pulsar(/Escribir el código/)
  await t('escribir', '.cam-panel input', '8480000123458')
  await pulsar('Buscar')
  await ver('Arroz al curry con pollo', 8000)
  await pulsar('Escanear otro')
  await t('pulsarSel', 'button[aria-label="Cerrar"]')
  // Con muchos escaneados sale «Ver los N escaneados y buscar» (la pantalla Escaneados).
  await meter('productos', Array.from({ length: 8 }, (_, i) => ({ codigo: `84100000000${10 + i}`, nombre: `Yogur ${i + 1}`, marca: 'X', kcal100: 60, proteina100: 10, racionG: 125, kcalRacion: 75, proteinaRacion: 12.5, guardado: '2026-10-01T10:00:00.000Z' })))
  await recargar()
  await pestana('Comida')
  await seg('Mis comidas')
  await pulsar(/^Ver los \d+ escaneados/)
  await ver('Escaneados')
  await revisarAqui('escaneados')
  await t('escribir', 'input[aria-label="Buscar en lo escaneado"]', 'curry')
  await pulsar(/Arroz al curry/)
  await ver('Ficha técnica')
  await revisarAqui('producto')
  await pulsar('Poco', '.chips')
  await pulsar(/^Añadir$/)
  await ver('Añadido: Arroz al curry con pollo (poco)')
  comprobar((await comidas()).some(x => x.codigo === '8480000123458' && x.racion === 'P'), 'El producto no se apunta con «Poco»')
  // Al añadir vuelve a la lista: se abre otra vez para guardarlo en Mis comidas y borrarlo.
  await pulsar(/Arroz al curry/)
  await pulsar('Ficha técnica')
  await ver('Por 100 g')
  await pulsar('Guardar en Mis comidas')
  await ver(/Guardado en Mis comidas|Ya está en Mis comidas/)
  comprobar((await tabla('plantillas')).some(x => x.codigo === '8480000123458'), '«Guardar en Mis comidas» no crea la comida')
  await esperar(500) // los botones de la ficha comparten el bloqueo contra el doble toque (400 ms)
  await pulsar('Borrar producto')
  await ver('Borrado: Arroz al curry con pollo')
  comprobar(!(await tabla('productos')).some(x => x.codigo === '8480000123458'), 'No se borra el producto')
})

escenario('ajustes a fondo: letra, tema, cada interruptor, descansos, cafeína y recuperar una copia', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await ver('Apariencia')
  await revisarAqui('ajustes')
  // Letra grande y tema oscuro: se aplican a la página y se ven bien.
  await pulsar(/Grande$/)
  await pulsar('Oscuro')
  await esperar(300)
  const pagina = await js(`const d = document.documentElement; return { ...d.dataset, clase: d.className, tema: localStorage.getItem('jf-tema'), letra: localStorage.getItem('jf-letra') }`)
  comprobar(pagina.theme === 'dark' && pagina.tema === 'oscuro' && pagina.letra === 'grande', 'La letra o el tema no se aplican: ' + JSON.stringify(pagina))
  await revisarAqui('ajustes con letra grande y tema oscuro')
  await pulsar('Más ajustes')
  await revisarAqui('más ajustes (oscuro, grande)')
  // Cada interruptor cambia su ajuste en la base.
  const campos = { 'Vibrar al acabar el descanso': 'vibrar', 'Sonido al acabar el descanso': 'sonido', 'Pantalla siempre encendida': 'pantallaEncendida', 'Calentamiento sugerido': 'calentamiento', 'Avisos de seguridad': 'avisosSeguridad', 'Mostrar calorías': 'mostrarKcal' }
  for (const [etq, campo] of Object.entries(campos)) {
    if (!(await js(`return !!document.querySelector('[role=switch][aria-label=${JSON.stringify(etq)}]')`))) continue
    const antes = (await ajustesBD())[campo]
    await t('pulsarSel', `[role=switch][aria-label="${etq}"]`)
    await esperar(250)
    comprobar((await ajustesBD())[campo] === !antes, `«${etq}» no cambia ${campo}`)
  }
  // Descansos y cafeína.
  const a0 = await ajustesBD()
  await t('pulsarSel', '[aria-label="Descanso de compuestos"] button[aria-label="Más"]')
  await t('pulsarSel', '[aria-label="Descanso de aislamiento"] button[aria-label="Menos"]')
  await t('pulsarSel', '[aria-label="Límite de cafeína"] button[aria-label="Menos"]')
  await esperar(300)
  const a1 = await ajustesBD()
  comprobar(a1.descansoCompuesto === a0.descansoCompuesto + 15 && a1.descansoAislamiento === a0.descansoAislamiento - 15 && a1.cafeinaLimite === a0.cafeinaLimite - 50, 'Descansos o cafeína no se guardan: ' + JSON.stringify([a1.descansoCompuesto, a1.descansoAislamiento, a1.cafeinaLimite]))
  // Recuperar una copia desde Ajustes (pide confirmar antes de sustituir nada).
  const copia = path.join(RAIZ, '.cache', 'e2e-copia-ajustes.jowyfit')
  fsx.writeFileSync(copia, JSON.stringify({ app: 'JowyFit', version: 1, datos: { perfil: (await tabla('perfil')).map(p => ({ ...p, nombre: 'Copiado' })), ajustes: await tabla('ajustes'), plantillas: [], rutinas: await tabla('rutinas'), gimnasios: await tabla('gimnasios') } }))
  archivoParaElegir = copia
  await pulsar('Recuperar una copia')
  await ver(/Recuperar/)
  await pulsar(/^Recuperar$/)
  await ver('Copia recuperada', 8000)
  archivoParaElegir = null
  comprobar((await tabla('perfil'))[0]?.nombre === 'Copiado', 'La copia recuperada no sustituye los datos')
  // Vuelta a claro y letra normal para lo siguiente.
  await pulsar(/^Normal$/).catch(() => {})
  await pulsar(/^Claro$/).catch(() => {})
})

escenario('progreso a fondo: registrar todas las medidas (báscula, origen y fecha), borrar con deshacer, semanas anteriores y metas', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Progreso')
  await revisarAqui('progreso: semana')
  // La semana anterior y vuelta.
  if (await js(`return !document.querySelector('button[aria-label="Semana anterior"]')?.disabled`)) {
    await t('pulsarSel', 'button[aria-label="Semana anterior"]')
    await revisarAqui('semana anterior')
    await t('pulsarSel', 'button[aria-label="Semana siguiente"]')
  }
  await seg('Cuerpo')
  await revisarAqui('cuerpo')
  const n = (await tabla('mediciones')).length
  await pulsar(/Registrar/)
  await ver('Registrar medidas')
  await revisarAqui('registrar medidas')
  await t('pulsarSel', '[aria-label="Peso"] button[aria-label="Más"]')
  await t('pulsarSel', '[aria-label="Cintura"] button[aria-label="Más"]')
  await pulsar('Más medidas')
  await t('pulsarSel', '[aria-label="Cuello"] button[aria-label="Más"]')
  await t('pulsarSel', '[aria-label="Brazo contraído"] button[aria-label="Más"]')
  await pulsar('Datos de la báscula')
  await t('escribir', 'input[aria-label="% grasa"]', '24,2')
  await t('escribir', 'input[aria-label="Agua"]', '55')
  await pulsar('Del gimnasio')
  await t('escribir', 'input[aria-label="Fecha"]', '2026-10-12')
  await t('pulsarSel', '.dock .btn')
  await ver('Medidas guardadas')
  const ms = await tabla('mediciones')
  const m = ms.find(x => x.fecha.startsWith('2026-10-12') && x.bascula?.grasaPct === 24.2)
  comprobar(ms.length === n + 1 && m, 'La medición no se guarda con todo: ' + JSON.stringify(ms.at(-1)))
  comprobar(m.origen === 'gimnasio' && m.bascula.aguaPct === 55 && m.perimetros?.cintura && m.perimetros.cuello && m.perimetros.brazoContraido && m.pesoKg, 'Faltan campos: ' + JSON.stringify(m))
  // Borrar la medición del historial (con confirmación) y deshacer.
  await t('listo')
  await revisarAqui('cuerpo con datos')
  await t('pulsarSel', 'button[aria-label="Borrar medición"]')
  await ver('¿Borrar esta medición?')
  await pulsar(/^Borrar$/, '.sheet')
  await ver('Deshacer')
  comprobar((await tabla('mediciones')).length === ms.length - 1, 'No se borra la medición')
  await pulsar('Deshacer')
  await esperar(400)
  comprobar((await tabla('mediciones')).length === ms.length, '«Deshacer» no devuelve la medición')
  // Metas: crear una de peso con fecha, editarla (marcar conseguida) y borrarla.
  await pestana('Progreso')
  await seg('Metas')
  await revisarAqui('metas')
  await pulsar('Crear una meta')
  await pulsar('Peso', '.sheet')
  await t('pulsarSel', '.sheet [aria-label="Objetivo"] button[aria-label="Menos"]')
  await t('escribir', '.sheet input[type=date]', '2027-06-01')
  await t('escribir', '.sheet input[placeholder]:not([type])', 'Verano 2027')
  await pulsar('Crear meta', '.sheet')
  await ver('Meta creada')
  let meta = (await tabla('metas')).find(x => x.titulo === 'Verano 2027')
  comprobar(meta?.tipo === 'peso' && meta.fecha === '2027-06-01', 'La meta no se guarda: ' + JSON.stringify(meta))
  await pulsar(/Verano 2027/)
  await t('pulsarSel', '.sheet [role=switch][aria-label="Meta conseguida"]')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Meta guardada')
  meta = (await tabla('metas')).find(x => x.id === meta.id)
  comprobar(meta.hecha === true, 'No queda como conseguida')
  await pulsar(/Verano 2027/)
  await pulsar('Borrar meta', '.sheet')
  await ver('Meta borrada')
  comprobar(!(await tabla('metas')).some(x => x.id === meta.id), 'No se borra la meta')
  await pulsar('Deshacer')
  await esperar(400)
  comprobar((await tabla('metas')).some(x => x.id === meta.id), '«Deshacer» no devuelve la meta')
})

escenario('pasos, fuerza y fotos a fondo: pasos a mano de ayer, objetivo de pasos, trote en minutos, gráficas y comparador', async () => {
  await altaRapida('2026-10-13T05:20:00')
  // Un entreno ya guardado (puesto en la base) para tener Fuerza con datos.
  await meterSesionHecha('2026-10-13', 40)
  await pestana('Progreso')
  await seg('Fuerza')
  await revisarAqui('fuerza con datos')
  await js(`[...document.querySelectorAll('.screen .chips .chip')].slice(0, 3).forEach(c => c.click())`)
  await revisarAqui('fuerza, otro ejercicio')
  await t('pulsarSel', '.screen .list button.it')
  await ver('Toca una serie para corregirla')
  await revisarAqui('detalle del entreno')
  // Pasos.
  await pestana('Progreso')
  await seg('Pasos').catch(async () => { await pestana('Inicio'); await t('pulsarSel', '.kpi.steps') })
  await ver('Últimos 7 días')
  await revisarAqui('pasos')
  await t('pulsarSel', 'button.pasos-obj')
  await t('pulsarSel', '[aria-label="Objetivo de pasos"] button[aria-label="Más"]')
  await esperar(300)
  comprobar((await tabla('perfil'))[0].pasosObjetivo === 8500, 'El objetivo de pasos no cambia: ' + (await tabla('perfil'))[0].pasosObjetivo)
  if (await t('hay', 'Ayer')) {
    await pulsar('Ayer')
    await t('pulsarSel', '[aria-label="Pasos"] button[aria-label="Más"]')
    await pulsar('Guardar pasos')
    await ver('Pasos guardados · ayer')
    comprobar((await tabla('pasos')).some(x => x.fecha === '2026-10-12' && x.pasos > 0), 'Los pasos de ayer no se guardan')
  }
  await pulsar('+ Trote / carrera')
  await pulsar('Minutos', '.sheet')
  await t('pulsarSel', '.sheet [aria-label="Minutos"] button[aria-label="Más"]')
  await t('pulsarSel', '.sheet [aria-label="Minutos"] button[aria-label="Más"]')
  await pulsar(/^Añadir$/, '.sheet')
  await ver(/Añadido: trote de \d+ min/)
  comprobar((await tabla('pasos')).some(x => x.fecha === '2026-10-13' && x.pasos > 0), 'El trote no suma pasos hoy')
  // Fotos: dos poses, comparador lado a lado y borrar una.
  await pestana('Progreso')
  await seg('Fotos')
  await revisarAqui('fotos vacío')
  archivoParaElegir = path.join(RAIZ, 'public', 'iconos', 'icono-512.png')
  await pulsar(/Hacer la primera foto|^Foto$/)
  await ver('Foto guardada', 8000)
  await pulsar('Perfil', '.chips')
  await t('pulsarSel', 'button[aria-label="Foto de perfil"]')
  await ver('Foto guardada · perfil', 8000)
  archivoParaElegir = null
  comprobar((await tabla('fotos')).length === 2, 'No se guardan las dos fotos')
  await revisarAqui('fotos')
  await pulsar('Lado a lado').catch(() => {})
  await t('pulsarSel', 'button.pthumb')
  await t('pulsarSel', 'button[aria-label="Borrar foto"]')
  await ver('¿Borrar esta foto?')
  await pulsar(/^Borrar$/, '.sheet')
  await esperar(500)
  comprobar((await tabla('fotos')).length === 1, 'No se borra la foto')
})

const perfilBD = async () => (await tabla('perfil'))[0]
/** Abre una sección de «Tu ficha» en Perfil (las de «Más secciones» están plegadas). */
async function seccion(nombre) {
  await pestana('Perfil')
  if (!(await js(`return [...document.querySelectorAll('.screen button.it b')].some(b => b.innerText.trim() === ${JSON.stringify(nombre)} && b.getBoundingClientRect().width > 0)`))) await pulsar('Más secciones')
  await pulsar(nombre)
  await ver(nombre)
  await t('listo')
  await revisarAqui(`perfil: ${nombre}`)
}

escenario('perfil a fondo: cada sección de la ficha cambia el perfil guardado', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Perfil')
  await revisarAqui('perfil')
  await t('pulsarSel', 'button[aria-label="¿Qué es esto?"]')
  let p0 = await perfilBD()
  // Datos personales: sexo y altura.
  await seccion('Datos personales')
  await pulsar('Mujer')
  await t('pulsarSel', '[aria-label="Altura"] button[aria-label="Más"]')
  await esperar(300)
  let p = await perfilBD()
  comprobar(p.sexo === 'mujer' && p.alturaCm === p0.alturaCm + 1, 'Datos personales no se guardan: ' + JSON.stringify([p.sexo, p.alturaCm]))
  await pulsar('Hombre')
  await seccion('Peso y medidas')
  // Objetivos: otro objetivo y una zona a reforzar.
  await seccion('Objetivos')
  await pulsar('Ganar fuerza')
  await js(`[...document.querySelectorAll('.screen .chips .chip')].find(c => /pecho/i.test(c.innerText))?.click()`)
  await esperar(300)
  p = await perfilBD()
  comprobar(p.objetivo === 'fuerza' && JSON.stringify(p.zonasPrioridad) !== JSON.stringify(p0.zonasPrioridad), 'Objetivos no se guardan: ' + JSON.stringify([p.objetivo, p.zonasPrioridad]))
  // Horario: el lunes pasa a fijo, la hora y el transporte.
  await seccion('Horario')
  await js(`[...document.querySelectorAll('.screen .chip.day')][0].click()`)
  await pulsar('Coche')
  await t('escribir', 'input[aria-label="Otra hora"]', '06:15')
  await esperar(300)
  p = await perfilBD()
  comprobar(JSON.stringify(p.diasFijos) !== JSON.stringify(p0.diasFijos) || JSON.stringify(p.diasOpcionales) !== JSON.stringify(p0.diasOpcionales), 'El día no cambia')
  comprobar(p.transporte === 'coche' && p.horaEntreno === '06:15', 'Horario no se guarda: ' + JSON.stringify([p.transporte, p.horaEntreno]))
  // Salud: una zona sensible y las lesiones (se guardan al salir del campo).
  await seccion('Salud y molestias')
  await js(`document.querySelector('.screen .chips .chip').click()`)
  await t('escribir', 'textarea[placeholder^="Por ejemplo"]', 'Hombro derecho')
  await soltarFoco()
  p = await perfilBD()
  comprobar(p.zonasSensibles.length !== p0.zonasSensibles.length && p.lesiones === 'Hombro derecho', 'Salud no se guarda: ' + JSON.stringify([p.zonasSensibles, p.lesiones]))
  // Preferencias: dos seguidos y abdominales.
  await seccion('Preferencias de entreno')
  await t('pulsarSel', '[role=switch][aria-label="Dos seguidos"]')
  await t('pulsarSel', '[role=switch][aria-label="Abdominales"]')
  await esperar(300)
  p = await perfilBD()
  comprobar(p.superseries === !p0.superseries && p.core === !p0.core, 'Preferencias no se guardan')
  // Tu nivel: un peso de referencia.
  await seccion('Tu nivel')
  await t('escribir', 'input[aria-label="Press de banca"]', '50 kg × 8')
  await soltarFoco()
  p = await perfilBD()
  comprobar(p.referencias.banca === '50 kg × 8', 'La referencia no se guarda: ' + JSON.stringify(p.referencias))
  // Pesarte y fotos: semanas entre fotos.
  await seccion('Pesarte y fotos')
  await t('pulsarSel', '[aria-label="Semanas entre fotos"] button[aria-label="Más"]')
  await esperar(300)
  comprobar((await perfilBD()).fotosCadaSemanas === p0.fotosCadaSemanas + 1, 'Las semanas entre fotos no cambian')
  // Suplementos: marcar uno.
  await seccion('Suplementos')
  await js(`document.querySelector('.screen .chips .chip').click()`)
  await esperar(300)
  comprobar((await perfilBD()).suplementos.length !== p0.suplementos.length, 'Los suplementos no cambian')
  // Tu trabajo.
  await seccion('Tu trabajo')
  await pulsar('De pie')
  await esperar(300)
  comprobar((await perfilBD()).trabajo === 'depie', 'El trabajo no cambia')
  // Regenerar desde una sección que afecta a la rutina.
  await seccion('Objetivos')
  await pulsar('Regenerar la rutina')
  await ver('Usar esta rutina')
})

escenario('inicio a fondo: días de la semana, atajos, + Peso con báscula, pendientes de hoy, pasar al sábado y ¿Voy bien?', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await revisarAqui('inicio')
  await t('pulsarSel', '.wd.today')
  await pulsar('+ Comer o beber')
  await ver('Toca lo que has tomado')
  await cerrarHoja()
  await pulsar('Escanear')
  await ver(/Escribir el código|cámara/i)
  await t('pulsarSel', 'button[aria-label="Cerrar"]')
  await pestana('Inicio')
  // + Peso con los datos de la báscula y otro origen.
  await pulsar('+ Peso')
  await t('pulsarSel', '.sheet [aria-label="Peso"] button[aria-label="Más"]')
  await pulsar('Más datos de la báscula', '.sheet')
  await pulsar('Del gimnasio', '.sheet')
  await t('escribir', '.sheet input[aria-label="% grasa"]', '23,5')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Guardado:')
  const m = (await tabla('mediciones')).at(-1)
  comprobar(m.origen === 'gimnasio' && m.bascula?.grasaPct === 23.5 && m.pesoKg > 0, '+ Peso no guarda la báscula: ' + JSON.stringify(m))
  // Primeros pasos: cada paso lleva a su sitio; «Ya lo sé» la quita y aparecen los pendientes de hoy.
  await js(`[...document.querySelectorAll('.sec .it.todo')].find(b => !b.classList.contains('done'))?.click()`)
  await t('listo')
  await pestana('Inicio')
  if (await t('hay', 'Primeros pasos')) await pulsar('Ya lo sé')
  const perfil = await perfilBD()
  await meter('perfil', [{ ...perfil, suplementos: ['Creatina'] }])
  await recargar()
  await ver('Pendientes de hoy')
  await revisarAqui('inicio con pendientes')
  await pulsar(/^Creatina/)
  await esperar(500)
  comprobar((await tabla('suplementos')).some(x => x.fecha === '2026-10-13' && x.tomados.includes('Creatina')), 'Marcar la creatina en pendientes no se guarda')
  // Sábado sin haber entrenado el viernes: ¿pasarlo al sábado? → Sí.
  await irA('2026-10-17T09:00:00')
  await ver('no entrenaste')
  await revisarAqui('inicio: sesión perdida')
  await pulsar(/^Sí/)
  await ver('Hecho: el sábado entrenas')
  comprobar((await ajustesBD()).recolocadas.some(r => r.fecha === '2026-10-17'), 'No se pasa la sesión al sábado')
  await ver('Hoy te toca')
  // Domingo: «¿Voy bien?».
  await irA('2026-10-18T10:00:00')
  await ver('¿Voy bien?')
  await revisarAqui('inicio: domingo')
  await t('pulsarSel', '.sem-card')
  await ver(/entrenos/i)
})

escenario('tema oscuro y letra grande en todas las pestañas', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await js(`localStorage.setItem('jf-tema', 'oscuro'); localStorage.setItem('jf-letra', 'grande')`)
  await meterSesionHecha('2026-10-12', 40)
  await tema('dark')
  const revisar = async (donde) => { await t('listo').catch(() => {}); await revisarAqui(`oscuro y grande · ${donde}`) }
  const pantallas = [
    ['Inicio', null], ['Rutina', null], ['Rutina', 'Ejercicios'], ['Rutina', 'Gimnasios'], ['Comida', null], ['Comida', 'Mis comidas'],
    ['Progreso', null], ['Progreso', 'Fuerza'], ['Progreso', 'Cuerpo'], ['Progreso', 'Fotos'], ['Progreso', 'Metas'], ['Perfil', null],
  ]
  for (const [p, s] of pantallas) { await pestana(p); if (s) await seg(s); await revisar(`${p}${s ? '/' + s : ''}`) }
  comprobar(await js(`return document.documentElement.dataset.theme === 'dark'`), 'El tema oscuro no se aplica')
  await tema('light')
})

escenario('tema oscuro y letra grande en las pantallas de dentro, el entreno y las hojas', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await js(`localStorage.setItem('jf-tema', 'oscuro'); localStorage.setItem('jf-letra', 'grande')`)
  await meterSesionHecha('2026-10-12', 40)
  await tema('dark')
  const revisar = async (donde) => { await t('listo').catch(() => {}); await revisarAqui(`oscuro y grande · ${donde}`) }
  await pestana('Rutina'); await seg('Mi plan'); await pulsar(/Cuerpo completo A/); await revisar('detalle del día')
  await pulsar('Editar'); await revisar('editar plan')
  await pestana('Rutina'); await seg('Ejercicios'); await pulsar(/Press de Banca con Barra/i); await revisar('ficha')
  await pestana('Comida'); await seg('Día'); await t('pulsarSel', '.card.pd.adj'); await revisar('objetivo de energía')
  await pestana('Comida'); await seg('Día'); await pulsar('Añadir', '.dock'); await revisar('hoja añadir'); await pulsar('Crear comida nueva', '.sheet'); await revisar('hoja crear comida'); await cerrarHoja()
  await pestana('Progreso'); await seg('Cuerpo'); await pulsar(/Registrar/); await revisar('registrar medidas')
  await pestana('Progreso'); await seg('Fuerza'); await t('pulsarSel', '.screen .list button.it'); await revisar('detalle del entreno')
  await pestana('Progreso'); await seg('Metas'); await pulsar('Crear una meta'); await revisar('hoja meta'); await cerrarHoja()
  await pestana('Perfil'); await t('pulsarSel', 'button[aria-label="Ajustes"]'); await revisar('ajustes')
  await pulsar('Créditos y aviso legal'); await revisar('créditos')
  await pestana('Inicio'); await pulsar('+ Peso'); await revisar('hoja peso'); await cerrarHoja()
  await pulsar('Empezar rutina'); await revisar('hoja empezar'); await pulsar(/^Empezar$/, '.sheet'); await ver('Hecho', 8000); await revisar('entreno')
  await t('pulsarSel', 'button[aria-label="Herramientas"]'); await revisar('hoja más'); await cerrarHoja()
  await t('pulsarSel', '[aria-label="Lista de la sesión"]'); await revisar('hoja lista'); await cerrarHoja()
  await pulsar('Ocupado'); await revisar('hoja ocupado'); await js('window.__jfAtras()')
  await tema('light')
})

escenario('alta a fondo: letra grande en la bienvenida, medidas opcionales y gimnasio marcado a mano', async () => {
  await deCero('2026-10-14T18:00:00')
  await ver('Tu fuerza y tu comida')
  await revisarAqui('bienvenida')
  await t('pulsarSel', '.alta-letra')
  comprobar(await js(`return localStorage.getItem('jf-letra') === 'grande'`), '«Letra grande» no se guarda')
  await revisarAqui('bienvenida con letra grande')
  await alta({ medidas: true, gimnasioYo: true })
  const ms = await tabla('mediciones')
  comprobar(ms.some(m => m.pesoKg === 75), 'El peso del alta no se guarda')
  comprobar(ms.some(m => m.perimetros?.cintura === 95 && m.perimetros?.cuello === 38), 'Las medidas del alta no se guardan: ' + JSON.stringify(ms))
  const [g] = await tabla('gimnasios')
  comprobar(g?.nombre === 'Gimnasio del barrio' && !g.material.includes('cable'), 'El gimnasio marcado a mano no se guarda: ' + JSON.stringify([g?.nombre, g?.material]))
  // La rutina no usa poleas si el gimnasio no tiene.
  const [r] = await tabla('rutinas')
  const conPolea = r.dias.flatMap(d => d.bloques).filter(b => /cable/.test(b.ejercicio))
  comprobar(!conPolea.length, 'La rutina usa poleas que el gimnasio no tiene: ' + conPolea.map(b => b.ejercicio))
  const p = (await tabla('perfil'))[0]
  comprobar(p.altaCompleta && p.alturaCm === 175 && p.sexo === 'hombre' && JSON.stringify(p.diasFijos) === '[1,3,4]', 'El perfil del alta no es el elegido: ' + JSON.stringify([p.alturaCm, p.sexo, p.diasFijos]))
  await js(`localStorage.removeItem('jf-letra')`)
})

escenario('entreno a fondo: +15 s de descanso, ocupado (también ocupada, esperar), vas tarde (aplicar), cronómetro y descartar', async () => {
  await altaRapida('2026-10-13T05:20:00')
  // A las 6:35 con salida a las 6:45: no da tiempo y propone recortar.
  await irA('2026-10-13T06:35:00')
  await pulsar('Empezar rutina')
  await pulsar(/^Empezar$/, '.sheet')
  await ver('Hecho', 8000)
  await ponerPesoSiFalta()
  await pulsar(/^Hecho$/)
  // Descanso: +15 s alarga el temporizador.
  let s = await enCurso()
  const hasta = s.descansoHasta
  await pulsar('+15 s')
  await esperar(300)
  s = await enCurso()
  comprobar(s.descansoHasta === hasta + 15000, '+15 s no alarga el descanso')
  await pulsar(/^Saltar$/)
  comprobar(!(await enCurso()).descansoHasta, '«Saltar» no quita el descanso')
  // Vas tarde: aplicar la propuesta (versión corta o una serie menos).
  await ver(/min tarde/, 6000)
  await revisarAqui('entreno con recorte')
  const series0 = (await enCurso()).ejercicios.reduce((t, e) => t + e.series.length, 0)
  await pulsar('Aplicar')
  await ver(/Pasado a la versión corta|1 serie menos/)
  s = await enCurso()
  comprobar(s.version === 'corta' || s.ejercicios.reduce((t, e) => t + e.series.length, 0) === series0 - 1, 'Aplicar el recorte no cambia nada')
  // Ocupado: «También ocupada» pasa a la siguiente alternativa; «Esperar» cierra sin cambiar.
  await pulsar('Ocupado')
  await ver(/ocupado|ocupada/i)
  await revisarAqui('hoja ocupado')
  if (await t('hay', 'También ocupada')) {
    await pulsar('También ocupada', '.sheet')
    await ver(/También ocupada|Está todo ocupado/)
  }
  if (await t('hay', 'Esperar')) { await pulsar('Esperar', '.sheet'); await ver('Vuelve a probar') }
  else await js('window.__jfAtras()')
  // Un ejercicio por tiempo: el cronómetro cuenta los segundos.
  s = await enCurso()
  const iT = s.ejercicios.findIndex(e => e.registro === 'tiempo' && e.estado !== 'hecho')
  if (iT >= 0) {
    await t('pulsarSel', '[aria-label="Lista de la sesión"]')
    await js(`[...document.querySelectorAll('.sheet .it.sl button.tx')][${iT}].click()`)
    await esperar(400)
    await pulsar(/^Empezar$/)
    await esperar(2200)
    await pulsar(/^Parar$/)
    await pulsar(/^Hecho$/)
    await esperar(300)
    const seg = (await enCurso())?.ejercicios[iT].series.find(x => x.hecha)?.segundos
    comprobar(seg >= 1, 'El cronómetro no apunta los segundos: ' + seg)
    await pulsar(/^Saltar$/).catch(() => {})
  }
  // Descartar el entreno.
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Descartar entreno', '.sheet')
  await pulsar(/^Descartar$/, '.sheet')
  await esperar(600)
  comprobar(!(await enCurso()), 'Descartar no cierra el entreno')
})

escenario('inicio y comida: «Hoy no», «No» a pasar la sesión, ver el entreno hecho, volver a lo normal y escaneado pendiente', async () => {
  await altaRapida('2026-10-13T05:20:00')
  // Sábado opcional: «Hoy no».
  await meterSesionHecha('2026-10-13', 40)
  await meterSesionHecha('2026-10-15', 40, {}, 'B')
  await meterSesionHecha('2026-10-16', 40, {}, 'C')
  await irA('2026-10-17T09:00:00')
  await ver('¿Sesión extra?')
  await pulsar('Hoy no')
  await ver('Vale, hoy no')
  // La semana siguiente sin entrenar: el sábado pregunta si pasar la sesión; «No» la salta esta semana.
  await irA('2026-10-24T09:00:00')
  await ver('no entrenaste')
  await pulsar(/^No$/)
  await ver('la saltamos esta semana')
  comprobar((await ajustesBD()).recolocadas.some(r => r.fecha === '0000-00-00'), '«No» no la marca como saltada')
  // Día con el entreno hecho: «Ver el entreno».
  await meterSesionHecha('2026-10-24', 42, {}, 'A')
  await ver('Entreno de hoy hecho')
  await pulsar('Ver el entreno')
  await ver('Toca una serie para corregirla')
  // Semana suave puesta: «Volver a lo normal».
  await pestana('Inicio')
  const a = await ajustesBD()
  await meter('ajustes', [{ ...a, semanaSuave: '2026-10-19' }])
  await irA('2026-10-20T09:00:00')
  await ver('Volver a lo normal')
  await pulsar('Volver a lo normal')
  await ver('Vuelta a lo normal')
  comprobar((await ajustesBD()).semanaSuave == null, '«Volver a lo normal» no quita la semana suave')
  // Escaneado sin conexión: «Apuntar como nota» y luego «Buscar ahora» desde su ficha.
  await pestana('Comida')
  sinConexion = true
  await t('pulsarSel', 'button[aria-label="Escanear"]')
  await pulsar(/Escribir el código/)
  await t('escribir', '.cam-panel input', '5449000000996')
  await pulsar('Buscar')
  await ver('Sin conexión', 8000)
  // Abre «Escribir lo que he comido» con el código, para apuntarlo como nota.
  await pulsar('Apuntar como nota')
  await pulsar(/^Apuntar$/, '.sheet')
  await esperar(500)
  comprobar((await comidas()).some(c => c.fecha === '2026-10-20'), '«Apuntar como nota» no apunta nada')
  comprobar((await tabla('productos')).some(p => p.codigo === '5449000000996' && p.pendiente), 'El código no queda pendiente')
  sinConexion = false
  await pestana('Comida')
  await seg('Mis comidas')
  await pulsar(/Coca-Cola|Pendiente de buscar|5449000000996/)
  if (await t('hay', 'Buscar ahora')) { await pulsar('Buscar ahora'); await ver(/Encontrado|Coca-Cola/, 8000) }
  await ver('Coca-Cola', 8000)
})

// ---------- ejecución ----------
await cdp.enviar('Performance.enable').catch(() => {})
let bien = 0, mal = 0
const inicio = Date.now()
for (const e of ESCENARIOS) {
  if (filtro && !e.nombre.includes(filtro)) continue
  errores.length = 0
  // Cada escenario empieza igual aunque el anterior fallara a medias (tamaño, tema, archivos, conexión).
  await movil(390, 844).catch(() => {}); await tema('light').catch(() => {})
  archivoParaElegir = null; sinConexion = false
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
