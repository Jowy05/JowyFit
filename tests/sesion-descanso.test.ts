// «Hecho» en el entreno (récord y descanso que sigue), pasar a la versión corta y añadir el calentamiento.
import { describe, expect, it } from 'vitest'
import { apuntarSerie, conCalentamiento, crearSesion, DESCANSO_CALENTAMIENTO, recortarACorta } from '../src/dominio/sesion'
import type { Bloque, DiaRutina, Serie } from '../src/datos/tipos'

const AHORA = new Date(2026, 9, 13, 6, 0).getTime()
const bloque = (uid: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio: uid, alternativas: [], series: 2, repsMin: 8, repsMax: 12, rpe: 8, descanso: 120, registro: 'peso', ...x })
const dia = (bloques: Bloque[]): DiaRutina => ({ letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques })
const sesion = (bloques: Bloque[]) => crearSesion(dia(bloques), { rutinaId: 1, gimnasioId: null, version: 'normal', calibracion: false, ahora: AHORA, sugerencias: new Map(bloques.map(b => [b.ejercicio, { peso: 40, reps: 8 }])) })
const prev = (peso: number, reps: number): Serie => ({ n: 1, peso, reps, rpe: null, calentamiento: false, hecha: true })
const datos = (peso: number, reps: number) => ({ peso, reps, rpe: null, segundos: null })

describe('apuntarSerie: récord y descanso', () => {
  it('serie normal: descanso del ejercicio desde ahora y sin récord si no supera lo anterior', () => {
    const r = apuntarSerie(sesion([bloque('a')]), 0, datos(40, 8), [prev(50, 8)], AHORA)!
    expect(r.record).toBeNull()
    expect(r.sesion.descansoHasta).toBe(AHORA + 120_000)
    expect(r.sesion.descansoTotal).toBe(120)
    expect(r.sesion.ejercicios[0]!.series[0]).toMatchObject({ hecha: true, peso: 40, reps: 8 })
    expect(r.sesion.ejercicios[0]!.series[0]!.record).toBeUndefined()
  })
  it('más peso que nunca: récord de peso y la serie queda marcada', () => {
    const r = apuntarSerie(sesion([bloque('a')]), 0, datos(52.5, 6), [prev(50, 8)], AHORA)!
    expect(r.record?.tipo).toBe('peso')
    expect(r.sesion.ejercicios[0]!.series[0]!.record).toBe(true)
  })
  it('mismo peso, más reps: récord de repeticiones; sin historial no hay récord', () => {
    expect(apuntarSerie(sesion([bloque('a')]), 0, datos(50, 10), [prev(50, 8)], AHORA)!.record?.tipo).toBe('reps')
    expect(apuntarSerie(sesion([bloque('a')]), 0, datos(80, 10), [], AHORA)!.record).toBeNull()
  })
  it('calentamiento: nunca es récord y descansa 45 s', () => {
    const s = conCalentamiento(sesion([bloque('a')]), 0, [{ peso: 20, reps: 10 }])
    const r = apuntarSerie(s, 0, datos(200, 10), [prev(50, 8)], AHORA)!
    expect(r.record).toBeNull()
    expect(r.sesion.descansoTotal).toBe(DESCANSO_CALENTAMIENTO)
    expect(r.sesion.descansoHasta).toBe(AHORA + 45_000)
  })
  it('al pasar de ejercicio el descanso se queda en 90 s como mucho', () => {
    let s = sesion([bloque('a', { series: 1 }), bloque('b')])
    s = apuntarSerie(s, 0, datos(40, 8), [], AHORA)!.sesion
    expect(s.descansoTotal).toBe(90)
  })
  it('última serie del entreno: sin descanso', () => {
    const r = apuntarSerie(sesion([bloque('a', { series: 1 })]), 0, datos(40, 8), [], AHORA)!
    expect(r.sesion.descansoHasta).toBeUndefined()
  })
  it('superserie: de A1 a A2 sin descanso; tras A2, el descanso', () => {
    let s = sesion([bloque('a', { superserie: 'b' }), bloque('b', { superserie: 'a' })])
    s = apuntarSerie(s, 0, datos(40, 8), [], AHORA)!.sesion
    expect(s.descansoHasta).toBeUndefined()
    s = apuntarSerie(s, 1, datos(40, 8), [], AHORA)!.sesion
    expect(s.descansoHasta).toBe(AHORA + 120_000)
  })
  it('sin serie por hacer: null (no hay nada que guardar)', () => {
    let s = sesion([bloque('a', { series: 1 }), bloque('b')])
    s = apuntarSerie(s, 0, datos(40, 8), [], AHORA)!.sesion
    expect(apuntarSerie(s, 0, datos(40, 8), [], AHORA)).toBeNull()
    expect(apuntarSerie(s, 9, datos(40, 8), [], AHORA)).toBeNull()
  })
  it('no toca la sesión de entrada', () => {
    const s = sesion([bloque('a')])
    const copia = structuredClone(s)
    apuntarSerie(s, 0, datos(60, 8), [prev(50, 8)], AHORA)
    expect(s).toEqual(copia)
  })
})

describe('recortarACorta', () => {
  const bs = [bloque('a'), bloque('b', { fueraEnCorta: true }), bloque('c', { fueraEnCorta: true })]
  it('salta los pendientes que la corta deja fuera y marca la versión', () => {
    const s = recortarACorta(sesion(bs), dia(bs))
    expect(s.version).toBe('corta')
    expect(s.ejercicios.map(e => e.estado)).toEqual(['curso', 'saltado', 'saltado'])
  })
  it('lo ya empezado o hecho no se salta', () => {
    const s0 = sesion(bs)
    s0.ejercicios[1]!.estado = 'hecho'
    expect(recortarACorta(s0, dia(bs)).ejercicios.map(e => e.estado)).toEqual(['curso', 'hecho', 'saltado'])
  })
  it('sin el día de la rutina (borrada): solo cambia la versión', () => {
    const s = recortarACorta(sesion(bs), undefined)
    expect(s.version).toBe('corta')
    expect(s.ejercicios.map(e => e.estado)).toEqual(['curso', 'pendiente', 'pendiente'])
  })
})

describe('conCalentamiento', () => {
  it('mete las de calentamiento delante y numera todas desde 1', () => {
    const s = conCalentamiento(sesion([bloque('a')]), 0, [{ peso: 20, reps: 10 }, { peso: 30, reps: 5 }])
    const series = s.ejercicios[0]!.series
    expect(series.map(x => x.n)).toEqual([1, 2, 3, 4])
    expect(series.map(x => x.calentamiento)).toEqual([true, true, false, false])
  })
  it('si ya tiene calentamiento no añade otro', () => {
    const s1 = conCalentamiento(sesion([bloque('a')]), 0, [{ peso: 20, reps: 10 }])
    expect(conCalentamiento(s1, 0, [{ peso: 30, reps: 5 }]).ejercicios[0]!.series).toHaveLength(3)
  })
})
