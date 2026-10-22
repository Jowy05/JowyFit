// La regla única del % de grasa (Inicio, Energía, Metas y el informe): la báscula de los últimos 120 días
// y, si no hay, el último de la cinta (cintura y cuello), sin límite de días.
import { describe, expect, it } from 'vitest'
import { DIAS_GRASA_BASCULA, grasaActual, grasaEn, grasaPorMedidas } from '../src/dominio/tendencias'
import type { Medicion } from '../src/datos/tipos'

const P = { sexo: 'hombre' as const, alturaCm: 178 }
const bascula = (fecha: string, grasaPct: number): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', pesoKg: 80, bascula: { grasaPct } })
const cinta = (fecha: string): Medicion => ({ fecha: `${fecha}T08:00`, origen: 'cinta', perimetros: { cintura: 90, cuello: 38 } })
const HOY = '2026-10-22'
const deCinta = grasaPorMedidas([cinta('2026-01-01')], P.sexo, P.alturaCm)[0]!.valor

describe('grasaEn', () => {
  it('la báscula reciente gana aunque la cinta sea más nueva', () => {
    const ms = [bascula('2026-10-01', 21.5), cinta('2026-10-20')]
    expect(grasaEn(ms, grasaPorMedidas(ms, P.sexo, P.alturaCm), HOY)).toEqual({ fecha: '2026-10-01', valor: 21.5, fuente: 'bascula' })
  })
  it('la báscula vale 120 días justos; un día más y manda la cinta', () => {
    expect(DIAS_GRASA_BASCULA).toBe(120)
    const justo = [bascula('2026-06-24', 22), cinta('2026-01-01')]
    expect(grasaActual(justo, P, HOY)).toBe(22)
    const viejo = [bascula('2026-06-23', 22), cinta('2026-01-01')]
    expect(grasaActual(viejo, P, HOY)).toBe(deCinta)
  })
  it('la cinta no caduca; sin báscula reciente ni cinta, null', () => {
    expect(grasaActual([cinta('2020-01-01')], P, HOY)).toBe(deCinta)
    expect(grasaActual([bascula('2025-01-01', 20)], P, HOY)).toBeNull()
    expect(grasaActual([], P, HOY)).toBeNull()
  })
  it('entre básculas, la más reciente; lo posterior a la fecha no cuenta', () => {
    const ms = [bascula('2026-09-01', 23), bascula('2026-10-10', 21), bascula('2026-11-01', 19)]
    expect(grasaActual(ms, P, HOY)).toBe(21)
    expect(grasaActual(ms, P, '2026-09-15')).toBe(23)
  })
  it('en una fecha pasada (el informe) se mira desde esa fecha', () => {
    const ms = [bascula('2026-01-10', 25), cinta('2026-03-01')]
    expect(grasaEn(ms, grasaPorMedidas(ms, P.sexo, P.alturaCm), '2026-02-01')?.fuente).toBe('bascula')
    expect(grasaEn(ms, grasaPorMedidas(ms, P.sexo, P.alturaCm), '2026-01-05')).toBeNull()
  })
  it('el orden de las mediciones no importa', () => {
    const ms = [cinta('2026-10-20'), bascula('2026-10-10', 21), bascula('2026-09-01', 23)]
    expect(grasaActual(ms, P, HOY)).toBe(21)
  })
})
