import 'fake-indexeddb/auto'
import { vi } from 'vitest'

vi.mock('../../../src/datos/db', async importar => {
  const original = await importar<typeof import('../../../src/datos/db')>()
  return { ...original, db: new original.BaseJowyFit('jowyfit-simulador') }
})

vi.mock('../../../src/plataforma', () => ({
  dispositivoApple: () => null,
  ID_AVISO: { descanso: 101 },
  programar: vi.fn(async () => undefined),
  cancelar: vi.fn(async () => undefined),
  guardarEntrenoEnSalud: vi.fn(async () => false),
  borrarEntrenoDeSalud: vi.fn(async () => false),
}))

export function fijarDia(fecha: string): void {
  if (!vi.isFakeTimers()) vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${fecha}T12:00:00`))
}

export function restaurarReloj(): void {
  vi.useRealTimers()
}
