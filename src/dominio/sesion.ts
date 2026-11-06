// Entreno en curso: crear la sesión desde un día de la rutina y operaciones puras sobre ella.
import type { Bloque, DiaRutina, EjercicioSesion, Serie, Sesion, TipoRegistro } from '../datos/tipos'
import { hoyISO } from './fechas'
import { esRecord, repsVolumen } from './progresion'
import { diaMinimo } from './cola'

/**
 * Lo más que se puede apuntar en una serie. Los mismos topes en los contadores del entreno y en las copias: con un
 * número absurdo la gráfica de fuerza y el PDF se quedaban sin memoria. Peso negativo = asistencia. Las reps de cada
 * lado van con el tope de `reps`.
 */
export const TOPE_SERIE = { peso: 2000, reps: 10_000, segundos: 86_400, km: 1000 } as const

/** Lo que se apunta al hacer o corregir una serie. */
export type DatosSerie = Pick<Serie, 'peso' | 'reps' | 'rpe' | 'segundos' | 'izq' | 'der' | 'km'>

/** Cómo se apunta un ejercicio: lo que sale en los contadores del panel. */
export type ComoSeApunta = { registro: TipoRegistro; conPeso: boolean; lastre: boolean; porLado: boolean; distancia: boolean }
/** Lo que marcan los contadores del panel (o al corregir). `separar`: cada lado con sus reps. */
export type CamposSerie = { peso: number | null; reps: number; segundos: number; izq: number; der: number; separar: boolean; km: number | null }

/**
 * Lo que se guarda de los contadores según cómo se apunta el ejercicio. Por lado, `reps` es el lado que menos hizo
 * (la progresión no sube si un lado se quedó corto) y los dos lados quedan apuntados para el volumen.
 */
export function datosDeCampos(c: CamposSerie, como: ComoSeApunta): Omit<DatosSerie, 'rpe'> {
  if (como.registro === 'tiempo') return { peso: null, reps: null, segundos: c.segundos }
  if (como.registro === 'cardio') return { peso: null, reps: c.reps, segundos: null, km: como.distancia && c.km != null && c.km > 0 ? Math.round(c.km * 100) / 100 : null }
  // De peso corporal, el lastre si lo hay (el que ya estaba apuntado se respeta aunque el ejercicio ya no lo ofrezca).
  const peso = como.conPeso ? c.peso : como.registro === 'corporal' && c.peso != null && c.peso > 0 ? c.peso : null
  if (!como.porLado) return { peso, reps: c.reps, segundos: null }
  const [izq, der] = c.separar ? [c.izq, c.der] : [c.reps, c.reps]
  return { peso, reps: Math.min(izq, der), segundos: null, izq, der }
}

/** Peso que pasa a una serie nueva: el de peso corporal solo si es lastre (sin él, nada). */
const pesoInicial = (peso: number | null | undefined, registro: TipoRegistro): number | null => {
  if (registro === 'tiempo' || registro === 'cardio') return null
  if (registro === 'corporal') return peso != null && peso > 0 ? peso : null
  return peso ?? null
}

/**
 * Ejercicio que se hace en lugar del del plan porque el gimnasio de hoy no tiene su material. Si se apunta de otra
 * forma (una plancha por segundos en lugar de un crunch por repeticiones), `pauta` trae sus reps y su descanso.
 */
export type CambioMaterial = { ejercicio: string; registro: TipoRegistro; pauta?: Pick<Bloque, 'repsMin' | 'repsMax' | 'descanso'> }

/** El bloque del plan con el cambio puesto: otro ejercicio y, si se apunta distinto, sus reps y descanso. */
export const conCambio = (b: Bloque, c: CambioMaterial): Bloque => ({ ...b, ...c.pauta, ejercicio: c.ejercicio, registro: c.registro })

/** Los bloques que se hacen en cada versión: la mínima (lo más importante, a 2 series) o la corta (sin los del final). */
export function bloquesDeVersion(dia: DiaRutina, version: Sesion['version']): Bloque[] {
  if (version === 'minima') return diaMinimo(dia).bloques
  return dia.bloques.filter(b => !(version === 'corta' && b.fueraEnCorta))
}

