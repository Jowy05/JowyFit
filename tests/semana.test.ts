process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import { estadoSemana, racha, tarjetaHoy } from '../src/dominio/semana'
import type { EjercicioSesion, Rutina, Sesion } from '../src/datos/tipos'

const rutina = (creada: string) => ({
  creada, activa: true, estructura: 'Cuerpo completo · 3 días', porque: [], calibracion: true, gimnasioId: null,
  dias: [
    { letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques: [] },
    { letra: 'B', nombre: 'B', dia: 3, opcional: false, bloques: [] },
  ],
}) as unknown as Rutina
const sesion = (ejercicios: EjercicioSesion[]): Sesion => ({ fecha: '2026-10-14', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 0, version: 'normal', estado: 'curso', calibracion: false, ejercicios })

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

describe('semana: casos límite', () => {
  const rutina: Rutina = { creada: '2026-01-01T10:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: null, dias: [
    { letra: 'A', nombre: 'A', dia: 0, opcional: false, bloques: [] },
    { letra: 'B', nombre: 'B', dia: 2, opcional: false, bloques: [] },
  ] }
  const hechaEl = (fecha: string): Sesion => ({ ...sesion([]), fecha, estado: 'hecha' })
  it('fallaba: la tarjeta de hoy reventaba si la semana no contenía hoy', () => {
    const semana = estadoSemana(rutina, [], '2026-10-14')
    expect(() => tarjetaHoy(rutina, semana, '2026-10-20', false, false)).not.toThrow()
  })
  it('fallaba: dos entrenos el mismo día contaban como dos días cumplidos en la racha', () => {
    expect(racha(rutina, [hechaEl('2026-10-05'), hechaEl('2026-10-05')], '2026-10-14')).toBe(0)
    expect(racha(rutina, [hechaEl('2026-10-05'), hechaEl('2026-10-07')], '2026-10-14')).toBe(1)
  })
  it('racha que cruza el fin de año', () => {
    const ses = ['2026-12-21', '2026-12-23', '2026-12-28', '2026-12-30'].map(hechaEl)
    expect(racha(rutina, ses, '2027-01-05')).toBe(2)
  })
  it('rutina sin días: todo descanso y racha 0', () => {
    const vacia = { ...rutina, dias: [] }
    expect(estadoSemana(vacia, [], '2026-10-14').every(d => d.estado === 'descanso')).toBe(true)
    expect(racha(vacia, [], '2026-10-14')).toBe(0)
  })
})
