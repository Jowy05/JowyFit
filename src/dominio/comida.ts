// Comida: franjas por hora, raciones P/N/G, lectura de Open Food Facts, picoteo y cafeína.
import type { Comida, Franja, Medicion, Plantilla, Producto } from '../datos/tipos'
import { t, tc, tk } from '../i18n'
import { propio } from './claves'
import { minutosDe } from './fechas'
import { consejoQuincenal, tipoConsejo } from './resumen'
import { datosQuincena as numerosQuincena } from './tendencias'

// En castellano (para las cuentas y el informe); lo que se pinta va con nombreFranja().
export const FRANJAS: { v: Franja; t: string; icono: string }[] = [
  { v: 'desayuno', t: 'Desayuno', icono: 'sun-horizon' },
  { v: 'comida', t: 'Comida', icono: 'sun' },
  { v: 'merienda', t: 'Merienda', icono: 'cookie' },
  { v: 'cena', t: 'Cena', icono: 'moon' },
]

export const NOMBRE_FRANJA: Record<Franja, string> = { desayuno: 'Desayuno', comida: 'Comida', merienda: 'Merienda', cena: 'Cena' }

/** El momento del día en el idioma de la app. «Comida» lleva contexto: la pestaña es otra cosa (ca «Dinar», en «Lunch»). */
export function nombreFranja(f: Franja): string {
  switch (f) {
    case 'desayuno': return t('Desayuno')
    case 'comida': return tc('franja', 'Comida')
    case 'merienda': return t('Merienda')
    default: return t('Cena')
  }
}

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
type TipoRacion = 'plato' | 'picoteo'
const FACTORES: Record<TipoRacion, Record<Racion, number>> = { plato: { P: 1 / 3, N: 1, G: 1.5 }, picoteo: { P: 1 / 3, N: 1 / 2, G: 1 } }
export const tipoRacion = (tipo?: string): TipoRacion => (tipo === 'picoteo' ? 'picoteo' : 'plato')
export const factorRacion = (r: Racion, tipo?: string) => FACTORES[tipoRacion(tipo)][r]
/** Las raciones con palabras: nada de «P N G» sueltas. Las mismas en Añadir, la nota, el producto y Mis comidas. */
// Marcados con tk(): se traducen al pintarlos con t().
export const NOMBRE_RACION: Record<Racion, string> = { P: tk('Poco'), N: tk('Normal'), G: tk('Mucho') }
/** Qué es cada ración, en pequeño debajo del botón. */
export const PISTA_RACION: Record<TipoRacion, Record<Racion, string>> = {
  plato: { P: tk('⅓ del plato'), N: tk('el plato'), G: tk('plato y medio') },
  picoteo: { P: tk('un ⅓'), N: tk('la mitad'), G: tk('todo') },
}
/** Coletilla de la ración para avisos y listas: nada si es la normal, «poco» o «mucho» si no. */
export const textoRacion = (r: Racion) => (r === 'N' ? '' : t(NOMBRE_RACION[r]).toLowerCase())

/** Hidratos, grasas, azúcares y sal en gramos (solo si se saben: los escaneados los traen). */
export type Macros = { hidratos?: number; grasas?: number; azucares?: number; sal?: number }
export const CLAVES_MACROS = ['hidratos', 'azucares', 'grasas', 'sal'] as const
export const NOMBRE_MACRO: Record<keyof Macros, string> = { hidratos: tk('Hidratos'), azucares: tk('de ellos, azúcares'), grasas: tk('Grasas'), sal: tk('Sal') }
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

/**
 * ¿Alguna de las palabras empieza una palabra del nombre? Antes se buscaban en cualquier sitio y «chocolate»
 * (por «cola»), «aguacate» (por «agua») o «panceta» salían como bebida o como pan; y «té» no casaba nunca
 * (\b no funciona tras una letra con tilde). `entera` obliga a que la palabra acabe ahí.
 */
function empieza(n: string, palabras: string, entera = false): boolean {
  return new RegExp(`(?:^|[^\\p{L}])(?:${palabras})${entera ? '(?![\\p{L}])' : ''}`, 'u').test(n)
}

