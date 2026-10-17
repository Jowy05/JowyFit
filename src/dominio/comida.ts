// Comida: franjas por hora, raciones P/N/G, lectura de Open Food Facts, picoteo y cafeína.
import type { Comida, Franja, Medicion, Plantilla, Producto } from '../datos/tipos'
import { minutosDe } from './fechas'
import { consejoQuincenal } from './resumen'
import { datosQuincena as numerosQuincena } from './tendencias'

export const FRANJAS: { v: Franja; t: string; icono: string }[] = [
  { v: 'desayuno', t: 'Desayuno', icono: 'sun-horizon' },
  { v: 'comida', t: 'Comida', icono: 'sun' },
  { v: 'merienda', t: 'Merienda', icono: 'cookie' },
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
/**
 * Cuánto es cada ración según lo que se guardó:
 * - un plato (comida, producto, bebida, lo escrito a mano) guarda el plato entero: Poco = ⅓, Normal = el plato, Mucho = × 1,5;
 * - un picoteo guarda la bolsa o el paquete entero: Poco = ⅓, Normal = la mitad, Mucho = todo.
 */
export type TipoRacion = 'plato' | 'picoteo'
const FACTORES: Record<TipoRacion, Record<Racion, number>> = { plato: { P: 1 / 3, N: 1, G: 1.5 }, picoteo: { P: 1 / 3, N: 1 / 2, G: 1 } }
export const tipoRacion = (tipo?: string): TipoRacion => (tipo === 'picoteo' ? 'picoteo' : 'plato')
export const factorRacion = (r: Racion, tipo?: string) => FACTORES[tipoRacion(tipo)][r]
/** Las raciones con palabras: nada de «P N G» sueltas. Las mismas en Añadir, la nota, el producto y Mis comidas. */
export const NOMBRE_RACION: Record<Racion, string> = { P: 'Poco', N: 'Normal', G: 'Mucho' }
/** Qué es cada ración, en pequeño debajo del botón. */
export const PISTA_RACION: Record<TipoRacion, Record<Racion, string>> = {
  plato: { P: '⅓ del plato', N: 'el plato', G: 'plato y medio' },
  picoteo: { P: 'un ⅓', N: 'la mitad', G: 'todo' },
}
/** Coletilla de la ración para avisos y listas: nada si es la normal, «poco» o «mucho» si no. */
export const textoRacion = (r: Racion) => (r === 'N' ? '' : NOMBRE_RACION[r].toLowerCase())

/** Hidratos, grasas, azúcares y sal en gramos (solo si se saben: los escaneados los traen). */
export type Macros = { hidratos?: number; grasas?: number; azucares?: number; sal?: number }
export const CLAVES_MACROS = ['hidratos', 'azucares', 'grasas', 'sal'] as const
export const NOMBRE_MACRO: Record<keyof Macros, string> = { hidratos: 'Hidratos', azucares: 'de ellos, azúcares', grasas: 'Grasas', sal: 'Sal' }
/** Multiplica los macros que haya (con un decimal); los que no se saben siguen sin saberse. */
export function escalarMacros(m: Macros, f: number): Macros {
  const out: Macros = {}
  for (const k of CLAVES_MACROS) { const v = m[k]; if (v != null) out[k] = Math.round(v * f * 10) / 10 }
  return out
}
/** Solo los macros de un objeto (para copiarlos de un producto a una comida o a Mis comidas). */
export const soloMacros = (m: Macros): Macros => escalarMacros(m, 1)

/** kcal, proteína (y cafeína y macros, si los hay) en la ración elegida, según lo que se guardó (plato o picoteo). */
export function conRacion(base: { kcal: number; proteina: number; cafeina?: number } & Macros, r: Racion, tipo?: string) {
  const f = factorRacion(r, tipo)
  return { kcal: Math.round(base.kcal * f), proteina: Math.round(base.proteina * f), cafeina: base.cafeina ? Math.round(base.cafeina * f) : undefined, ...escalarMacros(base, f) }
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
    azucares100: r1(n(nu['sugars_100g'])),
    sal100: r1(n(nu['salt_100g'])),
    // OFF guarda la cafeína en g/100 g: la pasamos a mg/100 g.
    cafeina100: caf == null ? null : Math.round(caf * 1000),
    racionG: racionG == null ? null : Math.round(racionG),
    kcalRacion: kcalRacion == null ? null : Math.round(kcalRacion),
    proteinaRacion: r1(protRacion),
    guardado: ahora.toISOString(),
  }
}

