// Demo de JowyFit (/Demo): capturas reales de la app dentro de un móvil, un recuadro que señala de qué se habla
// y una tarjeta que lo cuenta. Avanza sola (un minuto en Android), con pausa, atrás y siguiente (también con el
// teclado). Reglas de los recorridos guiados: el foco se apaga mientras cambia la pantalla y se enciende ya quieto.
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import './demo.css'
import { ALTO, ANCHO, cajaDe, duracion, guion, type Caja, type Plataforma, type PasoDemo } from './guion'
import { t, textos } from './i18n'

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!
const raiz = document.documentElement
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches

/** iPhone, iPad o Safari de Mac (como la app); se puede forzar con ?plataforma=apple|android. */
function plataformaInicial(): Plataforma {
  const q = new URLSearchParams(location.search).get('plataforma')
  if (q === 'apple' || q === 'android') return q
  const ua = navigator.userAgent
  const apple = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    || (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua))
  return apple ? 'apple' : 'android'
}

let plat: Plataforma = plataformaInicial()
let pasos: PasoDemo[] = guion(plat)
let i = 0
let jugando = true
let restante = 0
let inicio = 0
let reloj = 0
let capa = 0
/** Cada cambio de paso tiene su turno: lo que llega tarde de un paso anterior (foco, fundido) no cuenta. */
let turno = 0

const imgs = [...document.querySelectorAll<HTMLImageElement>('.d-cap')]
const foco = $('[data-foco]')
const barras = $('[data-barras]')
const tarjeta = $('[data-tarjeta]')
const final = $('[data-final]')
const botonPlay = $<HTMLButtonElement>('[data-play]')
const pantalla = $('.d-pantalla')
const cab = $('.d-cab')
/** En el móvil la captura ocupa toda la pantalla (como la app de verdad) y la tarjeta va encima o debajo. */
const enMovil = matchMedia('(max-width: 640px)')

/**
 * Móvil: la captura, a lo ancho; se sube o se baja para que lo señalado quede en el hueco que deja la tarjeta,
 * y la tarjeta va abajo o arriba (donde tape menos).
 */
function colocarMovil(c: Caja | null) {
  if (!enMovil.matches) { pantalla.removeAttribute('style'); delete tarjeta.dataset.donde; return }
  const vw = window.innerWidth, vh = window.innerHeight
  const s = vw / ANCHO, hi = ALTO * s
  const arriba = cab.getBoundingClientRect().bottom
  raiz.style.setProperty('--cab', `${arriba}px`)
  const hT = tarjeta.offsetHeight, M = 12
  pantalla.style.width = `${vw}px`
  pantalla.style.height = `${hi}px`
  let donde = 'abajo', oy = arriba
  if (c) {
    const f0 = (c[1] - 6) * s, f1 = (c[1] + c[3] + 6) * s
    const prueba = (a: number, b: number) => {
      // La captura no baja de la cabecera ni deja hueco abajo (si es más alta que la pantalla).
      const o = Math.min(arriba, Math.max(Math.min(arriba, vh - hi), (a + b) / 2 - (f0 + f1) / 2))
      return { o, fuera: Math.max(0, a - (f0 + o)) + Math.max(0, f1 + o - b) }
    }
    const ab = prueba(arriba + M, vh - hT - M * 2)
    const ar = prueba(arriba + hT + M * 2, vh - M)
    if (ar.fuera < ab.fuera) { donde = 'arriba'; oy = ar.o } else oy = ab.o
  }
  pantalla.style.transform = `translateY(${Math.round(oy)}px)`
  tarjeta.dataset.donde = donde
}

const src = (p: Plataforma, cap: string) => `demo/${p}/${cap}.webp`

/** Precarga las capturas de una plataforma (para que el cambio sea inmediato). */
function precargar(p: Plataforma) {
  for (const cap of new Set(guion(p).map(x => x.cap))) { const im = new Image(); im.src = src(p, cap) }
}

function pintarBarras() {
  barras.replaceChildren(...pasos.map((x, k) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'd-barra'
    b.setAttribute('aria-label', t('demo.control.barra', { n: k + 1, titulo: t(x.titulo) }))
    b.append(document.createElement('i'))
    b.addEventListener('click', () => ir(k))
    return b
  }))
}

function pintarPlataforma() {
  raiz.dataset.plataforma = plat
  const otro = document.querySelector('[data-cambiar]')
  if (otro) otro.textContent = t(plat === 'apple' ? 'demo.cambiar.android' : 'demo.cambiar.iphone')
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-plat]')) b.setAttribute('aria-selected', String(b.dataset.plat === plat))
}

/** Los textos del paso actual en la tarjeta (también al cambiar de idioma). */
function pintarPaso() {
  const paso = pasos[i]!
  $('[data-capitulo]').textContent = t(paso.capitulo)
  $('[data-n]').textContent = t('demo.control.n', { n: i + 1, total: pasos.length })
  $('[data-titulo]').textContent = t(paso.titulo)
  $('[data-texto]').textContent = t(paso.texto)
}

