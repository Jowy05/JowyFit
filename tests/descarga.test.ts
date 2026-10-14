import { describe, expect, it } from 'vitest'
import { estancado, pesoReinicio, propuestaDescarga, seriesSuave } from '../src/dominio/descarga'
import { pesosBarra } from '../src/dominio/pesos'
import type { Serie, Sesion } from '../src/datos/tipos'

const s = (peso: number, reps: number): Serie => ({ n: 1, peso, reps, rpe: null, calentamiento: false, hecha: true })
const sesion = (peso: number, reps: number) => ({ series: [s(peso, reps), s(peso, reps), s(peso, reps - 1)] })

describe('estancamiento por ejercicio', () => {
  it('3 sesiones con el mismo peso sin mejorar = estancado', () => {
    expect(estancado([sesion(50, 8), sesion(50, 8), sesion(50, 7), sesion(50, 8)])).toBe(true)
  })
  it('si mejora alguna, no', () => {
    expect(estancado([sesion(50, 9), sesion(50, 8), sesion(50, 8), sesion(50, 8)])).toBe(false)
    expect(estancado([sesion(52.5, 8), sesion(50, 8), sesion(50, 8), sesion(50, 8)])).toBe(false)
  })
  it('hacen falta 4 sesiones (3 + la de referencia)', () => {
    expect(estancado([sesion(50, 8), sesion(50, 8), sesion(50, 8)])).toBe(false)
    expect(estancado([])).toBe(false)
  })
  it('tras bajar el peso no vuelve a saltar mientras se recupera', () => {
    expect(estancado([sesion(45, 8), sesion(50, 7), sesion(50, 7), sesion(50, 8)])).toBe(false)
    expect(estancado([sesion(47.5, 8), sesion(45, 10), sesion(45, 9), sesion(50, 8)])).toBe(false)
  })
  it('sin peso (corporal) no cuenta', () => {
    const c = { series: [{ ...s(0, 10), peso: null }] }
    expect(estancado([c, c, c, c])).toBe(false)
  })
})

describe('reinicio y semana suave', () => {
  it('baja un 10 % a un peso que existe', () => {
    const lista = pesosBarra(20, [20, 10, 5, 2.5, 1.25])
    const p = pesoReinicio(50, lista)
    expect(lista).toContain(p)
    expect(p).toBeLessThan(50)
    expect(p).toBeGreaterThanOrEqual(42.5)
  })
  it('si no hay un peso menor, se queda igual', () => {
    expect(pesoReinicio(20, [20, 25, 30])).toBe(20)
  })
  it('una serie menos, nunca menos de 2', () => {
    expect(seriesSuave(4)).toBe(3)
    expect(seriesSuave(3)).toBe(2)
    expect(seriesSuave(2)).toBe(2)
  })
})

describe('propuesta de semana suave', () => {
  const ses = (fecha: string, i: number, o: Partial<Sesion> = {}, ej: Record<string, [number, number]> = {}): Sesion => ({
    id: i, fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: new Date(fecha + 'T05:30:00').getTime(), version: 'normal', estado: 'hecha', calibracion: false,
    ejercicios: Object.entries(ej).map(([id, [peso, reps]]) => ({ uid: id, ejercicio: id, planificado: id, estado: 'hecho', series: sesion(peso, reps).series, repsMin: 6, repsMax: 10, rpe: 8, descanso: 120, registro: 'peso' })),
    ...o,
  })
  const nombre = (id: string) => id
  // 6 semanas con un entreno cada martes, desde el 1 de septiembre de 2026.
  const martes = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06']

  it('a las 6 semanas seguidas propone una semana suave', () => {
    const sesiones = martes.map((f, i) => ses(f, i, {}, { 'bench-press': [40 + i * 2.5, 8] }))
    const p = propuestaDescarga({ hoy: '2026-10-12', sesiones, ejerciciosRutina: ['bench-press'], semanaSuave: null, pospuesta: null, nombre })
    expect(p?.motivo).toContain('6 semanas')
  })
  it('con 5 semanas, no; ni contando la calibración', () => {
    const sesiones = martes.map((f, i) => ses(f, i, { calibracion: i === 0 }, { 'bench-press': [40 + i * 2.5, 8] }))
    expect(propuestaDescarga({ hoy: '2026-10-12', sesiones, ejerciciosRutina: ['bench-press'], semanaSuave: null, pospuesta: null, nombre })).toBeNull()
  })
  it('con 3 ejercicios estancados la propone antes', () => {
    const ej = { a: [50, 8], b: [30, 10], c: [60, 6] } as Record<string, [number, number]>
    const sesiones = martes.slice(2).map((f, i) => ses(f, i, {}, ej))
    const p = propuestaDescarga({ hoy: '2026-10-12', sesiones, ejerciciosRutina: ['a', 'b', 'c'], semanaSuave: null, pospuesta: null, nombre })
    expect(p?.estancados.sort()).toEqual(['a', 'b', 'c'])
  })
  it('«Ahora no» la aplaza una semana; la semana suave reinicia la cuenta', () => {
    const sesiones = martes.map((f, i) => ses(f, i, {}, { x: [40 + i * 2.5, 8] }))
    const base = { hoy: '2026-10-12', sesiones, ejerciciosRutina: ['x'], semanaSuave: null, nombre }
    expect(propuestaDescarga({ ...base, pospuesta: '2026-10-12' })).toBeNull()
    expect(propuestaDescarga({ ...base, pospuesta: '2026-10-12', hoy: '2026-10-19' })).not.toBeNull()
    expect(propuestaDescarga({ ...base, pospuesta: null, semanaSuave: '2026-10-12' })).toBeNull()
    expect(propuestaDescarga({ ...base, pospuesta: null, semanaSuave: '2026-09-21', hoy: '2026-10-12' })).toBeNull()
  })
})
