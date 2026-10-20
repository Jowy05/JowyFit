// Ayudantes de las pruebas de iPhone (WebKit): reloj simulado, imitaciones de lo que el motor de pruebas no trae
// (sonido, menú Compartir, pantalla encendida, app instalada) y los pasos de siempre (alta, entreno…).
// Reutiliza el ayudante de la página de las pruebas de Edge (scripts/e2e/pagina.mjs): __t.pulsar, __t.ver…
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test as base, expect, type Page } from '@playwright/test'

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CAPTURAS = path.join(RAIZ, '.cache', 'iphone')
const { AYUDANTE } = (await import(pathToFileURL(path.join(RAIZ, 'scripts', 'e2e', 'pagina.mjs')).href)) as { AYUDANTE: string }

/**
 * Reloj simulado: como el de scripts/e2e/pagina.mjs (sessionStorage.__e2e_fecha = milisegundos de diferencia),
 * pero leyendo la diferencia en cada llamada: así se puede adelantar el reloj sin recargar (fin del descanso).
 */
const RELOJ_VIVO = `(() => {
  const R = Date
  const off = () => { try { return Number(sessionStorage.getItem('__e2e_fecha')) || 0 } catch { return 0 } }
  class D extends R {
    constructor(...a) { if (!a.length) super(R.now() + off()); else super(...a) }
    static now() { return R.now() + off() }
  }
  D.__real = () => R.now()
  globalThis.Date = D
})();`

export type ModoCompartir = 'ok' | 'sin-gesto-una-vez' | 'ninguno'
type Imitar = { instalada: boolean; compartir: ModoCompartir }

/** Lo que el WebKit de las pruebas no trae (o no deja ver) y un iPhone sí: se imita y se apunta lo que pide la app. */
function imitarIPhone({ instalada, compartir }: Imitar) {
  type Registro = { wl: string[]; wlSueltos: number; audio: { creados: number; resumes: number; osc: number }; compartido: { nombre: string; tipo: string; b64: string } | null; vibrar: number }
  const jf: Registro = { wl: [], wlSueltos: 0, audio: { creados: 0, resumes: 0, osc: 0 }, compartido: null, vibrar: 0 }
  ;(window as unknown as { __jf: Registro }).__jf = jf
  // Abierta desde la pantalla de inicio.
  if (instalada) Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true })
  // Pantalla encendida.
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: async (tipo: string) => { jf.wl.push(tipo); return { released: false, type: tipo, addEventListener() {}, release: async () => { jf.wlSueltos++ } } } },
  })
  // Sonido: el WebKit de Windows no trae AudioContext; uno de mentira que cuenta lo que se le pide.
  class Nodo { connect(n: unknown) { return n } }
  class AudioFalso {
    state = 'suspended'
    currentTime = 0
    destination = new Nodo()
    constructor() { jf.audio.creados++ }
    async resume() { jf.audio.resumes++; this.state = 'running' }
    createBuffer() { return {} }
    createBufferSource() { return Object.assign(new Nodo(), { buffer: null, start() {} }) }
    createOscillator() { jf.audio.osc++; return Object.assign(new Nodo(), { type: 'sine', frequency: { value: 0 }, start() {}, stop() {} }) }
    createGain() { return Object.assign(new Nodo(), { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }) }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioFalso })
  // iPhone no tiene vibración.
  Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined })
  // Menú Compartir con archivos.
  if (compartir === 'ninguno') {
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined })
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined })
  } else {
    let fallos = compartir === 'sin-gesto-una-vez' ? 1 : 0
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: (d: ShareData) => !!d && Array.isArray(d.files) })
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (d: ShareData) => {
        if (fallos-- > 0) throw new DOMException('Hace falta un toque', 'NotAllowedError')
        const f = d.files![0]!
        const b = new Uint8Array(await f.arrayBuffer())
        let s = ''
        for (const x of b) s += String.fromCharCode(x)
        jf.compartido = { nombre: f.name, tipo: f.type, b64: btoa(s) }
      },
    })
  }
}

// Productos de prueba de Open Food Facts (no se consulta internet).
const OFF: Record<string, unknown> = {
  '8480000123458': { status: 1, product: { product_name: 'Arroz al curry con pollo', brands: 'Hacendado', serving_quantity: 360, nutriments: { 'energy-kcal_100g': 167, proteins_100g: 6.1, carbohydrates_100g: 23, fat_100g: 5 } } },
}

