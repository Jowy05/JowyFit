// Landing de JowyFit (index.html). Página ligera, sin React: el enrutador de index.html ya ha decidido
// si se queda aquí y ha marcado <html data-plataforma="apple|otro"> para el botón.
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import '@fontsource/barlow-semi-condensed/latin-800.css'
import './landing.css'
// La versión sale de package.json (MAYOR.MENOR.PARCHE): nunca se escribe a mano en la página.
import { version } from '../../package.json'
import { arrancar } from './anim'
import { APK } from './apk'

const raiz = document.documentElement

/** «Letra grande»: la misma preferencia que la app (localStorage «jf-letra»). */
function letra() {
  const boton = document.querySelector<HTMLButtonElement>('[data-letra-boton]')
  if (!boton) return
  const pintar = () => boton.setAttribute('aria-pressed', String(raiz.dataset.letra === 'grande'))
  pintar()
  boton.addEventListener('click', () => {
    const grande = raiz.dataset.letra !== 'grande'
    if (grande) raiz.dataset.letra = 'grande'; else delete raiz.dataset.letra
    try { localStorage.setItem('jf-letra', grande ? 'grande' : 'normal') } catch { /* sin almacenamiento: solo ahora */ }
    pintar()
  })
}

/** Línea bajo el botón: «Para Android 8 o superior · 27 MB · actualizada el 20 de octubre de 2026 · Novedades».
 *  El tamaño y la fecha salen de apk.ts, y solo si son de la versión de package.json (MAYOR.MENOR.PARCHE). */
function lineaVersion() {
  const datos = ['Para Android 8 o superior']
  if (APK.version === version) {
    datos.push(`${Math.max(1, Math.round(APK.bytes / 1e6))} MB`)
    const fecha = new Date(`${APK.fecha}T12:00:00`)
    if (!Number.isNaN(fecha.getTime())) datos.push('actualizada el ' + new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(fecha))
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-version]')) {
    el.textContent = datos.join(' · ') + ' · '
    const a = document.createElement('a')
    a.href = '#novedades'
    a.dataset.abrir = 'd-novedades'
    a.textContent = 'Novedades'
    el.append(a)
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-version-corta]')) el.textContent = `Versión ${version}`
}

/** En iPhone, dentro del navegador de otra app (Instagram, Facebook…), no se puede añadir a la pantalla de inicio. */
function dentroDeOtraApp() {
  const aviso = document.querySelector<HTMLElement>('[data-dentro-app]')
  if (!aviso || raiz.dataset.plataforma !== 'apple') return
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|LinkedInApp|Snapchat|TikTok|musical_ly|GSA\//.test(navigator.userAgent)) aviso.hidden = false
}

/** En un ordenador (fuera de Apple) se explica que el APK es para el móvil. */
function notaOrdenador() {
  const nota = document.querySelector<HTMLElement>('[data-solo-pc]')
  if (!nota || raiz.dataset.plataforma !== 'otro') return
  const android = /Android/i.test(navigator.userAgent)
  if (!android && matchMedia('(pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches) nota.hidden = false
}

/** Los desplegables se abren al llegar con su ancla (#android, #segura, #novedades…) o al tocar su enlace. */
function preguntas() {
  const abrir = (id: string | null) => {
    const d = id ? document.getElementById(id) : null
    if (d instanceof HTMLDetailsElement && getComputedStyle(d).display !== 'none') d.open = true
  }
  const porAncla = () => {
    const h = decodeURIComponent(location.hash.slice(1))
    if (h === 'instalar') abrir(raiz.dataset.plataforma === 'apple' ? 'd-iphone' : 'd-android')
    else if (h) abrir(document.getElementById(h)?.closest('details')?.id ?? null)
  }
  porAncla()
  addEventListener('hashchange', porAncla)
  document.addEventListener('click', e => {
    const a = (e.target as Element | null)?.closest<HTMLElement>('[data-abrir]')
    if (a) abrir(a.dataset.abrir ?? null)
  })
}

letra()
lineaVersion()
notaOrdenador()
dentroDeOtraApp()
preguntas()
arrancar()
