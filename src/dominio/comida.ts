// Comida: franjas por hora, raciones P/N/G, lectura de Open Food Facts, picoteo y cafeína.
import type { Comida, Franja, Medicion, Plantilla, Producto } from '../datos/tipos'
import { minutosDe, sumarDias } from './fechas'
import { consejoQuincenal } from './resumen'

export const FRANJAS: { v: Franja; t: string; icono: string }[] = [
  { v: 'desayuno', t: 'Desayuno', icono: 'sun-horizon' },
  { v: 'comida', t: 'Comida', icono: 'sun' },
  { v: 'merienda', t: 'Merienda / picoteo', icono: 'cookie' },
  { v: 'cena', t: 'Cena', icono: 'moon' },
]

export const NOMBRE_FRANJA: Record<Franja, string> = { desayuno: 'Desayuno', comida: 'Comida', merienda: 'Merienda', cena: 'Cena' }

/** Franja según la hora: de 5 a 11 desayuno, hasta las 16:30 comida, hasta las 19:30 merienda y luego cena (también de madrugada). */
export function franjaPorHora(hhmm: string): Franja {
  const m = minutosDe(hhmm)
  if (m < 5 * 60) return 'cena'
  if (m < 11 * 60) return 'desayuno'
  if (m < 16 * 60 + 30) return 'comida'
  if (m < 19 * 60 + 30) return 'merienda'
  return 'cena'
}

export type Racion = 'P' | 'N' | 'G'
export const FACTOR_RACION: Record<Racion, number> = { P: 0.7, N: 1, G: 1.4 }

/** kcal y proteína de una plantilla en la ración elegida (redondeado). */
export function conRacion(base: { kcal: number; proteina: number; cafeina?: number }, r: Racion) {
  const f = FACTOR_RACION[r]
  return { kcal: Math.round(base.kcal * f), proteina: Math.round(base.proteina * f), cafeina: base.cafeina ? Math.round(base.cafeina * f) : undefined }
}

/** Color e icono de la miniatura según lo que parece el nombre. */
export function aspecto(nombre: string, tipo?: string): { fp: string; icono: string } {
  const n = nombre.toLowerCase()
  if (tipo === 'bebida' || /monster|red ?bull|energ|fuse|cola|refresco|café|cafe|zumo|agua|bebida|cerveza|té\b/.test(n)) return { fp: 'f-dr', icono: /café|cafe/.test(n) ? 'coffee' : 'lightning' }
  if (/batido|prote|yogur|leche|whey|skyr/.test(n)) return { fp: 'f-sh', icono: 'drop' }
  if (/pizza/.test(n)) return { fp: 'f-pz', icono: 'pizza' }
  if (/bocadillo|bocata|sandwich|sándwich|pan|tostada|fuet/.test(n)) return { fp: 'f-bo', icono: 'bread' }
  if (/albóndiga|albondiga|guiso|lentej|garbanz|estofado|potaje/.test(n)) return { fp: 'f-al', icono: 'cooking-pot' }
  if (/teriyaki|wok|ramen|sopa|caldo|fideo|noodle/.test(n)) return { fp: 'f-te', icono: 'bowl-steam' }
  if (tipo === 'picoteo' || /patata|quicos|chips|galleta|chocolate|snack|bollo|donut|nachos|frutos secos|cacahuete/.test(n)) return { fp: 'f-sn', icono: 'cookie' }
  return { fp: 'f-cu', icono: 'bowl-food' }
}

// ---------- Open Food Facts ----------
type NutrimentosOFF = Record<string, number | string | undefined>
type ProductoOFF = {
  product_name?: string; product_name_es?: string; generic_name_es?: string; brands?: string
  nutriments?: NutrimentosOFF; serving_quantity?: number | string; image_front_small_url?: string; image_front_url?: string
}

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(x) ? x : null
}
const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)