export function crearSesion(dia: DiaRutina, o: { rutinaId: number | null; gimnasioId: number | null; version: Sesion['version']; horaLimite?: string; calibracion: boolean; ahora?: number; sugerencias?: Map<string, { peso: number | null; reps: number | null }>; cambios?: Map<string, CambioMaterial> }): Sesion {
  const ahora = o.ahora ?? Date.now()
  const bloques = dia.bloques.filter(b => !(o.version === 'corta' && b.fueraEnCorta))
  const ejercicios = bloques.map(b => {
    const c = o.cambios?.get(b.uid)
    if (!c) return desdeBloque(b, o.sugerencias?.get(b.ejercicio))
    // Se apunta como un cambio: el del plan queda en `planificado` y la rutina no se toca.
    return { ...desdeBloque({ ...conCambio(b, c), ejercicio: b.ejercicio }, o.sugerencias?.get(c.ejercicio), c.ejercicio), motivo: 'cambio' as const }
  })
  if (ejercicios[0]) ejercicios[0].estado = 'curso'
  return {
    fecha: hoyISO(new Date(ahora)),
    rutinaId: o.rutinaId,
    letra: dia.letra,
    nombre: dia.nombre,
    gimnasioId: o.gimnasioId,
    inicio: ahora,
    horaLimite: o.horaLimite,
    version: o.version,
    estado: 'curso',
    calibracion: o.calibracion,
    ejercicios,
  }
}

/**
 * Qué cambiar para entrenar en un gimnasio sin el material de algún ejercicio: uid del bloque → la primera de sus
 * alternativas (las del plan y luego `otras`) que se puede hacer y no está ya en el día. `sePuede` dice null si no
 * conoce el ejercicio: uno desconocido del plan se deja como está. Sin alternativa posible, también.
 */
export function cambiosPorMaterial(bloques: readonly Bloque[], sePuede: (id: string) => boolean | null, otras: (b: Bloque, enDia: ReadonlySet<string>) => string[]): Map<string, string> {
  const m = new Map<string, string>()
  const enDia = new Set(bloques.map(b => b.ejercicio))
  for (const b of bloques) {
    if (sePuede(b.ejercicio) !== false) continue
    const alt = [...b.alternativas, ...otras(b, enDia)].find(id => !enDia.has(id) && sePuede(id) === true)
    if (alt) { m.set(b.uid, alt); enDia.add(alt) }
  }
  return m
}

/**
 * Lista de «Ocupado»: el ejercicio de ahora, la del plan y sus alternativas, en ese orden de preferencia. Quedan las
 * que existen y se pueden hacer en el gimnasio de hoy (`vale`) y no están ya en el entreno. El de ahora siempre está
 * (si no, se marcaría como actual otro). Si después de él no queda nada, o ya era un cambio por falta de material
 * (las del plan no valían), se añaden las que busca `mas` con el material de este gimnasio.
 */
export function opcionesOcupado(e: Pick<EjercicioSesion, 'ejercicio' | 'planificado' | 'motivo'>, delPlan: readonly string[], enEntreno: ReadonlySet<string>, vale: (id: string) => boolean, mas: () => string[]): string[] {
  const libre = (id: string) => id === e.ejercicio || (!enEntreno.has(id) && vale(id))
  const lista = [...new Set([e.planificado, ...delPlan])].filter(libre)
  if (!lista.includes(e.ejercicio)) lista.unshift(e.ejercicio)
  const quedan = lista.length - 1 - lista.indexOf(e.ejercicio)
  if (quedan === 0 || e.motivo === 'cambio') for (const id of mas()) if (!lista.includes(id) && libre(id)) lista.push(id)
  return lista
}

export function seriesNuevas(n: number, peso: number | null, reps: number | null, registro: TipoRegistro): Serie[] {
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    peso: pesoInicial(peso, registro),
    reps: registro === 'tiempo' ? null : reps,
    segundos: registro === 'tiempo' ? reps : null,
    rpe: null,
    calentamiento: false,
    hecha: false,
  }))
}

