// Tendencias y progreso: funciones puras que usa la pestaña Progreso
// (récords, subidas, gráficas por ejercicio, medidas, metas, hitos y pasos).
import type { Comida, Medicion, Perfil, Serie, Sesion, TipoRegistro } from '../datos/tipos'
import { epley, grasaMarina } from './calculos'
import { diasEntre, lunesDe, sumarDias } from './fechas'
import { volumen } from './progresion'

export type PuntoFecha = { fecha: string; valor: number }

const trabajo = (s: Serie[]) => s.filter(x => x.hecha && !x.calentamiento)
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Sesiones terminadas, de la más antigua a la más reciente. */
export function hechasAsc(sesiones: Sesion[]): Sesion[] {
  return sesiones.filter(s => s.estado === 'hecha').sort((a, b) => a.inicio - b.inicio)
}

/** Todas las series de un ejercicio dentro de una sesión (puede aparecer más de una vez). */
export function seriesDe(s: Sesion, id: string): Serie[] {
  return s.ejercicios.filter(e => e.ejercicio === id).flatMap(e => e.series)
}

/** Peso máximo de las series de trabajo hechas (con alguna repetición). */
export function pesoMaximo(series: Serie[]): number | null {
  const p = trabajo(series).filter(x => x.peso != null && (x.reps ?? 0) > 0).map(x => x.peso!)
  return p.length ? Math.max(...p) : null
}

/** Mejor 1RM estimado (Epley) de las series de trabajo. */
export function mejor1RM(series: Serie[]): number | null {
  const v = trabajo(series).filter(x => x.peso != null && x.peso > 0 && (x.reps ?? 0) > 0).map(x => epley(x.peso!, x.reps!))
  return v.length ? Math.max(...v) : null
}

/** Repeticiones máximas en una serie de trabajo. */
export function repsMaximas(series: Serie[]): number | null {
  const r = trabajo(series).map(x => x.reps ?? 0).filter(x => x > 0)
  return r.length ? Math.max(...r) : null
}

export type Medida = 'peso' | 'e1rm' | 'volumen'

/** Evolución de un ejercicio sesión a sesión según la medida elegida. */
export function evolucion(sesiones: Sesion[], id: string, medida: Medida): PuntoFecha[] {
  const out: PuntoFecha[] = []
  for (const s of hechasAsc(sesiones)) {
    const series = seriesDe(s, id)
    if (!trabajo(series).length) continue
    const v = medida === 'peso' ? pesoMaximo(series) : medida === 'e1rm' ? mejor1RM(series) : volumen(series)
    if (v == null || (medida !== 'peso' && v <= 0)) continue
    out.push({ fecha: s.fecha, valor: Math.round(v * 10) / 10 })
  }
  return out
}

/** Ejercicios hechos alguna vez, los más repetidos primero (a igualdad, el más reciente). */
export function ejerciciosHechos(sesiones: Sesion[]): string[] {
  const cuenta = new Map<string, { n: number; ultimo: number }>()
  for (const s of hechasAsc(sesiones)) for (const e of s.ejercicios) {
    if (!trabajo(e.series).length) continue
    const c = cuenta.get(e.ejercicio)
    cuenta.set(e.ejercicio, { n: (c?.n ?? 0) + 1, ultimo: s.inicio })
  }
  return [...cuenta.entries()].sort((a, b) => b[1].n - a[1].n || b[1].ultimo - a[1].ultimo).map(([id]) => id)
}

export type Subida = { ejercicio: string; fecha: string; sesionId?: number; antes: number; ahora: number }

/** Ejercicios cuyo peso máximo subió frente a la sesión anterior en que se hicieron (más recientes primero). */
export function subidas(sesiones: Sesion[]): Subida[] {
  const ultimo = new Map<string, number>()
  const out: Subida[] = []
  for (const s of hechasAsc(sesiones)) {
    for (const id of new Set(s.ejercicios.map(e => e.ejercicio))) {
      const p = pesoMaximo(seriesDe(s, id))
      // Las asistidas (peso negativo) no cuentan como subida de peso.
      if (p == null || p <= 0) continue
      const antes = ultimo.get(id)
      if (antes != null && p > antes) out.push({ ejercicio: id, fecha: s.fecha, sesionId: s.id, antes, ahora: p })
      ultimo.set(id, p)
    }
  }
  return out.reverse()
}

export type Logro = { ejercicio: string; fecha: string; sesionId?: number; peso: number; reps: number; tipo: 'peso' | 'reps' | 'primero'; mejora: number }

