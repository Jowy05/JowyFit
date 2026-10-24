// Prueba de la landing (index.html) en un navegador sin ventana, sobre la versión compilada en .cache/dist-landing.
//   npx vite build --outDir .cache/dist-landing --emptyOutDir   (o añade --build y lo hace esta prueba)
//   node scripts/e2e/landing.mjs [--build] [--solo "idioma|demo"]   (--solo: solo las pruebas cuyo nombre casa)
// Comprueba el botón según la plataforma (?plataforma=otro → APK, ?plataforma=apple → abrir la app), que no hay
// errores en la consola, que nada se sale de la pantalla a 360 px de ancho, que no se pide nada a otros sitios y que
// con «reducir movimiento» se ve todo. Y los idiomas (es, ca, en): el del navegador, el selector, que no se quede
// nada en castellano, que nada se salga de la pantalla y que no se vea un instante en castellano al cargar.
// Sale con 0 si todo va bien y con 1 si no.
import fs from 'node:fs'
import path from 'node:path'
import { build, preview } from 'vite'
import { abrirNavegador, trasCarga } from './navegador.mjs'

const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const SALIDA = path.join(RAIZ, '.cache', 'dist-landing')
const PUERTO = 5191
const BASE = `http://127.0.0.1:${PUERTO}/`
const APK = 'https://github.com/Jowy05/JowyFit/releases/latest/download/JowyFit.apk'
const APP = 'app.html?instalar=1'
const esperar = ms => new Promise(r => setTimeout(r, ms))

if (process.argv.includes('--build')) {
  await build({ root: RAIZ, logLevel: 'warn', build: { outDir: SALIDA, emptyOutDir: true } })
}
if (!fs.existsSync(path.join(SALIDA, 'index.html'))) {
  console.error('No está compilada: npx vite build --outDir .cache/dist-landing --emptyOutDir (o usa --build)')
  process.exit(1)
}

const servidor = await preview({ root: RAIZ, logLevel: 'error', build: { outDir: SALIDA }, preview: { port: PUERTO, strictPort: true, host: '127.0.0.1' } })
const nav = await abrirNavegador({ puerto: 9571 })
const { cdp } = nav

let errores = []
cdp.al('Runtime.exceptionThrown', p => errores.push(`excepción: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`))
cdp.al('Runtime.consoleAPICalled', p => { if (p.type === 'error') errores.push(`console.error: ${p.args.map(a => a.value ?? a.description).join(' ')}`) })
cdp.al('Log.entryAdded', p => { if (p.entry.level === 'error') errores.push(`log: ${p.entry.text} ${p.entry.url ?? ''}`) })
await cdp.enviar('Runtime.enable')
await cdp.enviar('Log.enable')
await cdp.enviar('Page.enable')

// Idioma del navegador (cambia navigator.languages): las pruebas de siempre, en castellano; las de idioma lo cambian.
const { userAgent: UA } = await cdp.enviar('Browser.getVersion')
const idiomaNavegador = lista => cdp.enviar('Emulation.setUserAgentOverride', { userAgent: UA, acceptLanguage: lista })
await idiomaNavegador('es-ES,es')
/** Borra lo guardado en la página (el idioma elegido, la letra grande…), como un navegador recién abierto. */
const vaciar = () => cdp.enviar('Storage.clearDataForOrigin', { origin: BASE.replace(/\/$/, ''), storageTypes: 'local_storage' })

async function js(codigo) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: `(async()=>{${codigo}})()`, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] ?? r.exceptionDetails.text)
  return r.result.value
}
async function pantalla(ancho, alto, reducido = false) {
  await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 900 })
  await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: ancho < 900 })
  await cdp.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducido ? 'reduce' : 'no-preference' }] })
}
async function abrir(consulta) {
  await trasCarga(cdp, () => cdp.enviar('Page.navigate', { url: BASE + consulta }))
  await js(`await new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r)); await document.fonts.ready`)
  await esperar(300)
}
/** Baja por toda la página (para que se revele todo) y vuelve arriba. */
async function recorrer() {
  await js(`
    const alto = () => document.documentElement.scrollHeight
    for (let y = 0; y < alto(); y += innerHeight * 0.6) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)) }
    scrollTo(0, alto()); await new Promise(r => setTimeout(r, 250))`)
}

