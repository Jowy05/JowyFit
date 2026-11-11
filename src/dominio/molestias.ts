// Molestias de los entrenos: un ejercicio que molesta varios entrenos seguidos se propone cambiar por otro que no
// cargue esa zona, y «Me duele» lo quita del plan al momento. Lógica pura: el catálogo, el gimnasio y lo que no se
// quiere hacer llegan ya filtrados en `candidatos`. Reglas: elección nuestra ([O]).
import type { Ejercicio } from '../catalogo/tipos'
import { tipoRegistro, type Patron } from '../catalogo/clasificacion'
import type { Bloque, DiaRutina, Guardado, Rutina, Sesion, ZonaDolor } from '../datos/tipos'
import { masParecido, patronGenerador, type Gustos } from './generador'
import { restricciones } from './salud'

/** Entrenos seguidos con molestia en un mismo ejercicio para proponer cambiarlo. */
export const VECES_MOLESTIA = 2

/** ¿Se hizo (o se marcó) este ejercicio en el entreno? Lo que solo estaba previsto no cuenta. */
const hecho = (e: Sesion['ejercicios'][number]) => !!e.molestia || e.series.some(x => x.hecha)

/**
 * Ejercicios del plan que molestaron en sus últimos `veces` entrenos seguidos (los entrenos en que se hicieron), con
 * el entreno más reciente. Salen los que ya se dejaron igual con esa misma molestia («Seguir igual»).
 */
export function molestiasRepetidas(sesiones: Guardado<Sesion>[], plan: ReadonlySet<string>, vistas: { ejercicio: string; sesion: number }[] = [], veces = VECES_MOLESTIA): { ejercicio: string; sesion: number }[] {
  const hechas = sesiones.filter(s => s.estado === 'hecha').sort((a, b) => b.fecha.localeCompare(a.fecha) || b.inicio - a.inicio)
  const out: { ejercicio: string; sesion: number }[] = []
  for (const id of plan) {
    const ultimas = hechas.flatMap(s => s.ejercicios.filter(e => e.ejercicio === id && hecho(e)).slice(0, 1).map(e => ({ s, e }))).slice(0, veces)
    if (ultimas.length < veces || !ultimas.every(x => x.e.molestia)) continue
    const sesion = ultimas[0]!.s.id
    if (vistas.some(v => v.ejercicio === id && v.sesion === sesion)) continue
    out.push({ ejercicio: id, sesion })
  }
  return out
}

// La zona que más suele quejarse en cada tipo de ejercicio (la articulación, salvo en el core y los gemelos).
const ZONA_MOLESTIA: Partial<Record<Patron, ZonaDolor>> = {
  'empuje-h': 'hombros', 'empuje-v': 'hombros', 'pecho-aisl': 'hombros', 'hombro-lat': 'hombros', 'hombro-post': 'hombros', 'tiron-v': 'hombros',
  'tiron-h': 'lumbar', cadera: 'lumbar', lumbar: 'lumbar', core: 'lumbar', trapecio: 'cuello',
  biceps: 'codos', triceps: 'codos', antebrazo: 'munecas',
  rodilla: 'rodillas', cuadriceps: 'rodillas', femoral: 'rodillas', gluteo: 'caderas', gemelo: 'tobillos',
}

/** La zona que probablemente molesta con este ejercicio («Rodillas» en una sentadilla). */
export const zonaMolestia = (e: Ejercicio): ZonaDolor | null => ZONA_MOLESTIA[patronGenerador(e)] ?? null

/**
 * Otro ejercicio para el sitio de `e` que no cargue la zona que molesta (o, sin zona, simplemente otro): el más parecido
 * (`masParecido`) de lo que esa zona permite, con otro movimiento antes que otra versión del mismo. `preferidos`: los
 * de «si está ocupado»; `ocupados`: los que ya hay en ese día. Null si no queda ninguno.
 */
export function alternativaSinMolestia(e: Ejercicio, candidatos: readonly Ejercicio[], x: Gustos, o: { zona?: ZonaDolor | null; preferidos?: readonly string[]; ocupados?: ReadonlySet<string> } = {}): Ejercicio | null {
  // Lo que se deja con una molestia «regular» de esa zona: solo lo seguro para ella (y lo estricto, nunca).
  const salud = o.zona ? restricciones({ dolores: [{ zona: o.zona, cuanto: 'regular', cuando: 'fuerza', desde: 'dias', inicio: '2026-01-01' }], zonasSensibles: [], creado: '' }) : null
  const permitidos = salud ? candidatos.filter(c => !salud.fuera(c) && salud.penaliza(c) < 1000) : candidatos
  return masParecido(e, permitidos, x, { preferidos: o.preferidos, ocupados: o.ocupados, otroMovimiento: true })
}

/** Un bloque que sale del plan o cambia de ejercicio, para enseñarlo y deshacerlo. */
export type CambioPlan = { letra: string; uid: string; antes: Bloque; despues: Bloque | null }

/**
 * Cambia un ejercicio en todos los días de la rutina por el que diga `elegir` (o lo quita si no hay ninguno) y lo
 * borra de las alternativas de los demás, para que tampoco salga al tocar «Ocupado». Quitar un ejercicio de «dos
 * seguidos» deja suelto al compañero.
 */
export function cambiarEnPlan(r: Rutina, id: string, elegir: (b: Bloque, d: DiaRutina) => Ejercicio | null): { rutina: Rutina; cambios: CambioPlan[] } {
  const cambios: CambioPlan[] = []
  const dias = r.dias.map(d => {
    const quitados = new Set<string>()
    let bloques = d.bloques.map(b => {
      if (b.ejercicio !== id) return b.alternativas.includes(id) ? { ...b, alternativas: b.alternativas.filter(a => a !== id) } : b
      const otro = elegir(b, d)
      if (!otro) { quitados.add(b.uid); cambios.push({ letra: d.letra, uid: b.uid, antes: b, despues: null }); return b }
      const despues: Bloque = { ...b, ejercicio: otro.id, alternativas: b.alternativas.filter(a => a !== otro.id && a !== id), registro: tipoRegistro(otro) }
      cambios.push({ letra: d.letra, uid: b.uid, antes: b, despues })
      return despues
    })
    if (quitados.size) bloques = bloques.filter(b => !quitados.has(b.uid)).map(b => (b.superserie && quitados.has(b.superserie) ? { ...b, superserie: undefined } : b))
    return { ...d, bloques }
  })
  return { rutina: { ...r, dias }, cambios }
}
