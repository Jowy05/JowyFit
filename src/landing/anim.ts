// Movimiento de la landing: revelado al hacer scroll, contadores, la maqueta del hero (capturas reales que se
// encadenan), el aviso «Descarga empezada» al tocar «Descargar» y la barra fija del móvil. Sin librerías; solo transform y opacity.
// Con «reducir movimiento» no se mueve nada solo, y sin JS todo se ve igual (el CSS por defecto es el estado final).
import { t, textos, type Clave } from './i18n'

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)]
const plataforma = () => document.documentElement.dataset.plataforma

/** Llama a fn una sola vez cuando cada elemento entra en pantalla. */
function alVer(els: Element[], umbral: number, fn: (el: HTMLElement) => void, margen = '0px') {
  if (!els.length) return
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); fn(e.target as HTMLElement) }
  }, { threshold: umbral, rootMargin: margen })
  els.forEach(el => io.observe(el))
}

function revelar() {
  const els = $$('[data-revelar], .pasos li')
  const alto = innerHeight
  // Lo que ya está a la vista (p. ej. al llegar con #instalar) se marca ya, sin parpadeo.
  const ya = els.filter(el => el.getBoundingClientRect().top < alto * 0.92)
  ya.forEach(el => el.classList.add('visto'))
  const pendientes = new Set(els.filter(el => !ya.includes(el)))
  // Al saltar (un ancla, «Ir arriba»…) también se marca lo que haya quedado por encima sin verse.
  const barrer = () => { for (const el of pendientes) if (el.getBoundingClientRect().top < alto) { el.classList.add('visto'); pendientes.delete(el) } }
  alVer([...pendientes], 0.15, el => { el.classList.add('visto'); pendientes.delete(el); barrer() }, '0px 0px -8% 0px')
}

/** Una cifra con su texto en el idioma de la página: «Más de 600» (data-contar-clave) o solo el número. */
function cifra(el: HTMLElement, n: number) {
  const num = new Intl.NumberFormat(textos.locale()).format(n)
  const clave = el.dataset.contarClave as Clave | undefined
  return clave ? t(clave, { n: num }) : num
}
const contando = new WeakSet<Element>()
/** Al cambiar de idioma, cada cifra con su texto nuevo (las que se están contando ya lo cogen solas). */
function cifrasEnSuIdioma() {
  textos.alCambiar(() => { for (const el of $$('[data-contar]')) if (!contando.has(el)) el.textContent = cifra(el, Number(el.dataset.contar)) })
}

/** Contadores de datos reales («Más de 600», «2», «3»): de 0 al valor final, una vez. */
function contadores() {
  if (reduce) return
  const els = $$('[data-contar]')
  alVer(els, 0.6, el => {
    const fin = Number(el.dataset.contar)
    const dur = fin > 50 ? 1200 : 600
    const t0 = performance.now() + els.indexOf(el) * 120
    el.style.minWidth = el.offsetWidth + 'px'
    contando.add(el)
    const paso = (ahora: number) => {
      const x = Math.min(1, Math.max(0, (ahora - t0) / dur))
      const p = 1 - (1 - x) ** 3
      el.textContent = cifra(el, Math.round(fin * p))
      if (x < 1) requestAnimationFrame(paso)
      else {
        contando.delete(el)
        el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'cubic-bezier(.34,1.56,.64,1)' })
      }
    }
    el.textContent = cifra(el, 0)
    requestAnimationFrame(paso)
  })
}