const resultados = []
const SOLO = process.argv.includes('--solo') ? new RegExp(process.argv[process.argv.indexOf('--solo') + 1] ?? '', 'i') : null
async function prueba(nombre, fn) {
  if (SOLO && !SOLO.test(nombre)) return
  errores = []
  try {
    const fallos = (await fn()) ?? []
    fallos.push(...errores)
    resultados.push({ nombre, fallos })
  } catch (e) {
    resultados.push({ nombre, fallos: [String(e?.message ?? e), ...errores] })
  }
  const r = resultados.at(-1)
  console.log(`${r.fallos.length ? 'MAL ' : 'BIEN'}  ${nombre}`)
  for (const f of r.fallos) console.log('      · ' + f)
}

// Estado de un botón: ¿existe, se ve y adónde lleva?
const BOTONES = `
  const ver = el => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0
  const apk = document.getElementById('cta-apk'), app = document.getElementById('cta-app')
  return {
    plataforma: document.documentElement.dataset.plataforma,
    apk: !!apk, apkVisible: ver(apk), apkHref: apk?.getAttribute('href'),
    app: !!app, appVisible: ver(app), appHref: app?.getAttribute('href'),
  }`

for (const [ancho, alto, nombre] of [[390, 844, 'móvil'], [1440, 900, 'ordenador']]) {
  await prueba(`Android/otros (${nombre}): se ve «Descargar» con el APK y no «Abrir»`, async () => {
    await pantalla(ancho, alto)
    await abrir('?plataforma=otro')
    const b = await js(BOTONES)
    const f = []
    if (b.plataforma !== 'otro') f.push(`data-plataforma = ${b.plataforma}`)
    if (!b.apk || !b.apkVisible) f.push('#cta-apk no se ve')
    if (b.apkHref !== APK) f.push(`#cta-apk lleva a ${b.apkHref}`)
    if (b.appVisible) f.push('#cta-app se ve y no debería')
    await recorrer()
    return f
  })
  await prueba(`iPhone/Mac (${nombre}): se ve «Abrir» con app.html?instalar=1 y no el APK`, async () => {
    await pantalla(ancho, alto)
    await abrir('?plataforma=apple')
    const b = await js(BOTONES)
    const f = []
    if (b.plataforma !== 'apple') f.push(`data-plataforma = ${b.plataforma}`)
    if (!b.app || !b.appVisible) f.push('#cta-app no se ve')
    if (b.appHref !== APP) f.push(`#cta-app lleva a ${b.appHref}`)
    if (b.apkVisible) f.push('#cta-apk se ve y no debería')
    await recorrer()
    return f
  })
}

/** ¿Algo se sale de la pantalla por los lados? (lo que recorta un contenedor no cuenta) */
const FUERA = `
      const vw = document.documentElement.clientWidth
      const f = []
      if (document.documentElement.scrollWidth > vw) f.push('la página se puede mover de lado: ' + document.documentElement.scrollWidth + ' px')
      // Un elemento que se sale solo cuenta si ningún contenedor suyo lo recorta.
      const recortado = el => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const cs = getComputedStyle(p)
          if (/hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(cs.overflow)) {
            const r = p.getBoundingClientRect()
            if (r.left >= -1 && r.right <= vw + 1) return true
          }
        }
        return false
      }
      for (const el of document.body.querySelectorAll('*')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        if ((r.right > vw + 1 || r.left < -1) && !recortado(el)) {
          f.push('se sale: ' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + ' (' + Math.round(r.left) + '…' + Math.round(r.right) + ')')
          if (f.length > 8) break
        }
      }
      return f`

// Nada se sale de la pantalla a 360 px (con los desplegables abiertos), en las dos plataformas.
for (const plat of ['otro', 'apple']) {
  await prueba(`360 px (${plat}): nada se sale de la pantalla`, async () => {
    await pantalla(360, 740)
    await abrir(`?plataforma=${plat}`)
    await js(`document.querySelectorAll('details').forEach(d => { d.open = true }); document.querySelectorAll('[data-dentro-app]').forEach(e => { e.hidden = false })`)
    await recorrer()
    return js(FUERA)
  })
}

// Con «reducir movimiento» se ve todo (nada se queda transparente esperando una animación).
for (const plat of ['otro', 'apple']) {
  await prueba(`Reducir movimiento (${plat}): todo se ve`, async () => {
    await pantalla(390, 844, true)
    await abrir(`?plataforma=${plat}`)
    await recorrer()
    await esperar(400)
    return js(`
      const ver = el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0
      return [...document.querySelectorAll('[data-revelar]')].filter(e => ver(e) && getComputedStyle(e).opacity !== '1')
        .map(e => 'transparente: ' + (e.textContent || '').trim().slice(0, 40))`)
  })
}

