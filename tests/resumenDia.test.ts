// Resumen de un día de la semana de Inicio: el entreno hecho o el que toca, la comida y los pasos de ese día.
import { describe, expect, it } from 'vitest'
import { resumenDia } from '../src/dominio/resumenDia'
import { estadoSemana, semanaEnCola } from '../src/dominio/semana'
import type { Bloque, Comida, Rutina, Serie, Sesion } from '../src/datos/tipos'

const HOY = '2026-11-04' // miércoles
const bloque = (uid: string): Bloque => ({ uid, ejercicio: 'bench-press', alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso' })
// Lunes (A), miércoles (B) y viernes (C), y el sábado opcional; creada antes de la semana para que el lunes cuente.
const rutina: Rutina = {
  id: 1, creada: '2026-10-01T10:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: null,
  dias: [
    { letra: 'A', nombre: 'Cuerpo completo A', dia: 0, opcional: false, bloques: [bloque('a1'), bloque('a2')] },
    { letra: 'B', nombre: 'Cuerpo completo B', dia: 2, opcional: false, bloques: [bloque('b1'), bloque('b2'), bloque('b3')] },
    { letra: 'C', nombre: 'Cuerpo completo C', dia: 4, opcional: false, bloques: [bloque('c1')] },
    { letra: 'S', nombre: 'Sábado', dia: 5, opcional: true, bloques: [bloque('s1')] },
  ],
}
const serie = (x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 40, reps: 10, rpe: null, calentamiento: false, hecha: true, ...x })
const sesion = (fecha: string, x: Partial<Sesion> = {}): Sesion & { id: number } => ({
  id: 9, fecha, rutinaId: 1, letra: 'B', nombre: 'Cuerpo completo B', gimnasioId: null, inicio: Date.parse(`${fecha}T06:00:00`), fin: Date.parse(`${fecha}T06:50:00`),
  version: 'normal', estado: 'hecha', calibracion: false,
  ejercicios: [
    { uid: 'b1', ejercicio: 'bench-press', planificado: 'bench-press', estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', series: [serie(), serie({ n: 2, record: true }), serie({ n: 0, calentamiento: true })] },
    { uid: 'b2', ejercicio: 'squat', planificado: 'squat', estado: 'saltado', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', series: [serie({ hecha: false })] },
  ],
  ...x,
})
const comida = (fecha: string, kcal: number, proteina: number): Comida => ({ fecha, hora: '14:00', franja: 'comida', nombre: 'Plato', kcal, proteina, racion: 'N', tipo: 'nota' })

const dia = (fecha: string, sesiones: Sesion[] = [], cola = false) => {
  const s = estadoSemana(rutina, sesiones, HOY)
  return (cola ? semanaEnCola(s) : s).find(e => e.fecha === fecha)!
}

describe('resumen de un día', () => {
  it('hoy entrenado: el entreno con sus ejercicios, series, minutos y récords, y lo comido y andado hoy', () => {
    const s = sesion(HOY)
    const r = resumenDia({ dia: dia(HOY, [s]), hoy: HOY, sesiones: [s], comidas: [comida(HOY, 600, 40.4), comida(HOY, 300, 20), comida('2026-11-03', 999, 99)], pasos: { fecha: HOY, pasos: 6500, fuente: 'manual', troteKm: 1.5 } })
    expect(r).toMatchObject({ cuando: 'hoy', estado: 'hecho', plan: null, comida: { kcal: 900, proteina: 60, apuntadas: 2 }, pasos: { pasos: 6500, troteKm: 1.5 } })
    // El calentamiento no es una serie; el ejercicio saltado no cuenta como hecho.
    expect(r.hechos).toEqual([{ id: 9, nombre: 'Cuerpo completo B', ejercicios: 1, series: 2, minutos: 50, records: 1 }])
  })

  it('los minutos que dijo al terminar mandan sobre el reloj, y dos entrenos el mismo día salen por orden', () => {
    const a = sesion(HOY, { id: 1, inicio: Date.parse(`${HOY}T18:00:00`), respuestas: { minutosReales: 35 } })
    const b = sesion(HOY, { id: 2, nombre: 'Entreno libre', letra: 'L' })
    const r = resumenDia({ dia: dia(HOY, [a, b]), hoy: HOY, sesiones: [a, b, sesion('2026-11-02', { id: 3 })], comidas: [] })
    expect(r.hechos.map(h => [h.id, h.minutos])).toEqual([[2, 50], [1, 35]])
  })

  it('un día que viene: lo que toca, sin comida ni pasos', () => {
    const r = resumenDia({ dia: dia('2026-11-06'), hoy: HOY, sesiones: [], comidas: [] })
    expect(r).toMatchObject({ cuando: 'futuro', estado: 'plan', hechos: [], comida: null, pasos: null })
    expect(r.plan).toMatchObject({ letra: 'C', nombre: 'Cuerpo completo C', ejercicios: 1 })
    expect(r.plan!.minutos).toBeGreaterThan(0)
  })

  it('el opcional del sábado sale como tal', () => {
    expect(resumenDia({ dia: dia('2026-11-07'), hoy: HOY, sesiones: [], comidas: [] })).toMatchObject({ estado: 'opcional', plan: { letra: 'S' } })
  })

  it('un día pasado sin entrenar: el entreno perdido y lo que se comió (aunque no se apuntara nada)', () => {
    const r = resumenDia({ dia: dia('2026-11-02'), hoy: HOY, sesiones: [], comidas: [] })
    expect(r).toMatchObject({ cuando: 'pasado', estado: 'perdido', plan: { letra: 'A', ejercicios: 2 }, comida: { kcal: 0, proteina: 0, apuntadas: 0 }, pasos: { pasos: 0, troteKm: 0 } })
  })

  it('en cola el día sin entrenar no se pierde: es un día sin entreno', () => {
    expect(resumenDia({ dia: dia('2026-11-02', [], true), hoy: HOY, sesiones: [], comidas: [] })).toMatchObject({ estado: 'descanso', plan: null })
  })

  it('un día de descanso, y los pasos de otro día no se cuelan', () => {
    const r = resumenDia({ dia: dia('2026-11-03'), hoy: HOY, sesiones: [], comidas: [], pasos: { fecha: HOY, pasos: 4000, fuente: 'manual' } })
    expect(r).toMatchObject({ estado: 'descanso', plan: null, hechos: [], pasos: { pasos: 0 } })
  })
})
