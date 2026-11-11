// Entorno aislado para recorrer JowyFit dentro de Vitest: IndexedDB en memoria con una base de nombre propio,
// plataforma sin avisos ni Salud y reloj falso. Se carga como setupFile de la batería y lo importan las pruebas.
import 'fake-indexeddb/auto'
import { vi } from 'vitest'

vi.mock('../../../src/datos/db', async importOriginal => {
  const original = await importOriginal<typeof import('../../../src/datos/db')>()
  return { ...original, db: new original.BaseJowyFit('jowyfit-simulador') }
})

vi.mock('../../../src/plataforma', async importOriginal => ({
  ...await importOriginal<typeof import('../../../src/plataforma')>(),
  programar: vi.fn(async () => undefined),
  cancelar: vi.fn(async () => undefined),
  avisarDescanso: vi.fn(async () => undefined),
  quitarAvisoDescanso: vi.fn(async () => undefined),
  guardarEntrenoEnSalud: vi.fn(async () => false),
  borrarEntrenoDeSalud: vi.fn(async () => false),
}))

export function fijarMomento(momento: Date | number): void {
  if (!vi.isFakeTimers()) vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(momento)
}

export function fijarDia(fecha: string): void {
  fijarMomento(new Date(`${fecha}T12:00:00`))
}

export function restaurarReloj(): void {
  vi.useRealTimers()
}