// Sin rastreadores: la página no pide nada a otros sitios.
await prueba('No pide nada a otros sitios', async () => {
  await pantalla(390, 844)
  await abrir('?plataforma=otro')
  await recorrer()
  return js(`return performance.getEntriesByType('resource').map(r => r.name).filter(u => /^https?:/.test(u) && !u.startsWith(location.origin)).map(u => 'pide ' + u)`)
})

// ---------------------------------------------------------------- demo (/Demo)
/** Estado de la demo: paso, título, recuadro y tarjeta. */
const DEMO = `
  const f = document.querySelector('[data-foco]'), t = document.querySelector('[data-tarjeta]'), fin = document.querySelector('[data-final]')
  const rf = f.getBoundingClientRect(), rt = t.getBoundingClientRect()
  return {
    n: document.querySelector('[data-n]').textContent, titulo: document.querySelector('[data-titulo]').textContent,
    texto: document.querySelector('[data-texto]').textContent, barras: document.querySelectorAll('.d-barra').length,
    foco: getComputedStyle(f).opacity === '1', tapa: !t.hidden && getComputedStyle(f).opacity === '1' && !(rt.bottom < rf.top + 4 || rt.top > rf.bottom - 4 || rt.right < rf.left + 4 || rt.left > rf.right - 4),
    final: !fin.hidden, cta: [...fin.querySelectorAll('.d-cta')].filter(a => getComputedStyle(a).display !== 'none').map(a => a.getAttribute('href')),
    ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight,
  }`
const tecla = async k => { await cdp.enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: k === ' ' ? 32 : k === 'ArrowRight' ? 39 : 37 }); await cdp.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: k === ' ' ? 32 : k === 'ArrowRight' ? 39 : 37 }) }

await prueba('Landing: «Ver la demo» en la cabecera y en el cierre, a /Demo', async () => {
  await pantalla(390, 844)
  await abrir('?plataforma=otro')
  const enlaces = await js(`return [...document.querySelectorAll('a.boton-demo')].map(a => a.getAttribute('href'))`)
  return enlaces.length === 2 && enlaces.every(h => h === 'Demo') ? [] : [`enlaces: ${JSON.stringify(enlaces)}`]
})

for (const [plat, pasos, cta] of [['android', 12, APK], ['apple', 17, APP]]) {
  await prueba(`Demo ${plat}: ${pasos} pasos con su recuadro, flechas, pausa y final con su botón`, async () => {
    const fallos = []
    await pantalla(1366, 820)
    await abrir(`Demo.html?plataforma=${plat}`)
    await esperar(900)
    let d = await js(DEMO)
    if (d.barras !== pasos) fallos.push(`pasos: ${d.barras}`)
    if (d.n !== `1 de ${pasos}`) fallos.push(`empieza en ${d.n}`)
    if (!d.foco) fallos.push('el primer paso no señala nada')
    // Pausa: no avanza sola.
    await tecla(' ')
    await esperar(7500)
    d = await js(DEMO)
    if (d.n !== `1 de ${pasos}`) fallos.push(`en pausa ha avanzado a ${d.n}`)
    const vistos = new Set()
    for (let k = 0; k < pasos; k++) {
      d = await js(DEMO)
      vistos.add(d.titulo)
      if (!d.foco && !d.final) { await esperar(900); d = await js(DEMO) }
      if (!d.foco) fallos.push(`sin recuadro en «${d.titulo}»`)
      if (d.titulo.length > 34 || d.texto.length > 125) fallos.push(`texto largo en «${d.titulo}»`)
      if (k < pasos - 1) { await tecla('ArrowRight'); await esperar(700) }
    }
    if (vistos.size !== pasos) fallos.push(`títulos repetidos: ${vistos.size} de ${pasos}`)
    await tecla('ArrowLeft'); await esperar(500)
    d = await js(DEMO)
    if (d.n !== `${pasos - 1} de ${pasos}`) fallos.push(`atrás va a ${d.n}`)
    await tecla('ArrowRight'); await esperar(300); await tecla('ArrowRight'); await esperar(600)
    d = await js(DEMO)
    if (!d.final) fallos.push('no sale el final')
    if (JSON.stringify(d.cta) !== JSON.stringify([cta])) fallos.push(`botón del final: ${JSON.stringify(d.cta)}`)
    // Android no promete nada de iPhone y al revés.
    const todo = await js(`return [...document.querySelectorAll('.d-barra')].map(b => b.getAttribute('aria-label')).join(' ')`)
    if (plat === 'android' && /pendientes|pantalla de inicio|a mano/i.test(todo)) fallos.push('Android enseña cosas de iPhone')
    return fallos
  })
}

