// iPhone: sin recordatorios ni pasos automáticos, «Pendientes de hoy» recuerda apuntar los pasos por la tarde.
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/datos/db'
import { pendientesDeHoy } from '../src/pantallas/inicio/pendientes'
import { perfilEjemplo } from './ayuda'

const HOY = '2026-10-13'
beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())) })

describe('«Apunta tus pasos de hoy»', () => {
  const ids = async (o: { pasosAMano?: boolean; tarde?: boolean }) => (await pendientesDeHoy(perfilEjemplo(), HOY, o)).map(p => p.id)

  it('solo en iPhone y por la tarde', async () => {
    expect(await ids({ pasosAMano: true, tarde: true })).toContain('pasos')
    expect(await ids({ pasosAMano: true, tarde: false })).not.toContain('pasos')
    expect(await ids({ pasosAMano: false, tarde: true })).not.toContain('pasos')
    // Android (o sin decir nada): como siempre.
    expect(await ids({})).not.toContain('pasos')
  })

  it('desaparece en cuanto hay pasos apuntados hoy', async () => {
    await db.pasos.put({ fecha: HOY, pasos: 0, fuente: 'manual' })
    expect(await ids({ pasosAMano: true, tarde: true })).toContain('pasos')
    await db.pasos.put({ fecha: HOY, pasos: 6200, fuente: 'manual' })
    expect(await ids({ pasosAMano: true, tarde: true })).not.toContain('pasos')
  })

  it('lleva a la pantalla de Pasos y dice dónde mirarlos', async () => {
    const p = (await pendientesDeHoy(perfilEjemplo(), HOY, { pasosAMano: true, tarde: true })).find(x => x.id === 'pasos')!
    expect(p.accion).toBe('pasos')
    expect(p.detalle).toMatch(/Salud/)
  })
})
