// Movimiento ligero de la landing Obsidian Press: revelado suave, aviso «Descarga empezada» y barra fija móvil.
// Sin librerías. Con «reducir movimiento» todo se ve ya al 100 % sin moverse nada solo.
import { t } from './i18n'

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)]

function revelar() {
  const els = $$('[data-revelar]')
  if (!els.length) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => el.classList.add('visto'))
    return
  }
  const alto = innerHeight
  const ya = els.filter(el => el.getBoundingClientRect().top < alto * 0.94)
  ya.forEach(el => el.classList.add('visto'))
  const pendientes = new Set(els.filter(el => !ya.includes(el)))
  if (!pendientes.size) return
  const io = new IntersectionObserver(es => {
    for (const e of es) {
      if (e.isIntersecting) {
        io.unobserve(e.target)
        e.target.classList.add('visto')
        pendientes.delete(e.target as HTMLElement)
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  pendientes.forEach(el => io.observe(el))
}

/** Al tocar «Descargar»: el texto cambia un momento a «Descarga empezada» (y se anuncia a lectores de pantalla). */
function descargaEmpezada() {
  const ocupados = new WeakSet<Element>()
  const aviso = $('[data-aviso-descarga]')
  for (const a of $$<HTMLAnchorElement>('[data-apk], [data-apk-barra]')) {
    a.addEventListener('click', () => {
      if (ocupados.has(a) || !a.querySelector('.boton-txt')) return
      ocupados.add(a)
      a.classList.add('descargando')
      if (aviso) aviso.textContent = t('cta.empezada')
      setTimeout(() => {
        a.classList.remove('descargando')
        ocupados.delete(a)
        if (aviso) aviso.textContent = ''
      }, 6000)
    })
  }
}

/** Barra fija con el botón (solo en el móvil): aparece tras pasar el hero y desaparece al llegar al cierre. */
function barraFija() {
  const barra = $('[data-barra]')
  const cta = $('.hero-botones')
  const cierre = $('.cierre')
  if (!barra || !cta || !cierre) return
  let pasado = false
  let enCierre = false
  const movil = matchMedia('(max-width: 899px)')
  const pintar = () => {
    const ver = movil.matches && pasado && !enCierre
    barra.classList.toggle('ver', ver)
    barra.setAttribute('aria-hidden', String(!ver))
    for (const a of $$('a', barra)) a.tabIndex = ver ? 0 : -1
    document.documentElement.classList.toggle('con-barra', movil.matches && pasado)
  }
  new IntersectionObserver(([e]) => {
    if (e) { pasado = !e.isIntersecting && e.boundingClientRect.top < 0; pintar() }
  }).observe(cta)
  new IntersectionObserver(([e]) => {
    if (e) { enCierre = e.isIntersecting; pintar() }
  }).observe(cierre)
  movil.addEventListener('change', pintar)
}

export function arrancar() {
  descargaEmpezada()
  if (!('IntersectionObserver' in window)) return
  document.documentElement.classList.add('anim')
  revelar()
  barraFija()
}
