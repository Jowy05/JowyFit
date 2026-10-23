import { describe, expect, it } from 'vitest'
import { estancado, pesoReinicio, propuestaDescarga, seriesSuave, SEMANAS_SIN_DESCARGA, SESIONES_ESTANCADO, mejor1RM, pesoTop } from '../src/dominio/descarga'
import { pesosBarra } from '../src/dominio/pesos'
import type { Serie, Sesion, EjercicioSesion, TipoRegistro } from '../src/datos/tipos'

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
  it('cuenta semanas seguidas: 6 entrenos sueltos tras un parón no proponen semana suave', () => {
    const sueltos = ['2026-06-02', '2026-06-23', '2026-07-14', '2026-08-04', '2026-08-25', '2026-09-15'].map((f, i) => ses(f, i, {}, { x: [40 + i * 2.5, 8] }))
    expect(propuestaDescarga({ hoy: '2026-09-21', sesiones: sueltos, ejerciciosRutina: ['x'], semanaSuave: null, pospuesta: null, nombre })).toBeNull()
  })
  it('«Ahora no» la aplaza una semana; la semana suave reinicia la cuenta', () => {
    const sesiones = martes.map((f, i) => ses(f, i, {}, { x: [40 + i * 2.5, 8] }))
    const base = { hoy: '2026-10-12', sesiones, ejerciciosRutina: ['x'], semanaSuave: null, nombre }
    expect(propuestaDescarga({ ...base, pospuesta: '2026-10-12' })).toBeNull()
    // Siguió entrenando la semana aplazada: a la siguiente se vuelve a proponer.
    const conSemanaAplazada = [...sesiones, ses('2026-10-13', 6, {}, { x: [55, 8] })]
    expect(propuestaDescarga({ ...base, sesiones: conSemanaAplazada, pospuesta: '2026-10-12', hoy: '2026-10-19' })).not.toBeNull()
    // Si esa semana no entrenó, la racha se corta: una semana parado ya es descanso.
    expect(propuestaDescarga({ ...base, pospuesta: '2026-10-12', hoy: '2026-10-19' })).toBeNull()
    expect(propuestaDescarga({ ...base, pospuesta: null, semanaSuave: '2026-10-12' })).toBeNull()
    expect(propuestaDescarga({ ...base, pospuesta: null, semanaSuave: '2026-09-21', hoy: '2026-10-12' })).toBeNull()
  })
})

describe('−10 % al peso más cercano', () => {
  it('no baja de más con barra ni en máquinas', () => {
    const barra = Array.from({ length: 40 }, (_, i) => 20 + i * 2.5)
    // 55 × 0,9 = 49,5 → 50 (antes 47,5, un −14 %).
    expect(pesoReinicio(55, barra)).toBe(50)
    expect(pesoReinicio(100, barra)).toBe(90)
    // Sin un peso por debajo, se queda igual.
    expect(pesoReinicio(20, barra)).toBe(20)
  })
})

describe('estancamiento: casos límite', () => {
  const serie = (peso: number | null, reps: number | null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe: 8, calentamiento: false, hecha: true, ...x })
  const ej = (ejercicio: string, series: Serie[], registro: TipoRegistro = 'peso'): EjercicioSesion => ({ uid: ejercicio, ejercicio, planificado: ejercicio, estado: 'hecho', series, repsMin: 6, repsMax: 10, rpe: 8, descanso: 120, registro })
  let n = 1
  const sesion = (fecha: string, ejercicios: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion => ({ id: n++, fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: new Date(`${fecha}T06:00`).getTime(), version: 'normal', estado: 'hecha', ejercicios, calibracion: false, ...x })
  const s = (peso: number | null, reps: number | null, x: Partial<Serie> = {}) => serie(peso, reps, { rpe: null, ...x })
  it('peso más alto y mejor 1RM de una sesión (sin calentamiento ni asistidas)', () => {
    expect(pesoTop([s(20, 10, { calentamiento: true }), s(50, 5), s(45, 8)])).toBe(50)
    expect(pesoTop([s(-20, 8)])).toBe(0)
    expect(pesoTop([])).toBe(0)
    expect(mejor1RM([s(100, 1)])).toBe(100)
    expect(mejor1RM([s(100, null)])).toBe(0)
  })
  it('una sesión de las 3 últimas sin series con peso: no está estancado', () => {
    const h = (p: number) => ({ series: [s(p, 8), s(p, 8)] })
    expect(estancado([h(50), h(50), h(50), h(50)])).toBe(true)
    expect(estancado([h(50), { series: [] }, h(50), h(50)])).toBe(false)
    expect(estancado([h(50), h(50), h(50), { series: [s(null, 10)] }])).toBe(false)
    expect(SESIONES_ESTANCADO).toBe(3)
  })
  it('mejora de menos del 1 % sigue siendo estancamiento; más del 1 %, no', () => {
    const h = (p: number, r: number) => ({ series: [s(p, r)] })
    expect(estancado([h(50.25, 8), h(50, 8), h(50, 8), h(50, 8)])).toBe(true)
    expect(estancado([h(50, 9), h(50, 8), h(50, 8), h(50, 8)])).toBe(false)
  })
  it('peso de reinicio sin lista: −10 % redondeado a 2,5; con 0 o negativo, el mismo', () => {
    expect(pesoReinicio(50, [])).toBe(45)
    expect(pesoReinicio(2, [])).toBe(2)
    expect(pesoReinicio(0, [])).toBe(0)
    expect(pesoReinicio(50, [50, 60])).toBe(50) // no hay nada por debajo
  })
  it('propuesta: ya en semana suave o aplazada este lunes, nada; el motivo nombra los estancados', () => {
    const base = { hoy: '2026-10-14', sesiones: [] as Sesion[], ejerciciosRutina: [], nombre: (id: string) => id.toUpperCase() }
    expect(propuestaDescarga({ ...base, semanaSuave: '2026-10-12', pospuesta: null })).toBeNull()
    expect(propuestaDescarga({ ...base, semanaSuave: null, pospuesta: '2026-10-12' })).toBeNull()
    const h = (fecha: string) => sesion(fecha, ['a', 'b', 'c', 'd'].map(id => ej(id, [s(50, 8)])))
    const ss = ['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].map(h)
    const p = propuestaDescarga({ ...base, sesiones: ss, ejerciciosRutina: ['a', 'b', 'c', 'd', 'a'], semanaSuave: null, pospuesta: null })!
    expect(p.estancados).toEqual(['a', 'b', 'c', 'd'])
    expect(p.motivo).toBe('4 ejercicios llevan 3 sesiones sin mejorar (A, B, C…)')
    expect(SEMANAS_SIN_DESCARGA).toBe(6)
  })
})
