// Peso y % de grasa de la báscula que llegan por Health Connect (la app de la báscula los escribe allí).
// Health Connect da el peso y la grasa por separado: aquí se juntan los de la misma pesada y se quitan
// los que ya están en la app (traídos antes o apuntados a mano), para no tener la misma medida dos veces.
import type { Medicion } from '../datos/tipos'

/** Un dato suelto de Health Connect: cuándo (ISO), el valor, su id y la app que lo escribió. */
export type MuestraHC = { fecha: string; valor: number; id?: string; fuente?: string }
/** Una pesada: peso, grasa o los dos. */
export type LecturaBascula = { fecha: string; pesoKg?: number; grasaPct?: number; ids: string[]; fuente?: string }

/** Peso y grasa de la misma pesada si se tomaron con menos de 10 minutos de diferencia. */
const MISMA_PESADA_MS = 10 * 60_000
const valido = { peso: (v: number) => v >= 25 && v <= 300, grasa: (v: number) => v >= 2 && v <= 70 }

export function juntarBascula(pesos: MuestraHC[], grasas: MuestraHC[]): LecturaBascula[] {
  const t = (m: { fecha: string }) => new Date(m.fecha).getTime()
  const out: LecturaBascula[] = pesos
    .filter(p => valido.peso(p.valor))
    .map(p => ({ fecha: p.fecha, pesoKg: Math.round(p.valor * 10) / 10, ids: p.id ? [p.id] : [], fuente: p.fuente }))
  const gs = grasas.filter(x => valido.grasa(x.valor))
  // Cada grasa con el peso más cercano, empezando por las parejas más juntas. Antes se iban emparejando en el orden
  // en que llegaban: una grasa de 8 minutos antes se quedaba el peso y la de la misma pesada (a 10 s) iba suelta.
  const pares: { p: number; g: number; d: number }[] = []
  out.forEach((l, p) => gs.forEach((g, i) => { const d = Math.abs(t(l) - t(g)); if (d <= MISMA_PESADA_MS) pares.push({ p, g: i, d }) }))
  pares.sort((a, b) => a.d - b.d)
  const pareja = new Map<number, number>()
  const conGrasa = new Set<number>()
  for (const x of pares) if (!pareja.has(x.g) && !conGrasa.has(x.p)) { pareja.set(x.g, x.p); conGrasa.add(x.p) }
  const solas: LecturaBascula[] = []
  gs.forEach((g, i) => {
    const grasaPct = Math.round(g.valor * 10) / 10
    const p = pareja.get(i)
    if (p != null) { out[p]!.grasaPct = grasaPct; if (g.id) out[p]!.ids.push(g.id) }
    else solas.push({ fecha: g.fecha, grasaPct, ids: g.id ? [g.id] : [], fuente: g.fuente })
  })
  out.push(...solas)
  // Dos apps que escriben la misma pesada (mismo peso, casi a la vez) cuentan como una sola.
  const unicas: LecturaBascula[] = []
  for (const l of out.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const igual = unicas.find(u => u.pesoKg != null && l.pesoKg != null && Math.abs(u.pesoKg - l.pesoKg) < 0.15
      && Math.abs(new Date(u.fecha).getTime() - new Date(l.fecha).getTime()) <= MISMA_PESADA_MS)
    if (igual) { igual.ids.push(...l.ids); if (igual.grasaPct == null && l.grasaPct != null) igual.grasaPct = l.grasaPct }
    else unicas.push(l)
  }
  return unicas
}

/** Fecha y hora local «AAAA-MM-DDTHH:MM», como guarda la app las mediciones. */
export function fechaLocal(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Las pesadas que aún no están en la app. Una ya está si se trajo antes (mismo id de Health Connect) o si ese
 * mismo día hay una medición con el mismo peso (o la misma grasa, si solo trae grasa): la apuntaste a mano.
 */
export function lecturasNuevas(lecturas: LecturaBascula[], mediciones: Medicion[], ignorados: string[] = []): LecturaBascula[] {
  const vistos = new Set([...mediciones.flatMap(m => m.hc ?? []), ...ignorados])
  return lecturas.filter(l => {
    if (l.ids.some(id => vistos.has(id))) return false
    const dia = fechaLocal(l.fecha).slice(0, 10)
    const ese = mediciones.filter(m => m.fecha.slice(0, 10) === dia)
    if (l.pesoKg != null) return !ese.some(m => m.pesoKg != null && Math.abs(m.pesoKg - l.pesoKg!) < 0.15)
    return !ese.some(m => m.bascula?.grasaPct != null && Math.abs(m.bascula.grasaPct - l.grasaPct!) < 0.15)
  })
}

/**
 * La grasa que llegó a Health Connect después de traer el peso (la báscula la sincroniza más tarde): se añade a la
 * pesada que ya está en la app. Devuelve qué medición completar, con qué grasa y con qué ids nuevos.
 */
export function grasaTardia(lecturas: LecturaBascula[], mediciones: Medicion[]): { id: number; grasaPct: number; ids: string[] }[] {
  const out: { id: number; grasaPct: number; ids: string[] }[] = []
  for (const l of lecturas) {
    if (l.grasaPct == null) continue
    const m = mediciones.find(x => x.id != null && x.hc?.some(id => l.ids.includes(id)))
    if (!m || m.bascula?.grasaPct != null) continue
    const nuevos = l.ids.filter(id => !m.hc!.includes(id))
    if (nuevos.length) out.push({ id: m.id!, grasaPct: l.grasaPct, ids: nuevos })
  }
  return out
}

/** La medición que se guarda: báscula de casa, con el peso, la grasa y de dónde viene. */
export function medicionDeLectura(l: LecturaBascula): Medicion {
  return {
    fecha: fechaLocal(l.fecha),
    origen: 'casa',
    ...(l.pesoKg != null ? { pesoKg: l.pesoKg } : {}),
    ...(l.grasaPct != null ? { bascula: { grasaPct: l.grasaPct } } : {}),
    hc: l.ids,
    ...(l.fuente ? { fuente: l.fuente } : {}),
  }
}

/** Nombre de la app que escribió el dato: Health Connect a veces solo da el paquete («com.garmin…»). */
const APPS: [RegExp, string][] = [
  [/garmin/i, 'Garmin Connect'], [/fitdays/i, 'Fitdays'], [/xiaomi|mi\.?fit|wearable/i, 'Mi Fitness'], [/huami|zepp/i, 'Zepp'],
  [/shealth|samsung/i, 'Samsung Health'], [/google.*fitness|fitbit/i, 'Google Fit'], [/withings/i, 'Withings'], [/renpho/i, 'Renpho'],
]
export function nombreFuente(fuente?: string): string {
  if (!fuente) return 'tu báscula'
  const conocida = APPS.find(([re]) => re.test(fuente))
  if (conocida) return conocida[1]
  if (!fuente.includes('.')) return fuente
  const ult = fuente.split('.').pop()!
  return ult.charAt(0).toUpperCase() + ult.slice(1)
}
