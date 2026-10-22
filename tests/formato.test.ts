// Formato de números y textos (dominio/formato): lo que se pinta y lo que se lee de los campos.
import { describe, expect, it } from 'vitest'
import { capital, conSigno, conUnidad, decimal, fijo, kg, leerNumero, num, textoSerie, textoSerieEnCurso } from '../src/dominio/formato'
import type { EjercicioSesion, Serie } from '../src/datos/tipos'

const serie = (x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 47.5, reps: 8, rpe: null, calentamiento: false, hecha: true, ...x })
const ej = (x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({ uid: 'a', ejercicio: 'a', planificado: 'a', estado: 'curso', series: [], repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })

describe('números', () => {
  it('num, kg y fijo con la coma del castellano y sin «-0»', () => {
    expect(num(72.25)).toBe('72,3')
    expect(num(-0.04)).toBe('0')
    expect(num(null)).toBe('—')
    expect(kg(47.5)).toBe('47,5')
    expect(kg(40)).toBe('40')
    expect(fijo(79)).toBe('79,0')
    expect(fijo(-0.001, 2)).toBe('0,00')
  })
  it('conSigno: más, raya corta y el cero sin signo', () => {
    expect(conSigno(1.5)).toBe('+1,5')
    expect(conSigno(-0.7)).toBe('–0,7')
    expect(conSigno(0.04)).toBe('0')
    expect(conSigno(-3, v => String(Math.round(v)))).toBe('–3')
  })
  it('conUnidad y decimal (el número tal cual para un campo)', () => {
    expect(conUnidad('26,3', '%')).toBe('26,3 %')
    expect(conUnidad('75', '')).toBe('75')
    expect(decimal(72.35)).toBe('72,35')
    expect(decimal(1234.5)).toBe('1234,5')
  })
  it('leerNumero: coma o punto, espacios y basura', () => {
    expect(leerNumero('72,5')).toBe(72.5)
    expect(leerNumero('72.5')).toBe(72.5)
    expect(leerNumero(' 80 ')).toBe(80)
    expect(leerNumero('12 kg')).toBe(12)
    expect(leerNumero('')).toBeNull()
    expect(leerNumero(undefined)).toBeNull()
    expect(leerNumero('abc')).toBeNull()
    expect(leerNumero('Infinity')).toBeNull()
  })
  it('capital', () => {
    expect(capital('martes')).toBe('Martes')
    expect(capital('')).toBe('')
  })
})

describe('texto de una serie', () => {
  it('«tabla» (Detalle del entreno): sin «kg» y cardio en minutos', () => {
    expect(textoSerie(serie(), 'peso', 'tabla')).toBe('47,5 × 8')
    expect(textoSerie(serie({ peso: -15, reps: 6 }), 'asistido', 'tabla')).toBe('asist. 15 × 6')
    expect(textoSerie(serie({ peso: null, segundos: 45, reps: null }), 'tiempo', 'tabla')).toBe('45 s')
    expect(textoSerie(serie({ peso: null, segundos: 1200 }), 'cardio', 'tabla')).toBe('20 min')
    expect(textoSerie(serie({ peso: null, reps: 10 }), 'corporal', 'tabla')).toBe('10 reps')
  })
  it('«corto» (Lista y panel): con «kg» y «ayuda» en la asistida', () => {
    expect(textoSerie(serie(), 'peso', 'corto')).toBe('47,5 kg × 8')
    expect(textoSerie(serie({ peso: -15, reps: 6 }), 'asistido', 'corto')).toBe('ayuda 15 kg × 6')
    expect(textoSerie(serie({ peso: null, reps: 30 }), 'cardio', 'corto')).toBe('30 min')
    expect(textoSerie(serie({ peso: null, segundos: null, reps: 30 }), 'tiempo', 'corto')).toBe('30 s')
  })
  it('en curso: la hecha con lo apuntado y la pendiente con el objetivo', () => {
    expect(textoSerieEnCurso(serie(), ej())).toBe('47,5 kg × 8')
    expect(textoSerieEnCurso(serie({ hecha: false }), ej())).toBe('47,5 kg × 8-12')
    expect(textoSerieEnCurso(serie({ hecha: false, peso: null }), ej({ registro: 'corporal' }))).toBe('8-12 reps')
    expect(textoSerieEnCurso(serie({ hecha: false }), ej({ registro: 'tiempo', repsMin: 30, repsMax: 45 }))).toBe('30-45 s')
    expect(textoSerieEnCurso(serie({ peso: -20, reps: 5 }), ej({ registro: 'asistido' }))).toBe('asist. 20 kg × 5')
  })
})