/** Color e icono de la miniatura según lo que parece el nombre. */
export function aspecto(nombre: string, tipo?: string): { fp: string; icono: string } {
  const n = nombre.toLowerCase()
  const cafe = empieza(n, 'café|cafe|cafés|cafes|cafè|cafès|coffee', true)
  if (tipo === 'bebida' || cafe || empieza(n, 'monster|red ?bull|energética|energetica|bebida energ|fuze|fuse|refresco|zumo|bebida|cerveza|cola|coca') || empieza(n, 'agua|aguas|té|te verde|te negro|infusión|infusion', true)) {
    return { fp: 'f-dr', icono: cafe ? 'coffee' : 'lightning' }
  }
  if (empieza(n, 'batido|prote|yogur|leche|whey|skyr')) return { fp: 'f-sh', icono: 'drop' }
  if (empieza(n, 'pizza')) return { fp: 'f-pz', icono: 'pizza' }
  if (empieza(n, 'bocadillo|bocata|sandwich|sándwich|tostada|fuet') || empieza(n, 'pan|panes', true)) return { fp: 'f-bo', icono: 'bread' }
  if (empieza(n, 'albóndiga|albondiga|guiso|lentej|garbanz|estofado|potaje')) return { fp: 'f-al', icono: 'cooking-pot' }
  if (empieza(n, 'teriyaki|wok|ramen|sopa|caldo|fideo|noodle')) return { fp: 'f-te', icono: 'bowl-steam' }
  if (tipo === 'picoteo' || empieza(n, 'patata|quicos|chips|galleta|chocolate|snack|bollo|donut|nachos|frutos secos|cacahuete')) return { fp: 'f-sn', icono: 'cookie' }
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

/**
 * La imagen de un producto solo se pinta si es https de Open Food Facts (images.openfoodfacts.org…). Cualquier otra
 * (de una copia ajena o de una respuesta manipulada) se descarta: servía de «píxel espía» para saber cuándo usas la app.
 */
export function imagenOFF(u: unknown): string | undefined {
  if (typeof u !== 'string' || u.length > 2000) return undefined
  try {
    const x = new URL(u)
    return x.protocol === 'https:' && !x.username && !x.password && !x.port && /(^|\.)openfoodfacts\.(org|net)$/.test(x.hostname) ? x.href : undefined
  } catch {
    return undefined
  }
}

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
  const txt = (v: unknown) => (typeof v === 'string' ? v : '')
  const nombre = (txt(p.product_name_es) || txt(p.product_name) || txt(p.generic_name_es)).trim()
  return {
    codigo,
    // Recortados: un nombre enorme congelaba las listas al pintarlas.
    nombre: (nombre || t('Producto {codigo}', { codigo })).slice(0, 150),
    marca: (typeof p.brands === 'string' ? p.brands : '').split(',')[0]!.trim().slice(0, 80),
    imagen: imagenOFF(p.image_front_small_url) ?? imagenOFF(p.image_front_url),
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

type Busqueda = { estado: 'encontrado'; producto: Producto } | { estado: 'no' } | { estado: 'offline' }

/** Busca un código en Open Food Facts. No envía nada más que el código. */
export async function buscarOFF(codigo: string, f: typeof fetch = fetch): Promise<Busqueda> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { estado: 'offline' }
  try {
    const ctl = new AbortController()
    const temporizador = setTimeout(() => ctl.abort(), 9000)
    const res = await f(URL_OFF(codigo), { signal: ctl.signal })
    clearTimeout(temporizador)
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
  const hora = horaTope.replace(/^0/, '')
  if (mg > limite) return { tono: 'bad', texto: t('Te has pasado del límite de {n} mg de hoy.', { n: limite }) }
  if (minutosDe(ahora) >= minutosDe(horaTope)) return { tono: 'warn', texto: t('Desde las {hora}, mejor sin cafeína: te quita sueño.', { hora }) }
  return { tono: mg > limite * 0.75 ? 'warn' : 'ok', texto: t('A partir de las {hora} te avisamos para que duermas bien.', { hora }) }
}

/** Plantillas ordenadas: más usadas primero y, a igualdad, por nombre. */
export function ordenarPlantillas(ps: Plantilla[]): Plantilla[] {
  return [...ps].sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, 'es'))
}

// ---------- ajuste quincenal ----------
type Quincena = { consejo: string; tono: 'ok' | 'warn' | 'neutral'; etiqueta: string; cinturaDelta: number | null; pesoDelta: number | null; picoteoDias: number; proteinaMedia: number | null }