/** Convierte la respuesta de Open Food Facts (API v2) en nuestro Producto. Null si no hay producto. */
export function leerOFF(codigo: string, json: { status?: number; product?: ProductoOFF } | null, ahora = new Date()): Producto | null {
  const p = json?.product
  if (!p || json?.status === 0) return null
  const nu = p.nutriments ?? {}
  let kcal100 = n(nu['energy-kcal_100g'])
  if (kcal100 == null) { const kj = n(nu['energy-kj_100g'] ?? nu['energy_100g']); if (kj != null) kcal100 = kj / 4.184 }
  const racionG = n(p.serving_quantity)
  let kcalRacion = n(nu['energy-kcal_serving'])
  if (kcalRacion == null && kcal100 != null && racionG) kcalRacion = (kcal100 * racionG) / 100
  let protRacion = n(nu['proteins_serving'])
  const prot100 = n(nu['proteins_100g'])
  if (protRacion == null && prot100 != null && racionG) protRacion = (prot100 * racionG) / 100
  const caf = n(nu['caffeine_100g'])
  const nombre = (p.product_name_es || p.product_name || p.generic_name_es || '').trim()
  return {
    codigo,
    nombre: nombre || `Producto ${codigo}`,
    marca: (p.brands ?? '').split(',')[0]!.trim(),
    imagen: p.image_front_small_url || p.image_front_url || undefined,
    kcal100: kcal100 == null ? null : Math.round(kcal100),
    proteina100: r1(prot100),
    hidratos100: r1(n(nu['carbohydrates_100g'])),
    grasas100: r1(n(nu['fat_100g'])),
    // OFF guarda la cafeína en g/100 g: la pasamos a mg/100 g.
    cafeina100: caf == null ? null : Math.round(caf * 1000),
    racionG: racionG == null ? null : Math.round(racionG),
    kcalRacion: kcalRacion == null ? null : Math.round(kcalRacion),
    proteinaRacion: r1(protRacion),
    guardado: ahora.toISOString(),
  }
}

