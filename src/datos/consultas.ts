// Consultas que combinan tablas: historial de ejercicios, sugerencias, totales del día…
import { db } from './db'
import type { Comida, DiaRutina, Gimnasio, Medicion, Perfil, Serie, Sesion } from './tipos'
import { cargarCatalogo, ejercicio, nombreEjercicio } from '../catalogo/catalogo'
import { patron, tipoRegistro } from '../catalogo/clasificacion'
import { pesosPara } from '../dominio/pesos'
import { conPartida, desdeReferencia, sugerir, type Sugerencia } from '../dominio/progresion'
import { estancado, pesoReinicio, SESIONES_ESTANCADO } from '../dominio/descarga'
import { edad, hoyISO } from '../dominio/fechas'
import { objetivos } from '../dominio/calculos'
import { basalDia, kcalPasos, kcalSesion, type GastoEntreno } from '../dominio/energia'
import { grasaPorMedidas } from '../dominio/tendencias'
import { regionNumeros, t } from '../i18n'
import { calcularInforme, hayDatosEn, primerDato, rangoInforme, type CatalogoInforme, type Informe, type PeriodoInforme, type RangoInforme, type SeccionesInforme, type TablasInforme } from '../dominio/informe'

export type Hecho = { sesionId: number; fecha: string; inicio: number; series: Serie[] }

/** Sesiones terminadas, de la más reciente a la más antigua. */
export async function sesionesHechas(): Promise<Sesion[]> {
  return (await db.sesiones.where('estado').equals('hecha').toArray()).sort((a, b) => b.inicio - a.inicio)
}

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

/** Historial de un ejercicio (más reciente primero), solo sesiones con series hechas. */
export async function historialDe(id: string, excluir?: number): Promise<Hecho[]> {
  return historialEn(await sesionesHechas(), id, excluir)
}

export async function ultimasSeries(id: string, excluir?: number): Promise<Serie[] | null> {
  return (await historialDe(id, excluir))[0]?.series ?? null
}

export function bloqueObjetivo(b: { repsMin: number; repsMax: number; rpe: number }) {
  return { repsMin: b.repsMin, repsMax: b.repsMax, rpe: b.rpe }
}

export async function sugerenciaPara(id: string, objetivo: { repsMin: number; repsMax: number; rpe: number }, g?: Gimnasio | null, excluir?: number, sesiones?: Sesion[], referencias?: Record<string, string>): Promise<Sugerencia> {
  const e = ejercicio(id)
  const reg = e ? tipoRegistro(e) : 'peso'
  // Las semanas suaves no cuentan: si no, tras la descarga se partiría del peso rebajado.
  const todas = (sesiones ?? (await sesionesHechas())).filter(x => !x.suave)
  const hist = historialEn(todas, id, excluir)
  const ultimas = hist[0]?.series ?? null
  const lista = pesosPara(e?.material ?? null, reg, g)
  const s = sugerir(ultimas, objetivo, reg, lista)
  // 3 sesiones con el mismo peso sin mejorar: se baja un 10 % para volver a subir (sin contar la calibración).
  // Con mancuernas o kettlebell también (antes solo con barra y máquinas: nunca bajaban al estancarse).
  if ((reg === 'peso' || reg === 'mancuerna') && s.peso != null && s.accion !== 'subir' && s.accion !== 'primera') {
    const sinCalibrar = historialEn(todas.filter(x => !x.calibracion), id, excluir)
    if (estancado(sinCalibrar)) {
      const p = pesoReinicio(s.peso, lista)
      // En inglés, punto decimal.
      const pesoTxt = regionNumeros() === 'en-US' ? String(p) : String(p).replace('.', ',')
      if (p < s.peso) return { ...s, accion: 'bajar', peso: p, reps: objetivo.repsMin, texto: t('Llevas {n} sesiones sin mejorar: baja a {peso} kg y vuelve a subir', { n: SESIONES_ESTANCADO, peso: pesoTxt }) }
    }
  }
  // Sin historial: si el perfil tiene un peso de referencia para este ejercicio, se parte de él.
  if (s.accion === 'primera' && reg === 'peso') {
    const refs = referencias ?? (await db.perfil.get('yo'))?.referencias
    const r = desdeReferencia(id, refs, objetivo, lista)
    if (r) return r
  }
  // Ni historial ni referencia: un peso de partida ligero que exista (barra vacía, mancuerna ligera, ~10 kg en máquina),
  // para que «Hecho» funcione a la primera. Corporales, tiempo y asistidos siguen igual.
  if (s.accion === 'primera') return conPartida(s, e?.material ?? null, reg, lista)
  return s
}

