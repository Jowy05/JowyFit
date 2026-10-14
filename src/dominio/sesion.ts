// Entreno en curso: crear la sesión desde un día de la rutina y operaciones puras sobre ella.
import type { Bloque, DiaRutina, EjercicioSesion, Serie, Sesion, TipoRegistro } from '../datos/tipos'
import { hoyISO } from './fechas'

export function crearSesion(dia: DiaRutina, o: { rutinaId: number | null; gimnasioId: number | null; version: 'normal' | 'corta'; horaLimite?: string; calibracion: boolean; ahora?: number; sugerencias?: Map<string, { peso: number | null; reps: number | null }> }): Sesion {
  const ahora = o.ahora ?? Date.now()
  const bloques = dia.bloques.filter(b => !(o.version === 'corta' && b.fueraEnCorta))
  const ejercicios = bloques.map(b => desdeBloque(b, o.sugerencias?.get(b.ejercicio)))
  if (ejercicios[0]) ejercicios[0].estado = 'curso'
  return {
    fecha: hoyISO(new Date(ahora)),
    rutinaId: o.rutinaId,
    letra: dia.letra,
    nombre: dia.nombre,
    gimnasioId: o.gimnasioId,
    inicio: ahora,
    horaLimite: o.horaLimite,
    version: o.version,
    estado: 'curso',
    calibracion: o.calibracion,
    ejercicios,
  }
}

export function seriesNuevas(n: number, peso: number | null, reps: number | null, registro: TipoRegistro): Serie[] {
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    peso: registro === 'corporal' || registro === 'tiempo' || registro === 'cardio' ? null : peso,
    reps: registro === 'tiempo' ? null : reps,
    segundos: registro === 'tiempo' ? reps : null,
    rpe: null,
    calentamiento: false,
    hecha: false,
  }))
}

export function desdeBloque(b: Bloque, sug?: { peso: number | null; reps: number | null }, ejercicio = b.ejercicio): EjercicioSesion {
  return {
    uid: b.uid,
    ejercicio,
    planificado: b.ejercicio,
    estado: 'pendiente',
    series: seriesNuevas(b.series, sug?.peso ?? null, sug?.reps ?? b.repsMin, b.registro),
    repsMin: b.repsMin,
    repsMax: b.repsMax,
    rpe: b.rpe,
    descanso: b.descanso,
    superserie: b.superserie,
    registro: b.registro,
  }
}

/** Índice del ejercicio en curso (o el primero pendiente). */
export function indiceActual(s: Sesion): number {
  const i = s.ejercicios.findIndex(e => e.estado === 'curso')
  if (i >= 0) return i
  return s.ejercicios.findIndex(e => e.estado === 'pendiente')
}

/** Serie que toca ahora dentro de un ejercicio (la primera sin hacer). */
export function serieActual(e: EjercicioSesion): number {
  return e.series.findIndex(x => !x.hecha)
}

const clon = (s: Sesion): Sesion => structuredClone(s)

/** Marca la serie como hecha y decide qué viene después (superserie, siguiente serie o ejercicio). */
export function hecha(s0: Sesion, idx: number, datos: Pick<Serie, 'peso' | 'reps' | 'rpe' | 'segundos'>, ahora = Date.now()): { sesion: Sesion; descanso: number } {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return { sesion: s, descanso: 0 }
  const i = serieActual(e)
  if (i < 0) return { sesion: s, descanso: 0 }
  e.inicio ??= ahora
  const eraCalentamiento = e.series[i]!.calentamiento
  Object.assign(e.series[i]!, datos, { hecha: true, ts: ahora })
  // Las siguientes series heredan peso y reps si aún no se tocaron. Una serie de calentamiento
  // no hereda nada: antes, al marcar «20 kg × 10» de aproximación, todas las series de trabajo pasaban a 20 kg.
  if (!eraCalentamiento) for (const x of e.series.slice(i + 1)) if (!x.hecha && !x.calentamiento) { x.peso = datos.peso; if (e.registro !== 'tiempo') x.reps ??= datos.reps }
  const companero = e.superserie ? s.ejercicios.find(o => o.uid === e.superserie) : undefined
  const terminado = serieActual(e) < 0
  if (terminado) { e.estado = 'hecho'; e.fin = ahora }
  // Superserie: tras A1 se pasa a A2 sin descanso; tras A2, descanso y vuelta a A1.
  if (companero && companero.estado !== 'hecho' && companero.estado !== 'saltado') {
    const jIdx = s.ejercicios.indexOf(companero)
    const esPrimero = jIdx > idx
    if (!terminado) e.estado = 'pendiente'
    companero.estado = 'curso'
    return { sesion: s, descanso: esPrimero ? 0 : e.descanso }
  }
  if (terminado) {
    const sig = s.ejercicios.findIndex(o => o.estado === 'pendiente')
    if (sig >= 0) s.ejercicios[sig]!.estado = 'curso'
    return { sesion: s, descanso: sig >= 0 ? Math.min(e.descanso, 90) : 0 }
  }
  e.estado = 'curso'
  return { sesion: s, descanso: e.descanso }
}

