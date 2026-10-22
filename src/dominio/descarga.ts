// Estancamiento y semana suave (descarga), sin ajustes: por ejercicio, 3 sesiones sin mejorar el 1RM → −10 % y a subir;
// en global, 3 ejercicios estancados o 6 semanas seguidas → semana suave (1 serie menos y −10 % de peso).
import type { Serie, Sesion } from '../datos/tipos'
import { epley } from './calculos'
import { lunesDe, sumarDias } from './fechas'
import { t } from '../i18n'

const trabajo = (s: Serie[]) => s.filter(x => x.hecha && !x.calentamiento && x.peso != null && x.reps != null && x.peso > 0 && x.reps > 0)

/** Mejor 1RM estimado de una sesión (0 si no hay series con peso). */
export function mejor1RM(series: Serie[]): number {
  return trabajo(series).reduce((m, x) => Math.max(m, epley(x.peso!, x.reps!)), 0)
}

/** Peso más alto usado en una sesión (0 si no hay). */
export function pesoTop(series: Serie[]): number {
  return trabajo(series).reduce((m, x) => Math.max(m, x.peso!), 0)
}

export const SESIONES_ESTANCADO = 3

/**
 * ¿Lleva 3 sesiones sin progresar? `hechos` va del más reciente al más antiguo. Hace falta una sesión anterior de
 * referencia y que en las 3 últimas no se haya bajado el peso (así no vuelve a saltar mientras se recupera).
 */
export function estancado(hechos: { series: Serie[] }[]): boolean {
  if (hechos.length < SESIONES_ESTANCADO + 1) return false
  const ultimas = hechos.slice(0, SESIONES_ESTANCADO)
  const ref = hechos[SESIONES_ESTANCADO]!
  const base = mejor1RM(ref.series)
  const pesoBase = pesoTop(ref.series)
  if (!base || !pesoBase) return false
  if (ultimas.some(h => pesoTop(h.series) < pesoBase - 1e-9 || !mejor1RM(h.series))) return false
  return Math.max(...ultimas.map(h => mejor1RM(h.series))) <= base * 1.01
}

/**
 * Peso para volver a empezar tras un estancamiento (o en la semana suave): −10 %, al peso que exista más cercano
 * por debajo del actual (redondear siempre hacia abajo llevaría 55 kg a 47,5, un −14 %).
 */
export function pesoReinicio(peso: number, lista: number[]): number {
  const objetivo = peso * 0.9
  const menores = lista.length ? lista.filter(v => v > 0 && v < peso - 1e-9) : []
  const p = lista.length
    ? (menores.length ? menores.reduce((m, v) => (Math.abs(v - objetivo) < Math.abs(m - objetivo) ? v : m)) : peso)
    : Math.round(objetivo / 2.5) * 2.5
  return p > 0 && p < peso ? p : peso
}

/** Semana suave: una serie menos (mínimo 2) y −10 % de peso. */
export function seriesSuave(n: number): number {
  return Math.max(2, n - 1)
}

export const SEMANAS_SIN_DESCARGA = 6

type Propuesta = { motivo: string; estancados: string[] }

/**
 * ¿Proponer una semana suave? Cuenta las semanas con algún entreno normal (sin la calibración ni
 * semanas suaves) desde el inicio o la última descarga, y los ejercicios de la rutina estancados.
 */
export function propuestaDescarga(o: {
  hoy: string
  sesiones: Sesion[]
  ejerciciosRutina: string[]
  semanaSuave: string | null
  pospuesta: string | null
  nombre: (id: string) => string
}): Propuesta | null {
  const lunes = lunesDe(o.hoy)
  if (o.semanaSuave === lunes) return null // ya es semana suave
  if (o.pospuesta && lunes <= o.pospuesta) return null // «Ahora no»: se vuelve a mirar la semana que viene
  const normales = o.sesiones
    .filter(s => s.estado === 'hecha' && !s.calibracion && !s.suave && (!o.semanaSuave || s.fecha > o.semanaSuave))
    .sort((a, b) => b.inicio - a.inicio)
  const historial = (id: string) => normales.flatMap(s => s.ejercicios.filter(e => e.ejercicio === id).map(e => ({ series: e.series })))
  const estancados = [...new Set(o.ejerciciosRutina)].filter(id => estancado(historial(id)))
  if (estancados.length >= 3) {
    return { motivo: t('{n} ejercicios llevan {sesiones} sesiones sin mejorar ({lista}…)', { n: estancados.length, sesiones: SESIONES_ESTANCADO, lista: estancados.slice(0, 3).map(o.nombre).join(', ') }), estancados }
  }
  // Semanas seguidas con entreno, contando hacia atrás desde la pasada (6 sesiones sueltas tras un parón no cuentan).
  const conEntreno = new Set(normales.filter(s => lunesDe(s.fecha) < lunes).map(s => lunesDe(s.fecha)))
  let semanas = 0
  for (let w = sumarDias(lunes, -7); conEntreno.has(w); w = sumarDias(w, -7)) semanas++
  if (semanas >= SEMANAS_SIN_DESCARGA) return { motivo: t('Llevas {n} semanas seguidas entrenando', { n: semanas }), estancados }
  return null
}