/** Sugerencias de todo un día leyendo las sesiones una sola vez (antes, una lectura completa por ejercicio). */
export async function sugerenciasDia(dia: DiaRutina, g?: Gimnasio | null): Promise<Map<string, Sugerencia>> {
  const m = new Map<string, Sugerencia>()
  const sesiones = await sesionesHechas()
  const refs = (await db.perfil.get('yo'))?.referencias ?? {}
  for (const b of dia.bloques) m.set(b.ejercicio, await sugerenciaPara(b.ejercicio, bloqueObjetivo(b), g, undefined, sesiones, refs))
  return m
}

export function totalesComida(lista: Comida[]) {
  return lista.reduce((suma, c) => ({ kcal: suma.kcal + c.kcal, proteina: suma.proteina + c.proteina, cafeina: suma.cafeina + (c.cafeina ?? 0) }), { kcal: 0, proteina: 0, cafeina: 0 })
}

export async function comidasDe(fecha: string): Promise<Comida[]> {
  return (await db.comidas.where('fecha').equals(fecha).toArray()).sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
}

export async function ultimaMedicion(campo: 'peso' | 'cintura' | 'cuello' | 'cadera' | 'bascula'): Promise<Medicion | undefined> {
  const todas = (await db.mediciones.orderBy('fecha').reverse().toArray())
  return todas.find(m => campo === 'peso' ? m.pesoKg != null : campo === 'bascula' ? !!m.bascula && Object.keys(m.bascula).length > 0 : m.perimetros?.[campo] != null)
}

export async function pesoActual(): Promise<number | null> {
  return (await ultimaMedicion('peso'))?.pesoKg ?? null
}

/** % de grasa más reciente: el de la báscula (de los últimos 4 meses) o, si no, el de la cinta (cintura y cuello). */
export async function grasaReciente(p: Perfil): Promise<number | null> {
  const ms = await db.mediciones.orderBy('fecha').toArray()
  const limite = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
  const bascula = [...ms].reverse().find(m => m.bascula?.grasaPct != null && m.fecha.slice(0, 10) >= limite)?.bascula?.grasaPct
  if (bascula != null) return bascula
  return grasaPorMedidas(ms, p.sexo, p.alturaCm).pop()?.valor ?? null
}

export type GastoDia = { basal: number; formula: 'katch' | 'mifflin'; peso: number; grasa: number | null; pasos: number; entreno: GastoEntreno; hayEntreno: boolean }

/**
 * Lo que gastas en un día: en reposo (con tu peso, altura, edad, sexo y % de grasa) y por ejercicio
 * (los pasos y los entrenos de ese día, contando solo las series hechas). Null si falta el peso o la altura.
 */
