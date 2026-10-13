// Doble progresión con esfuerzo (RPE) y récords.
import type { Serie, TipoRegistro } from '../datos/tipos'
import { epley } from './calculos'
import { siguiente } from './pesos'

export type Sugerencia = {
  accion: 'primera' | 'subir' | 'mantener' | 'bajar'
  peso: number | null
  reps: number | null // reps objetivo (para peso corporal y tiempo)
  ultima: { peso: number | null; reps: number | null; rpe: number | null } | null
  texto: string
}

const trabajo = (s: Serie[]) => s.filter(x => x.hecha && !x.calentamiento && (x.reps != null || x.segundos != null))

/**
 * Qué peso toca hoy. `ultimas`: series de la última vez que se hizo este ejercicio.
 * `lista`: pesos disponibles ordenados (vacía para peso corporal y tiempo).
 */
export function sugerir(ultimas: Serie[] | null, objetivo: { repsMin: number; repsMax: number; rpe: number }, registro: TipoRegistro, lista: number[]): Sugerencia {
  const hechas = ultimas ? trabajo(ultimas) : []
  if (!hechas.length) return { accion: 'primera', peso: null, reps: objetivo.repsMin, ultima: null, texto: 'Primera vez: elige un peso cómodo (esfuerzo 6-7)' }

  const top = hechas.reduce((a, b) => ((b.peso ?? 0) > (a.peso ?? 0) ? b : a))
  const ultima = { peso: top.peso, reps: top.reps ?? top.segundos ?? null, rpe: top.rpe }
  const reps = hechas.map(s => (registro === 'tiempo' ? s.segundos : s.reps) ?? 0)
  const rpes = hechas.map(s => s.rpe).filter((r): r is number => r != null)
  const rpeMax = rpes.length ? Math.max(...rpes) : null
  const rpeMin = rpes.length ? Math.min(...rpes) : null
  const todasArriba = reps.every(r => r >= objetivo.repsMax)
  const algunaCorta = reps.some(r => r < objetivo.repsMin)
  const muyDuro = rpeMax != null && rpeMax >= 9.5

  if (registro === 'corporal' || registro === 'tiempo' || registro === 'cardio' || top.peso == null) {
    const paso = registro === 'tiempo' ? 5 : 1
    const mejor = Math.max(...reps)
    if (todasArriba && !muyDuro) return { accion: 'subir', peso: top.peso, reps: mejor + paso, ultima, texto: registro === 'tiempo' ? `Hoy: aguanta ${mejor + paso} s` : `Hoy: ${mejor + paso} reps` }
    return { accion: 'mantener', peso: top.peso, reps: Math.max(objetivo.repsMin, mejor), ultima, texto: 'Repite y busca una repetición más' }
  }

  const peso = top.peso
  if (todasArriba && (rpeMax == null || rpeMax <= 8)) {
    let nuevo = siguiente(lista, peso, 1)
    // Si le costó muy poco (esfuerzo ≤ 6), salto doble.
    if (rpeMin != null && rpeMax != null && rpeMax <= 6) nuevo = siguiente(lista, nuevo, 1)
    return { accion: 'subir', peso: nuevo, reps: objetivo.repsMin, ultima, texto: 'Completaste el rango: toca subir' }
  }
  if ((algunaCorta && reps.some(r => r <= objetivo.repsMin - 2)) || (rpeMax != null && rpeMax >= 10 && algunaCorta)) {
    return { accion: 'bajar', peso: siguiente(lista, peso, -1), reps: objetivo.repsMin, ultima, texto: 'Costó demasiado: baja un poco y suma reps' }
  }
  if (muyDuro || algunaCorta) return { accion: 'mantener', peso, reps: objetivo.repsMin, ultima, texto: 'Mantén el peso y busca más reps' }
  return { accion: 'mantener', peso, reps: Math.min(objetivo.repsMax, Math.max(...reps) + 1), ultima, texto: 'Mismo peso, una rep más' }
}

export type Marca = { peso: number; reps: number; e1rm: number }

/** Mejor marca histórica: mayor 1RM estimado. */
export function mejorMarca(series: Serie[]): Marca | null {
  let mejor: Marca | null = null
  for (const s of trabajo(series)) {
    if (s.peso == null || s.reps == null || s.peso <= 0) continue
    const e = epley(s.peso, s.reps)
    if (!mejor || e > mejor.e1rm) mejor = { peso: s.peso, reps: s.reps, e1rm: e }
  }
  return mejor
}

export type Logro = { tipo: 'peso' | 'reps' | 'e1rm'; texto: string; peso: number; reps: number }

/** ¿Esta serie es un récord frente al historial anterior del ejercicio? */
export function esRecord(s: Serie, historial: Serie[]): Logro | null {
  if (!s.hecha || s.calentamiento || s.peso == null || s.reps == null || s.peso <= 0 || s.reps <= 0) return null
  const prev = trabajo(historial).filter(x => x.peso != null && x.reps != null)
  if (!prev.length) return null
  const maxPeso = Math.max(...prev.map(x => x.peso!))
  if (s.peso > maxPeso) return { tipo: 'peso', texto: 'Nuevo récord de peso', peso: s.peso, reps: s.reps }
  const mismas = prev.filter(x => x.peso === s.peso)
  if (mismas.length && s.reps > Math.max(...mismas.map(x => x.reps!))) return { tipo: 'reps', texto: 'Récord de repeticiones', peso: s.peso, reps: s.reps }
  return null
}

export function volumen(series: Serie[]): number {
  return trabajo(series).reduce((t, s) => t + Math.max(0, s.peso ?? 0) * (s.reps ?? 0), 0)
}