await prueba('Demo en el móvil: captura a pantalla completa, sin scroll y la tarjeta nunca tapa lo señalado', async () => {
  const fallos = []
  for (const [plat, alto] of [['apple', 664], ['android', 860]]) {
    await pantalla(390, alto)
    await abrir(`Demo.html?plataforma=${plat}`)
    await esperar(600)
    await tecla(' ')
    const total = (await js(DEMO)).barras
    for (let k = 0; k < total; k++) {
      await esperar(1000)
      const d = await js(DEMO)
      if (d.tapa) fallos.push(`${plat}: la tarjeta tapa «${d.titulo}»`)
      if (d.ancho > 390 || d.alto > alto + 1) fallos.push(`${plat}: se sale (${d.ancho}×${d.alto}) en «${d.titulo}»`)
      await tecla('ArrowRight')
    }
  }
  return fallos
})

await prueba('Demo: no pide nada a otros sitios y la plataforma se cambia con las pestañas', async () => {
  await pantalla(1366, 820)
  await abrir('Demo.html?plataforma=android')
  await js(`document.querySelector('[data-plat="apple"]').click()`)
  await esperar(900)
  const d = await js(DEMO)
  const fuera = await js(`return performance.getEntriesByType('resource').map(r => r.name).filter(u => /^https?:/.test(u) && !u.startsWith(location.origin))`)
  const f = []
  if (d.barras !== 17 || d.n !== '1 de 17') f.push(`al cambiar a iPhone: ${d.barras} pasos, ${d.n}`)
  for (const u of fuera) f.push('pide ' + u)
  return f
})

// ---------------------------------------------------------------- idiomas (es, ca, en)
const IDIOMAS = ['es', 'ca', 'en']
/** Hace algo que cambia de página (pulsar un enlace, recargar) y espera a que la nueva acabe de cargar, con sus letras. */
async function cargada(accion) {
  await trasCarga(cdp, accion)
  await js(`await new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r)); await document.fonts.ready`)
  await esperar(400)
}
/** Todo lo que se traduce (data-i18n, data-i18n-html y data-i18n-attr) y lo que escribe el JS, con su sitio. */
const TEXTOS = `
  const t = {}, n = {}
  const poner = (k, v) => { n[k] = (n[k] ?? 0) + 1; t[k + '#' + n[k]] = (v ?? '').replace(/\\s+/g, ' ').trim() }
  for (const el of document.querySelectorAll('[data-i18n]')) poner('texto:' + el.dataset.i18n, el.textContent)
  for (const el of document.querySelectorAll('[data-i18n-html]')) poner('html:' + el.dataset.i18nHtml, el.textContent)
  for (const el of document.querySelectorAll('[data-i18n-attr]'))
    for (const par of el.dataset.i18nAttr.split(';')) { const [a, k] = par.split(':').map(x => x.trim()); poner(a + ':' + k, el.getAttribute(a)) }
  for (const sel of ['[data-version]', '[data-version-corta]', '[data-capitulo]', '[data-n]', '[data-titulo]', '[data-texto]', '[data-play-txt]', '[data-cambiar]'])
    for (const el of document.querySelectorAll(sel)) poner('js:' + sel, el.textContent)
  for (const el of document.querySelectorAll('[data-idioma-boton]')) poner('js:idioma', el.getAttribute('aria-label'))
  return t`
const PAGINAS = { landing: '?plataforma=otro', demo: 'Demo.html?plataforma=android' }
/** Textos de referencia de cada página en cada idioma (elegido con ?lang=). */
const ref = { landing: {}, demo: {} }
/** Textos que pueden quedarse igual que en castellano (se dicen igual o son nombres). */
const IGUALES = new Set(['Gratis', 'Normal', 'S', '0 euros', 'al mes', 'JowyFit', 'Android', 'iPhone', ''])
/** Diferencias entre lo que hay y lo esperado (las primeras). */
function distintos(hay, esperado, nombre) {
  if (!esperado) return [`${nombre}: sin textos de referencia`]
  const f = []
  for (const [k, v] of Object.entries(esperado)) if (hay[k] !== v) f.push(`${nombre}: ${k} = «${String(hay[k]).slice(0, 50)}» y no «${v.slice(0, 50)}»`)
  return f.slice(0, 6)
}

