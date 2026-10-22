// Calorías que gastas en el día, separadas en dos: en reposo (lo que gasta el cuerpo sin moverte) y por
// ejercicio (pasos + entreno). Son aproximaciones con tus datos (peso, altura, edad, sexo y, si lo hay, % de grasa).
import type { Perfil, Sesion } from '../datos/tipos'
import { basalMifflin } from './calculos'
import { PASOS_POR_KM } from './tendencias'

/**
 * Metabolismo en reposo del día. Con % de grasa, Katch-McArdle (usa la masa magra: más fiel si tienes músculo);
 * sin él, Mifflin-St Jeor (peso, altura, edad y sexo).
 */
export function basalDia(o: { pesoKg: number; alturaCm: number; edad: number; sexo: Perfil['sexo']; grasaPct?: number | null }): { kcal: number; formula: 'katch' | 'mifflin' } {
  if (o.grasaPct != null && o.grasaPct > 2 && o.grasaPct < 70) {
    const magra = o.pesoKg * (1 - o.grasaPct / 100)
    return { kcal: Math.round(370 + 21.6 * magra), formula: 'katch' }
  }
  return { kcal: Math.round(basalMifflin(o.pesoKg, o.alturaCm, o.edad, o.sexo)), formula: 'mifflin' }
}

/** Lo que llevas gastado en reposo a esta hora del día (el reposo se reparte igual en las 24 h). */
export const basalHastaAhora = (basal: number, minutosDelDia: number) => Math.round((basal * Math.min(1440, Math.max(0, minutosDelDia))) / 1440)

/** Zancada al caminar (m): un 41,5 % de la altura. */
export const zancada = (alturaCm: number) => (alturaCm / 100) * 0.415

/**
 * kcal por los pasos, sin contar el reposo (eso va aparte): caminar gasta unas 0,5 kcal por kg y km;
 * trotar, alrededor de 1. El trote apuntado a mano ya está sumado en los pasos (a 1.300 pasos por km).
 */
export function kcalPasos(pasos: number, pesoKg: number, alturaCm: number, troteKm = 0): number {
  const pasosTrote = Math.min(pasos, troteKm * PASOS_POR_KM)
  const kmAndando = ((pasos - pasosTrote) * zancada(alturaCm)) / 1000
  return Math.round(0.5 * pesoKg * kmAndando + 1.0 * pesoKg * (pasosTrote / PASOS_POR_KM))
}

/** Lo que dura una serie con su descanso detrás (s). */
function segundosSerie(e: Sesion['ejercicios'][number], seg?: number | null): number {
  const trabajo = e.registro === 'tiempo' ? (seg ?? e.repsMax) : e.registro === 'cardio' ? 0 : e.repsMin >= 10 ? 40 : 45
  return trabajo + e.descanso
}

export type GastoEntreno = { hecho: number; plan: number; saltado: number }

/**
 * kcal de un entreno sin el reposo: (MET − 1) × kg × tiempo de cada serie con su descanso; calentamiento a la mitad
 * y cardio por sus minutos. «plan»: todas las series; «saltado»: lo no hecho de los saltados (no el que está en curso).
 */
export function kcalSesion(s: Sesion, pesoKg: number, met: (id: string) => number | null | undefined): GastoEntreno {
  let hecho = 0, plan = 0, saltado = 0
  for (const e of s.ejercicios) {
    const m = Math.max(1.5, met(e.ejercicio) ?? 5) - 1
    for (const x of e.series) {
      const horas = e.registro === 'cardio' ? ((x.reps ?? e.repsMin) * 60) / 3600 : segundosSerie(e, x.segundos) / 3600
      const k = m * pesoKg * horas * (x.calentamiento ? 0.5 : 1)
      plan += k
      if (x.hecha) hecho += k
      else if (e.estado === 'saltado') saltado += k
    }
  }
  return { hecho: Math.round(hecho), plan: Math.round(plan), saltado: Math.round(saltado) }
}