type Arg = string | number | RegExp
export class Jf {
  constructor(readonly page: Page) {}
  /** Llama al ayudante de la página (window.__t). */
  t(metodo: string, ...a: Arg[]): Promise<unknown> {
    const args = a.map(x => (x instanceof RegExp ? { re: x.source, f: x.flags } : x))
    return this.page.evaluate(([m, xs]) => {
      const v = (xs as unknown[]).map(x => { const r = x as { re?: string; f?: string } | null; return r && typeof r === 'object' && typeof r.re === 'string' ? new RegExp(r.re, r.f) : x })
      const t = (window as unknown as { __t: Record<string, (...a: unknown[]) => Promise<unknown>> }).__t
      return t[m as string]!(...v)
    }, [metodo, args] as const)
  }
  pulsar = (texto: string | RegExp, donde?: string) => this.t('pulsar', texto, ...(donde ? [donde] : []))
  ver = (texto: string | RegExp, ms = 6000) => this.t('ver', texto, ms)
  noVer = (texto: string | RegExp) => this.t('noVer', texto)
  hay = async (texto: string | RegExp) => (await this.t('hay', texto)) as boolean
  pulsarSel = (sel: string) => this.t('pulsarSel', sel)
  escribir = (sel: string, valor: string) => this.t('escribir', sel, valor)
  elegir = (sel: string, valor: string | number) => this.t('elegir', sel, valor)
  listo = () => this.t('listo')
  async revisar(donde: string) {
    const fallo = (await this.t('revisar')) as string
    expect(fallo, donde).toBe('')
  }
  js<T>(codigo: string): Promise<T> {
    return this.page.evaluate(c => new Function(`return (async () => { ${c} })()`)(), codigo) as Promise<T>
  }
  registro<T = { wl: string[]; wlSueltos: number; audio: { creados: number; resumes: number; osc: number }; compartido: { nombre: string; tipo: string; b64: string } | null }>(): Promise<T> {
    return this.page.evaluate(() => (window as unknown as { __jf: unknown }).__jf) as Promise<T>
  }

  /** Abre la app (o la ruta dada) de cero a una fecha y hora. */
  async deCero(fechaHora: string, ruta = 'app.html', esperar: RegExp | string | null = /JOWYFIT|Buenos|Buenas|Hoy te toca/i) {
    // La fecha se pone antes de abrir la app (en una página sencilla del mismo sitio): recargar con la app a medio
    // cargar cortaba la descarga del catálogo y salía como error.
    await this.page.goto('privacypolicy.html')
    await this.page.evaluate(f => sessionStorage.setItem('__e2e_fecha', String(new Date(f).getTime() - (Date as unknown as { __real: () => number }).__real())), fechaHora)
    await this.page.goto(ruta)
    if (esperar) await this.ver(esperar, 15000)
  }
  /** Cambia el día (como si pasara el tiempo) y recarga, sin borrar nada. */
  async irA(fechaHora: string) {
    await this.page.evaluate(f => sessionStorage.setItem('__e2e_fecha', String(new Date(f).getTime() - (Date as unknown as { __real: () => number }).__real())), fechaHora)
    await this.page.reload()
    await this.ver(/Buenos|Buenas|Hoy te toca|Inicio/i, 15000)
  }
  /** Adelanta el reloj de la página sin recargar. */
  async adelantar(ms: number) {
    await this.page.evaluate(d => sessionStorage.setItem('__e2e_fecha', String((Number(sessionStorage.getItem('__e2e_fecha')) || 0) + d)), ms)
  }
  /** Cierra la hoja abierta tocando el fondo oscuro de arriba (como se haría con el dedo). */
  async cerrarHoja() {
    await this.page.locator('.backdrop').tap({ position: { x: 195, y: 10 } })
    await expect(this.page.locator('.sheet')).toHaveCount(0)
  }
  async pestana(n: string) { await this.pulsar(new RegExp(`^${n}$`, 'i'), '.tabbar'); await this.listo() }
  async seg(n: string) { await this.pulsar(n, '.seg'); await this.listo() }
  async volver() {
    await this.js(`const b = [...document.querySelectorAll('button[aria-label]')].filter(b => /^(Volver|Atrás)$/.test(b.getAttribute('aria-label')) && b.getBoundingClientRect().width > 0).pop(); if (!b) throw new Error('No hay botón de volver'); b.click(); await new Promise(r => setTimeout(r, 300))`)
  }
  tabla<T = Record<string, unknown>>(nombre: string): Promise<T[]> {
    return this.js(`return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => { const g = q.result.transaction('${nombre}').objectStore('${nombre}').getAll(); g.onsuccess = () => ok(g.result); g.onerror = mal } })`)
  }
  meter(nombre: string, filas: unknown[]) {
    return this.js(`const filas = ${JSON.stringify(filas)}; return await new Promise((ok, mal) => { const q = indexedDB.open('jowyfit'); q.onerror = mal; q.onsuccess = () => { const tx = q.result.transaction('${nombre}', 'readwrite'); for (const f of filas) tx.objectStore('${nombre}').put(f); tx.oncomplete = () => ok(filas.length); tx.onerror = mal } })`)
  }