export function desdeBloque(b: Bloque, sug?: { peso: number | null; reps: number | null }, ejercicio = b.ejercicio): EjercicioSesion {
  return {
    uid: b.uid,
    ejercicio,
    planificado: b.ejercicio,
    estado: 'pendiente',
    series: seriesNuevas(b.series, sug?.peso ?? null, sug?.reps ?? b.repsMin, b.registro),
    repsMin: b.repsMin,
    repsMax: b.repsMax,
    rpe: b.rpe,
    descanso: b.descanso,
    superserie: b.superserie,
    registro: b.registro,
    ...(b.cargaPct && b.cargaPct < 1 ? { cargaPct: b.cargaPct } : {}),
  }
}

/** Índice del ejercicio en curso (o el primero pendiente). */
export function indiceActual(s: Sesion): number {
  const i = s.ejercicios.findIndex(e => e.estado === 'curso')
  if (i >= 0) return i
  return s.ejercicios.findIndex(e => e.estado === 'pendiente')
}

/** Serie que toca ahora dentro de un ejercicio (la primera sin hacer). */
export function serieActual(e: EjercicioSesion): number {
  return e.series.findIndex(x => !x.hecha)
}

const clon = (s: Sesion): Sesion => structuredClone(s)

/** Marca la serie como hecha y decide qué viene después (superserie, siguiente serie o ejercicio). */
export function hecha(s0: Sesion, idx: number, datos: DatosSerie, ahora = Date.now()): { sesion: Sesion; descanso: number } {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return { sesion: s, descanso: 0 }
  const i = serieActual(e)
  if (i < 0) return { sesion: s, descanso: 0 }
  e.inicio ??= ahora
  const eraCalentamiento = e.series[i]!.calentamiento
  Object.assign(e.series[i]!, datos, { hecha: true, ts: ahora })
  // Las siguientes series heredan peso y reps si aún no se tocaron, pero no de una de calentamiento:
  // una aproximación de «20 kg × 10» no pasa las series de trabajo a 20 kg.
  if (!eraCalentamiento) for (const x of e.series.slice(i + 1)) if (!x.hecha && !x.calentamiento) { x.peso = datos.peso; if (e.registro !== 'tiempo') x.reps ??= datos.reps }
  const companero = e.superserie ? s.ejercicios.find(o => o.uid === e.superserie) : undefined
  const terminado = serieActual(e) < 0
  if (terminado) { e.estado = 'hecho'; e.fin = ahora }
  // Superserie: tras A1 se pasa a A2 sin descanso; tras A2, descanso y vuelta a A1.
  if (companero && companero.estado !== 'hecho' && companero.estado !== 'saltado') {
    const jIdx = s.ejercicios.indexOf(companero)
    const esPrimero = jIdx > idx
    if (!terminado) e.estado = 'pendiente'
    companero.estado = 'curso'
    return { sesion: s, descanso: esPrimero ? 0 : e.descanso }
  }
  if (terminado) {
    const sig = s.ejercicios.findIndex(o => o.estado === 'pendiente')
    if (sig >= 0) s.ejercicios[sig]!.estado = 'curso'
    return { sesion: s, descanso: sig >= 0 ? Math.min(e.descanso, 90) : 0 }
  }
  e.estado = 'curso'
  return { sesion: s, descanso: e.descanso }
}

/** Descanso tras una serie de calentamiento (segundos). */
export const DESCANSO_CALENTAMIENTO = 45

/**
 * «Hecho» en la serie que toca: la marca, mira si es récord frente a `previas` (historial y lo de hoy) y pone el
 * descanso que sigue (`descansoHasta`) si toca y el entreno no ha terminado. Null si no queda serie por hacer.
 */
