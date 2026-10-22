// Doble progresión con esfuerzo (RPE) y récords.
import type { Serie, Sesion, TipoRegistro } from '../datos/tipos'
import { epley } from './calculos'
import { kg } from './formato'
import { propio } from './claves'
import { BARRAS, siguiente } from './pesos'
import { t, tk } from '../i18n'

export type Sugerencia = {
  accion: 'primera' | 'subir' | 'mantener' | 'bajar'
  peso: number | null
  reps: number | null // reps objetivo (para peso corporal y tiempo)
  ultima: { peso: number | null; reps: number | null; rpe: number | null } | null
  texto: string
  /** Primera vez sin historial ni referencia: el peso es uno de partida, ligero, que propone la app. */
  partida?: boolean
}

const finito = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)
const trabajo = (s: Serie[]) => s.filter(x => x.hecha && !x.calentamiento && (finito(x.reps) || finito(x.segundos)))

/**
 * Qué peso toca hoy. `ultimas`: series de la última vez que se hizo este ejercicio.
 * `lista`: pesos disponibles ordenados (vacía para peso corporal y tiempo).
 */
export function sugerir(ultimas: Serie[] | null, objetivo: { repsMin: number; repsMax: number; rpe: number }, registro: TipoRegistro, lista: number[]): Sugerencia {
  const hechas = ultimas ? trabajo(ultimas) : []
  if (!hechas.length) return { accion: 'primera', peso: null, reps: objetivo.repsMin, ultima: null, texto: t('Primera vez: elige un peso cómodo (esfuerzo 6-7)') }

  // La serie de referencia es la de más peso entre las que tienen peso apuntado: una sin peso no cuenta como
  // 0 kg, que en las asistidas (pesos negativos) «ganaría» y se perdería el peso.
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
    if (todasArriba && !muyDuro) return { accion: 'subir', peso: top.peso, reps: mejor + paso, ultima, texto: registro === 'tiempo' ? t('Hoy: aguanta {n} s', { n: mejor + paso }) : t('Hoy: {n} reps', { n: mejor + paso }) }
    return { accion: 'mantener', peso: top.peso, reps: Math.max(objetivo.repsMin, mejor), ultima, texto: t('Repite y busca una repetición más') }
  }

  const peso = top.peso
  if (todasArriba && (rpeMax == null || rpeMax <= 8)) {
    let nuevo = siguiente(lista, peso, 1)
    // Si le costó muy poco (esfuerzo ≤ 6), salto doble.
    if (rpeMin != null && rpeMax != null && rpeMax <= 6) nuevo = siguiente(lista, nuevo, 1)
    // Ya está en el peso más alto que hay: no se puede subir, se buscan más reps.
    if (nuevo <= peso + 1e-9) return { accion: 'mantener', peso, reps: objetivo.repsMax, ultima, texto: t('Es el peso más alto disponible: busca más reps') }
    return { accion: 'subir', peso: nuevo, reps: objetivo.repsMin, ultima, texto: t('Completaste el rango: toca subir') }
  }
  // Bajar solo si de verdad costó: faltaron 2+ reps sin que el esfuerzo apuntado fuera bajo
  // (con esfuerzo ≤ 8 sobraban reps: se paró antes, no es que pese demasiado), o se llegó al fallo sin el mínimo.
  const esfuerzoAlto = rpeMax == null || rpeMax >= 9
  if ((algunaCorta && esfuerzoAlto && reps.some(r => r <= objetivo.repsMin - 2)) || (rpeMax != null && rpeMax >= 10 && algunaCorta)) {
    const menos = siguiente(lista, peso, -1)
    if (menos < peso - 1e-9) return { accion: 'bajar', peso: menos, reps: objetivo.repsMin, ultima, texto: t('Costó demasiado: baja un poco y suma reps') }
    return { accion: 'mantener', peso, reps: objetivo.repsMin, ultima, texto: t('Mantén el peso y busca más reps') }
  }
  if (muyDuro || algunaCorta) return { accion: 'mantener', peso, reps: objetivo.repsMin, ultima, texto: t('Mantén el peso y busca más reps') }
  return { accion: 'mantener', peso, reps: Math.min(objetivo.repsMax, Math.max(...reps) + 1), ultima, texto: t('Mismo peso, una rep más') }
}

type Marca = { peso: number; reps: number; e1rm: number }

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

type Logro = { tipo: 'peso' | 'reps' | 'e1rm'; texto: string; peso: number; reps: number }

