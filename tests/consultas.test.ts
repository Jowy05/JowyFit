// Consultas que combinan tablas: historial y sugerencias de un día.
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../src/datos/db'
import { historialDe, sugerenciaPara, sugerenciasDia } from '../src/datos/consultas'
import type { Bloque, DiaRutina, Sesion } from '../src/datos/tipos'

const IDS = ['bench-press', 'squat', 'lat-pulldown', 'seated-cable-row', 'bicep-curl', 'tricep-pushdown', 'leg-press', 'lateral-raise']
const bloque = (id: string): Bloque => ({ uid: id, ejercicio: id, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso' })
const dia: DiaRutina = { letra: 'A', nombre: 'A', dia: 0, opcional: false, bloques: IDS.map(bloque) }

beforeAll(async () => {
  const sesiones: Sesion[] = Array.from({ length: 400 }, (_, i) => ({
    fecha: '2026-01-01', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: i, version: 'normal', estado: i % 10 === 9 ? 'cancelada' : 'hecha', calibracion: false,
    ejercicios: IDS.map(id => ({ uid: id, ejercicio: id, planificado: id, estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso',
      series: [1, 2, 3].map(n => ({ n, peso: 20 + i * 0.25, reps: 12, rpe: 7, calentamiento: false, hecha: true })) })),
  }))
  await db.sesiones.bulkAdd(sesiones)
})

describe('sugerencias', () => {
  it('sugerenciasDia da lo mismo que pedir cada ejercicio por separado', async () => {
    const m = await sugerenciasDia(dia)
    for (const b of dia.bloques) expect(m.get(b.ejercicio)).toEqual(await sugerenciaPara(b.ejercicio, b))
  })
  it('usa la sesión más reciente hecha (no las canceladas)', async () => {
    const h = await historialDe('bench-press')
    expect(h[0]!.inicio).toBe(398) // la 399 está cancelada
    const s = await sugerenciaPara('bench-press', { repsMin: 8, repsMax: 12, rpe: 8 })
    expect(s.accion).toBe('subir')
    expect(s.ultima?.peso).toBe(20 + 398 * 0.25)
  })
  it('rendimiento: un día de 8 ejercicios con 400 sesiones lee la base una sola vez', async () => {
    const t0 = performance.now()
    await sugerenciasDia(dia)
    const ms = performance.now() - t0
    console.log(`sugerenciasDia (8 ejercicios, 400 sesiones): ${ms.toFixed(1)} ms`)
    let lecturas = 0
    const original = db.sesiones.where.bind(db.sesiones)
    db.sesiones.where = ((...a: Parameters<typeof original>) => { lecturas++; return original(...a) }) as typeof db.sesiones.where
    try { await sugerenciasDia(dia) } finally { db.sesiones.where = original }
    expect(lecturas).toBe(1)
  })
})
