// Cuánto trabajo pide cada zona a la semana y cuántas series le tocan a cada ejercicio para llegar
// (docs/INVESTIGACION-RUTINAS.md §4.3). Se cuenta por zona (las mismas 8 de «Afinar»), no por músculo suelto.
import type { Patron } from '../catalogo/clasificacion'
import type { Perfil } from '../datos/tipos'
import { juegoDe, PARAMETROS } from './objetivos'

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
