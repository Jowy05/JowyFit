import { describe, expect, it } from 'vitest'
import { basalDia, basalHastaAhora, kcalPasos, kcalSesion } from '../src/dominio/energia'
import type { EjercicioSesion, Serie, Sesion } from '../src/datos/tipos'

const serie = (hecha: boolean, x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 60, reps: 8, rpe: null, calentamiento: false, hecha, ...x })
const ej = (id: string, series: Serie[], x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({ uid: id, ejercicio: id, planificado: id, estado: 'hecho', series, repsMin: 6, repsMax: 10, rpe: 8, descanso: 135, registro: 'peso', ...x })
const sesion = (ejercicios: EjercicioSesion[]): Sesion => ({ fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 0, version: 'normal', estado: 'hecha', calibracion: false, ejercicios })

describe('calorías en reposo', () => {
  it('con % de grasa usa la masa magra (Katch-McArdle); sin él, Mifflin', () => {
    // 79,1 kg con 24,2 % de grasa → 59,96 kg magros → 370 + 21,6 × 59,96 ≈ 1665.
    expect(basalDia({ pesoKg: 79.1, alturaCm: 177, edad: 21, sexo: 'hombre', grasaPct: 24.2 })).toEqual({ kcal: 1665, formula: 'katch' })
    // Mifflin: 10 × 79,1 + 6,25 × 177 − 5 × 21 + 5 = 1797.
    expect(basalDia({ pesoKg: 79.1, alturaCm: 177, edad: 21, sexo: 'hombre' })).toEqual({ kcal: 1797, formula: 'mifflin' })
    expect(basalDia({ pesoKg: 79.1, alturaCm: 177, edad: 21, sexo: 'hombre', grasaPct: 0 }).formula).toBe('mifflin')
  })
  it('se reparte a lo largo del día', () => {
    expect(basalHastaAhora(1800, 720)).toBe(900)
    expect(basalHastaAhora(1800, 2000)).toBe(1800)
  })
})

describe('calorías por pasos', () => {
  it('caminar: 0,5 kcal por kg y km con tu zancada', () => {
    // 10.000 pasos × 0,7346 m = 7,35 km × 79 kg × 0,5 ≈ 290 kcal.
    expect(kcalPasos(10000, 79, 177)).toBe(290)
    expect(kcalPasos(0, 79, 177)).toBe(0)
  })
  it('el trote gasta el doble por km', () => {
    // 3 km de trote = 3.900 pasos dentro de los 10.000.
    const conTrote = kcalPasos(10000, 79, 177, 3)
    expect(conTrote).toBeGreaterThan(kcalPasos(10000, 79, 177))
    expect(conTrote).toBe(Math.round(0.5 * 79 * (6100 * 0.73455) / 1000 + 79 * 3))
  })
})

describe('calorías del entreno', () => {
  const met = (id: string) => (id === 'press' ? 5 : 3.5)
  it('suma lo hecho y cuenta aparte lo saltado', () => {
    const s = sesion([
      ej('press', [serie(true), serie(true), serie(true)]),
      ej('curl', [serie(false), serie(false), serie(false)], { estado: 'saltado', repsMin: 10, descanso: 90 }),
    ])
    const k = kcalSesion(s, 80, met)
    // press: (5 − 1) × 80 kg × 3 × (45 + 135) s = 4 × 80 × 0,15 h = 48 kcal.
    expect(k.hecho).toBe(48)
    // curl saltado: (3,5 − 1) × 80 × 3 × (40 + 90) s ≈ 21,7 kcal.
    expect(k.saltado).toBe(22)
    expect(k.plan).toBe(70)
  })
  it('lo que queda de un ejercicio en curso no cuenta como saltado y el calentamiento va a la mitad', () => {
    const s = sesion([ej('press', [serie(true, { calentamiento: true }), serie(true), serie(false)], { estado: 'curso' })])
    const k = kcalSesion(s, 80, met)
    expect(k.saltado).toBe(0)
    expect(k.hecho).toBe(Math.round(4 * 80 * (180 / 3600) * 1.5))
  })
})