export const URL_OFF = (codigo: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=product_name,product_name_es,generic_name_es,brands,nutriments,serving_quantity,image_front_small_url,image_front_url&lc=es`

export type Busqueda = { estado: 'encontrado'; producto: Producto } | { estado: 'no' } | { estado: 'offline' }

/** Busca un código en Open Food Facts. No envía nada más que el código. */
export async function buscarOFF(codigo: string, f: typeof fetch = fetch): Promise<Busqueda> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { estado: 'offline' }
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 9000)
    const res = await f(URL_OFF(codigo), { signal: ctl.signal })
    clearTimeout(t)
    if (res.status === 404) return { estado: 'no' }
    if (!res.ok) return { estado: 'offline' }
    const p = leerOFF(codigo, await res.json())
    return p ? { estado: 'encontrado', producto: p } : { estado: 'no' }
  } catch {
    return { estado: 'offline' }
  }
}

/** Valores por envase/ración (o por 100 g si no hay ración). */
export function porRacion(p: Producto): { kcal: number; proteina: number; cafeina?: number; base: 'racion' | '100g' } {
  if (p.kcalRacion != null) {
    const caf = p.cafeina100 != null && p.racionG ? Math.round((p.cafeina100 * p.racionG) / 100) : undefined
    return { kcal: p.kcalRacion, proteina: Math.round(p.proteinaRacion ?? 0), cafeina: caf || undefined, base: 'racion' }
  }
  return { kcal: p.kcal100 ?? 0, proteina: Math.round(p.proteina100 ?? 0), cafeina: p.cafeina100 || undefined, base: '100g' }
}

/** Código de barras válido (EAN-8, EAN-13, UPC-A/E). */
export const codigoValido = (c: string) => /^\d{8,14}$/.test(c.trim())

// ---------- picoteo, bebidas y cafeína ----------
const esEnergetica = (c: Comida) => c.tipo === 'bebida' && (c.cafeina ?? 0) >= 80 && c.kcal >= 50

export function picoteoDeSemana(comidas: Comida[], dias: string[]) {
  const enSemana = comidas.filter(c => dias.includes(c.fecha))
  return {
    dias: new Set(enSemana.filter(c => c.tipo === 'picoteo').map(c => c.fecha)).size,
    energeticas: enSemana.filter(esEnergetica).length,
  }
}

/** Aviso de cafeína: pasado el límite diario o a partir de la hora tope (6 h antes de dormir por defecto). */
export function avisoCafeina(mg: number, limite: number, horaTope: string, ahora: string): { tono: 'ok' | 'warn' | 'bad'; texto: string } {
  if (mg > limite) return { tono: 'bad', texto: `Te has pasado del límite de ${limite} mg de hoy.` }
  if (minutosDe(ahora) >= minutosDe(horaTope)) return { tono: 'warn', texto: `Desde las ${horaTope.replace(/^0/, '')}, mejor sin cafeína: te quita sueño.` }
  return { tono: mg > limite * 0.75 ? 'warn' : 'ok', texto: `A partir de las ${horaTope.replace(/^0/, '')} te avisamos para que duermas bien.` }
}

/** Plantillas ordenadas: más usadas primero y, a igualdad, por nombre. */
export function ordenarPlantillas(ps: Plantilla[]): Plantilla[] {
  return [...ps].sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, 'es'))
}

// ---------- ajuste quincenal ----------
const mediaDe = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export type Quincena = { consejo: string; tono: 'ok' | 'warn' | 'neutral'; etiqueta: string; cinturaDelta: number | null; pesoDelta: number | null; picoteoDias: number; proteinaMedia: number | null }

/** Compara los últimos 14 días con los 14 anteriores y da un consejo por tendencias. */
export function datosQuincena(o: { hoy: string; mediciones: Medicion[]; comidas: Comida[]; objetivoProteina: number; objetivo: 'recomposicion' | 'perder' | 'fuerza' }): Quincena {
  const desde = sumarDias(o.hoy, -13), antes = sumarDias(o.hoy, -27)
  const en = (f: string, a: string, b: string) => f >= a && f <= b
  const delta = (f: (m: Medicion) => number | undefined) => {
    const ahora = mediaDe(o.mediciones.filter(m => en(m.fecha.slice(0, 10), desde, o.hoy) && f(m) != null).map(m => f(m)!))
    const prev = mediaDe(o.mediciones.filter(m => en(m.fecha.slice(0, 10), antes, sumarDias(desde, -1)) && f(m) != null).map(m => f(m)!))
    return ahora != null && prev != null ? Math.round((ahora - prev) * 10) / 10 : null
  }
  const cinturaDelta = delta(m => m.perimetros?.cintura)
  const pesoDelta = delta(m => m.pesoKg)
  const recientes = o.comidas.filter(c => en(c.fecha, desde, o.hoy))
  const picoteoDias = new Set(recientes.filter(c => c.tipo === 'picoteo').map(c => c.fecha)).size
  const porDia = new Map<string, number>()
  for (const c of recientes) porDia.set(c.fecha, (porDia.get(c.fecha) ?? 0) + c.proteina)
  const proteinaMedia = porDia.size >= 3 ? Math.round(mediaDe([...porDia.values()])!) : null
  const consejo = consejoQuincenal({ cinturaDelta, pesoDelta, picoteoDias, proteinaMedia, objetivoProteina: o.objetivoProteina, objetivo: o.objetivo })
  if (cinturaDelta == null && pesoDelta == null) return { consejo, tono: 'neutral', etiqueta: 'Faltan datos', cinturaDelta, pesoDelta, picoteoDias, proteinaMedia }
  const bien = (cinturaDelta ?? 0) < -0.3 || (/^Todo estable\. Sigue/.test(consejo)) || (o.objetivo === 'fuerza' && !/come un poco más/.test(consejo))
  return { consejo, tono: bien ? 'ok' : 'warn', etiqueta: bien ? 'Vas bien' : 'Un ajuste', cinturaDelta, pesoDelta, picoteoDias, proteinaMedia }
}