// ---------- Maqueta del hero: Hoy te toca → serie → «Hecho» → descanso → aviso (Android) ----------
const L = 10000
const o = (ms: number) => ms / L
const MAT = 'cubic-bezier(.4,0,.2,1)' // sin cola larga: la pantalla que entra no se queda a un dedo de llegar
const SAL = 'cubic-bezier(.16,1,.3,1)', EST = 'cubic-bezier(.2,.8,.2,1)', ENT = 'cubic-bezier(.4,0,1,1)', REB = 'cubic-bezier(.34,1.56,.64,1)'
type Pista = [string, Keyframe[]]
const toque = (desde: number): Keyframe[] => [
  { offset: 0, opacity: 0, transform: 'scale(1)' },
  { offset: o(desde), opacity: 0, transform: 'scale(1.3)' },
  { offset: o(desde + 150), opacity: 1, transform: 'scale(1)' },
  { offset: o(desde + 300), opacity: 1, transform: 'scale(.78)', easing: REB },
  { offset: o(desde + 450), opacity: 1, transform: 'scale(1)' },
  { offset: o(desde + 650), opacity: 0, transform: 'scale(1)' },
  { offset: 1, opacity: 0, transform: 'scale(1)' },
]
// La pantalla nueva entra por la derecha y tapa a la de debajo, que no se mueve (así nunca asoman letras cortadas);
// al final de cada vuelta sale por la derecha, como al volver atrás. Nunca hay dos capturas a medio fundir.
const PISTAS: Pista[] = [
  ['.c-serie', [
    { offset: 0, opacity: 1, transform: 'translateX(102%)' },
    { offset: o(1500), opacity: 1, transform: 'translateX(102%)', easing: MAT },
    { offset: o(1850), opacity: 1, transform: 'none' },
    { offset: o(9300), opacity: 1, transform: 'none', easing: MAT },
    { offset: o(9700), opacity: 1, transform: 'translateX(102%)' },
    { offset: 1, opacity: 1, transform: 'translateX(102%)' },
  ]],
  // El panel del descanso sube desde abajo (en las dos capturas empieza a la mitad de la altura) y se va con la serie.
  ['.c-desc', [
    { offset: 0, opacity: 1, transform: 'none', clipPath: 'inset(100% 0 0 0)' },
    { offset: o(3050), opacity: 1, transform: 'none', clipPath: 'inset(100% 0 0 0)', easing: SAL },
    { offset: o(3450), opacity: 1, transform: 'none', clipPath: 'inset(49.9% 0 0 0)' },
    { offset: o(9300), opacity: 1, transform: 'none', clipPath: 'inset(49.9% 0 0 0)', easing: MAT },
    { offset: o(9700), opacity: 1, transform: 'translateX(102%)', clipPath: 'inset(49.9% 0 0 0)' },
    { offset: o(9701), opacity: 1, transform: 'none', clipPath: 'inset(100% 0 0 0)' },
    { offset: 1, opacity: 1, transform: 'none', clipPath: 'inset(100% 0 0 0)' },
  ]],
  ['.dedo-1', toque(650)],
  ['.dedo-2', toque(2450)],
  // La hora del móvil y la del reloj van juntas: 5:20 en «Hoy te toca» y 5:34 ya entrenando.
  ['.hora-a', [{ offset: 0, opacity: 1 }, { offset: o(1700), opacity: 1 }, { offset: o(1850), opacity: 0 }, { offset: o(9300), opacity: 0 }, { offset: o(9450), opacity: 1 }, { offset: 1, opacity: 1 }]],
  ['.hora-b', [{ offset: 0, opacity: 0 }, { offset: o(1700), opacity: 0 }, { offset: o(1850), opacity: 1 }, { offset: o(9300), opacity: 1 }, { offset: o(9450), opacity: 0 }, { offset: 1, opacity: 0 }]],
]
/** Tramos en movimiento: si se pausa en medio de uno, se salta a su final para que la imagen quieta tenga sentido. */
const TRAMOS: [number, number][] = [[1500, 1850], [3050, 3450], [6000, 6350], [8600, 8900], [9300, 9700]]
// Solo fuera de Apple: el aviso de fin de descanso y el reloj (en iPhone no existen).
const PISTAS_ANDROID: Pista[] = [
  ['.aviso', [
    { offset: 0, opacity: 0, transform: 'translateY(-150%)' },
    { offset: o(6000), opacity: 0, transform: 'translateY(-150%)', easing: EST },
    { offset: o(6350), opacity: 1, transform: 'none' },
    { offset: o(8600), opacity: 1, transform: 'none', easing: ENT },
    { offset: o(8900), opacity: 0, transform: 'translateY(-150%)' },
    { offset: 1, opacity: 0, transform: 'translateY(-150%)' },
  ]],
  ['.hero-visual .reloj-cara', [
    { offset: 0, transform: 'none' }, { offset: o(6100), transform: 'none' },
    { offset: o(6170), transform: 'rotate(-5deg)' }, { offset: o(6240), transform: 'rotate(5deg)' },
    { offset: o(6310), transform: 'rotate(-4deg)' }, { offset: o(6380), transform: 'rotate(4deg)' },
    { offset: o(6450), transform: 'none' }, { offset: 1, transform: 'none' },
  ]],
  ['.hero-visual .reloj-aviso', [{ offset: 0, opacity: 0 }, { offset: o(6100), opacity: 0 }, { offset: o(6250), opacity: 1 }, { offset: o(8700), opacity: 1 }, { offset: o(9000), opacity: 0 }, { offset: 1, opacity: 0 }]],
  ['.hero-visual .reloj-hora', [{ offset: 0, opacity: 1 }, { offset: o(6100), opacity: 1 }, { offset: o(6250), opacity: 0 }, { offset: o(8700), opacity: 0 }, { offset: o(9000), opacity: 1 }, { offset: 1, opacity: 1 }]],
]