export async function gastoDelDia(p: Perfil, fecha: string): Promise<GastoDia | null> {
  const peso = await pesoActual()
  if (peso == null || !(p.alturaCm > 0)) return null
  const grasa = await grasaReciente(p)
  const b = basalDia({ pesoKg: peso, alturaCm: p.alturaCm, edad: edad(p.nacimiento), sexo: p.sexo, grasaPct: grasa })
  const dia = await db.pasos.get(fecha)
  const pasos = dia ? kcalPasos(dia.pasos, peso, p.alturaCm, dia.troteKm ?? 0) : 0
  const sesiones = (await db.sesiones.where('fecha').equals(fecha).toArray()).filter(s => s.estado !== 'cancelada')
  const entreno: GastoEntreno = { hecho: 0, plan: 0, saltado: 0 }
  for (const s of sesiones) {
    const k = kcalSesion(s, peso, id => ejercicio(id)?.met)
    entreno.hecho += k.hecho; entreno.plan += k.plan; entreno.saltado += k.saltado
  }
  return { basal: b.kcal, formula: b.formula, peso, grasa, pasos, entreno, hayEntreno: sesiones.some(s => s.ejercicios.some(e => e.series.some(x => x.hecha))) }
}

/** Objetivo de kcal y proteína (automático o el que puso el usuario). */
export async function objetivosEnergia(p: Perfil): Promise<{ kcal: number; proteina: number; basal: number; gasto: number; peso: number | null }> {
  const a = await db.ajustes.get('app')
  const peso = await pesoActual()
  const o = objetivos({ pesoKg: peso ?? 75, alturaCm: p.alturaCm, edad: edad(p.nacimiento), sexo: p.sexo, trabajo: p.trabajo, objetivo: p.objetivo, entrenosSemana: p.diasFijos.length })
  return { ...o, kcal: a?.kcalManual ?? o.kcal, proteina: a?.proteinaManual ?? o.proteina, peso }
}

export async function sesionDeHoy(): Promise<Sesion | undefined> {
  const hoy = hoyISO()
  return (await db.sesiones.where('fecha').equals(hoy).toArray()).find(s => s.estado === 'hecha')
}

// ---------- informe en PDF ----------

/** Todo lo que necesita el informe, leído de una vez (las tablas enteras: el periodo se filtra en el dominio). */
export async function tablasInforme(): Promise<TablasInforme> {
  const [perfil, ajustes, mediciones, sesiones, rutina, comidas, suplementos, pasos, metas] = await Promise.all([
    db.perfil.get('yo'),
    db.ajustes.get('app'),
    db.mediciones.toArray(),
    db.sesiones.toArray(),
    db.rutinas.filter(r => r.activa).last(),
    db.comidas.toArray(),
    db.suplementos.toArray(),
    db.pasos.toArray(),
    db.metas.toArray(),
  ])
  return { perfil, ajustes, mediciones, sesiones, rutina: rutina ?? null, comidas, suplementos, pasos, metas }
}

/** Nombres, grupos y MET de los ejercicios (RepDB). Sin catálogo (sin conexión la primera vez), el informe sale igual con lo que haya. */
async function catalogoInforme(): Promise<CatalogoInforme> {
  await cargarCatalogo().catch(() => null)
  return {
    nombre: id => (ejercicio(id) ? nombreEjercicio(id) : id),
    patron: id => { const e = ejercicio(id); return e ? patron(e) : undefined },
    met: id => ejercicio(id)?.met,
  }
}

/** Fechas de un periodo y si hay algo apuntado en ellas (para la hoja de Ajustes: el texto y el botón gris). */
export async function periodoInforme(periodo: PeriodoInforme, ahora = new Date()): Promise<RangoInforme & { hayDatos: boolean }> {
  const t = await tablasInforme()
  const r = rangoInforme(periodo, ahora, primerDato(t))
  return { ...r, hayDatos: hayDatosEn(t, r.inicio, r.fin) }
}

/** Todos los datos del informe en PDF de un periodo, listos para dibujar. */
export async function datosInforme(periodo: PeriodoInforme, ahora = new Date(), secciones?: Partial<SeccionesInforme>): Promise<Informe> {
  const [t, catalogo] = await Promise.all([tablasInforme(), catalogoInforme()])
  return calcularInforme({ ...t, periodo, ahora, secciones, catalogo })
}
