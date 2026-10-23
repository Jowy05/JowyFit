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
import { planes } from './plan'
import { t, textos } from './i18n'

const raiz = document.documentElement

/** Las capturas de la app, en el idioma de la página (public/landing/capturas/<idioma>/). */
function capturas(idioma: string = textos.idioma()) {
  for (const img of document.querySelectorAll<HTMLImageElement>('img[src*="landing/capturas/"]')) {
    const src = img.getAttribute('src')!.replace(/landing\/capturas\/(es|ca|en)\//, `landing/capturas/${idioma}/`)
    if (src !== img.getAttribute('src')) img.setAttribute('src', src)
  }
}
// Lo primero: el script del <head> ya ha puesto el idioma en <html lang>. Así, en catalán o inglés no se bajan ni se
// ven las capturas en castellano mientras carga el diccionario (la maqueta del hero las pide enseguida).
if (/^(es|ca|en)$/.test(raiz.lang)) capturas(raiz.lang)

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
 *  El tamaño y la fecha salen de apk.ts, y solo si son de la versión de package.json (MAYOR.MENOR.PARCHE).
 *  La fecha, en el formato largo del idioma de la página. */
function lineaVersion() {
  const datos = [t('version.android')]
  if (APK.version === version) {
    datos.push(t('version.tamano', { mb: Math.max(1, Math.round(APK.bytes / 1e6)) }))
    const fecha = new Date(`${APK.fecha}T12:00:00`)
    if (!Number.isNaN(fecha.getTime())) datos.push(t('version.fecha', { fecha: new Intl.DateTimeFormat(textos.locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(fecha) }))
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-version]')) {
    el.textContent = datos.join(' · ') + ' · '
    const a = document.createElement('a')
    a.href = '#novedades'
    a.dataset.abrir = 'd-novedades'
    a.textContent = t('version.novedades')
    el.append(a)
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-version-corta]')) el.textContent = t('version.corta', { version })
}

/** «¿Es seguro instalarla?»: si se conoce la huella SHA-256 del APK publicado (apk.ts), se enseña para comprobarlo. */
function huella() {
  const sha = APK.version === version && /^[0-9a-f]{64}$/i.test(APK.sha256) ? APK.sha256.toLowerCase() : ''
  for (const el of document.querySelectorAll<HTMLElement>('[data-huella]')) {
    const codigo = el.querySelector<HTMLElement>('[data-huella-valor]')
    if (!sha || !codigo) { el.hidden = true; continue }
    codigo.textContent = sha
    el.hidden = false
  }
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
    // Un enlace con el ancla mal codificada («#%E0%A4%A») lanzaba un error y cortaba el arranque de la página.
    let h = location.hash.slice(1)
    try { h = decodeURIComponent(h) } catch { /* se usa tal cual */ }
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

/** Idioma: el selector y los textos (si no es castellano). Al cambiar, se repinta lo que escribe el JS: la línea de
 *  la versión, la huella (sus párrafos se acaban de rehacer con el texto nuevo) y las capturas. */
function idioma() {
  textos.alCambiar(() => { lineaVersion(); huella(); capturas() })
  textos.iniciar().catch(e => console.error('Landing:', e))
}

// Cada paso por separado: si uno falla, los demás siguen (antes un fallo dejaba la página a medio arrancar).
for (const paso of [idioma, letra, lineaVersion, notaOrdenador, dentroDeOtraApp, preguntas, planes, arrancar, huella]) {
  try { paso() } catch (e) { console.error('Landing:', e) }
}
