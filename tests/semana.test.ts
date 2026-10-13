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
