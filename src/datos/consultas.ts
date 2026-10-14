// Consultas que combinan tablas: historial de ejercicios, sugerencias, totales del día…
import { db } from './db'
import type { Comida, DiaRutina, Gimnasio, Medicion, Perfil, Serie, Sesion } from './tipos'
import { ejercicio } from '../catalogo/catalogo'
import { tipoRegistro } from '../catalogo/clasificacion'
import { pesosPara } from '../dominio/pesos'
import { desdeReferencia, sugerir, type Sugerencia } from '../dominio/progresion'
import { edad, hoyISO } from '../dominio/fechas'
import { objetivos } from '../dominio/calculos'

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
  const ultimas = historialEn(sesiones ?? (await sesionesHechas()), id, excluir)[0]?.series ?? null
  const lista = pesosPara(e?.material ?? null, reg, g)
  const s = sugerir(ultimas, objetivo, reg, lista)
  // Sin historial: si el perfil tiene un peso de referencia para este ejercicio, se parte de él.
  if (s.accion === 'primera' && reg === 'peso') {
    const refs = referencias ?? (await db.perfil.get('yo'))?.referencias
    return desdeReferencia(id, refs, objetivo, lista) ?? s
  }
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
  return lista.reduce((t, c) => ({ kcal: t.kcal + c.kcal, proteina: t.proteina + c.proteina, cafeina: t.cafeina + (c.cafeina ?? 0) }), { kcal: 0, proteina: 0, cafeina: 0 })
}

export async function comidasDe(fecha: string): Promise<Comida[]> {
  return (await db.comidas.where('fecha').equals(fecha).toArray()).sort((a, b) => a.hora.localeCompare(b.hora))
}

export async function ultimaMedicion(campo: 'peso' | 'cintura' | 'cuello' | 'cadera' | 'bascula'): Promise<Medicion | undefined> {
  const todas = (await db.mediciones.orderBy('fecha').reverse().toArray())
  return todas.find(m => campo === 'peso' ? m.pesoKg != null : campo === 'bascula' ? !!m.bascula && Object.keys(m.bascula).length > 0 : m.perimetros?.[campo] != null)
}

export async function pesoActual(): Promise<number | null> {
  return (await ultimaMedicion('peso'))?.pesoKg ?? null
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