function maquetaHero() {
  const maqueta = $('[data-maqueta]')
  const visual = maqueta?.closest<HTMLElement>('.hero-visual')
  const boton = $<HTMLButtonElement>('[data-control]')
  const txt = $('[data-control-txt]')
  if (!maqueta || !visual || !boton || !txt || !('animate' in Element.prototype)) return
  let anims: Animation[] = []
  let estado: 'inicio' | 'jugando' | 'pausa' | 'fin' = 'inicio'
  let visible = true
  const pintar = (e: typeof estado) => {
    estado = e
    boton.dataset.estado = e
    txt.textContent = t(({ inicio: 'anim.ver', jugando: 'anim.pausar', pausa: 'anim.seguir', fin: 'anim.otra' } as const)[e])
  }
  textos.alCambiar(() => pintar(estado))
  const crear = (vueltas: number) => {
    anims.forEach(a => a.cancel())
    const pistas = plataforma() === 'apple' ? PISTAS : [...PISTAS, ...PISTAS_ANDROID]
    anims = pistas.flatMap(([sel, k]) => $$(sel, visual).map(el => el.animate(k, { duration: L, iterations: vueltas, fill: 'both' })))
    anims[0]?.finished.then(() => {
      anims.forEach(a => a.cancel()) // vuelve al CSS por defecto: «Hoy te toca»
      anims = []
      pintar('fin')
    }).catch(() => { /* cancelada */ })
    pintar('jugando')
    if (!visible || document.hidden) { anims.forEach(a => a.pause()); pintar('pausa') }
  }
  const estable = () => {
    const t = Number(anims[0]?.currentTime ?? 0)
    const local = t % L
    const tramo = TRAMOS.find(([d, h]) => local > d && local < h)
    if (tramo) anims.forEach(a => { a.currentTime = t - local + tramo[1] })
  }
  boton.hidden = false
  boton.addEventListener('click', () => {
    if (estado === 'jugando') { anims.forEach(a => a.pause()); estable(); pintar('pausa') }
    else if (estado === 'pausa') { anims.forEach(a => a.play()); pintar('jugando') }
    else crear(reduce ? 1 : 3)
  })
  // Solo se mueve a la vista y con la pestaña delante.
  new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting
    if (!visible && estado === 'jugando') anims.forEach(a => a.pause())
    if (visible && estado === 'jugando') anims.forEach(a => a.play())
  }, { threshold: 0.25 }).observe(maqueta)
  document.addEventListener('visibilitychange', () => {
    if (estado !== 'jugando') return
    if (document.hidden) anims.forEach(a => a.pause()); else if (visible) anims.forEach(a => a.play())
  })
  if (reduce) { pintar('inicio'); return }
  pintar('jugando')
  // Arranca cuando las tres capturas están listas (sin saltos) y tras la entrada del hero.
  const imgs = $$<HTMLImageElement>('.capa', visual)
  imgs.forEach(i => { i.loading = 'eager' })
  const listas = Promise.all(imgs.map(i => i.decode().catch(() => undefined)))
  const espera = new Promise(r => setTimeout(r, 1200))
  Promise.all([listas, espera]).then(() => { if (estado === 'jugando' && !anims.length) crear(3) })
}

