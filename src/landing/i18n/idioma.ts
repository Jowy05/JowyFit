// Idiomas de la landing y de la demo: castellano (el original, ya escrito en el HTML), catalán e inglés.
// El <script> del <head> ya ha decidido el idioma antes de pintar y, si no es castellano, ha escondido la página
// (clase «i18n-cargando»). Aquí se cargan sus textos, se ponen en el HTML, se quita el velo y se avisa con un evento
// para que cada módulo repinte lo que escribe él. También el selector de la cabecera (ES · CA · EN).
//
// Marcado en el HTML:
//   data-i18n="clave"                       el texto del elemento (los iconos de dentro se quedan)
//   data-i18n-html="clave"                  su contenido, con etiquetas (<b>, <a>, <small>, <br>…)
//   data-i18n-attr="alt:clave;aria-label:otra"   atributos (alt, aria-label, title, content…)

export type Idioma = 'es' | 'ca' | 'en'
/** Cada idioma con su nombre en su propio idioma (no se traducen). */
export const NOMBRES: Record<Idioma, string> = { es: 'Español', ca: 'Català', en: 'English' }
const LOCALE: Record<Idioma, string> = { es: 'es-ES', ca: 'ca-ES', en: 'en-US' }
const OG: Record<Idioma, string> = { es: 'es_ES', ca: 'ca_ES', en: 'en_US' }
const GUARDADO = 'jf-idioma-web'
const EVENTO = 'jf-idioma'
const raiz = document.documentElement

const esIdioma = (x: unknown): x is Idioma => x === 'es' || x === 'ca' || x === 'en'
const deLaDireccion = (): string | null => { try { return new URLSearchParams(location.search).get('lang') } catch { return null } }

/** El mismo orden que el script del <head>: ?lang= → el que eligió la persona → el del navegador → castellano. */
export function detectar(): Idioma {
  const q = deLaDireccion()
  if (esIdioma(q)) return q
  let g: string | null = null
  try { g = localStorage.getItem(GUARDADO) } catch { /* sin almacenamiento */ }
  if (esIdioma(g)) return g
  const lista = navigator.languages?.length ? navigator.languages : [navigator.language ?? '']
  for (const x of lista) { const c = String(x ?? '').toLowerCase().slice(0, 2); if (esIdioma(c)) return c }
  return 'es'
}

// ---------------------------------------------------------------- poner los textos en el HTML
/** Espacios que tenía el original delante y detrás (separan el texto de un icono o de la palabra de al lado). */
const bordes = new WeakMap<Node, [string, string]>()
function rodear(n: Node, original: string, valor: string) {
  let b = bordes.get(n)
  if (!b) {
    b = original.trim() ? [/^\s*/.exec(original)![0], /\s*$/.exec(original)![0]] : ['', '']
    bordes.set(n, b)
  }
  return b[0] + valor + b[1]
}
/** El trozo de texto de cada elemento con data-i18n (el primero con letras): los iconos de al lado no se tocan. */
const trozo = new WeakMap<Element, Text>()
function ponerTexto(el: Element, valor: string) {
  let n = trozo.get(el)
  if (!n) {
    const textos = [...el.childNodes].filter((x): x is Text => x.nodeType === Node.TEXT_NODE && !!(x as Text).data.trim())
    n = textos[0] ?? el.appendChild(document.createTextNode(''))
    for (const x of textos.slice(1)) x.remove()
    trozo.set(el, n)
  }
  const nuevo = rodear(n, n.data, valor)
  if (n.data !== nuevo) n.data = nuevo
}
function ponerHtml(el: Element, valor: string) {
  const nuevo = rodear(el, el.innerHTML, valor)
  if (el.innerHTML !== nuevo) el.innerHTML = nuevo
}
function aplicar(dic: Record<string, string>) {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = dic[el.getAttribute('data-i18n') ?? '']
    if (v !== undefined) ponerTexto(el, v)
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    const v = dic[el.getAttribute('data-i18n-html') ?? '']
    if (v !== undefined) ponerHtml(el, v)
  }
  for (const el of document.querySelectorAll('[data-i18n-attr]')) {
    for (const par of (el.getAttribute('data-i18n-attr') ?? '').split(';')) {
      const [atributo, clave] = par.split(':').map(s => s.trim())
      const v = clave ? dic[clave] : undefined
      if (atributo && v !== undefined) el.setAttribute(atributo, v)
    }
  }
}

