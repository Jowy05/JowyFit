// Idiomas de la app (castellano, catalán, inglés), al estilo gettext: la clave es el propio texto en castellano.
// El castellano va en el código y no se carga nada; el catalán y el inglés son diccionarios aparte (ca/, en/)
// que se descargan con import() antes de pintar la app. Cambiar de idioma guarda la elección y recarga la app.
// Cómo usarlo en las pantallas: docs/I18N-APP.md.
import type { Diccionario } from './tipos'

export type Idioma = 'es' | 'ca' | 'en'
export type Vars = Record<string, string | number>

/** Los idiomas del selector de Ajustes: cada nombre en su propio idioma. */
export const IDIOMAS: readonly { v: Idioma; nombre: string }[] = [
  { v: 'es', nombre: 'Español' },
  { v: 'ca', nombre: 'Català' },
  { v: 'en', nombre: 'English' },
]

const CLAVE = 'jf-idioma-app'

// Lo elegido en Ajustes; si no, castellano (no se mira el idioma del móvil). Sin localStorage (Node, pruebas): castellano.
function leer(): Idioma {
  try {
    const v = globalThis.localStorage?.getItem(CLAVE)
    return v === 'ca' || v === 'en' ? v : 'es'
  } catch { return 'es' }
}

let actual: Idioma | null = null
let dic: Diccionario = {}
let listo = false
let carga: Promise<void> | null = null

/** Idioma de la app. No cambia mientras la app está abierta (cambiarlo recarga). */
export function idioma(): Idioma {
  return (actual ??= leer())
}

/** Guarda el idioma y vuelve a abrir la app: así todo (también lo calculado al arrancar) sale en el nuevo. */
export function ponerIdioma(i: Idioma): void {
  try { localStorage.setItem(CLAVE, i) } catch { /* sin almacenamiento: no se puede recordar */ }
  location.reload()
}

/** Carga el diccionario del idioma elegido (en castellano no hay nada que cargar). Si falla, sigue en castellano. */
export function cargarIdioma(): Promise<void> {
  return (carga ??= (async () => {
    const i = idioma()
    if (typeof document !== 'undefined') document.documentElement.lang = i
    if (i === 'es') { listo = true; return }
    try {
      dic = (i === 'ca' ? await import('./ca') : await import('./en')).default
    } catch (e) {
      console.warn('JowyFit: no se pudo cargar el idioma; sigue en castellano', e)
      dic = {}
    }
    listo = true
  })())
}

/** Región para formatear números: en inglés, punto decimal y coma de miles; en catalán, como en castellano. */
export function regionNumeros(): string {
  return idioma() === 'en' ? 'en-US' : 'es-ES'
}

/** Rellena {variables}: «Faltan {n} g» + { n: 12 } → «Faltan 12 g». Lo que no está en vars se deja tal cual. */
function rellenar(texto: string, vars?: Vars): string {
  if (!vars) return texto
  return texto.replace(/\{(\w+)\}/g, (todo, k: string) => (Object.hasOwn(vars, k) ? String(vars[k]) : todo))
}

/** Traducción de una clave (o undefined si no hay: vacía también cuenta como que falta). */
function buscar(clave: string): string | undefined {
  if (!listo && import.meta.env?.DEV && idioma() !== 'es') {
    // Casi siempre es un t() en el nivel superior de un módulo: se evalúa antes de cargar el idioma.
    console.warn(`JowyFit: t() antes de cargar el idioma: «${clave}»`)
  }
  const v = Object.hasOwn(dic, clave) ? dic[clave] : undefined
  return v ? v : undefined
}

/** Texto en el idioma de la app. La clave es el castellano exacto; si falta la traducción, sale el castellano. */
export function t(texto: string, vars?: Vars): string {
  return rellenar(buscar(texto) ?? texto, vars)
}

/** Plurales: 1 → singular, lo demás → plural (igual en castellano, catalán e inglés). {n} lleva el número tal cual. */
export function tn(n: number, singular: string, plural: string, vars?: Vars): string {
  return t(n === 1 ? singular : plural, { n, ...vars })
}

/**
 * Con contexto, para cuando el mismo castellano se traduce distinto según dónde sale:
 * tc('máquina', 'Ocupado') → clave «máquina|Ocupado» en el diccionario; sin traducción, «Ocupado».
 */
export function tc(contexto: string, texto: string, vars?: Vars): string {
  return rellenar(buscar(`${contexto}|${texto}`) ?? texto, vars)
}

/**
 * Marca un texto para traducir sin traducirlo aún (el N_() de gettext): para listas y constantes del nivel
 * superior de un módulo, que se evalúan antes de cargar el idioma. Se traduce al pintarlo con t(x).
 */
export const tk = <S extends string>(texto: S): S => texto

/** Solo para las pruebas: fija el idioma y su diccionario sin localStorage ni import(). */
export function usarIdiomaEnPruebas(i: Idioma, diccionario: Diccionario = {}): void {
  actual = i
  dic = diccionario
  listo = true
  carga = Promise.resolve()
}
