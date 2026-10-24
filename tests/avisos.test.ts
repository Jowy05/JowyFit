// Avisos del móvil: el del descanso se vuelve a poner al abrir la app (Android lo borra si cierra la app a la fuerza)
// y el de la copia cuenta desde la última copia, no desde que se abre la app.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLAS, db } from '../src/datos/db'
import type { Sesion } from '../src/datos/tipos'

const { programar, nativo } = vi.hoisted(() => ({ programar: vi.fn(() => Promise.resolve()), nativo: { si: false } }))
vi.mock('../src/plataforma', async original => ({
  ...(await original<typeof import('../src/plataforma')>()),
  programar,
  cancelar: vi.fn(() => Promise.resolve()),
  esNativo: () => nativo.si,
}))

const { reponerAvisoDescanso } = await import('../src/datos/acciones/entreno')
const { reprogramarNotificaciones } = await import('../src/datos/acciones/avisos')
const { guardarAjustes, guardarPerfil, perfilPorDefecto } = await import('../src/datos/repos')
const { aISO, horaActual } = await import('../src/dominio/fechas')
const { ID_AVISO } = await import('../src/plataforma')

const sesion = (x: Partial<Sesion>): Sesion => ({
  fecha: '2026-10-24', rutinaId: 1, letra: 'A', nombre: 'Cuerpo completo A', gimnasioId: 1, inicio: 1, version: 'normal', estado: 'curso',
  calibracion: false, ejercicios: [{ uid: 'u1', ejercicio: 'squat', planificado: 'squat', estado: 'curso', repsMin: 6, repsMax: 10, rpe: 8, descanso: 90, registro: 'peso', series: [] }],
  ...x,
})
type Programado = { id: number; titulo: string; cuando: Date }
const programados = () => (programar.mock.calls as unknown as [Programado[]][]).flatMap(([avisos]) => avisos)

beforeEach(async () => {
  for (const t of TABLAS) await db.table(t).clear()
  programar.mockClear()
  nativo.si = false
})
afterEach(() => { vi.useRealTimers() })

describe('reponerAvisoDescanso', () => {
  it('con un descanso en marcha, lo vuelve a programar a su hora', async () => {
    const hasta = Date.now() + 60_000
    const serie = { n: 1, peso: 20, reps: 8, rpe: 8, calentamiento: false, hecha: true, ts: 1 }
    await db.sesiones.add(sesion({ descansoHasta: hasta, ejercicios: [{ ...sesion({}).ejercicios[0]!, series: [serie] }] }))
    await reponerAvisoDescanso()
    const [aviso] = programados()
    expect(aviso?.id).toBe(ID_AVISO.descanso)
    expect(aviso?.titulo).toBe('Descanso terminado')
    expect(aviso?.cuando.getTime()).toBe(hasta)
  })

  it('sin ninguna serie hecha es el calentamiento, y su aviso lo dice', async () => {
    await db.sesiones.add(sesion({ descansoHasta: Date.now() + 60_000 }))
    await reponerAvisoDescanso()
    expect(programados()[0]?.titulo).toBe('Calentamiento terminado')
  })

  it('sin descanso, con el descanso ya pasado o sin entreno en curso, no programa nada', async () => {
    await reponerAvisoDescanso()
    await db.sesiones.add(sesion({ descansoHasta: Date.now() - 1000 }))
    await reponerAvisoDescanso()
    await db.sesiones.clear()
    await db.sesiones.add(sesion({ estado: 'hecha', descansoHasta: Date.now() + 60_000 }))
    await reponerAvisoDescanso()
    expect(programar).not.toHaveBeenCalled()
  })
})

describe('aviso de la copia', () => {
  it('cuenta desde la última copia: hacer una copia nueva lo mueve', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
    nativo.si = true
    await guardarPerfil({ ...perfilPorDefecto(), altaCompleta: true, creado: '2026-10-01T10:00:00.000Z' })
    const copia = async () => {
      programar.mockClear()
      await reprogramarNotificaciones()
      const a = programados().find(x => x.id === ID_AVISO.copia)!
      return `${aISO(a.cuando)} ${horaActual(a.cuando)}`
    }
    await guardarAjustes({ ultimaCopia: new Date(2026, 9, 18, 12, 0).toISOString() })
    expect(await copia()).toBe('2026-10-25 20:00')
    await guardarAjustes({ ultimaCopia: new Date(2026, 9, 22, 8, 30).toISOString() })
    expect(await copia()).toBe('2026-10-29 20:00')
  })
})
