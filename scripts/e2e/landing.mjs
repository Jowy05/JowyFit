// Prueba de la landing (index.html) en un navegador sin ventana, sobre la versión compilada en .cache/dist-landing.
//   npx vite build --outDir .cache/dist-landing --emptyOutDir   (o añade --build y lo hace esta prueba)
//   node scripts/e2e/landing.mjs [--build]
// Comprueba el botón según la plataforma (?plataforma=otro → APK, ?plataforma=apple → abrir la app), que no hay
// errores en la consola, que nada se sale de la pantalla a 360 px de ancho, que no se pide nada a otros sitios y que
// con «reducir movimiento» se ve todo. Sale con 0 si todo va bien y con 1 si no.
import fs from 'node:fs'
import path from 'node:path'
import { build, preview } from 'vite'
import { abrirNavegador } from './navegador.mjs'

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
  await cdp.enviar('Page.navigate', { url: BASE + consulta })
  await esperar(400)
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
async function prueba(nombre, fn) {
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

// Nada se sale de la pantalla a 360 px (con los desplegables abiertos), en las dos plataformas.
for (const plat of ['otro', 'apple']) {
  await prueba(`360 px (${plat}): nada se sale de la pantalla`, async () => {
    await pantalla(360, 740)
    await abrir(`?plataforma=${plat}`)
    await js(`document.querySelectorAll('details').forEach(d => { d.open = true }); document.querySelectorAll('[data-dentro-app]').forEach(e => { e.hidden = false })`)
    await recorrer()
    return js(`
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
      return f`)
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

const bien = resultados.filter(r => !r.fallos.length).length
const mal = resultados.length - bien
console.log(`\n${bien} bien, ${mal} mal`)
await nav.cerrar()
await new Promise(r => servidor.httpServer.close(r))
process.exit(mal ? 1 : 0)