  /** Alta completa: martes, jueves y viernes a las 5:30 con el sábado de extra. */
  async alta(nombre = 'Joel') {
    await this.pulsar('Empezar')
    await this.elegir('select[aria-label="Día de nacimiento"]', 20)
    await this.elegir('select[aria-label="Mes de nacimiento"]', 5)
    await this.elegir('select[aria-label="Año de nacimiento"]', 1990)
    await this.pulsar('Hombre')
    await this.escribir('input[aria-label="Altura en centímetros"]', '175')
    await this.escribir('input[aria-label="Peso en kilos"]', '75')
    for (let i = 0; i < 12 && !(await this.hay(/Creando tu rutina|Tu rutina está lista/)); i++) {
      await this.t('nombreSiHace', nombre)
      if (await this.js<boolean>(`return !!document.querySelector('select[aria-label="Hora de entreno"]')`)) {
        for (const d of ['martes', 'jueves', 'viernes']) await this.pulsarSel(`[aria-label="${d}"]`)
        await this.elegir('select[aria-label="Hora de entreno"]', '05:30')
        await this.pulsarSel('[aria-label="Extra el sábado"]')
      }
      await this.pulsar('Siguiente')
    }
    await this.ver('Tu rutina está lista', 20000)
    await this.pulsar('Ir a Inicio')
    await this.ver(/Hoy te toca|descansas|no entrenaste|Próximo/, 8000)
  }
  /** En la primera sesión el peso puede empezar vacío: sube el contador hasta tener un peso. */
  async ponerPesoSiFalta() {
    await this.js(`const g = [...document.querySelectorAll('.stp')].find(x => /peso/i.test(x.getAttribute('aria-label') || '') || /kg/i.test(x.closest('div')?.previousElementSibling?.textContent || ''))
      const v = g?.querySelector('.val')?.textContent || ''
      if (g && (v.includes('—') || v.includes('?') || v.trim() === '')) for (let i = 0; i < 8; i++) g.querySelector('button[aria-label="Más"]')?.click()`)
  }
  /** Ruta del archivo de pruebas guardado en disco (para el selector de archivos). */
  archivo(nombre: string, bytes: Buffer) {
    const dir = path.join(RAIZ, '.cache', 'e2e-webkit-archivos')
    fs.mkdirSync(dir, { recursive: true })
    const f = path.join(dir, nombre)
    fs.writeFileSync(f, bytes)
    return f
  }
}

type Fixtures = { instalada: boolean; compartir: ModoCompartir; jf: Jf }

export const test = base.extend<Fixtures>({
  instalada: [true, { option: true }],
  compartir: ['ok', { option: true }],
  // Un perfil de navegador de verdad para cada prueba: el contexto normal de las pruebas es como el modo privado de
  // Safari, que no deja guardar fotos (Blob) en la base de datos. La app instalada en el iPhone no es privada.
  context: async ({ playwright, userAgent, viewport, isMobile, hasTouch, locale, timezoneId, deviceScaleFactor, baseURL, serviceWorkers }, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jowyfit-webkit-'))
    const ctx = await playwright.webkit.launchPersistentContext(dir, { userAgent, viewport, isMobile, hasTouch, locale, timezoneId, deviceScaleFactor, baseURL, serviceWorkers, acceptDownloads: true })
    await use(ctx)
    await ctx.close()
    fs.rmSync(dir, { recursive: true, force: true })
  },
  page: async ({ context, instalada, compartir }, use) => {
    const page = context.pages()[0] ?? await context.newPage()
    const errores: string[] = []
    page.on('pageerror', e => errores.push(`excepción: ${e.message}`))
    page.on('console', m => { if (m.type() === 'error' && !/openfoodfacts|favicon|Failed to load resource/i.test(m.text())) errores.push(`console.error: ${m.text()}`) })
    await page.addInitScript(RELOJ_VIVO + AYUDANTE)
    await page.addInitScript(imitarIPhone, { instalada, compartir })
    await page.route(/openfoodfacts\.org\/api\/v2\/product\//, async r => {
      const codigo = r.request().url().match(/product\/(\d+)/)?.[1] ?? ''
      const json = OFF[codigo]
      await r.fulfill({ status: json ? 200 : 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(json ?? { status: 0 }) })
    })
    await use(page)
    expect(errores, 'errores en la página').toEqual([])
  },
  jf: async ({ page }, use) => { await use(new Jf(page)) },
})

export { expect }

/** Palabras de Android que nunca deben verse en un iPhone. */
export const DE_ANDROID = /Android|Health Connect|Google Play|alarmas? exactas?|Documentos\/JowyFit|Notificaciones|Recordatorios|Vibrar al acabar|Copia sola cada semana/