/** Compara los últimos 14 días con los 14 anteriores y da un consejo por tendencias. */
/** Consejo quincenal con tono y etiqueta. Los números salen de `tendencias.datosQuincena`, la misma cuenta que usa Progreso. */
export function datosQuincena(o: { hoy: string; mediciones: Medicion[]; comidas: Comida[]; objetivoProteina: number; objetivo: 'recomposicion' | 'perder' | 'fuerza' }): Quincena {
  const base = numerosQuincena({ domingo: o.hoy, mediciones: o.mediciones, comidas: o.comidas })
  const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)
  const cinturaDelta = r1(base.cinturaDelta)
  const pesoDelta = r1(base.pesoDelta)
  const picoteoDias = base.picoteoDias
  const proteinaMedia = base.proteinaMedia == null ? null : Math.round(base.proteinaMedia)
  const datos = { cinturaDelta, pesoDelta, picoteoDias, proteinaMedia, objetivoProteina: o.objetivoProteina, objetivo: o.objetivo }
  const consejo = consejoQuincenal(datos)
  if (cinturaDelta == null && pesoDelta == null) return { consejo, tono: 'neutral', etiqueta: t('Faltan datos'), cinturaDelta, pesoDelta, picoteoDias, proteinaMedia }
  // Por el tipo de consejo y no por su frase, que cambia con el idioma. Va bien si baja la cintura, si está todo
  // estable sin picoteo o, con «fuerza», si no toca «come un poco más».
  const tipo = tipoConsejo(datos)
  const bien = (cinturaDelta ?? 0) < -0.3 || tipo === 'estable' || (o.objetivo === 'fuerza' && tipo !== 'peso-estable')
  return { consejo, tono: bien ? 'ok' : 'warn', etiqueta: bien ? t('Vas bien') : t('Un ajuste'), cinturaDelta, pesoDelta, picoteoDias, proteinaMedia }
}

// ---------- «Lo de ayer» y «Recientes» al añadir ----------

/** Lo que se apuntó ayer en esa franja (para repetirlo de un toque). */
export function deAyer(comidas: Comida[], ayer: string, franja: Franja): Comida[] {
  return comidas.filter(c => c.fecha === ayer && c.franja === franja).sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
}

/**
 * Lo último apuntado que no es una plantilla (ya están a un toque), sin repetir nombre:
 * notas, productos escaneados… del más reciente al más antiguo.
 */
export function recientes(comidas: Comida[], antesDe: string, plantillas: { nombre: string }[], n = 5): Comida[] {
  const yaPlantilla = new Set(plantillas.map(p => p.nombre.trim().toLowerCase()))
  const vistos = new Set<string>()
  const out: Comida[] = []
  for (const c of [...comidas].filter(c => c.fecha < antesDe || c.fecha === antesDe).sort((a, b) => (b.fecha + String(b.hora)).localeCompare(a.fecha + String(a.hora)))) {
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
export function notaPorTamano(tam: TamanoNota, franja: Franja): { kcal: number; proteina: number } {
  const pequena = franja === 'desayuno' || franja === 'merienda'
  const plato = pequena ? { kcal: 350, proteina: 15 } : { kcal: 600, proteina: 25 }
  // Las mismas proporciones que las raciones de un plato: ⅓, el plato y plato y medio (kcal redondeadas a 10).
  const f = factorRacion(tam === 'ligera' ? 'P' : tam === 'normal' ? 'N' : 'G')
  return { kcal: Math.round((plato.kcal * f) / 10) * 10, proteina: Math.round(plato.proteina * f) }
}

/** Qué tamaño corresponde a unos valores (para marcar el botón al editar algo escrito a mano); null si se afinaron. */
export function tamanoDe(kcal: number, proteina: number, franja: Franja): TamanoNota | null {
  return TAMANOS_NOTA.find(x => { const v = notaPorTamano(x.v, franja); return v.kcal === kcal && v.proteina === proteina })?.v ?? null
}

/** Productos escaneados que aún no están guardados en «Mis comidas» (para no enseñarlos dos veces). */
export function escaneadosSueltos<P extends { codigo: string }>(productos: P[], plantillas: { codigo?: string }[]): P[] {
  const ya = new Set(plantillas.map(p => p.codigo).filter(Boolean))
  return productos.filter(p => !ya.has(p.codigo))
}

// ---------- suplementos ----------
/** El batido de proteína se apunta como comida (suma proteína al día); el resto solo se marca. */
// También en catalán e inglés, por si el suplemento se escribe así.
export const esBatido = (s: string) => /prote|batido|batut|shake/i.test(s)
/** Lo habitual si el dueño no ha escrito su cantidad. */
export function dosisPorDefecto(s: string): string {
  if (/creatin/i.test(s)) return '3-5 g'
  if (esBatido(s)) return t('1 cacito')
  return ''
}
/** La cantidad que toma (la suya o la habitual). */
export const dosisDe = (dosis: Record<string, string> | undefined, s: string) => {
  // Solo la dosis guardada de verdad: «constructor» o «toString» devolvían funciones de JavaScript y Comida fallaba.
  const v = propio(dosis, s)
  return (typeof v === 'string' ? v.trim() : '') || dosisPorDefecto(s)
}
/** Lo que lleva el batido: lo suyo o un cacito típico de 24 g de proteína (unas 120 kcal). */
export const batidoDe = (b: { proteina: number; kcal: number } | undefined) => b ?? { proteina: 24, kcal: 120 }
/** kcal aproximadas de un batido a partir de su proteína (la proteína en polvo da unas 5 kcal por gramo con lo demás). */
export const kcalBatido = (proteina: number) => Math.round(proteina * 5)
