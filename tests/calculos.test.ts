// Cuentas del cuerpo y la energía (IMC, grasa por medidas, Epley, basal, gasto y objetivos),
// también con datos raros.
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import { ajusteKcal, basalMifflin, cinturaAltura, epley, grasaMarina, imc, objetivos, AJUSTE_KCAL, FACTOR_ACTIVIDAD, gastoDiario, kcalEntreno } from '../src/dominio/calculos'
import { kg, num } from '../src/dominio/formato'

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

describe('cálculos de energía y cuerpo', () => {
  it('factor de actividad y gasto del día', () => {
    expect(FACTOR_ACTIVIDAD).toEqual({ sentado: 1.2, depie: 1.375, fisico: 1.55 })
    expect(gastoDiario(1800, 'sentado')).toBeCloseTo(2160)
    expect(gastoDiario(1800, 'fisico')).toBeCloseTo(2790)
  })
  it('kcal de un entreno: MET × kg × horas (0 minutos = 0)', () => {
    expect(kcalEntreno(5, 80, 60)).toBe(400)
    expect(kcalEntreno(5, 80, 30)).toBe(200)
    expect(kcalEntreno(5, 80, 0)).toBe(0)
  })
  it('objetivos: ajuste según el objetivo, kcal de 50 en 50 y proteína de 5 en 5', () => {
    const base = { pesoKg: 79.1, alturaCm: 177, edad: 21, sexo: 'hombre' as const, trabajo: 'sentado' as const, entrenosSemana: 3 }
    const r = objetivos({ ...base, objetivo: 'recomposicion' })
    const f = objetivos({ ...base, objetivo: 'fuerza' })
    const p = objetivos({ ...base, objetivo: 'perder' })
    const s = objetivos({ ...base, objetivo: 'salud' })
    expect(AJUSTE_KCAL).toMatchObject({ perder: -300, recomposicion: -200, musculo: 200, peso: 300 })
    expect(f.kcal - r.kcal).toBe(200)
    expect(s.kcal).toBe(f.kcal) // salud y fuerza: lo que gastas
    expect(p.kcal - s.kcal).toBe(-300)
    expect(r.ajuste).toBe(-200)
    expect(r.kcal % 50).toBe(0)
    expect(r.proteina % 5).toBe(0)
    expect(p.proteina).toBe(160) // 2 g/kg al perder
    expect(r.proteina).toBe(140) // 1,8 g/kg
    expect(r.basal).toBe(Math.round(basalMifflin(79.1, 177, 21, 'hombre')))
    expect(objetivos({ ...base, objetivo: 'fuerza', entrenosSemana: 0 }).gasto).toBe(Math.round(gastoDiario(basalMifflin(79.1, 177, 21, 'hombre'), 'sentado')))
  })
  it('objetivos: un objetivo extra pone su ajuste si el principal no cambia nada; nunca por debajo del reposo', () => {
    const base = { pesoKg: 79.1, alturaCm: 177, edad: 21, sexo: 'hombre' as const, trabajo: 'sentado' as const, entrenosSemana: 3 }
    expect(ajusteKcal('salud', ['perder'])).toBe(-300)
    expect(ajusteKcal('musculo', ['perder'])).toBe(200)
    expect(objetivos({ ...base, objetivo: 'salud', extra: ['perder'] }).kcal).toBe(objetivos({ ...base, objetivo: 'perder' }).kcal)
    const pequena = objetivos({ pesoKg: 45, alturaCm: 150, edad: 80, sexo: 'mujer', trabajo: 'sentado', objetivo: 'perder', entrenosSemana: 0 })
    expect(pequena.kcal).toBeGreaterThanOrEqual(pequena.basal)
  })
  it('objetivos: los pasos por encima de 5.000 suman gasto (0,5 kcal por kg y km)', () => {
    const base = { pesoKg: 80, alturaCm: 180, edad: 30, sexo: 'hombre' as const, trabajo: 'sentado' as const, objetivo: 'salud' as const, entrenosSemana: 0 }
    expect(objetivos({ ...base, pasos: 5000 }).desglose.pasos).toBe(0)
    // 5.000 pasos de más × 0,747 m = 3,7 km → 0,5 × 80 × 3,7 ≈ 149 kcal.
    expect(objetivos({ ...base, pasos: 10_000 }).desglose.pasos).toBe(149)
  })
  it('mujer: −161 en el basal y cadera en la grasa', () => {
    expect(basalMifflin(60, 165, 30, 'mujer')).toBeCloseTo(600 + 1031.25 - 150 - 161)
    expect(grasaMarina('mujer', 165, 75, 32)).toBeNull() // sin cadera
    const g = grasaMarina('mujer', 165, 75, 32, 98)!
    expect(g).toBeGreaterThan(20)
    expect(g).toBeLessThan(40)
  })
  it('cintura/altura, IMC y Epley con una sola repetición', () => {
    expect(cinturaAltura(98, 177)).toBeCloseTo(0.5537, 3)
    expect(imc(79.1, 177)).toBeCloseTo(25.25, 1)
    expect(imc(0, 177)).toBeNaN()
    expect(epley(100, 1)).toBe(100)
    expect(epley(100, 0)).toBe(0)
    expect(epley(NaN, 5)).toBe(0)
  })
  it('números en español: coma, sin «-0» y «—» si no hay número', () => {
    expect(num(79.14)).toBe('79,1')
    expect(num(-0.04)).toBe('0')
    expect(num(null)).toBe('—')
    expect(num(undefined)).toBe('—')
    expect(num(Infinity)).toBe('—')
    expect(num(1234.5, 0)).toBe('1235')
    expect(kg(47.5)).toBe('47,5')
    expect(kg(40)).toBe('40')
    expect(kg(1.25)).toBe('1,25')
  })
})

describe('cálculos con datos raros', () => {
  it('fallaba: IMC con altura 0 daba Infinity («∞»)', () => {
    expect(Number.isNaN(imc(80, 0))).toBe(true)
    expect(num(imc(80, 0))).toBe('—')
  })
  it('fallaba: % de grasa con altura 0 daba −450', () => {
    expect(grasaMarina('hombre', 0, 98, 37)).toBeNull()
    expect(grasaMarina('mujer', 0, 80, 32, 100)).toBeNull()
  })
  it('fallaba: «-0» al formatear (asistencia 0 kg, deltas de −0,04)', () => {
    expect(num(-0)).toBe('0')
    expect(num(-0.04)).toBe('0')
    expect(kg(-0)).toBe('0')
    expect(num(Infinity)).toBe('—')
    expect(kg(47.5)).toBe('47,5')
    expect(kg(-22.5)).toBe('-22,5')
    expect(num(1234.56)).toBe('1234,6')
  })
  it('Epley con datos no numéricos da 0', () => {
    expect(epley(Number.NaN, 5)).toBe(0)
    expect(epley(50, Number.NaN)).toBe(0)
  })
})
