import { describe, expect, it } from 'vitest'
import { basalMifflin, cinturaAltura, epley, grasaMarina, imc, objetivos } from '../src/dominio/calculos'
import { ajustarA, calentamiento, discosPorLado, mancuernasDisponibles, pesosBarra, siguiente } from '../src/dominio/pesos'
import { esRecord, mejorMarca, sugerir } from '../src/dominio/progresion'
import { estadoHora, propuestaRecorte, restoDescanso } from '../src/dominio/tiempos'
import { diaSemana, deISO, edad, lunesDe, semanaDe, sumarDias } from '../src/dominio/fechas'
import type { Serie, Sesion } from '../src/datos/tipos'

const serie = (peso: number | null, reps: number, rpe: number | null = 8, extra: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe, calentamiento: false, hecha: true, ...extra })

describe('cálculos', () => {
  it('IMC, basal, % grasa y cintura/altura con el ejemplo del plan', () => {
    expect(imc(79.1, 177)).toBeCloseTo(25.2, 1)
    expect(basalMifflin(79.1, 177, 21, 'hombre')).toBeCloseTo(1797, 0)
    expect(grasaMarina('hombre', 177, 98, 37)).toBeCloseTo(26.3, 1)
    expect(cinturaAltura(98, 177)).toBeCloseTo(0.55, 2)
    expect(grasaMarina('hombre', 177, 30, 37)).toBeNull()
  })
  it('1RM de Epley', () => {
    expect(epley(100, 1)).toBe(100)
    expect(epley(47.5, 6)).toBeCloseTo(57, 0)
  })
  it('objetivos: déficit moderado y proteína ~1,8 g/kg', () => {
    const o = objetivos({ pesoKg: 80, alturaCm: 178, edad: 22, sexo: 'hombre', trabajo: 'sentado', objetivo: 'recomposicion', entrenosSemana: 3 })
    expect(o.proteina).toBe(145)
    expect(o.kcal % 50).toBe(0)
    expect(o.kcal).toBeGreaterThan(1700)
    expect(o.kcal).toBeLessThan(2300)
  })
})

describe('pesos reales', () => {
  it('mancuernas por tramos', () => {
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 5, hasta: 10, paso: 1 }, { desde: 12, hasta: 16, paso: 2 }] })).toEqual([5, 6, 7, 8, 9, 10, 12, 14, 16])
  })
  it('barra con discos de 0,5 permite subir de kilo en kilo', () => {
    const p = pesosBarra(20, [0.5, 1, 2.5, 5, 10])
    expect(p).toContain(41)
    expect(p).toContain(47)
    expect(p).not.toContain(47.5)
    expect(siguiente(p, 45, 1)).toBe(46)
  })
  it('discos por lado', () => {
    expect(discosPorLado(47.5, 20, [0.5, 1, 1.25, 2.5, 5, 10, 20])).toEqual([10, 2.5, 1.25])
    expect(discosPorLado(21.3, 20, [1.25])).toBeNull()
  })
  it('calentamiento de aproximación con pesos que existen', () => {
    const lista = pesosBarra(20, [1.25, 2.5, 5, 10])
    const c = calentamiento(47.5, lista, 20)
    expect(c[0]).toEqual({ peso: 22.5, reps: 10 })
    expect(c.every(x => lista.includes(x.peso))).toBe(true)
    expect(ajustarA(lista, 33, true)).toBe(32.5)
  })
})

