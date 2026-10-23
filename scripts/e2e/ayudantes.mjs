// Ayudantes de las pruebas de extremo a extremo: usar la app como una persona (pulsar, ver, alta, entreno…), leer y
// preparar su base local y registrar los escenarios. correr.mjs abre el navegador y se lo pasa con conectar().
import * as fsx from 'node:fs'
import path from 'node:path'

export const RAIZ = path.resolve(import.meta.dirname, '..', '..')
export const DESCARGAS = path.join(RAIZ, '.cache', 'e2e-descargas')
export const esperar = ms => new Promise(r => setTimeout(r, ms))

/** Lo que simulan la red y el selector de archivos (correr.mjs lo lee y lo deja como al principio en cada escenario). */
export const entorno = {
  sinConexion: false,
  /** Próximo archivo que se dará cuando la app abra el selector de archivos (fotos, importar copia). */
  archivoParaElegir: null,
}

/** El navegador y la página de la app: los pone correr.mjs antes de cargar los escenarios. */
export let cdp, compilada
let PAGINA_APP
export function conectar(o) { cdp = o.cdp; compilada = o.compilada; PAGINA_APP = o.paginaApp }

/** Los escenarios, en el orden en que se registran (correr.mjs los pasa uno a uno). */
export const ESCENARIOS = []
export const escenario = (nombre, f) => ESCENARIOS.push({ nombre, f })

export async function movil(ancho, alto) {
  await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 2, mobile: true })
  await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: true })
}
export async function tema(t) { await cdp.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: t }] }) }

/** Evalúa JS en la página (con await). */
export async function js(codigo) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: `(async()=>{${codigo}})()`, awaitPromise: true, returnByValue: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] ?? r.exceptionDetails.text)
  return r.result.value
}
export const t = (metodo, ...a) => js(`return await __t.${metodo}(${a.map(x => x instanceof RegExp ? x.toString() : JSON.stringify(x)).join(',')})`)
export const pulsar = (texto, donde) => t('pulsar', texto, donde)
export const ver = (texto, ms) => t('ver', texto, ms)
export const noVer = texto => t('noVer', texto)

