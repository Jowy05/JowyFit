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

const finito = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)
const trabajo = (s: Serie[]) => s.filter(x => x.hecha && !x.calentamiento && (finito(x.reps) || finito(x.segundos)))

/**
 * Qué peso toca hoy. `ultimas`: series de la última vez que se hizo este ejercicio.
 * `lista`: pesos disponibles ordenados (vacía para peso corporal y tiempo).
 */
export function sugerir(ultimas: Serie[] | null, objetivo: { repsMin: number; repsMax: number; rpe: number }, registro: TipoRegistro, lista: number[]): Sugerencia {
  const hechas = ultimas ? trabajo(ultimas) : []
  if (!hechas.length) return { accion: 'primera', peso: null, reps: objetivo.repsMin, ultima: null, texto: 'Primera vez: elige un peso cómodo (esfuerzo 6-7)' }

  // La serie de referencia es la de más peso entre las que tienen peso apuntado. Antes una serie sin
  // peso contaba como 0 kg y, en las asistidas (pesos negativos), «ganaba» y se perdía el peso.
  const conPeso = hechas.filter(s => finito(s.peso))
  const top = (conPeso.length ? conPeso : hechas).reduce((a, b) => ((b.peso ?? -Infinity) > (a.peso ?? -Infinity) ? b : a))
  const ultima = { peso: top.peso, reps: top.reps ?? top.segundos ?? null, rpe: top.rpe }
  const reps = hechas.map(s => (registro === 'tiempo' ? s.segundos : s.reps) ?? 0).map(r => (Number.isFinite(r) ? r : 0))
  const rpes = hechas.map(s => s.rpe).filter(finito)
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
    // Ya está en el peso más alto que hay: no se puede subir, se buscan más reps.
    if (nuevo <= peso + 1e-9) return { accion: 'mantener', peso, reps: objetivo.repsMax, ultima, texto: 'Es el peso más alto disponible: busca más reps' }
    return { accion: 'subir', peso: nuevo, reps: objetivo.repsMin, ultima, texto: 'Completaste el rango: toca subir' }
  }
  // Bajar solo si de verdad costó: faltaron 2+ reps sin que el esfuerzo apuntado fuera bajo
  // (con esfuerzo ≤ 8 sobraban reps: se paró antes, no es que pese demasiado), o se llegó al fallo sin el mínimo.
  const esfuerzoAlto = rpeMax == null || rpeMax >= 9
  if ((algunaCorta && esfuerzoAlto && reps.some(r => r <= objetivo.repsMin - 2)) || (rpeMax != null && rpeMax >= 10 && algunaCorta)) {
    const menos = siguiente(lista, peso, -1)
    if (menos < peso - 1e-9) return { accion: 'bajar', peso: menos, reps: objetivo.repsMin, ultima, texto: 'Costó demasiado: baja un poco y suma reps' }
    return { accion: 'mantener', peso, reps: objetivo.repsMin, ultima, texto: 'Mantén el peso y busca más reps' }
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

// ---------- primera carga a partir de los pesos de referencia del perfil ----------

/** Ejercicio → referencia del perfil que sirve para él (y factor si es una variante algo distinta). */
const DESDE_REFERENCIA: Record<string, { ref: string; f: number }> = {
  'bench-press': { ref: 'banca', f: 1 }, 'smith-machine-bench-press': { ref: 'banca', f: 1 },
  squat: { ref: 'sentadilla', f: 1 }, 'smith-machine-squat': { ref: 'sentadilla', f: 1 },
  deadlift: { ref: 'pesoMuerto', f: 1 },
  'barbell-row': { ref: 'remo', f: 1 }, 'pendlay-row': { ref: 'remo', f: 0.9 }, 'seated-cable-row': { ref: 'remo', f: 1 },
  'seated-barbell-overhead-press': { ref: 'pressMilitar', f: 1 }, 'smith-machine-shoulder-press': { ref: 'pressMilitar', f: 1 },
  'lat-pulldown': { ref: 'jalon', f: 1 }, 'close-grip-lat-pulldown': { ref: 'jalon', f: 1 },
}

/** «40 kg × 8», «40x8», «40-50 kg», «40» → { peso, reps }. Con un rango se toma el más bajo. */
export function leerReferencia(texto: string | undefined): { peso: number; reps: number } | null {
  if (!texto) return null
  const t = texto.toLowerCase().replace(',', '.')
  const peso = parseFloat(t.match(/\d+(?:\.\d+)?/)?.[0] ?? '')
  if (!Number.isFinite(peso) || peso <= 0 || peso > 400) return null
  const reps = parseInt(t.match(/[x×*]\s*(\d{1,2})/)?.[1] ?? '', 10)
  return { peso, reps: Number.isFinite(reps) && reps > 0 && reps <= 30 ? reps : 8 }
}

/**
 * Primera carga cuando no hay historial pero sí un peso de referencia: el 1RM estimado (Epley),
 * un 10 % menos por el parón y dejando en reserva las reps que pide el esfuerzo objetivo.
 */
export function desdeReferencia(id: string, referencias: Record<string, string> | undefined, objetivo: { repsMin: number; rpe: number }, lista: number[]): Sugerencia | null {
  const m = DESDE_REFERENCIA[id]
  const r = m ? leerReferencia(referencias?.[m.ref]) : null
  if (!m || !r) return null
  const reserva = Math.max(1, 10 - (Number.isFinite(objetivo.rpe) ? objetivo.rpe : 7))
  const bruto = (epley(r.peso, r.reps) * m.f * 0.9) / (1 + (objetivo.repsMin + reserva) / 30)
  const enLista = lista.length ? [...lista].reverse().find(v => v <= bruto + 1e-9) ?? lista[0]! : Math.floor(bruto / 2.5) * 2.5
  const peso = Math.max(0, enLista)
  if (!peso) return null
  return { accion: 'primera', peso, reps: objetivo.repsMin, ultima: null, texto: `Por tu referencia (${referencias![m.ref]}): empieza con ${String(peso).replace('.', ',')} kg y ajusta` }
}