describe('progresión', () => {
  const lista = pesosBarra(20, [1.25, 2.5, 5, 10])
  const obj = { repsMin: 6, repsMax: 8, rpe: 8 }
  it('primera vez', () => expect(sugerir(null, obj, 'peso', lista).accion).toBe('primera'))
  it('sube cuando completa el rango con esfuerzo ≤ 8', () => {
    const s = sugerir([serie(45, 8, 7), serie(45, 8, 8), serie(45, 8, 8)], obj, 'peso', lista)
    expect(s.accion).toBe('subir')
    expect(s.peso).toBe(47.5)
  })
  it('salto doble si costó muy poco', () => {
    expect(sugerir([serie(40, 8, 5), serie(40, 8, 6)], obj, 'peso', lista).peso).toBe(45)
  })
  it('mantiene si no llega al tope', () => expect(sugerir([serie(45, 8), serie(45, 7), serie(45, 6)], obj, 'peso', lista).accion).toBe('mantener'))
  it('baja si se queda muy corto', () => {
    const s = sugerir([serie(45, 4, 10), serie(45, 3, 10)], obj, 'peso', lista)
    expect(s.accion).toBe('bajar')
    expect(s.peso).toBe(42.5)
  })
  it('ignora el calentamiento', () => {
    expect(sugerir([serie(20, 10, 3, { calentamiento: true }), serie(45, 8, 8)], obj, 'peso', lista).accion).toBe('subir')
  })
  it('asistido: subir es quitar asistencia', () => {
    const asis = Array.from({ length: 21 }, (_, i) => -i * 5).reverse()
    expect(sugerir([serie(-25, 8, 7), serie(-25, 8, 8)], obj, 'asistido', asis).peso).toBe(-20)
  })
  it('peso corporal: una rep más', () => {
    expect(sugerir([serie(null, 12, 8), serie(null, 12, 8)], { repsMin: 8, repsMax: 12, rpe: 8 }, 'corporal', []).reps).toBe(13)
  })
  it('récords', () => {
    const h = [serie(45, 8), serie(45, 7)]
    expect(esRecord(serie(47.5, 6), h)?.tipo).toBe('peso')
    expect(esRecord(serie(45, 9), h)?.tipo).toBe('reps')
    expect(esRecord(serie(45, 8), h)).toBeNull()
    expect(esRecord(serie(45, 8), [])).toBeNull()
    expect(mejorMarca(h)?.peso).toBe(45)
  })
})

describe('tiempos del entreno', () => {
  const base = (horaLimite: string): Sesion => ({
    fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: 1, inicio: 0, horaLimite, version: 'normal', estado: 'curso', calibracion: false,
    ejercicios: [
      { uid: 'a', ejercicio: 'bench-press', planificado: 'bench-press', estado: 'curso', series: [serie(45, 8), { ...serie(45, 8), hecha: false }, { ...serie(45, 8), hecha: false }], repsMin: 6, repsMax: 8, rpe: 8, descanso: 150, registro: 'peso' },
      { uid: 'b', ejercicio: 'lat-pulldown', planificado: 'lat-pulldown', estado: 'pendiente', series: [1, 2, 3].map(() => ({ ...serie(40, 8), hecha: false })), repsMin: 8, repsMax: 10, rpe: 8, descanso: 120, registro: 'peso' },
    ],
  })
  it('a tiempo / tarde según la hora límite', () => {
    const ahora = new Date(2026, 9, 13, 6, 0).getTime()
    expect(estadoHora(base('06:40'), ahora)!.aTiempo).toBe(true)
    const tarde = estadoHora(base('06:05'), ahora)!
    expect(tarde.aTiempo).toBe(false)
    expect(tarde.minutosTarde).toBeGreaterThan(5)
  })
  it('propone quitar una serie del último pendiente', () => {
    const r = propuestaRecorte(base('06:00'), 4, id => id)
    expect(r).toEqual({ tipo: 'serie', uid: 'b', texto: 'Vas 4 min tarde → quita 1 serie de lat-pulldown' })
    expect(propuestaRecorte(base('06:00'), 9, id => id)?.tipo).toBe('corta')
  })
  it('descanso por marcas de tiempo (sobrevive al bloqueo del móvil)', () => {
    expect(restoDescanso(1000, 150, 0, 1000 + 43_000)).toBe(107)
    expect(restoDescanso(1000, 150, 15, 1000 + 200_000)).toBe(0)
  })
})

describe('fechas', () => {
  it('semana de lunes a domingo', () => {
    expect(diaSemana(deISO('2026-10-13'))).toBe(1) // martes
    expect(lunesDe('2026-10-18')).toBe('2026-10-12')
    expect(semanaDe('2026-10-13')).toHaveLength(7)
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(edad('2005-03-23', new Date(2026, 9, 13))).toBe(21)
  })
})
