// Cálculos corporales y de energía. Fórmulas del plan (sección 7).
import type { Perfil, TipoObjetivo, Trabajo } from '../datos/tipos'

export function imc(pesoKg: number, alturaCm: number): number {
  // Perfil a medias (altura 0): NaN en vez de Infinity, que se pinta como «∞».
  if (!(alturaCm > 0) || !(pesoKg > 0)) return Number.NaN
  const m = alturaCm / 100
  return pesoKg / (m * m)
}

/** Metabolismo basal, Mifflin-St Jeor. */
export function basalMifflin(pesoKg: number, alturaCm: number, edad: number, sexo: Perfil['sexo']): number {
  return 10 * pesoKg + 6.25 * alturaCm - 5 * edad + (sexo === 'hombre' ? 5 : -161)
}

/** % de grasa por el método de la Marina de EE. UU. (cm). Null si faltan medidas o no cuadran. */
export function grasaMarina(sexo: Perfil['sexo'], alturaCm: number, cinturaCm?: number, cuelloCm?: number, caderaCm?: number): number | null {
  if (!cinturaCm || !cuelloCm) return null
  // Sin altura válida log10(0) = −∞ y sale un −450 %.
  if (!(alturaCm > 0) || !Number.isFinite(alturaCm)) return null
  if (sexo === 'hombre') {
    if (cinturaCm <= cuelloCm) return null
    return 495 / (1.0324 - 0.19077 * Math.log10(cinturaCm - cuelloCm) + 0.15456 * Math.log10(alturaCm)) - 450
  }
  if (!caderaCm || cinturaCm + caderaCm <= cuelloCm) return null
  return 495 / (1.29579 - 0.35004 * Math.log10(cinturaCm + caderaCm - cuelloCm) + 0.221 * Math.log10(alturaCm)) - 450
}

export const cinturaAltura = (cinturaCm: number, alturaCm: number) => cinturaCm / alturaCm

/** 1RM estimado (Epley). */
export function epley(peso: number, reps: number): number {
  if (!Number.isFinite(peso) || !Number.isFinite(reps) || reps <= 0) return 0
  if (reps === 1) return peso
  return peso * (1 + reps / 30)
}

export const FACTOR_ACTIVIDAD: Record<Trabajo, number> = { sentado: 1.2, depie: 1.375, fisico: 1.55 }

/** Gasto diario sin contar el entreno (se suma aparte y solo en parte). */
export function gastoDiario(basal: number, trabajo: Trabajo): number {
  return basal * FACTOR_ACTIVIDAD[trabajo]
}

/** kcal de un entreno: MET × kg × horas. */
export function kcalEntreno(met: number, pesoKg: number, minutos: number): number {
  return met * pesoKg * (minutos / 60)
}

export const DEFICIT: Record<TipoObjetivo, number> = { recomposicion: 350, perder: 500, fuerza: 0 }

/** Objetivo de kcal orientativo (redondeado a 50) y de proteína (g, redondeada a 5). */
export function objetivos(p: { pesoKg: number; alturaCm: number; edad: number; sexo: Perfil['sexo']; trabajo: Trabajo; objetivo: TipoObjetivo; entrenosSemana: number }) {
  const basal = basalMifflin(p.pesoKg, p.alturaCm, p.edad, p.sexo)
  const gasto = gastoDiario(basal, p.trabajo)
  // Media diaria del entreno (~300 kcal por sesión), contada a la mitad para no pasarse.
  const entreno = (p.entrenosSemana * 300) / 7 / 2
  const kcal = Math.round((gasto + entreno - DEFICIT[p.objetivo]) / 50) * 50
  const gramosKg = p.objetivo === 'perder' ? 2.0 : 1.8
  const proteina = Math.round((p.pesoKg * gramosKg) / 5) * 5
  return { basal: Math.round(basal), gasto: Math.round(gasto + entreno), kcal, proteina }
}
