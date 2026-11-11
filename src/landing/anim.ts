// Movimiento de la landing: la taquilla del escaparate (la puerta se abre al bajar y la pantalla de dentro cambia con
// cada función), el revelado al hacer scroll, el aviso «Descarga empezada» y la barra fija del móvil.
// Sin librerías. Con «reducir movimiento» no se mueve nada solo, y sin JS todo se ve igual (el CSS por defecto es el
// estado final: la puerta abierta y todo visible).
import { t } from './i18n'

const menosMovimiento = matchMedia('(prefers-reduced-motion: reduce)')
const reduce = () => menosMovimiento.matches
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)]

/** Llama a fn una sola vez cuando cada elemento entra en pantalla. */
function alVer(els: Element[], umbral: number, fn: (el: HTMLElement) => void, margen = '0px') {
  if (!els.length) return
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); fn(e.target as HTMLElement) }
  }, { threshold: umbral, rootMargin: margen })
  els.forEach(el => io.observe(el))
}

function revelar() {
  const els = $$('[data-revelar]')
  const alto = innerHeight
  // Lo que ya está a la vista (p. ej. al llegar con #instalar) se marca ya, sin parpadeo.
  const ya = els.filter(el => el.getBoundingClientRect().top < alto * 0.92)
  ya.forEach(el => el.classList.add('visto'))
  const pendientes = new Set(els.filter(el => !ya.includes(el)))
  // Al saltar (un ancla, «Ir arriba»…) también se marca lo que haya quedado por encima sin verse.
  const barrer = () => { for (const el of pendientes) if (el.getBoundingClientRect().top < alto) { el.classList.add('visto'); pendientes.delete(el) } }
  alVer([...pendientes], 0.15, el => { el.classList.add('visto'); pendientes.delete(el); barrer() }, '0px 0px -8% 0px')
}

/** La taquilla del escaparate. Al cargar se entreabre; en el ordenador, la puerta se abre del todo según se baja
 *  y la pantalla de dentro (y el número de la placa) es la de la función que se está leyendo. */
function taquilla() {
  const tq = $('[data-taquilla]')
  if (!tq) return
  const placas = $$('[data-tq-placa]', tq)
  const paradas = $$('[data-parada]')
  const ordenador = matchMedia('(min-width: 900px)')
  const ENTREABIERTA = 0.7

  const ver = (k: number) => {
    if (tq.dataset.ver === String(k)) return
    tq.dataset.ver = String(k)
    for (const p of placas) {
      p.textContent = String(k + 1).padStart(2, '0')
      // La placa gira al cambiar de número, como una ficha que se da la vuelta.
      if (!reduce()) p.animate([{ transform: 'rotateX(90deg)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.65, 0, .35, 1)' })
    }
  }
  const hace = $('#hace')

  // Lo que se abre la puerta: entreabierta arriba del todo; abierta del todo al llegar a la primera función.
  let pendiente = false
  const abrir = () => {
    pendiente = false
    if (!ordenador.matches) { tq.style.setProperty('--abre', '0.84'); tq.classList.remove('cerrada-candado'); return }
    // Al acabar las funciones, la puerta se cierra y sale el candado: llega «Tus datos se quedan en tu móvil».
    const resto = hace ? hace.getBoundingClientRect().bottom - innerHeight : Infinity
    const cierre = Math.min(1, Math.max(0, 1 - resto / (innerHeight * 0.45)))
    tq.classList.toggle('cerrada-candado', cierre > 0.92)
    if (reduce()) { tq.style.setProperty('--abre', cierre > 0.5 ? '0' : '1'); return }
    const p = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.7)))
    const abierta = ENTREABIERTA + (1 - ENTREABIERTA) * p
    tq.style.setProperty('--abre', (abierta * (1 - cierre)).toFixed(3))
  }
  addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(abrir) } }, { passive: true })
  ordenador.addEventListener('change', abrir)
  menosMovimiento.addEventListener('change', abrir)

  // Primero cerrada; un instante después se entreabre (la transición larga) y luego sigue al scroll (la corta).
  tq.style.setProperty('--abre', ordenador.matches ? String(reduce() ? 1 : ENTREABIERTA) : '0.84')
  requestAnimationFrame(() => {
    tq.classList.add('lista')
    abrir()
    setTimeout(() => tq.classList.add('siguiendo'), 950)
  })

  // La función que cruza el centro de la pantalla manda en lo que se ve dentro.
  // En el móvil cada función lleva su propia pantalla y la taquilla grande se queda con la primera.
  const io = new IntersectionObserver(es => {
    if (!ordenador.matches) { ver(0); return }
    for (const e of es) if (e.isIntersecting) ver(Number((e.target as HTMLElement).dataset.parada))
  }, { rootMargin: '-45% 0px -45% 0px' })
  paradas.forEach(p => io.observe(p))
  ver(0)
}

/** Al tocar «Descargar»: el texto cambia un momento a «Descarga empezada» (y se dice a los lectores de pantalla). */
function descargaEmpezada() {
  const ocupados = new WeakSet<Element>()
  const aviso = $('[data-aviso-descarga]')
  for (const a of $$<HTMLAnchorElement>('[data-apk], [data-apk-barra]')) {
    a.addEventListener('click', () => {
      // No se impide nada: la descarga sigue su curso normal.
      if (ocupados.has(a) || !a.querySelector('.boton-txt')) return
      ocupados.add(a)
      a.classList.add('descargando')
      if (aviso) aviso.textContent = t('cta.empezada')
      setTimeout(() => { a.classList.remove('descargando'); ocupados.delete(a); if (aviso) aviso.textContent = '' }, 6000)
    })
  }
}

/** Barra fija con el botón (solo en el móvil): sale al pasar el botón del principio y se va al llegar al cierre. */
function barraFija() {
  const barra = $('[data-barra]')
  const cta = $('.hero-botones')
  const cierre = $('.cierre')
  if (!barra || !cta || !cierre) return
  let pasado = false, enCierre = false
  const movil = matchMedia('(max-width: 899px)')
  const pintar = () => {
    const ver = movil.matches && pasado && !enCierre
    barra.classList.toggle('ver', ver)
    barra.setAttribute('aria-hidden', String(!ver))
    for (const a of $$('a', barra)) a.tabIndex = ver ? 0 : -1
    document.documentElement.classList.toggle('con-barra', movil.matches && pasado) // el hueco no cambia al esconderla: sin saltos
  }
  new IntersectionObserver(([e]) => { if (e) { pasado = !e.isIntersecting && e.boundingClientRect.top < 0; pintar() } }).observe(cta)
  new IntersectionObserver(([e]) => { if (e) { enCierre = e.isIntersecting; pintar() } }).observe(cierre)
  movil.addEventListener('change', pintar)
}

export function arrancar() {
  descargaEmpezada()
  if (!('IntersectionObserver' in window)) return
  document.documentElement.classList.add('anim')
  revelar()
  taquilla()
  barraFija()
}
