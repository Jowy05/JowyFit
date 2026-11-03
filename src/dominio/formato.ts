// Ayudantes para escribir y leer datos en pantalla: números con la coma o el punto del idioma, series y textos.
import type { EjercicioSesion, Serie, TipoRegistro } from '../datos/tipos'
import { idioma, regionNumeros, t, tc } from '../i18n'
import { claseDistancia, type ClaseDistancia } from '../catalogo/clasificacion'

/** Redondea a 1 decimal con la coma o el punto del idioma (en inglés, punto decimal y coma de miles). */
export function num(n: number | null | undefined, decimales = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  // Redondeo propio y sin «-0» (−0,04 con un decimal se vería como «-0»).
  const f = 10 ** decimales
  const r = Math.round(n * f) / f
  return (r === 0 ? 0 : r).toLocaleString(regionNumeros(), { minimumFractionDigits: 0, maximumFractionDigits: decimales })
}

/** Número entero con la separación de miles del idioma: «12.500» (en inglés, «12,500»; con 4 cifras, «8000» y «8,000»). */
export const miles = (n: number) => num(n, 0)

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

/**
 * Lista en una frase: «a», «a y b», «a, b y c». Con tres o más va con contexto «3+»: en inglés lleva coma antes de
 * «and» («a, b, and c»); en catalán, «a, b i c».
 */
export function enLista(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  const v = { lista: xs.slice(0, -1).join(', '), ultimo: xs[xs.length - 1]! }
  return xs.length > 2 ? tc('3+', '{lista} y {ultimo}', v) : t('{lista} y {ultimo}', v)
}

/** Primera letra en mayúscula: «martes» → «Martes». */
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Las repeticiones de una serie: «8», «8 por lado» o, si un lado hizo distinto, «8 izq. · 7 der.». */
export function textoReps(x: Pick<Serie, 'reps' | 'izq' | 'der'>, porLado = false): string {
  if (x.izq != null && x.der != null && x.izq !== x.der) return t('{izq} izq. · {der} der.', { izq: x.izq, der: x.der })
  const n = String(x.izq ?? x.reps ?? 0)
  return porLado || x.izq != null ? t('{n} por lado', { n }) : n
}

/** Minutos de una serie de cardio (van en `reps`; las de antes podían ir en segundos). */
export const minutosCardio = (x: Pick<Serie, 'reps' | 'segundos'>) => (x.segundos ? x.segundos / 60 : x.reps ?? 0)

/**
 * Ritmo de un cardio con distancia: andando o corriendo, «6:00 min/km»; en bici, «18 km/h». Null si no tiene sentido
 * (remo, elíptica, sin km o sin minutos).
 */
