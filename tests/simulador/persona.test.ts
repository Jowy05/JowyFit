import { describe, expect, it } from 'vitest'
import { azar, diaSemana, fechaEn } from '../../scripts/simulador/azar.ts'
import { asiste, realizar } from '../../scripts/simulador/persona.ts'
import { validarConfiguracion } from '../../scripts/simulador/validar.ts'
import type { ContextoDia, Evento, Registro } from '../../scripts/simulador/tipos.ts'
import { configuracionEjemplo, planEjemplo } from './ayuda.ts'

const contexto: ContextoDia = { indice: 0, fecha: '2026-01-05', lunes: '2026-01-05', semana: 0, programado: true, decision: 'aceptar', eventos: [], material: ['dumbbell'] }

describe('persona ficticia y calendario', () => {
  it('mantiene separados los flujos de azar y sus claves', () => {
    const primero = azar(8, 'asistencia', 4)
    azar(8, 'duracion', 4, 'otro-ejercicio')
    expect(azar(8, 'asistencia', 4)).toBe(primero)
    expect(azar(9, 'asistencia', 4)).not.toBe(primero)
    expect(azar(8, 'rendimiento', 4)).not.toBe(primero)
    expect(azar(8, 'a|b', 'c')).not.toBe(azar(8, 'a', 'b|c'))
    for (let semilla = 0; semilla < 1000; semilla++) expect(azar(semilla, 'muestra')).toBeGreaterThanOrEqual(0)
    expect(azar(0xffffffff, 'muestra')).toBeLessThan(1)
  })

  it.each([
    ['2026-03-28', 2, '2026-03-30'], ['2026-10-24', 2, '2026-10-26'],
    ['2026-12-31', 1, '2027-01-01'], ['2028-02-28', 1, '2028-02-29'], ['2028-02-28', 2, '2028-03-01'],
  ])('avanza %s en %i días hasta %s', (inicio, dias, resultado) => {
    expect(fechaEn(inicio, dias)).toBe(resultado)
  })

  it('usa lunes cero y domingo seis', () => {
    expect(diaSemana('2026-01-05')).toBe(0)
    expect(diaSemana('2026-01-11')).toBe(6)
  })

  it('respeta asistencia cero, uno, descanso e intervalo inclusivo de ausencia', () => {
    const configuracion = configuracionEjemplo()
    expect(asiste(configuracion, contexto)).toBe(true)
    expect(asiste(configuracion, { ...contexto, programado: false })).toBe(false)
    configuracion.escenario.persona.asistencia = 0
    expect(asiste(configuracion, contexto)).toBe(false)
    configuracion.escenario.persona.asistencia = 1
    configuracion.escenario.eventos = [{ dia: 1, tipo: 'ausencia', hasta: 2 }]
    expect(asiste(configuracion, { ...contexto, indice: 1 })).toBe(false)
    expect(asiste(configuracion, { ...contexto, indice: 2 })).toBe(false)
    expect(asiste(configuracion, { ...contexto, indice: 3 })).toBe(true)
  })

  it.each([
    ['normal', 8, 7], ['facil', 12, 5], ['dificil', 6, 9], ['estancado', 8, 7], ['sin-esfuerzo', 12, null],
  ] as const)('produce el guion %s sin fisiología inventada', (conducta, repeticiones, esfuerzo) => {
    const configuracion = configuracionEjemplo()
    configuracion.escenario.eventos = [{ dia: 0, tipo: 'conducta', valor: conducta }]
    const resultado = realizar(configuracion, contexto, planEjemplo())
    expect(resultado.ejercicios[0]!.series[0]).toEqual({ numero: 1, peso: 10, repeticiones, segundos: null, esfuerzo, hecha: true })
  })

  it.each(['peso', 'mancuerna', 'asistido', 'corporal', 'tiempo', 'cardio'] satisfies Registro[])('representa correctamente el registro %s', registro => {
    const plan = planEjemplo()
    plan.ejercicios[0]!.registro = registro
    plan.ejercicios[0]!.peso = registro === 'asistido' ? -10 : registro === 'corporal' || registro === 'tiempo' || registro === 'cardio' ? null : 10
    const serie = realizar(configuracionEjemplo(), contexto, plan).ejercicios[0]!.series[0]!
    expect(serie.segundos).toBe(registro === 'tiempo' ? 8 : null)
    expect(serie.repeticiones).toBe(registro === 'tiempo' ? null : 8)
    expect(serie.peso).toBe(plan.ejercicios[0]!.peso)
  })

  it('una sesión abandonada puede tener cero series hechas; una corta es parcial', () => {
    const configuracion = configuracionEjemplo()
    for (const [valor, hechas] of [['abandonada', 0], ['corta', 1]] as const) {
      const resultado = realizar(configuracion, { ...contexto, eventos: [{ dia: 0, tipo: 'sesion', valor }] }, planEjemplo())
      expect(resultado.ejercicios[0]!.series.filter(serie => serie.hecha)).toHaveLength(hechas)
      expect(resultado.estado).toBe(valor)
      expect(resultado.ejercicios[0]!.series.filter(serie => !serie.hecha).every(serie => serie.peso === null && serie.esfuerzo === null)).toBe(true)
    }
  })

  it('el ruido de un ejercicio no cambia al añadir otro antes', () => {
    const configuracion = configuracionEjemplo()
    configuracion.escenario.persona.variabilidad = 0.5
    const plan = planEjemplo()
    const original = realizar(configuracion, contexto, plan)
    const adicional = { ...plan.ejercicios[0]!, id: 'otro-bloque', ejercicio: 'otro' }
    const ampliado = realizar(configuracion, contexto, { ...plan, ejercicios: [adicional, ...plan.ejercicios] })
    expect(ampliado.ejercicios[1]).toEqual(original.ejercicios[0])
  })
})

describe('validación previa a cualquier adaptador', () => {
  it.each([-1, 0x100000000, 1.2, NaN, Infinity])('rechaza semilla %s', semilla => {
    expect(() => validarConfiguracion({ ...configuracionEjemplo(), semilla })).toThrow()
  })
  it.each([0, -1, 521, 1.5, Infinity])('rechaza semanas %s', semanas => {
    expect(() => validarConfiguracion({ ...configuracionEjemplo(), semanas })).toThrow()
  })
  it.each(['2026-02-30', '2026-13-01', 'ayer', '2026-1-5'])('rechaza fecha %s', inicio => {
    expect(() => validarConfiguracion({ ...configuracionEjemplo(), inicio })).toThrow()
  })
  it('rechaza días repetidos o eventos desordenados', () => {
    const configuracion = configuracionEjemplo()
    configuracion.escenario.dias = [0, 0]
    expect(() => validarConfiguracion(configuracion)).toThrow('Días')
    configuracion.escenario.dias = [0]
    configuracion.escenario.eventos = [{ dia: 4, tipo: 'decision', valor: 'aceptar' }, { dia: 3, tipo: 'decision', valor: 'rechazar' }]
    expect(() => validarConfiguracion(configuracion)).toThrow('Eventos')
  })
  it.each([
    { dia: -1, tipo: 'decision', valor: 'aceptar' }, { dia: 0, tipo: 'ausencia', hasta: -1 },
    { dia: 0, tipo: 'conducta', valor: 'inventada' }, { dia: 0, tipo: 'desconocido' },
  ])('rechaza un evento inválido %j', evento => {
    const configuracion = configuracionEjemplo()
    configuracion.escenario.eventos = [evento as Evento]
    expect(() => validarConfiguracion(configuracion)).toThrow()
  })
})