/** ¿Esta serie es un récord frente al historial anterior del ejercicio? */
export function esRecord(s: Serie, historial: Serie[]): Logro | null {
  if (!s.hecha || s.calentamiento || s.peso == null || s.reps == null || s.peso <= 0 || s.reps <= 0) return null
  const prev = trabajo(historial).filter(x => x.peso != null && x.reps != null)
  if (!prev.length) return null
  const maxPeso = Math.max(...prev.map(x => x.peso!))
  if (s.peso > maxPeso) return { tipo: 'peso', texto: t('Nuevo récord de peso'), peso: s.peso, reps: s.reps }
  const mismas = prev.filter(x => x.peso === s.peso)
  if (mismas.length && s.reps > Math.max(...mismas.map(x => x.reps!))) return { tipo: 'reps', texto: t('Récord de repeticiones'), peso: s.peso, reps: s.reps }
  return null
}

export function volumen(series: Serie[]): number {
  return trabajo(series).reduce((t, s) => t + Math.max(0, s.peso ?? 0) * (s.reps ?? 0), 0)
}

// Primera carga a partir de los pesos de referencia del perfil

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
  const m = propio(DESDE_REFERENCIA, id)
  const r = m ? leerReferencia(propio(referencias, m.ref)) : null
  if (!m || !r) return null
  const reserva = Math.max(1, 10 - (Number.isFinite(objetivo.rpe) ? objetivo.rpe : 7))
  const bruto = (epley(r.peso, r.reps) * m.f * 0.9) / (1 + (objetivo.repsMin + reserva) / 30)
  const enLista = lista.length ? [...lista].reverse().find(v => v <= bruto + 1e-9) ?? lista[0]! : Math.floor(bruto / 2.5) * 2.5
  const peso = Math.max(0, enLista)
  if (!peso) return null
  return { accion: 'primera', peso, reps: objetivo.repsMin, ultima: null, texto: t('Por tu referencia ({ref}): empieza con {peso} kg y ajusta', { ref: referencias![m.ref]!, peso: kg(peso) }) }
}

// Primera vez sin historial ni referencia: peso de partida

export const TEXTO_PARTIDA = tk('Empieza con este y súbelo si va fácil')

/** Mínimo «razonable» para empezar según el material (antes de buscarlo en la lista de pesos reales). */
function minimoPartida(material: string | null | undefined, registro: TipoRegistro, lista: number[]): number {
  if (material && material in BARRAS) {
    // Barra vacía: con gimnasio, la lista de barra empieza en la propia barra; sin él (lista 0…300), la barra típica.
    return lista.length && lista[0]! > 0 ? lista[0]! : BARRAS[material]!
  }
  if (registro === 'mancuerna') return 4
  if (material === 'plates' || material === 'loop_band' || material === 'resistance_band') return 5
  return 10 // máquinas, poleas y lo demás: ~10 kg (la lista suele empezar en 0)
}

/**
 * Peso de partida sin historial ni referencia: la barra vacía, la mancuerna más ligera razonable o ~10 kg en
 * máquina; siempre uno que exista y nunca 0. Null para peso corporal, tiempo, cardio y asistidos (no cambian).
 */
export function pesoPartida(material: string | null | undefined, registro: TipoRegistro, lista: number[]): number | null {
  if (registro !== 'peso' && registro !== 'mancuerna') return null
  const positivos = lista.filter(v => Number.isFinite(v) && v > 0)
  const minimo = minimoPartida(material, registro, lista)
  if (!positivos.length) return minimo > 0 ? minimo : null
  // El primero que llega al mínimo; si todos son más ligeros, el más pesado que haya.
  return positivos.find(v => v >= minimo - 1e-9) ?? positivos[positivos.length - 1]!
}

/** Aplica el peso de partida a una sugerencia de «primera vez» que aún no tiene peso. */
export function conPartida(s: Sugerencia, material: string | null | undefined, registro: TipoRegistro, lista: number[]): Sugerencia {
  if (s.accion !== 'primera' || s.peso != null) return s
  const peso = pesoPartida(material, registro, lista)
  return peso == null ? s : { ...s, peso, partida: true, texto: t(TEXTO_PARTIDA) }
}

/** Series hechas de un ejercicio en una sesión terminada. */
export type Hecho = { sesionId: number; fecha: string; inicio: number; series: Serie[] }

/** Historial de un ejercicio dentro de una lista de sesiones ya leída (más reciente primero). */
export function historialEn(sesiones: Sesion[], id: string, excluir?: number): Hecho[] {
  const out: Hecho[] = []
  for (const s of sesiones) {
    if (s.id === excluir) continue
    for (const e of s.ejercicios) {
      if (e.ejercicio !== id) continue
      const series = e.series.filter(x => x.hecha)
      if (series.some(x => !x.calentamiento)) out.push({ sesionId: s.id!, fecha: s.fecha, inicio: s.inicio, series })
    }
  }
  return out
}

export function bloqueObjetivo(b: { repsMin: number; repsMax: number; rpe: number }) {
  return { repsMin: b.repsMin, repsMax: b.repsMax, rpe: b.rpe }
}