/** Carga la app de cero (base vacía) a una fecha y hora concretas. */
export async function deCero(fechaHora) {
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
export async function recargar() {
  await cdp.enviar('Page.reload', { ignoreCache: true })
  await esperar(400)
  await t('ver', /JOWYFIT|Buenos|Buenas|Hoy te toca|Inicio/i, 15000)
}
/** Cambia la fecha simulada sin borrar datos (como si pasaran los días). */
export async function irA(fechaHora) {
  await js(`sessionStorage.setItem('__e2e_fecha', String(new Date(${JSON.stringify(fechaHora)}).getTime() - Date.__real()))`)
  await recargar()
}
/** Hace el entreno de hoy con la interfaz. Con `series`, solo esas series y luego «Terminar entreno» desde la lista. */
export async function hacerEntreno({ ocupado = false, series = Infinity } = {}) {
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
export async function alta(o = {}) {
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
export async function ponerPesoSiFalta() {
  await js(`const g = [...document.querySelectorAll('.stp')].find(x => /peso/i.test(x.getAttribute('aria-label') || '') || /kg/i.test(x.closest('div')?.previousElementSibling?.textContent || ''))
    const v = g?.querySelector('.val')?.textContent || ''
    if (g && (v.includes('—') || v.includes('?') || v.trim() === '')) for (let i = 0; i < 8; i++) g.querySelector('button[aria-label="Más"]')?.click()`)
}
/** Botón de volver de la cabecera (o de la galería de la ficha). */
export const volver = () => js(`const b = [...document.querySelectorAll('button[aria-label]')].filter(b => /^(Volver|Atrás)$/.test(b.getAttribute('aria-label')) && b.getBoundingClientRect().width > 0).pop(); if (!b) throw new Error('No hay botón de volver'); b.click(); await new Promise(r => setTimeout(r, 300))`)
export const seg = async n => { await pulsar(n, '.seg'); await t('listo') }
/** Lee una tabla entera de la base local de la app. */
export const tabla = nombre => js(`return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => { const g = q.result.transaction('${nombre}').objectStore('${nombre}').getAll(); g.onsuccess = () => ok(g.result); g.onerror = mal } })`)
/** Mete filas en una tabla de la base local (para preparar historiales largos sin tocar 6 semanas). */
export const meter = (nombre, filas) => js(`const filas = ${JSON.stringify(filas)}; return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => { const tx = q.result.transaction('${nombre}', 'readwrite'); for (const f of filas) tx.objectStore('${nombre}').put(f); tx.oncomplete = () => ok(filas.length); tx.onerror = mal } })`)

export const pestana = async n => { await pulsar(new RegExp(`^${n}$`, 'i'), '.tabbar'); await t('listo') }

/** Toda la base local de la app (cada tabla con sus filas). */
export const volcar = () => js(`return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = async () => {
  const b = q.result, out = {}
  for (const n of b.objectStoreNames) out[n] = await new Promise(r => { const g = b.transaction(n).objectStore(n).getAll(); g.onsuccess = () => r(g.result) })
  b.close(); ok(out) } })`)
/** Sustituye toda la base local por un volcado (las tablas que no vengan se vacían). */
export const reponer = datos => js(`const datos = ${JSON.stringify(datos)}; return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => {
  const b = q.result, tx = b.transaction([...b.objectStoreNames], 'readwrite')
  for (const n of b.objectStoreNames) { const st = tx.objectStore(n); st.clear(); for (const f of datos[n] ?? []) st.put(f) }
  tx.oncomplete = () => { b.close(); ok(true) }; tx.onerror = mal } })`)
/**
 * Alta rápida: la primera vez de cada fecha se hace el alta de verdad (con la interfaz) y se guarda la base;
 * las siguientes se parte de cero y se pone esa base. Así cada escenario no gasta 15 s en el alta.
 */
export const altas = new Map()
export async function altaRapida(fechaHora) {
  await deCero(fechaHora)
  const foto = altas.get(fechaHora)
  if (!foto) { await alta(); altas.set(fechaHora, await volcar()); return }
  await reponer(foto)
  await recargar()
  await ver(/Hoy te toca|descansas|no entrenaste|Próximo/i, 8000)
}
/** Mete un entreno hecho del día A de la rutina (todas las series a ese peso) y recarga. */
export async function meterSesionHecha(fecha, peso, x = {}, letra = 'A') {
  const [r] = (await tabla('rutinas')).filter(r => r.activa)
  const d = r.dias.find(d => d.letra === letra)
  const inicio = new Date(`${fecha}T05:30:00`).getTime()
  await meter('sesiones', [{ id: 5000 + Math.floor(inicio / 1e6) % 1000, fecha, rutinaId: r.id, letra: d.letra, nombre: d.nombre, gimnasioId: null, inicio, fin: inicio + 50 * 60_000, version: 'normal', estado: 'hecha', calibracion: false,
    ejercicios: d.bloques.map(b => ({ uid: b.uid, ejercicio: b.ejercicio, planificado: b.ejercicio, estado: 'hecho', repsMin: b.repsMin, repsMax: b.repsMax, rpe: b.rpe, descanso: b.descanso, registro: b.registro,
      series: Array.from({ length: b.series }, (_, i) => ({ n: i + 1, peso: ['peso', 'mancuerna'].includes(b.registro) ? peso : null, reps: b.registro === 'tiempo' ? null : b.repsMin, segundos: b.registro === 'tiempo' ? 30 : null, rpe: 8, calentamiento: false, hecha: true, ts: inicio + (i + 1) * 120_000 })) })), ...x }])
  await recargar()
}
/** El entreno en curso tal como está en la base. */
export const enCurso = async () => (await tabla('sesiones')).find(s => s.estado === 'curso')
/** Falla con un mensaje claro si algo no se cumple. */
export function comprobar(cond, msg) { if (!cond) throw new Error(msg) }
/** Revisa la pantalla actual (textos rotos, cosas que se salen) y falla si hay algo. */
export async function revisarAqui(donde) { const f = await t('revisar'); if (f) throw new Error(`${donde}: ${f}`) }
/** Tras recargar con un entreno a medias: vuelve a la pantalla del entreno. */
export async function volverAlEntreno() {
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
export const soltarFoco = async () => { await js(`const el = document.activeElement; if (el && el !== document.body) { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); el.blur() }`); await esperar(250) }
/** Cierra la hoja abierta (botón «Cerrar» de la hoja). */
export const cerrarHoja = () => t('pulsarSel', '.sheet button[aria-label="Cerrar"]')

/** Espera a que aparezca en Descargas un archivo nuevo que cumpla `filtro` y lo devuelve leído. */
export async function descargado(filtro, antes = new Set()) {
  for (let i = 0; i < 60; i++) {
    const f = fsx.readdirSync(DESCARGAS).find(x => filtro(x) && !antes.has(x) && !x.endsWith('.crdownload'))
    if (f) { await esperar(200); return { nombre: f, bytes: new Uint8Array(fsx.readFileSync(path.join(DESCARGAS, f))) } }
    await esperar(250)
  }
  return null
}
export const comidas = () => tabla('comidas')
export const ajustesBD = async () => (await tabla('ajustes'))[0]
export const perfilBD = async () => (await tabla('perfil'))[0]