// ---------------------------------------------------------------- enlaces entre la landing y la demo
// Lo elegido ya se guarda (localStorage, el mismo sitio). Si el idioma llega en la dirección (?lang=), los enlaces
// a la demo y de vuelta a la landing lo llevan también, para no perderlo por el camino.
const enlaces = new Map<HTMLAnchorElement, string>()
function pintarEnlaces() {
  const q = deLaDireccion()
  for (const [a, original] of enlaces) {
    if (!esIdioma(q)) { a.setAttribute('href', original); continue }
    const [ruta = '', ancla] = original.split('#')
    a.setAttribute('href', `${ruta}${ruta.includes('?') ? '&' : '?'}lang=${q}${ancla !== undefined ? '#' + ancla : ''}`)
  }
}

// ---------------------------------------------------------------- selector de la cabecera
type Selector = { boton: HTMLButtonElement; codigo: HTMLElement | null; opciones: HTMLButtonElement[] }
function montarSelector(caja: HTMLElement, elegir: (l: Idioma) => void): Selector | null {
  const boton = caja.querySelector<HTMLButtonElement>('[data-idioma-boton]')
  const menu = caja.querySelector<HTMLElement>('[role="menu"]')
  if (!boton || !menu) return null
  const opciones = [...menu.querySelectorAll<HTMLButtonElement>('[data-idioma-opcion]')]
  const abierto = () => !menu.hidden
  const abrir = (donde: 'actual' | 'ultima' = 'actual') => {
    menu.hidden = false
    boton.setAttribute('aria-expanded', 'true')
    const k = donde === 'ultima' ? opciones.length - 1 : opciones.findIndex(o => o.getAttribute('aria-checked') === 'true')
    opciones[Math.max(0, k)]?.focus()
  }
  const cerrar = (devolverFoco: boolean) => {
    if (!abierto()) return
    menu.hidden = true
    boton.setAttribute('aria-expanded', 'false')
    if (devolverFoco) boton.focus()
  }
  boton.addEventListener('click', () => (abierto() ? cerrar(false) : abrir()))
  boton.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(e.key === 'ArrowUp' ? 'ultima' : 'actual') }
    else if (e.key === 'Escape') cerrar(true)
    // La demo usa el teclado (espacio para pausar, flechas): aquí no le llega.
    if (e.key !== 'Tab') e.stopPropagation()
  })
  menu.addEventListener('keydown', e => {
    const k = opciones.indexOf(document.activeElement as HTMLButtonElement)
    const ir = (n: number) => { e.preventDefault(); opciones[(n + opciones.length) % opciones.length]?.focus() }
    if (e.key === 'ArrowDown') ir(k + 1)
    else if (e.key === 'ArrowUp') ir(k - 1)
    else if (e.key === 'Home') ir(0)
    else if (e.key === 'End') ir(opciones.length - 1)
    else if (e.key === 'Escape') { e.preventDefault(); cerrar(true) }
    else if (e.key === 'Tab') cerrar(false)
    if (e.key !== 'Tab') e.stopPropagation()
  })
  for (const o of opciones) {
    o.addEventListener('click', () => {
      const l = o.dataset.idiomaOpcion
      cerrar(true)
      if (esIdioma(l)) elegir(l)
    })
  }
  // Se cierra al tocar fuera o al pasar el foco a otra parte.
  document.addEventListener('pointerdown', e => { if (abierto() && !caja.contains(e.target as Node)) cerrar(false) })
  document.addEventListener('focusin', e => { if (abierto() && !caja.contains(e.target as Node)) cerrar(false) })
  return { boton, codigo: caja.querySelector('[data-idioma-codigo]'), opciones }
}