/** Récords (series marcadas como récord), uno por ejercicio y sesión, más recientes primero. */
export function logros(sesiones: Sesion[]): Logro[] {
  const historial = new Map<string, Serie[]>()
  const out: Logro[] = []
  for (const s of hechasAsc(sesiones)) {
    for (const id of new Set(s.ejercicios.map(e => e.ejercicio))) {
      const series = seriesDe(s, id)
      const prev = trabajo(historial.get(id) ?? []).filter(x => x.peso != null && x.reps != null)
      const recs = trabajo(series).filter(x => x.record && x.peso != null && x.reps != null)
      if (recs.length) {
        const mejor = recs.reduce((a, b) => (epley(b.peso!, b.reps!) > epley(a.peso!, a.reps!) ? b : a))
        const base = { ejercicio: id, fecha: s.fecha, sesionId: s.id, peso: mejor.peso!, reps: mejor.reps! }
        if (!prev.length) out.push({ ...base, tipo: 'primero', mejora: 0 })
        else {
          const maxPeso = Math.max(...prev.map(x => x.peso!))
          if (mejor.peso! > maxPeso) out.push({ ...base, tipo: 'peso', mejora: mejor.peso! - maxPeso })
          else {
            const mismas = prev.filter(x => x.peso === mejor.peso).map(x => x.reps!)
            out.push({ ...base, tipo: 'reps', mejora: mismas.length ? Math.max(1, mejor.reps! - Math.max(...mismas)) : 1 })
          }
        }
      }
      historial.set(id, [...(historial.get(id) ?? []), ...series])
    }
  }
  return out.reverse()
}

/** Series marcadas como récord en sesiones hechas de esos días. */
export function recordsEn(sesiones: Sesion[], dias: string[]): number {
  return sesiones.filter(s => s.estado === 'hecha' && dias.includes(s.fecha))
    .reduce((t, s) => t + s.ejercicios.reduce((a, e) => a + trabajo(e.series).filter(x => x.record).length, 0), 0)
}

// ---------- series por grupo muscular ----------

export const GRUPOS_MUSCULARES: { n: string; patrones: string[]; zona: [number, number] }[] = [
  { n: 'Pecho', patrones: ['empuje-h', 'pecho-aisl'], zona: [10, 20] },
  { n: 'Espalda', patrones: ['tiron-h', 'tiron-v', 'lumbar'], zona: [10, 20] },
  { n: 'Piernas', patrones: ['rodilla', 'cadera', 'cuadriceps', 'femoral', 'gluteo', 'gemelo'], zona: [10, 20] },
  { n: 'Hombros', patrones: ['empuje-v', 'hombro-lat', 'hombro-post', 'trapecio'], zona: [8, 16] },
  { n: 'Brazos', patrones: ['biceps', 'triceps', 'antebrazo'], zona: [8, 16] },
  { n: 'Core', patrones: ['core'], zona: [4, 10] },
]

/** Series de trabajo hechas por grupo muscular en esos días. `patronDe` da el patrón de un ejercicio. */
export function seriesPorGrupo(sesiones: Sesion[], dias: string[], patronDe: (id: string) => string | undefined): { n: string; v: number; zona: [number, number] }[] {
  const cuenta = new Map(GRUPOS_MUSCULARES.map(g => [g.n, 0]))
  for (const s of sesiones) {
    if (s.estado !== 'hecha' || !dias.includes(s.fecha)) continue
    for (const e of s.ejercicios) {
      const p = patronDe(e.ejercicio)
      const g = GRUPOS_MUSCULARES.find(x => p != null && x.patrones.includes(p))
      if (g) cuenta.set(g.n, (cuenta.get(g.n) ?? 0) + trabajo(e.series).length)
    }
  }
  return GRUPOS_MUSCULARES.map(g => ({ n: g.n, v: cuenta.get(g.n) ?? 0, zona: g.zona }))
}

// ---------- medidas del cuerpo ----------

export type Lector = (m: Medicion) => number | undefined

/** Un punto por día (el último del día), de más antiguo a más reciente. */
export function serieMedida(ms: Medicion[], f: Lector): PuntoFecha[] {
  const porDia = new Map<string, number>()
  for (const m of [...ms].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const v = f(m)
    if (v != null) porDia.set(m.fecha.slice(0, 10), v)
  }
  return [...porDia.entries()].map(([fecha, valor]) => ({ fecha, valor }))
}

