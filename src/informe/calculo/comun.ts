// Ayudantes del informe: formatos de número y fecha, el esfuerzo de las series y la fuerza de un ejercicio.
import type { EjercicioSesion, Serie, Sesion } from '../../datos/tipos'
import { conSigno, conUnidad, fijo, kg, num } from '../../dominio/formato'
import { DIAS_ABREV, MESES_CORTOS, deISO, diaSemana, fechaCorta, sumarDias } from '../../dominio/fechas'
import { hechasAsc, pesoMaximo, repsMaximas, seriesDe } from '../../dominio/tendencias'
import { t, tc, tk } from '../../i18n'
import type { EsfuerzoInforme, PalabraEsfuerzo, TonoInforme, UnidadFuerza } from './tipos'

export const r1 = (v: number) => Math.round(v * 10) / 10
export const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const media = (xs: number[]) => (xs.length ? suma(xs) / xs.length : null)
export const dia10 = (f: string) => f.slice(0, 10)
export const entre = (f: string, a: string, b: string) => f >= a && f <= b
export const anio = (f: string) => deISO(f).getFullYear()
export const trabajo = (s: Serie[]) => s.filter(x => x.hecha && !x.calentamiento)
export const conRpe = (s: Serie[]) => trabajo(s).filter(x => x.rpe != null && Number.isFinite(x.rpe))
export const unico = <T>(xs: T[]) => [...new Set(xs)]

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Formato común de una serie: si algún valor lleva decimal, todos lo llevan («79,0» junto a «80,1»). */
export function formatoSerie(vals: number[], d = 1): (v: number) => string {
  const f = 10 ** d
  const conDecimal = vals.some(v => Math.round(v * f) % f !== 0)
  return v => (conDecimal ? fijo(v, d) : num(v, 0))
}

/** «+10 %», «–8 %». */
export const textoPct = (p: number) => conUnidad(conSigno(p, v => String(Math.round(v))), '%')

/** Porcentaje de cambio redondeado: Math.round((hoy − normal) / normal × 100). */
export const pctCambio = (valor: number, normal: number): number | null => (normal ? Math.round(((valor - normal) / Math.abs(normal)) * 100) : null)

/** «1 h 8 min», «59 min», «1 h», «—». */
export function textoDuracion(min: number | null): string {
  if (min == null) return '—'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}

/** «mar 22 sep» */
export const fechaDia = (f: string) => `${DIAS_ABREV[diaSemana(deISO(f))]} ${fechaCorta(f)}`

/** «21-27 sep», «28 sep-4 oct» */
export function etiquetaSemana(desde: string, hasta: string): string {
  const a = deISO(desde), b = deISO(hasta)
  if (desde === hasta) return fechaCorta(desde)
  return a.getMonth() === b.getMonth() ? t('{desde}-{hasta} {mes}', { desde: a.getDate(), hasta: b.getDate(), mes: MESES_CORTOS[b.getMonth()]! }) : `${fechaCorta(desde)}-${fechaCorta(hasta)}`
}

/** Días seguidos desde `inicio` hasta `fin` (incluidos). */
export function diasDe(inicio: string, fin: string): string[] {
  const out: string[] = []
  for (let f = inicio; f <= fin; f = sumarDias(f, 1)) out.push(f)
  return out
}

/** Minutos de un entreno: fin − inicio; si falta, lo que dijo al terminar; si no, null. */
export function minutosSesion(s: Sesion): number | null {
  if (s.fin != null && s.fin > s.inicio) return Math.round((s.fin - s.inicio) / 60_000)
  const m = s.respuestas?.minutosReales
  return m != null && m > 0 ? Math.round(m) : null
}

const ZONAS_ESFUERZO: { palabra: PalabraEsfuerzo; tono: TonoInforme; rango: string }[] = [
  { palabra: tk('fácil'), tono: 'azul', rango: '6' },
  { palabra: tk('bien'), tono: 'ok', rango: '7-8' },
  { palabra: tk('duro'), tono: 'warn', rango: '9' },
  { palabra: tk('al límite'), tono: 'bad', rango: '10' },
]

/** Zona del esfuerzo redondeado a 1 decimal: hasta 6,4 fácil · 6,5-8,4 bien · 8,5-9,4 duro · desde 9,5 al límite. */
export function zonaEsfuerzo(v: number): number {
  const r = r1(v)
  return r < 6.5 ? 0 : r < 8.5 ? 1 : r < 9.5 ? 2 : 3
}

export function palabraEsfuerzo(v: number): { palabra: PalabraEsfuerzo; tono: TonoInforme; rango: string; texto: string } {
  const z = ZONAS_ESFUERZO[zonaEsfuerzo(v)]!
  return { palabra: z.palabra, tono: z.tono, rango: z.rango, texto: `${num(v)} ${t(z.palabra)}` }
}

/** «Qué dice» frente al objetivo: se compara la palabra, no los decimales. */
export function queDiceEsfuerzo(mediaV: number, objetivo: number): { texto: 'lo previsto' | 'más duro' | 'más fácil'; tono: TonoInforme } {
  const a = zonaEsfuerzo(mediaV), b = zonaEsfuerzo(objetivo)
  // El texto se traduce al pintarlo (t(queDice)).
  return a === b ? { texto: tk('lo previsto'), tono: 'ok' } : a > b ? { texto: tk('más duro'), tono: 'warn' } : { texto: tk('más fácil'), tono: 'azul' }
}