export const URL_OFF = (codigo: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=product_name,product_name_es,generic_name_es,brands,nutriments,serving_quantity,image_front_small_url,image_front_url&lc=es&app_name=JowyFit`

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

/** Hidratos, azúcares, grasas y sal por cada 100 g del producto (los que traiga). */
export const macros100 = (p: Producto): Macros => {
  const m: Macros = {}
  if (p.hidratos100 != null) m.hidratos = p.hidratos100
  if (p.azucares100 != null) m.azucares = p.azucares100
  if (p.grasas100 != null) m.grasas = p.grasas100
  if (p.sal100 != null) m.sal = p.sal100
  return m
}

/** Valores por envase/ración (o por 100 g si no hay ración), con los macros que se sepan. */
export function porRacion(p: Producto): { kcal: number; proteina: number; cafeina?: number; base: 'racion' | '100g' } & Macros {
  if (p.kcalRacion != null) {
    const caf = p.cafeina100 != null && p.racionG ? Math.round((p.cafeina100 * p.racionG) / 100) : undefined
    // Los macros solo vienen por 100 g: sin el peso de la ración no se pueden pasar a la ración.
    const m = p.racionG ? escalarMacros(macros100(p), p.racionG / 100) : {}
    return { kcal: p.kcalRacion, proteina: Math.round(p.proteinaRacion ?? 0), cafeina: caf || undefined, base: 'racion', ...m }
  }
  return { kcal: p.kcal100 ?? 0, proteina: Math.round(p.proteina100 ?? 0), cafeina: p.cafeina100 || undefined, base: '100g', ...macros100(p) }
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
export type Quincena = { consejo: string; tono: 'ok' | 'warn' | 'neutral'; etiqueta: string; cinturaDelta: number | null; pesoDelta: number | null; picoteoDias: number; proteinaMedia: number | null }

/** Compara los últimos 14 días con los 14 anteriores y da un consejo por tendencias. */
/** Consejo quincenal con tono y etiqueta. Los números salen de `tendencias.datosQuincena`, la misma cuenta que usa Progreso. */
export function datosQuincena(o: { hoy: string; mediciones: Medicion[]; comidas: Comida[]; objetivoProteina: number; objetivo: 'recomposicion' | 'perder' | 'fuerza' }): Quincena {
  const base = numerosQuincena({ domingo: o.hoy, mediciones: o.mediciones, comidas: o.comidas })
  const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)
  const cinturaDelta = r1(base.cinturaDelta)
  const pesoDelta = r1(base.pesoDelta)
  const picoteoDias = base.picoteoDias
  const proteinaMedia = base.proteinaMedia == null ? null : Math.round(base.proteinaMedia)
  const consejo = consejoQuincenal({ cinturaDelta, pesoDelta, picoteoDias, proteinaMedia, objetivoProteina: o.objetivoProteina, objetivo: o.objetivo })
  if (cinturaDelta == null && pesoDelta == null) return { consejo, tono: 'neutral', etiqueta: 'Faltan datos', cinturaDelta, pesoDelta, picoteoDias, proteinaMedia }
  const bien = (cinturaDelta ?? 0) < -0.3 || (/^Todo estable\. Sigue/.test(consejo)) || (o.objetivo === 'fuerza' && !/come un poco más/.test(consejo))
  return { consejo, tono: bien ? 'ok' : 'warn', etiqueta: bien ? 'Vas bien' : 'Un ajuste', cinturaDelta, pesoDelta, picoteoDias, proteinaMedia }
}

// ---------- «Lo de ayer» y «Recientes» al añadir ----------

/** Lo que se apuntó ayer en esa franja (para repetirlo de un toque). */
export function deAyer(comidas: Comida[], ayer: string, franja: Franja): Comida[] {
  return comidas.filter(c => c.fecha === ayer && c.franja === franja).sort((a, b) => a.hora.localeCompare(b.hora))
}

/**
 * Lo último apuntado que no es una plantilla (ya están a un toque), sin repetir nombre:
 * notas, productos escaneados… del más reciente al más antiguo.
 */
export function recientes(comidas: Comida[], antesDe: string, plantillas: { nombre: string }[], n = 5): Comida[] {
  const yaPlantilla = new Set(plantillas.map(p => p.nombre.trim().toLowerCase()))
  const vistos = new Set<string>()
  const out: Comida[] = []
  for (const c of [...comidas].filter(c => c.fecha < antesDe || c.fecha === antesDe).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))) {
    const k = c.nombre.trim().toLowerCase()
    if (!k || vistos.has(k) || yaPlantilla.has(k) || c.plantillaId != null) continue
    vistos.add(k)
    out.push(c)
    if (out.length >= n) break
  }
  return out
}

// ---------- «Escribir lo que he comido» y «Crear comida nueva»: «Poco · Normal · Mucho» ----------
// Las claves internas siguen siendo ligera/normal/abundante; lo que se ve son las mismas palabras que las raciones.
export type TamanoNota = 'ligera' | 'normal' | 'abundante'
export const TAMANOS_NOTA: { v: TamanoNota; t: string }[] = [
  { v: 'ligera', t: NOMBRE_RACION.P },
  { v: 'normal', t: NOMBRE_RACION.N },
  { v: 'abundante', t: NOMBRE_RACION.G },
]

/**
 * Valores típicos de una comida según su tamaño, para quien no sabe las kcal de lo que ha comido.
 * Desayuno y merienda suelen ser más pequeños que la comida y la cena.
 */
export function notaPorTamano(t: TamanoNota, franja: Franja): { kcal: number; proteina: number } {
  const pequena = franja === 'desayuno' || franja === 'merienda'
  const plato = pequena ? { kcal: 350, proteina: 15 } : { kcal: 600, proteina: 25 }
  // Las mismas proporciones que las raciones de un plato: ⅓, el plato y plato y medio (kcal redondeadas a 10).
  const f = factorRacion(t === 'ligera' ? 'P' : t === 'normal' ? 'N' : 'G')
  return { kcal: Math.round((plato.kcal * f) / 10) * 10, proteina: Math.round(plato.proteina * f) }
}

/** Qué tamaño corresponde a unos valores (para marcar el botón al editar algo escrito a mano); null si se afinaron. */
export function tamanoDe(kcal: number, proteina: number, franja: Franja): TamanoNota | null {
  return TAMANOS_NOTA.find(t => { const v = notaPorTamano(t.v, franja); return v.kcal === kcal && v.proteina === proteina })?.v ?? null
}

/** Productos escaneados que aún no están guardados en «Mis comidas» (para no enseñarlos dos veces). */
export function escaneadosSueltos<P extends { codigo: string }>(productos: P[], plantillas: { codigo?: string }[]): P[] {
  const ya = new Set(plantillas.map(p => p.codigo).filter(Boolean))
  return productos.filter(p => !ya.has(p.codigo))
}
