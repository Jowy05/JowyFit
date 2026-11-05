// Cuánto trabajo pide cada zona a la semana y cuántas series le tocan a cada ejercicio para llegar
// (docs/INVESTIGACION-RUTINAS.md §4.3). Se cuenta por zona (las mismas 8 de «Afinar»), no por músculo suelto.
import type { Patron } from '../catalogo/clasificacion'
import type { Perfil, Rutina, Sesion } from '../datos/tipos'
import { juegoDe, PARAMETROS } from './objetivos'
import { t, tk } from '../i18n'

export type ZonaVolumen = 'pecho' | 'espalda' | 'hombros' | 'brazos' | 'abdomen' | 'gluteo' | 'piernas' | 'gemelos'

/** Zona que trabaja cada patrón del generador (lo que no es de fuerza, ninguna). */
export const ZONA_DE_PATRON: Partial<Record<Patron, ZonaVolumen>> = {
  'empuje-h': 'pecho', 'pecho-aisl': 'pecho',
  'tiron-h': 'espalda', 'tiron-v': 'espalda', lumbar: 'espalda', trapecio: 'espalda',
  'empuje-v': 'hombros', 'hombro-lat': 'hombros', 'hombro-post': 'hombros',
  biceps: 'brazos', triceps: 'brazos', antebrazo: 'brazos',
  core: 'abdomen',
  cadera: 'gluteo', gluteo: 'gluteo',
  rodilla: 'piernas', cuadriceps: 'piernas', femoral: 'piernas',
  gemelo: 'gemelos',
}

const NOMBRE_ZONA: Record<ZonaVolumen, string> = {
  pecho: tk('pecho'), espalda: tk('espalda'), hombros: tk('hombros'), brazos: tk('brazos'), abdomen: tk('abdomen'), gluteo: tk('glúteo'), piernas: tk('piernas'), gemelos: tk('gemelos'),
}
/** «piernas», «glúteo»…: la zona en minúscula, en el idioma de la app. */
export const nombreZonaVolumen = (z: ZonaVolumen) => t(NOMBRE_ZONA[z])

/** Límites de series a la semana por nivel (§4.3): quien empieza o vuelve, poco al principio. */
function rangoNivel(p: Pick<Perfil, 'nivel' | 'modoMayor'>, prueba: boolean): [number, number] {
  const novato = p.nivel === 'empiezo' || p.nivel === 'vuelvo' || !!p.modoMayor?.activo
  if (novato && prueba) return [4, 6]
  if (p.modoMayor?.activo) return [4, 10]
  if (novato) return [4, 12]
  return p.nivel === 'intermedio' ? [4, 16] : [4, 20]
}

const centro = ([a, b]: [number, number]) => Math.round((a + b) / 2)

/**
 * Series a la semana para una zona: las de prioridad («Un poco más» o «Mucho más») según el objetivo, el resto en
 * mantenimiento. Nunca por debajo de 4 (mínimo útil, Iversen 2021) ni fuera de lo que aguanta el nivel; con un solo
 * entreno a la semana, como mucho 4 (ACSM 2026).
 */
export function seriesSemana(zona: ZonaVolumen, p: Pick<Perfil, 'objetivo' | 'zonasPrioridad' | 'zonasMucho' | 'nivel' | 'modoMayor'>, o: { sesiones: number; prueba: boolean }): number {
  const par = PARAMETROS[juegoDe(p.objetivo)]
  const prioritaria = p.zonasPrioridad.includes(zona)
  const base = prioritaria ? par.prioritario[(p.zonasMucho ?? []).includes(zona) ? 1 : 0] : centro(par.mantenimiento)
  const [lo, hi] = rangoNivel(p, o.prueba)
  let t = Math.min(Math.max(base, Math.max(4, lo)), hi)
  if (o.sesiones <= 1) t = Math.min(t, 4)
  return t
}

/** Series de un ejercicio: las de su zona repartidas entre los ejercicios de esa zona en la semana (2 a 4, o 5 con «Mucho más»). */
export function seriesEjercicio(semana: number, ejerciciosZona: number, mucho: boolean): number {
  const n = Math.round(semana / Math.max(1, ejerciciosZona))
  return Math.min(Math.max(n, 2), mucho ? 5 : 4)
}

/** Orden fijo de las zonas para deshacer empates (lo grande primero). */
const ORDEN: ZonaVolumen[] = ['piernas', 'espalda', 'pecho', 'gluteo', 'hombros', 'brazos', 'abdomen', 'gemelos']

/**
 * Sábado «lo que falte»: series de trabajo que faltan esta semana en cada zona que trabaja la rutina (las que tocan
 * menos las hechas en `dias`), de la que más le falta a la que menos. Solo zonas con algo pendiente. Las que tocan son
 * las que pone el plan en los días fijos (como mucho las de `seriesSemana`): el plan limita las series de cada
 * ejercicio y las recorta para que quepan en el tiempo, y quien hace todos sus días tiene que ir al día.
 * `zonaDe` dice qué zona trabaja un ejercicio (por su patrón).
 */
export function faltanSemana(o: {
  rutina: Pick<Rutina, 'dias' | 'calibracion'>
  perfil: Pick<Perfil, 'objetivo' | 'zonasPrioridad' | 'zonasMucho' | 'nivel' | 'modoMayor'>
  sesiones: Pick<Sesion, 'fecha' | 'estado' | 'ejercicios'>[]
  dias: string[]
  zonaDe: (id: string) => ZonaVolumen | undefined
}): { zona: ZonaVolumen; faltan: number; objetivo: number; hechas: number }[] {
  const fijos = o.rutina.dias.filter(d => !d.opcional)
  // Solo las zonas que la rutina trabaja: si no lleva core (no lo quiere), el sábado tampoco lo mete.
  const plan = new Map<ZonaVolumen, number>()
  for (const b of fijos.flatMap(d => d.bloques)) {
    const z = o.zonaDe(b.ejercicio)
    if (z) plan.set(z, (plan.get(z) ?? 0) + b.series)
  }
  const hechas = new Map<ZonaVolumen, number>()
  for (const s of o.sesiones) {
    if (s.estado !== 'hecha' || !o.dias.includes(s.fecha)) continue
    for (const e of s.ejercicios) {
      const z = o.zonaDe(e.ejercicio)
      if (z) hechas.set(z, (hechas.get(z) ?? 0) + e.series.filter(x => x.hecha && !x.calentamiento).length)
    }
  }
  return [...plan]
    .map(([zona, delPlan]) => {
      const objetivo = Math.min(delPlan, seriesSemana(zona, o.perfil, { sesiones: Math.max(1, fijos.length), prueba: o.rutina.calibracion }))
      const h = hechas.get(zona) ?? 0
      return { zona, faltan: Math.max(0, objetivo - h), objetivo, hechas: h }
    })
    .filter(x => x.faltan > 0)
    // A igualdad, la que lleva menos hecho en proporción (y luego el orden de las zonas, para que salga siempre igual).
    .sort((a, b) => b.faltan - a.faltan || a.hechas / a.objetivo - b.hechas / b.objetivo || ORDEN.indexOf(a.zona) - ORDEN.indexOf(b.zona))
}