/** Media de las series de trabajo con esfuerzo marcado (las vacías no cuentan). */
export function mediaEsfuerzo(series: Serie[]): number | null {
  const v = media(conRpe(series).map(x => x.rpe!))
  return v == null ? null : r1(v)
}

/** Esfuerzo de un grupo de ejercicios (una sesión, un ejercicio o todo el periodo): cada serie pesa lo mismo. */
export function esfuerzoDe(ejs: EjercicioSesion[]): EsfuerzoInforme {
  const total = suma(ejs.map(e => trabajo(e.series).length))
  const valores = ejs.flatMap(e => conRpe(e.series).map(x => x.rpe!))
  const objetivosV = ejs.filter(e => conRpe(e.series).length).map(e => e.rpe)
  const m = media(valores)
  const obj = media(objetivosV)
  const marcadas = valores.length
  const pct = total ? Math.round((marcadas / total) * 100) : null
  const p = m == null ? null : palabraEsfuerzo(m)
  return {
    media: m == null ? null : r1(m),
    palabra: p?.palabra ?? null,
    tono: p?.tono ?? 'gris',
    texto: p?.texto ?? t('sin marcar'),
    marcadas, total, pct,
    pocas: total > 0 && marcadas / total < 0.3,
    objetivo: obj == null ? null : r1(obj),
  }
}

/** Cómo se mide un ejercicio en las gráficas: kg, ayuda (asistidos, menos es mejor), repeticiones o segundos. */
export function unidadFuerza(sesiones: Sesion[], id: string): UnidadFuerza {
  const series = sesiones.flatMap(s => trabajo(seriesDe(s, id)))
  if (series.some(x => x.peso != null && x.peso > 0 && (x.reps ?? 0) > 0)) return 'kg'
  if (series.some(x => x.peso != null && x.peso < 0)) return 'asistido'
  if (series.some(x => (x.reps ?? 0) > 0)) return 'reps'
  return 's'
}

/** Valor de un día según la unidad: peso máximo, ayuda mínima (en positivo), reps máximas o segundos máximos. */
export function valorFuerza(series: Serie[], unidad: UnidadFuerza): number | null {
  if (unidad === 'kg') { const p = pesoMaximo(series); return p != null && p > 0 ? p : null }
  if (unidad === 'asistido') {
    const p = trabajo(series).filter(x => x.peso != null && x.peso < 0).map(x => x.peso!)
    return p.length ? -Math.max(...p) : null
  }
  if (unidad === 'reps') return repsMaximas(series)
  const s = trabajo(series).map(x => x.segundos ?? 0).filter(x => x > 0)
  return s.length ? Math.max(...s) : null
}

/** La serie más pesada (a igualdad, la de más reps). */
function serieTop(series: Serie[]): Serie {
  return trabajo(series).reduce((a, b) => ((b.peso ?? -Infinity) > (a.peso ?? -Infinity) || ((b.peso ?? -Infinity) === (a.peso ?? -Infinity) && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a))
}

/** «55 kg», «ayuda 15 kg», «12 reps», «40 s» */
export function textoFuerza(v: number, unidad: UnidadFuerza): string {
  if (unidad === 'kg') return `${kg(v)} kg`
  if (unidad === 'asistido') return t('ayuda {kg} kg', { kg: kg(v) })
  if (unidad === 'reps') return t('{n} reps', { n: num(v, 0) })
  return `${num(v, 0)} s`
}

/** «55 kg × 6», «12 reps», «40 s», «ayuda 15 kg × 6» */
export function textoSerie(series: Serie[], unidad: UnidadFuerza): string {
  if (unidad === 'kg' || unidad === 'asistido') {
    const top = serieTop(series)
    return `${unidad === 'kg' ? `${kg(top.peso!)} kg` : t('ayuda {kg} kg', { kg: kg(-top.peso!) })} × ${top.reps}`
  }
  return textoFuerza(valorFuerza(series, unidad)!, unidad)
}

export const unidadCorta = (u: UnidadFuerza) => (u === 'reps' ? tc('unidad', 'reps') : u === 's' ? 's' : 'kg')

/** Puntos de un ejercicio, sesión a sesión (de más antiguo a más reciente), con su unidad. */
export function serieFuerza(sesiones: Sesion[], id: string, unidad = unidadFuerza(sesiones, id)): { fecha: string; sesionId: number | null; valor: number; series: Serie[] }[] {
  const out: { fecha: string; sesionId: number | null; valor: number; series: Serie[] }[] = []
  for (const s of hechasAsc(sesiones)) {
    const series = seriesDe(s, id)
    const v = valorFuerza(series, unidad)
    if (v != null) out.push({ fecha: s.fecha, sesionId: s.id ?? null, valor: Math.round(v * 100) / 100, series })
  }
  return out
}

/** Agrupa por clave en el orden en que llegan. */
export function agrupar<T>(xs: T[], clave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = clave(x)
    const l = m.get(k)
    if (l) l.push(x)
    else m.set(k, [x])
  }
  return m
}