export function cambiarSerie(s0: Sesion, idx: number, n: number, cambios: Partial<Serie>): Sesion {
  const s = clon(s0)
  Object.assign(s.ejercicios[idx]!.series[n]!, cambios)
  return s
}

export function anadirSerie(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]!
  const ult = e.series[e.series.length - 1]
  e.series.push({ n: e.series.length + 1, peso: ult?.peso ?? null, reps: ult?.reps ?? e.repsMin, segundos: ult?.segundos ?? null, rpe: null, calentamiento: false, hecha: false })
  if (e.estado === 'hecho') e.estado = 'curso'
  return s
}

export function quitarSerie(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return s
  // La última serie de trabajo sin hacer (antes podía borrar una de calentamiento pendiente).
  const j = e.series.map(x => !x.hecha && !x.calentamiento).lastIndexOf(true)
  if (j >= 0 && e.series.filter(x => !x.calentamiento).length > 1) e.series.splice(j, 1)
  e.series.forEach((x, k) => (x.n = k + 1))
  if (serieActual(e) < 0 && e.estado === 'curso') { e.estado = 'hecho'; const sig = s.ejercicios.findIndex(o => o.estado === 'pendiente'); if (sig >= 0) s.ejercicios[sig]!.estado = 'curso' }
  return s
}

export function anadirCalentamiento(s0: Sesion, idx: number, series: { peso: number; reps: number }[]): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]!
  const ya = e.series.filter(x => x.calentamiento)
  if (ya.length) return s
  e.series.unshift(...series.map(c => ({ n: 0, peso: c.peso, reps: c.reps, rpe: null, calentamiento: true, hecha: false })))
  return s
}

/** Sustituye el ejercicio (máquina ocupada o cambio) manteniendo series y objetivo. */
export function sustituir(s0: Sesion, idx: number, nuevo: string, motivo: 'ocupado' | 'cambio', sug?: { peso: number | null; reps: number | null }, registro?: TipoRegistro): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return s
  e.ejercicio = nuevo
  e.motivo = motivo
  if (registro) e.registro = registro
  const r = e.registro
  for (const x of e.series) if (!x.hecha) {
    // Al cambiar a un ejercicio por tiempo o de peso corporal, las series pendientes se adaptan
    // (antes una plancha heredaba «8 reps» y ningún segundo).
    x.peso = r === 'corporal' || r === 'tiempo' || r === 'cardio' ? null : sug?.peso ?? null
    if (r === 'tiempo') { x.segundos = sug?.reps ?? x.segundos ?? 30; x.reps = null }
    else {
      if (sug?.reps != null) x.reps = sug.reps
      else x.reps ??= e.repsMin
      x.segundos = null
    }
  }
  return s
}

/** Pone otro ejercicio pendiente en curso (reordenar sobre la marcha). */
export function irA(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  for (const e of s.ejercicios) if (e.estado === 'curso') e.estado = serieActual(e) < 0 ? 'hecho' : 'pendiente'
  const e = s.ejercicios[idx]!
  if (e.estado !== 'hecho') e.estado = 'curso'
  return s
}

/** Mueve un ejercicio a otra posición (los no hechos). */
export function mover(s0: Sesion, desde: number, hasta: number): Sesion {
  const s = clon(s0)
  // Índices fuera de rango: antes metía un «undefined» en la lista y rompía la sesión.
  if (desde < 0 || desde >= s.ejercicios.length || !Number.isInteger(desde) || !Number.isInteger(hasta)) return s
  const [e] = s.ejercicios.splice(desde, 1)
  s.ejercicios.splice(Math.max(0, Math.min(hasta, s.ejercicios.length)), 0, e!)
  return s
}

export function saltar(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return s
  e.estado = 'saltado'
  const sig = s.ejercicios.findIndex(o => o.estado === 'pendiente')
  if (sig >= 0 && !s.ejercicios.some(o => o.estado === 'curso')) s.ejercicios[sig]!.estado = 'curso'
  return s
}

export function quitarUnaSerie(s0: Sesion, uid: string): Sesion {
  const i = s0.ejercicios.findIndex(e => e.uid === uid)
  return i < 0 ? s0 : quitarSerie(s0, i)
}

export const terminada = (s: Sesion) => s.ejercicios.every(e => e.estado === 'hecho' || e.estado === 'saltado')

export function resumen(s: Sesion) {
  const hechos = s.ejercicios.filter(e => e.estado === 'hecho' || e.series.some(x => x.hecha && !x.calentamiento))
  const series = s.ejercicios.reduce((t, e) => t + e.series.filter(x => x.hecha && !x.calentamiento).length, 0)
  const volumen = s.ejercicios.reduce((t, e) => t + e.series.filter(x => x.hecha && !x.calentamiento).reduce((a, x) => a + Math.max(0, x.peso ?? 0) * (x.reps ?? 0), 0), 0)
  return {
    ejercicios: s.ejercicios.length,
    hechos: hechos.length,
    saltados: s.ejercicios.filter(e => e.estado === 'saltado').length,
    sustituidos: s.ejercicios.filter(e => e.ejercicio !== e.planificado).length,
    series,
    volumen: Math.round(volumen),
    segundos: Math.round(((s.fin ?? Date.now()) - s.inicio) / 1000),
  }
}