export function ritmo(min: number, km: number | null | undefined, clase: ClaseDistancia | null): string | null {
  if (!(min > 0) || km == null || !(km > 0) || (clase !== 'pie' && clase !== 'rueda')) return null
  if (clase === 'rueda') return `${num(km / (min / 60), 1)} km/h`
  const s = Math.round((min * 60) / km)
  // Más de una hora por km no es andar: un km mal apuntado.
  if (s >= 3600) return null
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min/km`
}

/** Distancia y ritmo de una serie de cardio: « · 5 km · 6:00 min/km» (vacío sin km). */
function conKm(x: Serie, id: string | undefined, conRitmo: boolean): string {
  if (x.km == null || !(x.km > 0)) return ''
  const r = conRitmo ? ritmo(minutosCardio(x), x.km, id ? claseDistancia(id) : null) : null
  return ` · ${num(x.km, 2)} km${r ? ` · ${r}` : ''}`
}

/**
 * Texto de una serie hecha. Dos estilos a propósito: «tabla» (Detalle del entreno: «47,5 × 8», «asist. 15 kg × 6»,
 * cardio en minutos con su ritmo) y «corto» (Lista y panel del entreno: «47,5 kg × 8», «ayuda 15 kg × 6»). Con el
 * id del ejercicio, el cardio con distancia lleva su ritmo.
 */
export function textoSerie(x: Serie, registro: TipoRegistro, estilo: 'tabla' | 'corto', id?: string): string {
  const reps = textoReps(x)
  const lastre = registro === 'corporal' && x.peso != null && x.peso > 0 ? kg(x.peso) : null
  if (estilo === 'tabla') {
    if (registro === 'tiempo') return `${x.segundos ?? x.reps ?? 0} s`
    if (registro === 'cardio') return `${Math.round(minutosCardio(x))} min${conKm(x, id, true)}`
    if (lastre) return t('lastre {peso} × {reps}', { peso: lastre, reps })
    if (registro === 'corporal' || x.peso == null) return x.izq != null ? reps : t('{n} reps', { n: x.reps ?? 0 })
    if (registro === 'asistido') return t('asist. {peso} × {reps}', { peso: kg(Math.abs(x.peso)), reps })
    return `${kg(x.peso)} × ${reps}`
  }
  if (registro === 'tiempo') return `${x.segundos ?? x.reps} s`
  if (registro === 'cardio') return `${x.reps} min${conKm(x, id, false)}`
  if (lastre) return `${t('lastre {n} kg', { n: lastre })} × ${reps}`
  if (registro === 'corporal' || x.peso == null) return x.izq != null ? reps : t('{n} reps', { n: String(x.reps) })
  return `${registro === 'asistido' ? t('ayuda {n}', { n: kg(Math.abs(x.peso)) }) : kg(x.peso)} kg × ${reps}`
}

/**
 * Serie en la lista del entreno en curso: la hecha con lo apuntado y la pendiente con el objetivo («20 kg × 8-12»).
 * Distinto de «corto»: la asistencia va como «asist.». `porLado`: el ejercicio se hace con un lado cada vez.
 */
export function textoSerieEnCurso(x: Serie, e: EjercicioSesion, porLado = false): string {
  const objetivo = `${e.repsMin}-${e.repsMax}`
  if (e.registro === 'tiempo') return x.hecha ? `${x.segundos ?? x.reps} s` : `${objetivo} s`
  if (e.registro === 'cardio') return x.hecha ? `${x.reps} min${conKm(x, e.ejercicio, false)}` : `${objetivo} min`
  const reps = x.hecha ? textoReps(x, porLado) : porLado ? t('{n} por lado', { n: objetivo }) : objetivo
  const lastre = e.registro === 'corporal' && x.peso != null && x.peso > 0
  if (!lastre && (e.registro === 'corporal' || x.peso == null)) return porLado ? reps : t('{n} reps', { n: reps })
  const p = lastre ? t('lastre {n} kg', { n: kg(x.peso) }) : e.registro === 'asistido' ? t('asist. {n} kg', { n: kg(Math.abs(x.peso!)) }) : `${kg(x.peso)} kg`
  return `${p} × ${reps}`
}

/** Los kilos que tocan: «47,5 kg» o, en los de peso corporal, «lastre 5 kg». */
export const textoKilos = (peso: number, registro: TipoRegistro) => (registro === 'corporal' ? t('lastre {n} kg', { n: kg(peso) }) : `${kg(peso)} kg`)

/** Una marca (récord o mejor serie): «47,5 kg × 8», «lastre 5 kg × 8», «10 kg × 8 por lado». */
export function textoMarca(m: { peso: number | null; reps: number | null; lastre?: boolean; porLado?: boolean }): string {
  const marca = `${m.lastre ? t('lastre {n} kg', { n: kg(m.peso) }) : `${kg(m.peso)} kg`} × ${m.reps ?? 0}`
  return m.porLado ? t('{marca} por lado', { marca }) : marca
}

/** El texto de un error para enseñarlo en un aviso. */
export const mensajeDe = (e: unknown): string => String((e as Error)?.message ?? e)

/** Lo que ocupa un archivo: «820 KB» o «27,7 MB». */
export function tamanoArchivo(bytes: number): string {
  const MB = 1024 * 1024
  return bytes >= MB ? `${num(bytes / MB, 1)} MB` : `${miles(Math.max(1, Math.round(bytes / 1024)))} KB`
}
