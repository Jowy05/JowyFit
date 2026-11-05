// Material del gimnasio que RepDB no separa: los accesorios de la polea. RepDB solo dice «cable» (polea), así que lo
// que engancha cada ejercicio sale de su id. Las barras sí vienen separadas: barbell (olímpica), ez_bar y trap_bar.
import type { Ejercicio } from './tipos'
import { tk } from '../i18n'

/** Lo que se engancha a la polea. Se guarda con el resto del material del gimnasio (`Gimnasio.material`). */
export const ACCESORIOS_POLEA = ['polea-agarres', 'polea-cuerda', 'polea-barra-recta', 'polea-barra-v', 'polea-tobilleras'] as const
export type AccesorioPolea = (typeof ACCESORIOS_POLEA)[number]
const ES_ACCESORIO = new Set<string>(ACCESORIOS_POLEA)
export const esAccesorioPolea = (clave: string): clave is AccesorioPolea => ES_ACCESORIO.has(clave)

/** Toda polea trae al menos un agarre: es el que se queda si se quitan los demás. */
export const AGARRE_BASICO: AccesorioPolea = 'polea-agarres'

export const NOMBRE_ACCESORIO: Record<AccesorioPolea, string> = {
  'polea-agarres': tk('Agarres sueltos'),
  'polea-cuerda': tk('Cuerda'),
  'polea-barra-recta': tk('Barra recta'),
  'polea-barra-v': tk('Barra en V (triángulo)'),
  'polea-tobilleras': tk('Tobilleras'),
}
export const ICONO_ACCESORIO: Record<AccesorioPolea, string> = {
  'polea-agarres': 'hand-grabbing', 'polea-cuerda': 'scribble-loop', 'polea-barra-recta': 'line-segment', 'polea-barra-v': 'triangle', 'polea-tobilleras': 'sneaker',
}

/** Las barras con el nombre que se les da en el gimnasio (en las tarjetas del material; en el resto de la app, «Barra»). */
export const NOMBRE_BARRA: Record<string, string> = {
  barbell: tk('Barra olímpica (la larga)'),
  ez_bar: tk('Barra Z (EZ)'),
  trap_bar: tk('Barra hexagonal'),
}

// Qué accesorio pide cada ejercicio de polea: vale cualquiera de la lista. Los jalones con la barra larga de la
// máquina no piden nada (viene con ella); el resto de los de polea, un agarre suelto.
const PIDE: Record<string, readonly AccesorioPolea[]> = {
  'face-pull': ['polea-cuerda'],
  'cable-crunch': ['polea-cuerda'],
  'cable-hammer-curl': ['polea-cuerda'],
  'cable-overhead-tricep-extension': ['polea-cuerda'],
  'cable-pull-through': ['polea-cuerda'],
  'tricep-pushdown': ['polea-cuerda', 'polea-barra-recta', 'polea-barra-v'],
  'v-bar-tricep-pushdown': ['polea-barra-v'],
  'v-bar-lat-pulldown': ['polea-barra-v'],
  'close-grip-lat-pulldown': ['polea-barra-v'],
  'seated-cable-row': ['polea-barra-v', 'polea-agarres'],
  'kneeling-cable-row': ['polea-barra-v', 'polea-agarres', 'polea-cuerda'],
  'wide-grip-seated-cable-row': ['polea-barra-recta'],
  'straight-bar-cable-front-raise': ['polea-barra-recta'],
  'cable-wrist-curl': ['polea-barra-recta'],
  'cable-curl': ['polea-barra-recta', 'polea-agarres'],
  'cable-upright-row': ['polea-barra-recta', 'polea-cuerda'],
  'cable-bent-over-row': ['polea-barra-recta', 'polea-agarres'],
  'straight-arm-pulldown': ['polea-barra-recta', 'polea-cuerda'],
  'cable-kickback': ['polea-tobilleras'],
}
const SIN_ACCESORIO = new Set(['lat-pulldown', 'reverse-grip-lat-pulldown'])

/** Accesorios con los que se puede hacer (vale uno cualquiera); vacío si no pide ninguno. */
export function accesoriosDe(e: Pick<Ejercicio, 'id' | 'material' | 'propio'>): readonly AccesorioPolea[] {
  if (e.propio) return []
  const pide = PIDE[e.id]
  if (pide) return pide
  return e.material === 'cable' && !SIN_ACCESORIO.has(e.id) ? [AGARRE_BASICO] : []
}

/**
 * ¿Tiene el gimnasio el accesorio que pide? Si no marcó ninguno (gimnasios de antes de los accesorios, o los que
 * nunca entraron a mirarlos) se entiende que tiene todos: así nadie pierde de golpe sus ejercicios de polea.
 */
export function tieneAccesorio(e: Pick<Ejercicio, 'id' | 'material' | 'propio'>, material: ReadonlySet<string>): boolean {
  const pide = accesoriosDe(e)
  // Primero lo más corriente (no pide nada, o tiene lo que pide): el generador pregunta esto miles de veces.
  if (!pide.length || pide.some(a => material.has(a))) return true
  return !ACCESORIOS_POLEA.some(a => material.has(a))
}

/** El material como se ve en las tarjetas: sin ningún accesorio marcado, todos marcados (es como se tiene en cuenta). */
export function materialEfectivo(material: readonly string[]): string[] {
  return material.some(esAccesorioPolea) ? [...material] : [...material, ...ACCESORIOS_POLEA]
}

/**
 * Marca o desmarca una clave desde las tarjetas. Con los accesorios se parte de lo que se ve (todos, si no había
 * ninguno), y nunca se quedan todos fuera: sin ninguno contaría como «todos», así que se queda el agarre suelto.
 */
export function conmutarMaterial(material: readonly string[], clave: string): string[] {
  if (!esAccesorioPolea(clave)) return material.includes(clave) ? material.filter(x => x !== clave) : [...material, clave]
  const visto = materialEfectivo(material)
  if (!visto.includes(clave)) return [...visto, clave]
  const sin = visto.filter(x => x !== clave)
  return sin.some(esAccesorioPolea) ? sin : [...sin, AGARRE_BASICO]
}

/**
 * «Marcar todo» o «Quitar todo» de un grupo de tarjetas (con la búsqueda, solo las que se ven). Con accesorios entre
 * las claves vale lo mismo que al tocarlos de uno en uno: se parte de lo que se ve y siempre queda el agarre suelto.
 */
export function conmutarVarios(material: readonly string[], claves: readonly string[], poner: boolean): string[] {
  const base = claves.some(esAccesorioPolea) ? materialEfectivo(material) : [...material]
  if (poner) return [...new Set([...base, ...claves])]
  const sin = base.filter(x => !claves.includes(x))
  return !claves.some(esAccesorioPolea) || sin.some(esAccesorioPolea) ? sin : [...sin, AGARRE_BASICO]
}

/**
 * Material cuyos ejercicios piden accesorio: la polea y la máquina de jalón (su jalón con barra en V usa el triángulo).
 * Con alguno de estos marcado se enseñan los accesorios; si no, quedarían guardados y ocultos quitando ejercicios.
 */
export function materialConAccesorios(ejercicios: readonly Pick<Ejercicio, 'id' | 'material' | 'propio'>[]): Set<string> {
  return new Set(ejercicios.filter(e => e.material && accesoriosDe(e).length).map(e => e.material!))
}
