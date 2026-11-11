import { describe, expect, it } from 'vitest'
import { opcionesDe } from '../../scripts/simulador/opciones.ts'

describe('opciones del lanzador', () => {
  it('sin opciones, todos los escenarios, 52 semanas y semillas 1 a 20', () => {
    expect(opcionesDe([])).toEqual({ escenarios: null, semanas: 52, semillas: Array.from({ length: 20 }, (_, indice) => indice + 1), inicio: '2026-01-05', comparar: null })
  })

  it('lee una batería pequeña', () => {
    expect(opcionesDe(['--escenario', 'turnos,posparto', '--semanas', '2', '--semillas', '3,7', '--inicio', '2026-03-02'])).toEqual({
      escenarios: ['turnos', 'posparto'], semanas: 2, semillas: [3, 7], inicio: '2026-03-02', comparar: null,
    })
  })

  it('la ayuda no devuelve opciones', () => {
    expect(opcionesDe(['--semanas', '2', '--ayuda'])).toBeNull()
  })

  it.each([
    ['--desconocido', '1'], ['--semanas'], ['--semanas', '--semillas', '1'], ['--semanas', '2', '--semanas', '3'],
    ['--semillas', '1,1'], ['--semillas', '-1'], ['--semanas', '1.5'], ['--escenario', 'a,a'],
    ['--comparar', 'indice.json', '--semanas', '4'], ['--semillas', Array.from({ length: 101 }, (_, indice) => indice).join(',')],
  ])('rechaza %j', (...argumentos) => {
    expect(() => opcionesDe(argumentos)).toThrow()
  })
})
