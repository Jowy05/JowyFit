// Cuentas de una rutina para enseñarla: minutos de un día, duración de la semana, filas de «dos seguidos» y
// series por grupo muscular. Las mismas en Mi plan, el detalle del día, editar, generar y el alta.
import type { Bloque, DiaRutina, Rutina } from '../datos/tipos'
import { ejercicio } from '../catalogo/catalogo'
import { patron } from '../catalogo/clasificacion'
import { duracionDia } from './generador'
import { tk } from '../i18n'

/** Minutos de un día de la rutina (en su versión corta, si se pide). */
export const minutosDia = (d: DiaRutina, corta = false) => Math.round(duracionDia(d.bloques, corta) / 60)

/** Duración de la semana en una cifra: «~55 min» o, si los días varían, «48-55 min». */
export function duracionPlan(r: Pick<Rutina, 'dias'>): string {
  const ms = r.dias.filter(d => !d.opcional).map(d => minutosDia(d))
  if (!ms.length) return '—'
  const a = Math.min(...ms), z = Math.max(...ms)
  return a === z ? `~${a} min` : `${a}-${z} min`
}

// Lo que la pareja de «dos seguidos» comparte: las series, si se quita con prisa y el descanso (va tras hacer los dos).
const DE_LA_PAREJA = ['series', 'fueraEnCorta', 'descanso'] as const

/** Cambia un bloque del día desde Editar plan (series, reps, descanso, esfuerzo…); su pareja de superserie le sigue. */
export function editarBloque(bloques: Bloque[], uid: string, c: Partial<Bloque>): Bloque[] {
  const comun: Partial<Bloque> = {}
  for (const k of DE_LA_PAREJA) if (c[k] != null) Object.assign(comun, { [k]: c[k] })
  const pareja = Object.keys(comun).length > 0
  return bloques.map(b => (b.uid === uid ? { ...b, ...c } : pareja && b.superserie === uid ? { ...b, ...comun } : b))
}

/** Junta un bloque con el siguiente en «dos seguidos»: el segundo toma del primero lo que la pareja comparte. */
export function unirConSiguiente(bloques: Bloque[], uid: string): Bloque[] {
  const i = bloques.findIndex(x => x.uid === uid)
  const b = bloques[i], sig = bloques[i + 1]
  if (!b || !sig || sig.superserie || b.superserie) return bloques
  const segundo: Bloque = { ...sig, superserie: b.uid }
  // Lo que el primero no tiene (p. ej. sin «quitar con prisa») tampoco lo tiene el segundo.
  for (const k of DE_LA_PAREJA) if (b[k] === undefined) delete (segundo as Partial<Bloque>)[k]; else Object.assign(segundo, { [k]: b[k] })
  return bloques.map(x => (x.uid === b.uid ? { ...x, superserie: sig.uid } : x.uid === sig.uid ? segundo : x))
}

/** Agrupa los bloques en filas: sueltos o pares de superserie. */
export function filas(bloques: Bloque[]): (Bloque | [Bloque, Bloque])[] {
  const out: (Bloque | [Bloque, Bloque])[] = []
  const vistos = new Set<string>()
  for (const b of bloques) {
    if (vistos.has(b.uid)) continue
    vistos.add(b.uid)
    const c = b.superserie ? bloques.find(o => o.uid === b.superserie) : undefined
    if (c && !vistos.has(c.uid)) { vistos.add(c.uid); out.push([b, c]) } else out.push(b)
  }
  return out
}

const GRUPOS: { n: string; patrones: string[] }[] = [
  { n: tk('Pecho'), patrones: ['empuje-h', 'pecho-aisl'] },
  { n: tk('Espalda'), patrones: ['tiron-h', 'tiron-v', 'lumbar'] },
  { n: tk('Hombros'), patrones: ['empuje-v', 'hombro-lat', 'hombro-post', 'trapecio'] },
  { n: tk('Brazos'), patrones: ['biceps', 'triceps', 'antebrazo'] },
  { n: tk('Piernas'), patrones: ['rodilla', 'cadera', 'cuadriceps', 'femoral', 'gluteo', 'gemelo'] },
  { n: tk('Abdomen'), patrones: ['core'] },
]

/** Series semanales por grupo muscular (solo días fijos). n va en castellano: se traduce al pintarlo. */
export function seriesPorGrupo(r: Rutina): { n: string; v: number }[] {
  const cuenta = new Map(GRUPOS.map(g => [g.n, 0]))
  for (const d of r.dias.filter(x => !x.opcional)) for (const b of d.bloques) {
    const e = ejercicio(b.ejercicio)
    if (!e) continue
    const p = patron(e)
    const g = GRUPOS.find(x => x.patrones.includes(p))
    if (g) cuenta.set(g.n, (cuenta.get(g.n) ?? 0) + b.series)
  }
  return [...cuenta.entries()].map(([n, v]) => ({ n, v }))
}
