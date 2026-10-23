// Movimiento de la landing: revelado al hacer scroll, contadores, la hora del hero (capturas reales que se encadenan),
// las historias del móvil, el aviso «Descarga empezada» al tocar «Descargar» y la barra fija del móvil.
// Sin librerías; solo transform y opacity.
// Con «reducir movimiento» no se mueve nada solo, y sin JS todo se ve igual (el CSS por defecto es el estado final).
import { t, textos, type Clave } from './i18n'

// Se mira cada vez: si la persona lo activa con la página abierta, lo que aún no ha empezado ya no se mueve.
const menosMovimiento = matchMedia('(prefers-reduced-motion: reduce)')
const reduce = () => menosMovimiento.matches
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
  if (reduce()) return
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

// ---------- Hero (ordenador): la hora grande y el móvil avanzan juntos: 5:30 Hoy te toca → 5:31 la serie → 5:34 el descanso ----------
function maquetaHero() {
  const pantalla = $('[data-capas]')
  const boton = $<HTMLButtonElement>('[data-control]')
  const txt = $('[data-control-txt]')
  if (!pantalla || !boton || !txt) return
  const pasos = $$('.hora-grande [data-paso]')
  const ordenador = matchMedia('(min-width: 900px)')
  let paso = 0, reloj = 0, visible = true, pausada = false
  const mostrar = (k: number) => {
    paso = k
    pantalla.dataset.ver = String(k)
    for (const el of pasos) { const es = Number(el.dataset.paso) === k; el.classList.toggle('ver', es); el.classList.toggle('fuera', !es) }
  }
  const pintar = () => {
    boton.dataset.estado = pausada ? 'pausa' : 'jugando'
    txt.textContent = t(pausada ? 'anim.seguir' : 'anim.pausar')
  }
  const parar = () => { clearInterval(reloj); reloj = 0 }
  // Solo se mueve en el ordenador, a la vista, con la pestaña delante y si no se ha pausado.
  const decidir = () => {
    boton.hidden = !ordenador.matches || reduce()
    if (!ordenador.matches || reduce()) { parar(); mostrar(0); return }
    const mueve = !pausada && visible && !document.hidden
    if (mueve && !reloj) reloj = window.setInterval(() => mostrar((paso + 1) % 3), 3400)
    if (!mueve) parar()
  }
  boton.addEventListener('click', () => { pausada = !pausada; pintar(); decidir() })
  textos.alCambiar(pintar)
  new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; decidir() }, { threshold: 0.25 }).observe(pantalla)
  document.addEventListener('visibilitychange', decidir)
  ordenador.addEventListener('change', decidir)
  menosMovimiento.addEventListener('change', decidir)
  mostrar(0)
  pintar()
  decidir()
}

// ---------- Historias (móvil): segmentos de progreso, la de delante se enciende y tocar el móvil pasa a la siguiente ----------
function historias() {
  const hs = $$('.historia')
  if (!hs.length) return
  const seguir = document.getElementById('seguir')
  hs.forEach((h, i) => {
    const ol = document.createElement('ol')
    ol.className = 'h-seg'
    ol.setAttribute('aria-hidden', 'true')
    hs.forEach((_, j) => {
      const li = document.createElement('li')
      if (j < i) li.className = 'lleno'
      if (j === i) li.className = 'ahora'
      li.append(document.createElement('i'))
      ol.append(li)
    })
    $('.h-barra', h)?.prepend(ol)
    $('[data-siguiente]', h)?.addEventListener('click', () => (hs[i + 1] ?? seguir)?.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }))
  })
  // El segmento de la historia actual se llena según se baja por ella.
  let pendiente = false
  const progreso = () => {
    pendiente = false
    const vh = innerHeight
    for (const h of hs) h.style.setProperty('--p', Math.max(0, Math.min(1, (vh - h.getBoundingClientRect().top) / vh)).toFixed(3))
  }
  addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(progreso) } }, { passive: true })
  progreso()
  const io = new IntersectionObserver(es => { for (const e of es) e.target.classList.toggle('activa', e.intersectionRatio > 0.45) }, { threshold: [0, 0.45, 0.8] })
  hs.forEach(h => io.observe(h))
}

/** Los ceros de privacidad ruedan hasta 0 y el sol del cierre sube, una vez, al verse. */
function alLlegar() {
  alVer($$('[data-ceros], [data-cierre]'), 0.3, el => el.classList.add('visto'))
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

/** Barra fija con el botón (solo en el móvil): sale al pasar el botón del hero y se va al llegar al cierre.
 *  No se esconde al bajar: las historias se leen bajando y dejan su hueco abajo. */
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

/** El reloj del bloque «El descanso te avisa» vibra dos veces al verse. */
function relojBloque() {
  if (reduce() || plataforma() === 'apple') return
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
  historias()
  barraFija()
  relojBloque()
  alLlegar()
}