await prueba('Idiomas: cada página en es, ca y en con ?lang=, sin claves ni huecos sin rellenar', async () => {
  const f = []
  await idiomaNavegador('es-ES,es')
  await pantalla(390, 844)
  for (const [pag, consulta] of Object.entries(PAGINAS)) for (const l of IDIOMAS) {
    await vaciar()
    await abrir(`${consulta}&lang=${l}`)
    const lang = await js(`return document.documentElement.lang`)
    if (lang !== l) f.push(`${pag} ?lang=${l}: <html lang="${lang}">`)
    ref[pag][l] = await js(TEXTOS)
    for (const [k, v] of Object.entries(ref[pag][l])) {
      if (/\{\w+\}|undefined|NaN|\[object/.test(v)) f.push(`${pag} ${l}: ${k} = «${v.slice(0, 60)}»`)
      if (/^(demo|cab|hero|faq|meta)\.[\w.-]+$/.test(v)) f.push(`${pag} ${l}: sale la clave «${v}»`)
    }
  }
  return f
})

await prueba('Idiomas: en ca y en no se queda nada en castellano', async () => {
  const f = []
  for (const pag of Object.keys(PAGINAS)) for (const l of ['ca', 'en']) {
    const es = ref[pag].es, otro = ref[pag][l]
    if (!es || !otro) { f.push(`${pag}: sin textos de referencia`); continue }
    if (Object.keys(es).length < 20) f.push(`${pag}: solo ${Object.keys(es).length} textos`)
    for (const [k, v] of Object.entries(es)) {
      if (!(k in otro)) f.push(`${pag} ${l}: falta ${k}`)
      else if (otro[k] === v && !IGUALES.has(v) && !/^\d+ de \d+$/.test(v)) f.push(`${pag} ${l}: ${k} sigue en castellano: «${v.slice(0, 60)}»`)
    }
  }
  return f.slice(0, 20)
})

for (const [lista, esperado] of [['en-GB,en', 'en'], ['en-US,en', 'en'], ['ca-ES,ca', 'ca'], ['es-ES,es', 'es'], ['fr-FR,fr', 'es'], ['de-DE,de', 'es']]) {
  await prueba(`Navegador en ${lista.split(',')[0]}: landing y demo en ${esperado}`, async () => {
    const f = []
    await idiomaNavegador(lista)
    await pantalla(390, 844)
    for (const [pag, consulta] of Object.entries(PAGINAS)) {
      await vaciar()
      await abrir(consulta)
      const d = await js(`return { lang: document.documentElement.lang, nav: navigator.languages.join(','), oculto: document.documentElement.classList.contains('i18n-cargando') }`)
      if (d.nav !== lista) f.push(`${pag}: navigator.languages = ${d.nav}`)
      if (d.lang !== esperado) f.push(`${pag}: <html lang="${d.lang}">`)
      if (d.oculto) f.push(`${pag}: la página sigue escondida`)
      f.push(...distintos(await js(TEXTOS), ref[pag][esperado], pag))
    }
    return f
  })
}

await prueba('Selector: cambia sin recargar, se recuerda al recargar y se lleva a la demo (y de vuelta)', async () => {
  const f = []
  await idiomaNavegador('es-ES,es')
  await pantalla(390, 844)
  await vaciar()
  await abrir(PAGINAS.landing)
  await js(`window.__sinRecargar = 1; document.querySelector('[data-idioma-boton]').click()`)
  await esperar(200)
  if (!(await js(`return !document.querySelector('#menu-idioma').hidden`))) f.push('el menú no se abre')
  await js(`document.querySelector('[data-idioma-opcion="en"]').click()`)
  await esperar(700)
  let d = await js(`return { sigue: window.__sinRecargar === 1, lang: document.documentElement.lang, guardado: localStorage.getItem('jf-idioma-web'),
    codigo: document.querySelector('[data-idioma-codigo]').textContent, marcado: document.querySelector('[aria-checked="true"]')?.dataset.idiomaOpcion,
    cerrado: document.querySelector('#menu-idioma').hidden }`)
  if (!d.sigue) f.push('ha recargado la página')
  if (d.lang !== 'en' || d.guardado !== 'en' || d.codigo !== 'EN' || d.marcado !== 'en') f.push(`al elegir English: ${JSON.stringify(d)}`)
  if (!d.cerrado) f.push('el menú no se cierra')
  f.push(...distintos(await js(TEXTOS), ref.landing.en, 'landing en (sin recargar)'))
  // Al recargar, se queda.
  await cargada(() => cdp.enviar('Page.reload'))
  if ((await js(`return document.documentElement.lang`)) !== 'en') f.push('al recargar vuelve al castellano')
  f.push(...distintos(await js(TEXTOS), ref.landing.en, 'landing en (recargada)'))
  // «Ver la demo» lleva a la demo en inglés.
  await cargada(() => js(`document.querySelector('a.boton-demo').click()`))
  if (!/\/Demo/.test(await js(`return location.pathname`))) f.push('«Ver la demo» no lleva a la demo')
  if ((await js(`return document.documentElement.lang`)) !== 'en') f.push('la demo no sale en inglés')
  // En la demo se cambia a catalán sin recargar, y «Tornar a la pàgina» lo lleva de vuelta.
  await js(`window.__sinRecargar = 1; document.querySelector('[data-idioma-boton]').click()`)
  await esperar(200)
  await js(`document.querySelector('[data-idioma-opcion="ca"]').click()`)
  await esperar(700)
  d = await js(`return { sigue: window.__sinRecargar === 1, lang: document.documentElement.lang, n: document.querySelector('[data-n]').textContent }`)
  if (!d.sigue || d.lang !== 'ca') f.push(`demo al elegir Català: ${JSON.stringify(d)}`)
  if (!/^\d+ de \d+$/.test(d.n)) f.push(`demo en catalán: «${d.n}»`)
  await cargada(() => js(`document.querySelector('.d-volver').click()`))
  if ((await js(`return document.documentElement.lang`)) !== 'ca') f.push('al volver, la landing no sale en catalán')
  f.push(...distintos(await js(TEXTOS), ref.landing.ca, 'landing ca (de vuelta)'))
  return f
})

await prueba('?lang=ca manda sobre lo guardado y el navegador, y los enlaces lo llevan', async () => {
  const f = []
  await idiomaNavegador('en-US,en')
  await pantalla(390, 844)
  await vaciar()
  await abrir(PAGINAS.landing)
  await js(`localStorage.setItem('jf-idioma-web', 'en')`)
  await abrir(`${PAGINAS.landing}&lang=ca`)
  if ((await js(`return document.documentElement.lang`)) !== 'ca') f.push('?lang=ca no sale en catalán')
  f.push(...distintos(await js(TEXTOS), ref.landing.ca, 'landing ?lang=ca'))
  const hrefs = await js(`return [...document.querySelectorAll('a.boton-demo')].map(a => a.getAttribute('href'))`)
  if (!hrefs.length || !hrefs.every(h => h === 'Demo?lang=ca')) f.push(`«Ver la demo» lleva a ${JSON.stringify(hrefs)}`)
  await abrir('Demo.html?plataforma=android&lang=ca')
  if ((await js(`return document.documentElement.lang`)) !== 'ca') f.push('la demo con ?lang=ca no sale en catalán')
  const volver = await js(`return document.querySelector('.d-volver').getAttribute('href')`)
  if (volver !== './?lang=ca') f.push(`«Tornar a la pàgina» lleva a ${volver}`)
  // Un ?lang= que no existe no cuenta: manda lo guardado (inglés).
  await abrir(`${PAGINAS.landing}&lang=fr`)
  if ((await js(`return document.documentElement.lang`)) !== 'en') f.push('con ?lang=fr no se queda con lo guardado')
  await idiomaNavegador('es-ES,es')
  return f
})

// Al cargar en catalán o inglés no se ve ni un instante en castellano: el <head> esconde la página hasta poner el
// diccionario. Se apunta, en cada fotograma desde el principio, si la página se ve y si hay texto en castellano; y
// también si se ve nada más aparecer el <body> (eso no depende de lo que tarde en llegar el diccionario).
const FOTOGRAMAS = `(() => {
  const marcas = []
  window.__pintados = marcas
  const alEmpezar = new MutationObserver(() => {
    if (!document.body) return
    alEmpezar.disconnect()
    window.__alEmpezar = { lang: document.documentElement.lang, ve: getComputedStyle(document.body).visibility !== 'hidden' }
  })
  alEmpezar.observe(document, { childList: true, subtree: true })
  const castellano = /Menos pensar|Ir al contenido|Descargar la app gratis|Lo que te puedes preguntar|Volver a la página|Así funciona JowyFit|Espacio para pausar|Paso anterior/
  let vistos = 0
  const mirar = () => {
    const b = document.body
    if (b) {
      const ve = getComputedStyle(b).visibility !== 'hidden'
      if (ve) vistos++
      marcas.push({ lang: document.documentElement.lang, ve, castellano: ve && castellano.test(b.innerText) })
    }
    if (vistos < 20 && marcas.length < 600) requestAnimationFrame(mirar)
  }
  requestAnimationFrame(mirar)
})()`
await prueba('Sin parpadeo: en ca y en, el primer pintado ya sale traducido y con su <html lang>', async () => {
  const f = []
  await idiomaNavegador('es-ES,es')
  await pantalla(390, 844)
  const { identifier } = await cdp.enviar('Page.addScriptToEvaluateOnNewDocument', { source: FOTOGRAMAS })
  try {
    for (const [pag, consulta] of Object.entries(PAGINAS)) for (const [l, como] of [['ca', 'lang'], ['en', 'lang'], ['en', 'navegador'], ['ca', 'guardado']]) {
      await vaciar()
      if (como === 'navegador') await idiomaNavegador('en-US,en')
      if (como === 'guardado') { await abrir(consulta); await js(`localStorage.setItem('jf-idioma-web', '${l}')`) }
      await abrir(como === 'lang' ? `${consulta}&lang=${l}` : consulta)
      await esperar(400)
      await idiomaNavegador('es-ES,es')
      const m = await js(`return window.__pintados ?? []`)
      const inicio = await js(`return window.__alEmpezar ?? null`)
      const nombre = `${pag} ${l} (${como})`
      if (!m.length || !inicio) { f.push(`${nombre}: no se ha podido mirar`); continue }
      if (inicio.ve) f.push(`${nombre}: la página no se esconde mientras llegan los textos`)
      if (inicio.lang !== l) f.push(`${nombre}: al aparecer el <body>, <html lang="${inicio.lang}">`)
      if (m[0].lang !== l) f.push(`${nombre}: al empezar <html lang="${m[0].lang}">`)
      if (!m.some(x => x.ve)) f.push(`${nombre}: la página no llega a verse`)
      const malo = m.findIndex(x => x.castellano)
      if (malo >= 0) f.push(`${nombre}: en el fotograma ${malo + 1} se ve texto en castellano`)
    }
    // En castellano no se esconde nada.
    await vaciar()
    await abrir(PAGINAS.landing)
    const inicio = await js(`return window.__alEmpezar ?? null`)
    if (!inicio?.ve || inicio.lang !== 'es') f.push(`en castellano la página empieza escondida o sin lang="es": ${JSON.stringify(inicio)}`)
  } finally {
    await cdp.enviar('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    await idiomaNavegador('es-ES,es')
  }
  return f
})

/** ¿La cabecera cabe en una línea? Sus enlaces y botones, en la misma fila, sin partir su texto y dentro de la pantalla. */
const CABECERA = sel => `
  const vw = document.documentElement.clientWidth
  const ver = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 }
  const cab = document.querySelector(${JSON.stringify(sel)})
  const cosas = [...cab.querySelectorAll('a, button')].filter(el => ver(el) && !el.closest('[role="menu"]'))
  const f = []
  const rs = cosas.map(el => el.getBoundingClientRect())
  if (Math.max(...rs.map(r => r.top)) >= Math.min(...rs.map(r => r.bottom))) f.push('la cabecera ocupa dos filas')
  cosas.forEach((el, k) => {
    const nombre = (el.textContent || el.getAttribute('aria-label') || el.tagName).replace(/\\s+/g, ' ').trim()
    if (rs[k].right > vw + 1 || rs[k].left < -1) f.push('se sale de la cabecera: «' + nombre + '»')
    const lineas = []
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.data.trim()) continue
      const r = document.createRange(); r.selectNodeContents(n)
      for (const x of r.getClientRects()) if (x.width > 1 && !lineas.some(y => Math.abs(y - x.bottom) < 6)) lineas.push(x.bottom)
    }
    if (lineas.length > 1) f.push('«' + nombre + '» ocupa ' + lineas.length + ' líneas')
  })
  return f`

/** Los siete días de «Tu plan» (los que se ven: en el móvil, los de la primera historia), en una sola fila. */
const DIAS = `
  const ds = [...document.querySelectorAll('[data-plan] .plan-dias button')].filter(b => b.getBoundingClientRect().width > 0).map(d => d.getBoundingClientRect().top)
  return ds.length === 7 && Math.max(...ds) - Math.min(...ds) < 2 ? [] : ['los días de «Tu plan» no caben en una fila (' + ds.length + ')']`

for (const l of IDIOMAS) {
  await prueba(`${l} a 360 y 390 px: nada se sale de la landing ni de la demo y las cabeceras caben en una línea`, async () => {
    const f = []
    await idiomaNavegador('es-ES,es')
    for (const ancho of [360, 390]) {
      await pantalla(ancho, 780)
      for (const plat of ['otro', 'apple']) {
        await vaciar()
        await abrir(`?plataforma=${plat}&lang=${l}`)
        f.push(...(await js(CABECERA('.cab'))).map(x => `landing ${plat} ${ancho}: ${x}`))
        await js(`document.querySelectorAll('details').forEach(d => { d.open = true }); document.querySelectorAll('[data-dentro-app]').forEach(e => { e.hidden = false })`)
        await recorrer()
        f.push(...(await js(FUERA)).map(x => `landing ${plat} ${ancho}: ${x}`))
        f.push(...(await js(DIAS)).map(x => `landing ${plat} ${ancho}: ${x}`))
        // Con «Letra grande» (la usan sobre todo las personas mayores), igual.
        if (ancho === 360) {
          await js(`document.documentElement.dataset.letra = 'grande'`)
          await esperar(200)
          f.push(...(await js(CABECERA('.cab'))).map(x => `landing ${plat} ${ancho} letra grande: ${x}`))
          f.push(...(await js(FUERA)).map(x => `landing ${plat} ${ancho} letra grande: ${x}`))
          f.push(...(await js(DIAS)).map(x => `landing ${plat} ${ancho} letra grande: ${x}`))
        }
      }
      for (const plat of ['android', 'apple']) {
        await abrir(`Demo.html?plataforma=${plat}&lang=${l}`)
        await esperar(500)
        f.push(...(await js(CABECERA('.d-cab'))).map(x => `demo ${plat} ${ancho}: ${x}`))
        f.push(...(await js(FUERA)).map(x => `demo ${plat} ${ancho}: ${x}`))
      }
    }
    return f
  })
}

for (const l of IDIOMAS) {
  await prueba(`Demo en el móvil (${l}): la tarjeta nunca tapa lo señalado y nada se sale${l === 'es' ? ', a 360 px' : ', a 360 y 390 px'}`, async () => {
    const fallos = []
    await idiomaNavegador('es-ES,es')
    // A 390 px con los altos de la prueba de siempre (el castellano ya pasa por ella) y a 360 px, un móvil pequeño.
    const tamanos = l === 'es' ? [[360, 'apple', 640], [360, 'android', 740]] : [[390, 'apple', 664], [390, 'android', 860], [360, 'apple', 640], [360, 'android', 740]]
    for (const [ancho, plat, alto] of tamanos) {
      await pantalla(ancho, alto)
      await abrir(`Demo.html?plataforma=${plat}&lang=${l}`)
      await esperar(600)
      await tecla(' ')
      const total = (await js(DEMO)).barras
      for (let k = 0; k < total; k++) {
        // Se mira con el paso ya quieto: cuando se enciende el recuadro.
        let d = await js(DEMO)
        for (let i = 0; i < 15 && !d.foco; i++) { await esperar(100); d = await js(DEMO) }
        await esperar(150)
        d = await js(DEMO)
        if (!d.foco) fallos.push(`${plat} ${ancho}: sin recuadro en «${d.titulo}»`)
        if (d.tapa) fallos.push(`${plat} ${ancho}: la tarjeta tapa «${d.titulo}»`)
        if (d.ancho > ancho || d.alto > alto + 1) fallos.push(`${plat} ${ancho}: se sale (${d.ancho}×${d.alto}) en «${d.titulo}»`)
        await tecla('ArrowRight')
        await esperar(150)
      }
    }
    return fallos
  })
}
await idiomaNavegador('es-ES,es')

const bien = resultados.filter(r => !r.fallos.length).length
const mal = resultados.length - bien
console.log(`\n${bien} bien, ${mal} mal`)
await nav.cerrar()
await new Promise(r => servidor.httpServer.close(r))
process.exit(mal ? 1 : 0)
