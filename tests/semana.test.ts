import { describe, expect, it } from 'vitest'
import { estadoSemana } from '../src/dominio/semana'
import type { Rutina } from '../src/datos/tipos'

const rutina = (creada: string) => ({
  creada, activa: true, estructura: 'Cuerpo completo · 3 días', porque: [], calibracion: true, gimnasioId: null,
  dias: [
    { letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques: [] },
    { letra: 'B', nombre: 'B', dia: 3, opcional: false, bloques: [] },
  ],
}) as unknown as Rutina

describe('semana', () => {
  // Semana del lunes 12 al domingo 18 de octubre de 2026; hoy es viernes 16.
  it('un día de entreno pasado y sin hacer es perdido', () => {
    const s = estadoSemana(rutina('2026-10-01T10:00:00.000Z'), [], '2026-10-16')
    expect(s[1]!.estado).toBe('perdido')
    expect(s[3]!.estado).toBe('perdido')
  })
  it('no cuenta como perdido lo que había antes de crear la rutina', () => {
    const s = estadoSemana(rutina('2026-10-14T22:00:00.000Z'), [], '2026-10-16')
    expect(s[1]!.estado).toBe('descanso')
    expect(s[3]!.estado).toBe('perdido')
  })
})

describe('semáforo de la semana', () => {
  it('al día con los entrenos y sin nada en contra = verde, aunque falten datos', async () => {
    const { resumenSemana } = await import('../src/dominio/resumen')
    const sesion = { id: 1, fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 0, version: 'normal', estado: 'hecha', calibracion: false, ejercicios: [] } as never
    const r = resumenSemana({ hoy: '2026-10-14', sesiones: [sesion], fijos: 3, esperados: 1, mediciones: [], comidas: [], pasos: [], objetivoProteina: 135, objetivoPasos: 8000, recordsSemana: 0, subidasSemana: 0 })
    expect(r.semaforo).toBe('verde')
    const mal = resumenSemana({ hoy: '2026-10-16', sesiones: [], fijos: 3, esperados: 3, mediciones: [], comidas: [], pasos: [], objetivoProteina: 135, objetivoPasos: 8000, recordsSemana: 0, subidasSemana: 0 })
    expect(mal.semaforo).not.toBe('verde')
  })
})