// ---------------------------------------------------------------- textos de una página
type Cargador<D> = () => Promise<{ default: Record<keyof D, string> }>

/**
 * Los textos de una página (landing o demo): el castellano va dentro; el catalán y el inglés se cargan al pedirlos.
 * El diccionario lleva siempre «idioma.boton» (la etiqueta del selector, con {nombre}).
 */
export function crearTextos<D extends Record<string, string> & { 'idioma.boton': string }>(es: D, cargar: Record<'ca' | 'en', Cargador<D>>) {
  let idioma: Idioma = 'es'
  let dic: Record<keyof D, string> = es
  let turno = 0
  const selectores: Selector[] = []

  /** El texto de una clave en el idioma actual; {nombre} se cambia por datos.nombre. */
  function t(clave: keyof D & string, datos?: Record<string, string | number>): string {
    const s = dic[clave] ?? es[clave] ?? clave
    return datos ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in datos ? String(datos[k]) : m)) : s
  }

  function pintarSelectores() {
    for (const s of selectores) {
      if (s.codigo) s.codigo.textContent = idioma.toUpperCase()
      s.boton.setAttribute('aria-label', t('idioma.boton', { codigo: idioma.toUpperCase(), nombre: NOMBRES[idioma] }))
      for (const o of s.opciones) o.setAttribute('aria-checked', String(o.dataset.idiomaOpcion === idioma))
    }
  }

  /** Pone un idioma: carga sus textos, los aplica y avisa. «primera»: al arrancar, con el HTML aún en castellano. */
  async function poner(l: Idioma, primera = false) {
    const yo = ++turno
    let nuevo: Record<keyof D, string> = es
    if (l !== 'es') {
      try { nuevo = (await cargar[l]()).default } catch (e) {
        // Sin sus textos (p. ej. sin conexión), la página se queda como estaba.
        console.warn('Idioma:', e)
        if (yo === turno && primera) { raiz.setAttribute('lang', idioma); raiz.classList.remove('i18n-cargando') }
        return
      }
    }
    if (yo !== turno) return
    idioma = l
    dic = nuevo
    raiz.setAttribute('lang', l)
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', OG[l])
    if (!(primera && l === 'es')) aplicar(dic)
    pintarSelectores()
    pintarEnlaces()
    raiz.classList.remove('i18n-cargando')
    if (!(primera && l === 'es')) document.dispatchEvent(new CustomEvent(EVENTO, { detail: l }))
  }

  /** Lo que elige la persona en el selector: se guarda y se aplica sin recargar. */
  function elegir(l: Idioma) {
    try { localStorage.setItem(GUARDADO, l) } catch { /* sin almacenamiento: solo ahora */ }
    // Si venía en la dirección (?lang=), se cambia ahí también: si no, al recargar volvería el de antes.
    if (deLaDireccion() !== null) {
      try {
        const u = new URL(location.href)
        u.searchParams.set('lang', l)
        history.replaceState(history.state, '', u)
      } catch { /* se queda como está */ }
    }
    if (l !== idioma) void poner(l)
  }

  return {
    t,
    /** El idioma que se ve ahora. */
    idioma: () => idioma,
    /** Para Intl (fechas y números): es-ES, ca-ES o en-US. */
    locale: () => LOCALE[idioma],
    /** Llama a fn cada vez que cambian los textos (después de ponerlos en el HTML). */
    alCambiar(fn: (l: Idioma) => void) { document.addEventListener(EVENTO, () => fn(idioma)) },
    /** Arranque: selector, enlaces y el idioma detectado (el mismo que ya decidió el <head>). */
    iniciar() {
      for (const caja of document.querySelectorAll<HTMLElement>('[data-idioma-selector]')) {
        const s = montarSelector(caja, elegir)
        if (s) selectores.push(s)
      }
      for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href="Demo"], a[href="./"], a[href^="?"]')) enlaces.set(a, a.getAttribute('href') ?? '')
      return poner(detectar(), true)
    },
  }
}