/** Último valor conocido hasta una fecha (incluida). */
export function ultimoValor(ms: Medicion[], f: Lector, hasta?: string): PuntoFecha | null {
  let mejor: Medicion | null = null
  for (const m of ms) {
    if (f(m) == null || (hasta && m.fecha.slice(0, 10) > hasta)) continue
    if (!mejor || m.fecha > mejor.fecha) mejor = m
  }
  return mejor ? { fecha: mejor.fecha.slice(0, 10), valor: f(mejor)! } : null
}

/** Media de cada semana (lunes a domingo); la fecha del punto es el lunes. */
export function mediasSemanales(ms: Medicion[], f: Lector): PuntoFecha[] {
  const sem = new Map<string, number[]>()
  for (const m of ms) {
    const v = f(m)
    if (v == null) continue
    const l = lunesDe(m.fecha.slice(0, 10))
    sem.set(l, [...(sem.get(l) ?? []), v])
  }
  return [...sem.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, vs]) => ({ fecha, valor: media(vs)! }))
}

/** Pendiente por semana (mínimos cuadrados). Null si no hay al menos dos fechas distintas. */
export function pendienteSemanal(ps: PuntoFecha[]): number | null {
  if (ps.length < 2) return null
  const x0 = ps[0]!.fecha
  const xs = ps.map(p => diasEntre(x0, p.fecha) / 7)
  const ys = ps.map(p => p.valor)
  const mx = media(xs)!, my = media(ys)!
  const den = xs.reduce((t, x) => t + (x - mx) ** 2, 0)
  if (den === 0) return null
  return xs.reduce((t, x, i) => t + (x - mx) * (ys[i]! - my), 0) / den
}

/** % de grasa estimado por medidas (Marina) para cada día con cintura, con el último cuello y cadera conocidos. */
export function grasaPorMedidas(ms: Medicion[], sexo: Perfil['sexo'], alturaCm: number): PuntoFecha[] {
  const out: PuntoFecha[] = []
  for (const p of serieMedida(ms, m => m.perimetros?.cintura)) {
    const cuello = ultimoValor(ms, m => m.perimetros?.cuello, p.fecha)?.valor
    const cadera = ultimoValor(ms, m => m.perimetros?.cadera, p.fecha)?.valor
    const g = grasaMarina(sexo, alturaCm, p.valor, cuello, cadera)
    if (g != null && g > 0 && g < 70) out.push({ fecha: p.fecha, valor: Math.round(g * 10) / 10 })
  }
  return out
}

/** Datos para el consejo quincenal: las dos semanas que terminan en `domingo`. */
export function datosQuincena(o: { domingo: string; mediciones: Medicion[]; comidas: Comida[] }) {
  const inicio = sumarDias(o.domingo, -13)
  const entre = (f: string, a: string, b: string) => f >= a && f <= b
  const cint: Lector = m => m.perimetros?.cintura
  const cAhora = ultimoValor(o.mediciones, cint, o.domingo)
  const cAntes = ultimoValor(o.mediciones, cint, sumarDias(inicio, -1))
  const pesos = (a: string, b: string) => media(o.mediciones.filter(m => m.pesoKg != null && entre(m.fecha.slice(0, 10), a, b)).map(m => m.pesoKg!))
  const pAhora = pesos(sumarDias(o.domingo, -6), o.domingo)
  const pAntes = pesos(sumarDias(o.domingo, -20), sumarDias(o.domingo, -14)) ?? pesos(inicio, sumarDias(o.domingo, -7))
  const deQuincena = o.comidas.filter(c => entre(c.fecha, inicio, o.domingo))
  const porDia = new Map<string, number>()
  for (const c of deQuincena) porDia.set(c.fecha, (porDia.get(c.fecha) ?? 0) + c.proteina)
  return {
    cinturaDelta: cAhora && cAntes && cAhora.fecha !== cAntes.fecha ? cAhora.valor - cAntes.valor : null,
    pesoDelta: pAhora != null && pAntes != null ? pAhora - pAntes : null,
    picoteoDias: new Set(deQuincena.filter(c => c.tipo === 'picoteo').map(c => c.fecha)).size,
    proteinaMedia: media([...porDia.values()]),
  }
}

// ---------- metas ----------

/** Progreso (0 a 1) desde el valor inicial hasta el objetivo, sirve para metas que bajan o suben. */
export function progresoMeta(inicio: number | null | undefined, actual: number | null, objetivo: number): number {
  if (actual == null) return 0
  const desde = inicio ?? actual
  if (desde === objetivo) return actual === objetivo ? 1 : 0
  const f = (actual - desde) / (objetivo - desde)
  return Math.max(0, Math.min(1, f))
}