export function apuntarSerie(s: Sesion, idx: number, datos: DatosSerie, previas: Serie[], ahora = Date.now()): { sesion: Sesion; record: ReturnType<typeof esRecord> } | null {
  const e = s.ejercicios[idx]
  const n = e ? serieActual(e) : -1
  const actual = e?.series[n]
  if (!actual) return null
  const record = actual.calentamiento ? null : esRecord({ ...actual, ...datos, hecha: true }, previas)
  const r = hecha(s, idx, datos, ahora)
  const nueva = record ? cambiarSerie(r.sesion, idx, n, { record: true }) : r.sesion
  const descanso = actual.calentamiento ? DESCANSO_CALENTAMIENTO : r.descanso
  if (descanso > 0 && !terminada(nueva)) {
    nueva.descansoHasta = ahora + descanso * 1000
    nueva.descansoTotal = descanso
  } else nueva.descansoHasta = undefined
  return { sesion: nueva, record }
}

export function cambiarSerie(s0: Sesion, idx: number, n: number, cambios: Partial<Serie>): Sesion {
  const s = clon(s0)
  Object.assign(s.ejercicios[idx]!.series[n]!, cambios)
  return s
}

/**
 * Corrige una serie ya hecha. Las siguientes sin hacer que heredaron el peso equivocado pasan al corregido y las
 * tocadas a mano se respetan. Una serie sin hacer o fuera de rango no se toca.
 */
export function corregirSerie(s0: Sesion, idx: number, n: number, datos: Omit<DatosSerie, 'rpe'> & { record?: boolean }): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  const x = e?.series[n]
  if (!e || !x || !x.hecha) return s
  const pesoAntes = x.peso
  x.peso = datos.peso
  x.reps = datos.reps
  x.segundos = datos.segundos
  // Los lados y los km se quitan si ya no vienen (corregido a «igual en los dos lados» o sin distancia).
  for (const k of ['izq', 'der', 'km'] as const) { if (datos[k] != null) x[k] = datos[k]; else delete x[k] }
  if (datos.record !== undefined) x.record = datos.record || undefined
  if (!x.calentamiento && pesoAntes !== datos.peso) {
    for (const y of e.series.slice(n + 1)) if (!y.hecha && !y.calentamiento && y.peso === pesoAntes) y.peso = datos.peso
  }
  return s
}

export function anadirSerie(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]!
  const ult = e.series[e.series.length - 1]
  // Por tiempo va en segundos y sin reps.
  const tiempo = e.registro === 'tiempo'
  e.series.push({ n: e.series.length + 1, peso: ult?.peso ?? null, reps: tiempo ? null : ult?.reps ?? e.repsMin, segundos: tiempo ? ult?.segundos ?? e.repsMin : null, rpe: null, calentamiento: false, hecha: false })
  if (e.estado === 'hecho') e.estado = 'curso'
  return s
}

export function quitarSerie(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return s
  // La última serie de trabajo sin hacer, nunca una de calentamiento pendiente.
  const j = e.series.map(x => !x.hecha && !x.calentamiento).lastIndexOf(true)
  if (j >= 0 && e.series.filter(x => !x.calentamiento).length > 1) e.series.splice(j, 1)
  e.series.forEach((x, k) => (x.n = k + 1))
  if (serieActual(e) < 0 && e.estado === 'curso') { e.estado = 'hecho'; const sig = s.ejercicios.findIndex(o => o.estado === 'pendiente'); if (sig >= 0) s.ejercicios[sig]!.estado = 'curso' }
  return s
}

/** Añade el calentamiento y vuelve a numerar las series (1, 2, 3…): la pantalla usa `n` para las notas. */
export function conCalentamiento(s: Sesion, idx: number, series: { peso: number; reps: number }[]): Sesion {
  const nueva = anadirCalentamiento(s, idx, series)
  nueva.ejercicios[idx]?.series.forEach((x, k) => { x.n = k + 1 })
  return nueva
}

export function anadirCalentamiento(s0: Sesion, idx: number, series: { peso: number; reps: number }[]): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]!
  const ya = e.series.filter(x => x.calentamiento)
  if (ya.length) return s
  e.series.unshift(...series.map(c => ({ n: 0, peso: c.peso, reps: c.reps, rpe: null, calentamiento: true, hecha: false })))
  return s
}