/** Al tocar «Descargar»: el texto cambia un momento a «Descarga empezada». */
function descargaEmpezada() {
  const ocupados = new WeakSet<Element>()
  for (const a of $$<HTMLAnchorElement>('[data-apk], [data-apk-barra]')) {
    a.addEventListener('click', () => {
      // No se impide nada: la descarga sigue su curso normal.
      if (ocupados.has(a) || !a.querySelector('.boton-txt')) return
      ocupados.add(a)
      a.classList.add('descargando')
      setTimeout(() => { a.classList.remove('descargando'); ocupados.delete(a) }, 6000)
    })
  }
}

/** Barra fija con el botón (solo en el móvil): sale al pasar el botón del hero y se va al llegar al cierre.
 *  Mientras bajas leyendo se esconde (para no tapar el texto) y vuelve en cuanto subes un poco. */
function barraFija() {
  const barra = $('[data-barra]')
  const cta = $('.hero-cta')
  const cierre = $('.cierre')
  if (!barra || !cta || !cierre) return
  let pasado = false, enCierre = false, bajando = false, ultimo = scrollY
  const movil = matchMedia('(max-width: 899px)')
  const pintar = () => {
    const ver = movil.matches && pasado && !enCierre && !bajando
    barra.classList.toggle('ver', ver)
    barra.setAttribute('aria-hidden', String(!ver))
    for (const a of $$('a', barra)) a.tabIndex = ver ? 0 : -1
    document.documentElement.classList.toggle('con-barra', movil.matches && pasado) // el hueco no cambia al esconderla: sin saltos
  }
  new IntersectionObserver(([e]) => { if (e) { pasado = !e.isIntersecting && e.boundingClientRect.top < 0; pintar() } }).observe(cta)
  new IntersectionObserver(([e]) => { if (e) { enCierre = e.isIntersecting; pintar() } }).observe(cierre)
  movil.addEventListener('change', pintar)
  addEventListener('scroll', () => {
    const y = scrollY
    if (Math.abs(y - ultimo) < 24) return
    const ahora = y > ultimo
    ultimo = y
    if (ahora !== bajando) { bajando = ahora; pintar() }
  }, { passive: true })
}

/** El reloj del bloque «El descanso te avisa» vibra dos veces al verse. */
function relojBloque() {
  if (reduce || plataforma() === 'apple') return
  alVer($$('[data-reloj-bloque]'), 0.45, el => {
    const k: Keyframe[] = [{ transform: 'none' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'none' }]
    const cara = $('.reloj-cara', el)
    cara?.animate(k, { duration: 350, delay: 300 })
    cara?.animate(k, { duration: 350, delay: 1250 })
  })
}

export function arrancar() {
  descargaEmpezada()
  cifrasEnSuIdioma()
  if (!('IntersectionObserver' in window)) return
  document.documentElement.classList.add('anim')
  revelar()
  contadores()
  maquetaHero()
  barraFija()
  relojBloque()
}
