// Ayudantes para escribir y leer datos en pantalla: números con la coma o el punto del idioma, series y textos.
import type { EjercicioSesion, Serie, TipoRegistro } from '../datos/tipos'
import { idioma, regionNumeros, t } from '../i18n'

/** Redondea a 1 decimal con la coma o el punto del idioma (en inglés, punto decimal y coma de miles). */
export function num(n: number | null | undefined, decimales = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  // Redondeo propio y sin «-0» (−0,04 con un decimal se vería como «-0»).
  const f = 10 ** decimales
  const r = Math.round(n * f) / f
  return (r === 0 ? 0 : r).toLocaleString(regionNumeros(), { minimumFractionDigits: 0, maximumFractionDigits: decimales })
}

/** Peso con coma y sin decimales sobrantes: 47,5 · 40 */
export const kg = (n: number | null | undefined) => num(n, 2)

/** Número con un número fijo de decimales: «79,0», «–0,03». */
export function fijo(v: number, d = 1): string {
  const f = 10 ** d
  const r = Math.round(v * f) / f
  return (r === 0 ? 0 : r).toLocaleString(regionNumeros(), { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Valor con su unidad: «26,3 %», «75 kg»; en inglés el % va pegado («26.3%»). */
export const conUnidad = (valor: string, u: string) => (!u ? valor : u === '%' && idioma() === 'en' ? `${valor}%` : `${valor} ${u}`)

/** Menos tipográfico (raya corta) del informe. */
export const MENOS = '–'

/** «+1,5», «–0,7», «0». */
export function conSigno(n: number, f: (v: number) => string = v => num(v)): string {
  const v = f(Math.abs(n))
  if (n === 0 || /^0([,.]0*)?$/.test(v)) return '0'
  return n > 0 ? `+${v}` : `${MENOS}${v}`
}

/** El número tal cual, sin redondear ni separar miles, con la coma o el punto del idioma: para rellenar un campo. */
export const decimal = (n: number) => (idioma() === 'en' ? String(n) : String(n).replace('.', ','))

/** Número escrito por el usuario, con coma o punto decimal («72,5», «72.5»); null si no lo es. */
export function leerNumero(s: string | null | undefined): number | null {
  const n = parseFloat((s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Primera letra en mayúscula: «martes» → «Martes». */
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Texto de una serie hecha. Dos estilos a propósito: «tabla» (Detalle del entreno: «47,5 × 8», «asist. 15 kg × 6»,
 * cardio en minutos) y «corto» (Lista y panel del entreno: «47,5 kg × 8», «ayuda 15 kg × 6»).
 */
export function textoSerie(x: Serie, registro: TipoRegistro, estilo: 'tabla' | 'corto'): string {
  if (estilo === 'tabla') {
    if (registro === 'tiempo') return `${x.segundos ?? x.reps ?? 0} s`
    if (registro === 'cardio') return x.segundos ? `${Math.round(x.segundos / 60)} min` : `${x.reps ?? 0} min`
    if (registro === 'corporal' || x.peso == null) return t('{n} reps', { n: x.reps ?? 0 })
    if (registro === 'asistido') return t('asist. {peso} × {reps}', { peso: kg(Math.abs(x.peso)), reps: x.reps ?? 0 })
    return `${kg(x.peso)} × ${x.reps ?? 0}`
  }
  if (registro === 'tiempo') return `${x.segundos ?? x.reps} s`
  if (registro === 'cardio') return `${x.reps} min`
  if (registro === 'corporal' || x.peso == null) return t('{n} reps', { n: String(x.reps) })
  return `${registro === 'asistido' ? t('ayuda {n}', { n: kg(Math.abs(x.peso)) }) : kg(x.peso)} kg × ${x.reps}`
}

/**
 * Serie en la lista del entreno en curso: la hecha con lo apuntado y la pendiente con el objetivo («20 kg × 8-12»).
 * Distinto de «corto»: el cardio va en reps y la asistencia como «asist.».
 */
export function textoSerieEnCurso(x: Serie, e: EjercicioSesion): string {
  const objetivo = `${e.repsMin}-${e.repsMax}`
  if (e.registro === 'tiempo') return x.hecha ? `${x.segundos ?? x.reps} s` : `${objetivo} s`
  if (e.registro === 'corporal' || x.peso == null) return t('{n} reps', { n: x.hecha ? String(x.reps) : objetivo })
  const p = e.registro === 'asistido' ? t('asist. {n} kg', { n: kg(Math.abs(x.peso)) }) : `${kg(x.peso)} kg`
  return `${p} × ${x.hecha ? x.reps : objetivo}`
}