/** Lo que falta para el objetivo (0 si ya se alcanzó). La dirección la marca el valor inicial. */
export function faltaMeta(inicio: number | null | undefined, actual: number | null, objetivo: number): number | null {
  if (actual == null) return null
  const baja = objetivo < (inicio ?? actual)
  return Math.max(0, baja ? actual - objetivo : objetivo - actual)
}

// ---------- dominadas ----------

const DOMINADA = /(pull-?ups?|chin-?ups?)/
const NO_ESTRICTA = /(assisted|negative|band|australian|inverted|jumping|kipping|scapular)/

export const esDominadaEstricta = (id: string, registro: TipoRegistro) => DOMINADA.test(id) && !NO_ESTRICTA.test(id) && registro !== 'asistido'
export const esDominadaAsistida = (id: string, registro: TipoRegistro) => (DOMINADA.test(id) || /assisted-pull/.test(id)) && (registro === 'asistido' || /assisted/.test(id))
export const esDominadaNegativa = (id: string) => DOMINADA.test(id) && /negative/.test(id)

export type Hito = { titulo: string; detalle: string; fecha: string | null; estado: 'hecho' | 'actual' | 'pendiente' }

/** Hitos guiados de las dominadas: asistidas → negativas → 1 → 3 → 5 estrictas. */
export function hitosDominadas(sesiones: Sesion[]): { hitos: Hito[]; estrictas: number; hay: boolean } {
  let asist: string | null = null, neg: string | null = null
  const estrictas: (string | null)[] = [null, null, null] // 1, 3, 5
  let max = 0, hay = false
  for (const s of hechasAsc(sesiones)) {
    for (const e of s.ejercicios) {
      const t = trabajo(e.series)
      if (!t.length) continue
      if (esDominadaAsistida(e.ejercicio, e.registro)) {
        hay = true
        if (!asist && t.some(x => x.peso != null && Math.abs(x.peso) <= 15 && (x.reps ?? 0) >= 5)) asist = s.fecha
      } else if (esDominadaNegativa(e.ejercicio)) {
        hay = true
        if (!neg && t.filter(x => (x.reps ?? 0) >= 5).length >= 3) neg = s.fecha
      } else if (esDominadaEstricta(e.ejercicio, e.registro)) {
        hay = true
        const r = Math.max(...t.map(x => x.reps ?? 0))
        max = Math.max(max, r)
        ;[1, 3, 5].forEach((n, i) => { if (!estrictas[i] && r >= n) estrictas[i] = s.fecha })
      }
    }
  }
  const base: Omit<Hito, 'estado'>[] = [
    { titulo: 'Asistidas: hasta −15 kg', detalle: 'Ve quitando ayuda poco a poco', fecha: asist },
    { titulo: 'Negativas: 3 × 5', detalle: 'Bajar despacio, 3-5 segundos', fecha: neg },
    { titulo: '1 dominada estricta', detalle: 'Sin asistencia', fecha: estrictas[0]! },
    { titulo: '3 estrictas', detalle: 'En una misma serie', fecha: estrictas[1]! },
    { titulo: '5 estrictas', detalle: 'Meta', fecha: estrictas[2]! },
  ]
  // Un hito cuenta como hecho si se logró o si ya se superó uno posterior.
  const ultimoHecho = base.map(h => h.fecha != null).lastIndexOf(true)
  const hitos = base.map((h, i): Hito => ({ ...h, estado: i <= ultimoHecho ? 'hecho' : i === ultimoHecho + 1 ? 'actual' : 'pendiente' }))
  return { hitos, estrictas: max, hay }
}

// ---------- pasos ----------

export const PASOS_POR_KM = 1300
export const PASOS_POR_MINUTO = 160

/** Pasos equivalentes a un trote, redondeados a 10. */
export function pasosEquivalentes(valor: number, modo: 'km' | 'min'): number {
  return Math.round((Math.max(0, valor) * (modo === 'km' ? PASOS_POR_KM : PASOS_POR_MINUTO)) / 10) * 10
}

// ---------- mini gráfica ----------

/** Puntos «x,y» de una línea pequeña (sparkline) dentro de un lienzo w × h. */
export function puntosSpark(valores: number[], w = 120, h = 40, margen = 4): { x: number; y: number }[] {
  if (!valores.length) return []
  const min = Math.min(...valores), max = Math.max(...valores)
  const rango = max - min || 1
  return valores.map((v, i) => ({
    x: Math.round((valores.length === 1 ? w / 2 : margen + (i * (w - 2 * margen)) / (valores.length - 1)) * 10) / 10,
    y: Math.round((max === min ? h / 2 : h - margen - ((v - min) / rango) * (h - 2 * margen)) * 10) / 10,
  }))
}