/** Sustituye el ejercicio (máquina ocupada o cambio) manteniendo series y objetivo. */
export function sustituir(s0: Sesion, idx: number, nuevo: string, motivo: 'ocupado' | 'cambio', sug?: { peso: number | null; reps: number | null }, registro?: TipoRegistro): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return s
  e.ejercicio = nuevo
  e.motivo = motivo
  if (registro) e.registro = registro
  const r = e.registro
  for (const x of e.series) if (!x.hecha) {
    // Al cambiar a un ejercicio por tiempo o de peso corporal, las series pendientes se adaptan.
    x.peso = pesoInicial(sug?.peso, r)
    if (r === 'tiempo') { x.segundos = sug?.reps ?? x.segundos ?? 30; x.reps = null }
    else {
      if (sug?.reps != null) x.reps = sug.reps
      else x.reps ??= e.repsMin
      x.segundos = null
    }
  }
  return s
}

/** Pone otro ejercicio pendiente en curso (reordenar sobre la marcha). */
export function irA(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  for (const e of s.ejercicios) if (e.estado === 'curso') e.estado = serieActual(e) < 0 ? 'hecho' : 'pendiente'
  const e = s.ejercicios[idx]!
  if (e.estado !== 'hecho') e.estado = 'curso'
  return s
}

/** Mueve un ejercicio a otra posición (los no hechos). */
export function mover(s0: Sesion, desde: number, hasta: number): Sesion {
  const s = clon(s0)
  // Con índices fuera de rango no se mueve nada: un «undefined» en la lista rompería la sesión.
  if (desde < 0 || desde >= s.ejercicios.length || !Number.isInteger(desde) || !Number.isInteger(hasta)) return s
  const [e] = s.ejercicios.splice(desde, 1)
  s.ejercicios.splice(Math.max(0, Math.min(hasta, s.ejercicios.length)), 0, e!)
  return s
}

export function saltar(s0: Sesion, idx: number): Sesion {
  const s = clon(s0)
  const e = s.ejercicios[idx]
  if (!e) return s
  e.estado = 'saltado'
  const sig = s.ejercicios.findIndex(o => o.estado === 'pendiente')
  if (sig >= 0 && !s.ejercicios.some(o => o.estado === 'curso')) s.ejercicios[sig]!.estado = 'curso'
  return s
}

/**
 * Pasa a la versión corta: salta los ejercicios aún pendientes que el día deja fuera en la corta (o, en el sábado
 * armado, que no está en la rutina, los que lo apuntan en la sesión).
 */
export function recortarACorta(s: Sesion, dia: DiaRutina | undefined): Sesion {
  let nueva: Sesion = { ...s, version: 'corta' }
  const fuera = new Set((dia?.bloques ?? []).filter(b => b.fueraEnCorta).map(b => b.uid))
  s.ejercicios.forEach((x, i) => {
    if ((fuera.has(x.uid) || x.fueraEnCorta) && nueva.ejercicios[i]!.estado === 'pendiente') nueva = saltar(nueva, i)
  })
  return nueva
}

export function quitarUnaSerie(s0: Sesion, uid: string): Sesion {
  const i = s0.ejercicios.findIndex(e => e.uid === uid)
  return i < 0 ? s0 : quitarSerie(s0, i)
}

export const terminada = (s: Sesion) => s.ejercicios.every(e => e.estado === 'hecho' || e.estado === 'saltado')

export function resumen(s: Sesion) {
  const hechos = s.ejercicios.filter(e => e.estado === 'hecho' || e.series.some(x => x.hecha && !x.calentamiento))
  const series = s.ejercicios.reduce((t, e) => t + e.series.filter(x => x.hecha && !x.calentamiento).length, 0)
  const volumen = s.ejercicios.reduce((t, e) => t + e.series.filter(x => x.hecha && !x.calentamiento).reduce((a, x) => a + Math.max(0, x.peso ?? 0) * repsVolumen(x), 0), 0)
  return {
    ejercicios: s.ejercicios.length,
    hechos: hechos.length,
    saltados: s.ejercicios.filter(e => e.estado === 'saltado').length,
    sustituidos: s.ejercicios.filter(e => e.ejercicio !== e.planificado).length,
    series,
    volumen: Math.round(volumen),
    segundos: Math.round(((s.fin ?? Date.now()) - s.inicio) / 1000),
  }
}
