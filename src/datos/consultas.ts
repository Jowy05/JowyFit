// Consultas que combinan tablas: historial de ejercicios, sugerencias, totales del día…
import { db } from './db'
import type { Comida, DiaRutina, Gimnasio, Medicion, Meta, Perfil, Serie, Sesion } from './tipos'
import { ejercicio } from '../catalogo/catalogo'
import { tipoRegistro } from '../catalogo/clasificacion'
import { pesosPara } from '../dominio/pesos'
import { bloqueObjetivo, conPartida, desdeReferencia, historialEn, sugerir, type Hecho, type Sugerencia } from '../dominio/progresion'
import { estancado, pesoReinicio, SESIONES_ESTANCADO } from '../dominio/descarga'
import { edad, hoyISO } from '../dominio/fechas'
import { objetivos } from '../dominio/calculos'
import { basalDia, kcalPasos, kcalSesion, type GastoEntreno } from '../dominio/energia'
import { grasaActual, hitosDominadas, pesoMaximo, seriesDe, ultimoValor } from '../dominio/tendencias'
import { kg } from '../dominio/formato'
import { t } from '../i18n'

/** Sesiones terminadas, de la más reciente a la más antigua. */
export async function sesionesHechas(): Promise<Sesion[]> {
  return (await db.sesiones.where('estado').equals('hecha').toArray()).sort((a, b) => b.inicio - a.inicio)
}

/** Historial de un ejercicio (más reciente primero), solo sesiones con series hechas. */
export async function historialDe(id: string, excluir?: number): Promise<Hecho[]> {
  return historialEn(await sesionesHechas(), id, excluir)
}

export async function ultimasSeries(id: string, excluir?: number): Promise<Serie[] | null> {
  return (await historialDe(id, excluir))[0]?.series ?? null
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
  // También con mancuernas y kettlebell, no solo con barra y máquinas.
  if ((reg === 'peso' || reg === 'mancuerna') && s.peso != null && s.accion !== 'subir' && s.accion !== 'primera') {
    const sinCalibrar = historialEn(todas.filter(x => !x.calibracion), id, excluir)
    if (estancado(sinCalibrar)) {
      const p = pesoReinicio(s.peso, lista)
      if (p < s.peso) return { ...s, accion: 'bajar', peso: p, reps: objetivo.repsMin, texto: t('Llevas {n} sesiones sin mejorar: baja a {peso} kg y vuelve a subir', { n: SESIONES_ESTANCADO, peso: kg(p) }) }
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

/** Sugerencias de todo un día leyendo las sesiones una sola vez, no una por ejercicio. */
export async function sugerenciasDia(dia: DiaRutina, g?: Gimnasio | null): Promise<Map<string, Sugerencia>> {
  const m = new Map<string, Sugerencia>()
  const sesiones = await sesionesHechas()
  const refs = (await db.perfil.get('yo'))?.referencias ?? {}
  for (const b of dia.bloques) m.set(b.ejercicio, await sugerenciaPara(b.ejercicio, bloqueObjetivo(b), g, undefined, sesiones, refs))
  return m
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

/** % de grasa de hoy con la regla de dominio/tendencias.grasaEn (báscula de los últimos 120 días o cinta). */
export async function grasaReciente(p: Perfil): Promise<number | null> {
  return grasaActual(await db.mediciones.toArray(), p, hoyISO())
}

type GastoDia = { basal: number; formula: 'katch' | 'mifflin'; peso: number; grasa: number | null; pasos: number; entreno: GastoEntreno; hayEntreno: boolean }

/**
 * Lo que gastas en un día: en reposo (con tu peso, altura, edad, sexo y % de grasa) y por ejercicio
 * (los pasos y los entrenos de ese día, contando solo las series hechas). Null si falta el peso o la altura.
 */
export async function gastoDelDia(p: Perfil, fecha: string): Promise<GastoDia | null> {
  const [ms, dia, delDia] = await Promise.all([db.mediciones.orderBy('fecha').toArray(), db.pasos.get(fecha), db.sesiones.where('fecha').equals(fecha).toArray()])
  const peso = [...ms].reverse().find(m => m.pesoKg != null)?.pesoKg ?? null
  if (peso == null || !(p.alturaCm > 0)) return null
  const grasa = grasaActual(ms, p, hoyISO())
  const b = basalDia({ pesoKg: peso, alturaCm: p.alturaCm, edad: edad(p.nacimiento), sexo: p.sexo, grasaPct: grasa })
  const pasos = dia ? kcalPasos(dia.pasos, peso, p.alturaCm, dia.troteKm ?? 0) : 0
  const sesiones = delDia.filter(s => s.estado !== 'cancelada')
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

/** Valor actual de una meta (null si no se puede saber). */
export async function valorActualMeta(tipo: Meta['tipo'], ejercicioId: string | undefined, perfil: Perfil): Promise<number | null> {
  if (tipo === 'libre') return null
  if (tipo === 'ejercicio' || tipo === 'dominadas') {
    const ses = await sesionesHechas()
    if (tipo === 'dominadas') return hitosDominadas(ses).estrictas
    if (!ejercicioId) return null
    const pesos = ses.map(s => pesoMaximo(seriesDe(s, ejercicioId))).filter((v): v is number => v != null)
    return pesos.length ? Math.max(...pesos) : null
  }
  const ms = await db.mediciones.toArray()
  if (tipo === 'cintura') return ultimoValor(ms, m => m.perimetros?.cintura)?.valor ?? null
  if (tipo === 'peso') return ultimoValor(ms, m => m.pesoKg)?.valor ?? null
  return grasaActual(ms, perfil, hoyISO())
}

export async function sesionDeHoy(): Promise<Sesion | undefined> {
  const hoy = hoyISO()
  return (await db.sesiones.where('fecha').equals(hoy).toArray()).find(s => s.estado === 'hecha')
}