/** Pone el paso k: cambia la captura (fundido), apaga el foco, lo mueve y lo vuelve a encender. */
function ir(k: number) {
  window.clearTimeout(reloj)
  const yo = ++turno
  final.hidden = true
  tarjeta.hidden = false
  i = Math.max(0, Math.min(pasos.length - 1, k))
  const paso = pasos[i]!
  const nueva = src(plat, paso.cap)
  foco.classList.remove('visible')
  pintarPaso()
  const actual = imgs[capa]!
  const cambiar = !actual.src.endsWith(nueva)
  const ponerFoco = () => {
    if (yo !== turno) return
    const c = cajaDe(plat, paso)
    colocarMovil(c)
    if (!c) return
    const m = 6
    foco.style.left = `${((c[0] - m) / ANCHO) * 100}%`
    foco.style.top = `${((c[1] - m) / ALTO) * 100}%`
    foco.style.width = `${((c[2] + m * 2) / ANCHO) * 100}%`
    foco.style.height = `${((c[3] + m * 2) / ALTO) * 100}%`
    // En el móvil la captura se mueve: el foco se enciende cuando ya está quieta.
    window.setTimeout(() => requestAnimationFrame(() => { if (yo === turno) foco.classList.add('visible') }), enMovil.matches && !reducido ? 380 : 0)
  }
  if (cambiar) {
    capa = 1 - capa
    const otra = imgs[capa]!
    const listo = () => {
      if (yo !== turno) return
      for (const im of imgs) im.classList.toggle('ver', im === otra)
      window.setTimeout(ponerFoco, reducido ? 0 : 260)
    }
    otra.src = nueva
    if (otra.complete) listo(); else otra.onload = listo
  } else window.setTimeout(ponerFoco, reducido ? 0 : 140)

  const bs = [...barras.children] as HTMLElement[]
  bs.forEach((b, k) => {
    b.classList.toggle('hecha', k < i)
    b.classList.toggle('actual', k === i)
    b.removeAttribute('aria-current')
    const r = b.firstElementChild as HTMLElement
    r.style.animation = 'none'
  })
  bs[i]?.setAttribute('aria-current', 'step')
  restante = duracion(t(paso.titulo), t(paso.texto))
  const relleno = bs[i]?.firstElementChild as HTMLElement | undefined
  if (relleno) {
    void relleno.offsetWidth
    relleno.style.animation = `d-llenar ${restante}ms linear forwards`
    relleno.style.animationPlayState = jugando ? 'running' : 'paused'
  }
  if (jugando) programar()
}

function programar() {
  inicio = performance.now()
  reloj = window.setTimeout(() => (i + 1 < pasos.length ? ir(i + 1) : terminar()), restante)
}

function terminar() {
  window.clearTimeout(reloj)
  foco.classList.remove('visible')
  tarjeta.hidden = true
  final.hidden = false
  ponerJugando(false, true)
  ;(final.querySelector('.d-cta:not([hidden])') as HTMLElement | null)?.focus({ preventScroll: true })
}

function pintarPlay() {
  const txt = t(jugando ? 'demo.control.pausar' : 'demo.control.seguir')
  botonPlay.setAttribute('aria-label', txt)
  $('[data-play-txt]').textContent = txt
}

function ponerJugando(si: boolean, alFinal = false) {
  jugando = si
  botonPlay.dataset.estado = si ? 'jugando' : 'pausa'
  pintarPlay()
  const relleno = barras.children[i]?.firstElementChild as HTMLElement | undefined
  if (alFinal) return
  if (si) { if (relleno) relleno.style.animationPlayState = 'running'; programar() }
  else {
    window.clearTimeout(reloj)
    restante = Math.max(400, restante - (performance.now() - inicio))
    if (relleno) relleno.style.animationPlayState = 'paused'
  }
}

function cambiarPlataforma(p: Plataforma) {
  if (p === plat) return
  plat = p
  pasos = guion(plat)
  pintarPlataforma()
  pintarBarras()
  precargar(plat)
  ponerJugando(true, true)
  ir(0)
}

// ---------------------------------------------------------------- arranque
// Idioma: el selector y los textos. Al cambiar, se repinta lo que escribe el JS sin parar ni reiniciar el paso.
textos.alCambiar(() => {
  pintarPaso()
  pintarPlataforma()
  pintarPlay()
  ;[...barras.children].forEach((b, k) => { const x = pasos[k]; if (x) b.setAttribute('aria-label', t('demo.control.barra', { n: k + 1, titulo: t(x.titulo) })) })
  if (final.hidden) colocarMovil(cajaDe(plat, pasos[i]!))
})
textos.iniciar().catch(e => console.error('Demo:', e))
pintarPlataforma()
pintarBarras()
precargar(plat)
ponerJugando(jugando, true)
ir(0)

botonPlay.addEventListener('click', () => ponerJugando(!jugando))
$('[data-atras]').addEventListener('click', () => ir(i - 1))
$('[data-sigue]').addEventListener('click', () => (i + 1 < pasos.length ? ir(i + 1) : terminar()))
$('[data-otra]').addEventListener('click', () => { ponerJugando(true, true); ir(0) })
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-plat]')) b.addEventListener('click', () => cambiarPlataforma(b.dataset.plat as Plataforma))
document.querySelector('[data-cambiar]')?.addEventListener('click', () => cambiarPlataforma(plat === 'apple' ? 'android' : 'apple'))
// Al girar el móvil o cambiar el tamaño, se recoloca el paso actual.
let recolocar = 0
window.addEventListener('resize', () => { window.clearTimeout(recolocar); recolocar = window.setTimeout(() => { if (final.hidden) colocarMovil(cajaDe(plat, pasos[i]!)) }, 150) })
enMovil.addEventListener('change', () => colocarMovil(final.hidden ? cajaDe(plat, pasos[i]!) : null))

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select')) return
  if (e.key === ' ' && !final.hidden) return
  if (e.key === ' ') { e.preventDefault(); ponerJugando(!jugando) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); if (i + 1 < pasos.length) ir(i + 1); else terminar() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1) }
})
// Con la pestaña escondida no avanza (si no, al volver se habría perdido la mitad).
document.addEventListener('visibilitychange', () => { if (document.hidden && jugando) ponerJugando(false) })
