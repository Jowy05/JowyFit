// Generador: duración de un bloque (solo y en superserie, con tiempos reales), alternativas de un
// ejercicio cualquiera y bloques añadidos a mano con el catálogo real.
import { describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo, perfilEjemplo } from './ayuda'
import { alternativasDe, bloqueNuevo, descansoAjustado, duracionBloque, duracionDia, tiemposReales } from '../src/dominio/generador'
import { gimnasioNuevo } from '../src/datos/repos'
import type { Bloque } from '../src/datos/tipos'

const bloque = (uid: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio: uid, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })

describe('duración de un bloque', () => {
  it('solo: series × 45 s + descansos entre series + 75 s de cambio', () => {
    expect(duracionBloque(bloque('a'), undefined)).toBe(3 * 45 + 2 * 90 + 75)
    // Reps altas (10+): series algo más cortas.
    expect(duracionBloque(bloque('a', { repsMin: 10 }), undefined)).toBe(3 * 40 + 2 * 90 + 75)
    // Por tiempo: lo que dura la serie más larga.
    expect(duracionBloque(bloque('p', { registro: 'tiempo', repsMax: 45 }), undefined)).toBe(3 * 45 + 2 * 90 + 75)
    expect(duracionBloque(bloque('a', { series: 1 }), undefined)).toBe(45 + 75)
  })
  it('superserie: las dos series + 20 s de cambio por vuelta y dos cambios de sitio', () => {
    expect(duracionBloque(bloque('a'), bloque('b'))).toBe(3 * (45 + 45 + 20) + 2 * 90 + 150)
  })
  it('con los tiempos reales de la semana de prueba', () => {
    const tiempos = new Map([['a', { serie: 40, descanso: 150 }]])
    expect(duracionBloque(bloque('a'), undefined, { tiempos })).toBe(3 * 40 + 2 * 150 + 75)
  })
  it('un día: 5 min de calentamiento, +3 si empieza con barra, y en la corta sin lo marcado', () => {
    const bs = [bloque('a'), bloque('b', { fueraEnCorta: true })]
    const uno = duracionBloque(bloque('a'), undefined)
    expect(duracionDia(bs)).toBe(300 + 180 + uno * 2)
    expect(duracionDia(bs, true)).toBe(300 + 180 + uno)
    expect(duracionDia([])).toBe(300)
    expect(duracionDia([bloque('c', { registro: 'corporal' })])).toBe(300 + uno)
  })
})

describe('descanso según Ajustes', () => {
  it('sin ajustes o con valores raros, el de la rutina; si no, en proporción y de 15 en 15', () => {
    expect(descansoAjustado(150)).toBe(150)
    expect(descansoAjustado(150, { compuesto: 0, aislamiento: 90 })).toBe(150)
    expect(descansoAjustado(150, { compuesto: 180, aislamiento: 90 })).toBe(180)
    expect(descansoAjustado(75, { compuesto: 150, aislamiento: 60 })).toBe(45)
    expect(descansoAjustado(30, { compuesto: 150, aislamiento: 10 })).toBe(15)
  })
})

describe('tiempos reales', () => {
  it('sin series con hora o con ciclos absurdos (< 20 s o > 10 min) no da tiempos', () => {
    expect(tiemposReales([]).size).toBe(0)
    const ser = (ts: number) => ({ hecha: true, calentamiento: false, ts })
    expect(tiemposReales([{ ejercicios: [{ ejercicio: 'a', series: [ser(0), ser(5_000), ser(900_000)] }] }]).size).toBe(0)
    const t = tiemposReales([{ ejercicios: [{ ejercicio: 'a', series: [ser(0), ser(150_000), ser(300_000)] }] }])
    expect(t.get('a')).toEqual({ serie: 40, descanso: 110 })
  })
})

describe.skipIf(!hayCatalogo)('alternativas y bloques nuevos con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const gym = { ...gimnasioNuevo(), id: 1 }
  it('alternativas de un ejercicio: otras distintas de él, del mismo patrón y con el material del gimnasio', () => {
    const x = { perfil: perfilEjemplo(), gimnasio: gym, marcas: new Map(), ejercicios: c!.ejercicios }
    const alt = alternativasDe('bench-press', x)
    expect(alt.length).toBeGreaterThan(0)
    expect(alt).not.toContain('bench-press')
    for (const id of alt) {
      const e = c!.ejercicios.find(z => z.id === id)!
      expect(e.material == null || gym.material.includes(e.material), id).toBe(true)
    }
    expect(alternativasDe('no-existe', x)).toEqual([])
  })
  it('las alternativas no proponen lo que odia', () => {
    const x = { perfil: perfilEjemplo(), gimnasio: gym, marcas: new Map([['chest-press-machine', { id: 'chest-press-machine', odiado: true }]]), ejercicios: c!.ejercicios }
    expect(alternativasDe('bench-press', x)).not.toContain('chest-press-machine')
  })
  it('bloque nuevo: series y reps razonables, registro correcto y esfuerzo 7 en la semana de prueba', () => {
    const b = bloqueNuevo('bench-press', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios, gimnasio: gym })
    expect(b.ejercicio).toBe('bench-press')
    expect(b.series).toBeGreaterThanOrEqual(3)
    expect(b.repsMin).toBeLessThan(b.repsMax)
    expect(b.registro).toBe('peso')
    const plancha = bloqueNuevo('plank', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios })
    expect(plancha.registro).toBe('tiempo')
    expect(bloqueNuevo('desconocido', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios, calibracion: true }).rpe).toBe(7)
    const a = bloqueNuevo('bench-press', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios })
    expect(a.uid).not.toBe(b.uid)
  })
})
