// Escaneados sin conexión: al volver la cobertura se buscan una sola vez aunque lo pidan a la vez la app y una pantalla.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLAS, db } from '../src/datos/db'
import { buscarPendientes } from '../src/datos/acciones/comida'

const PENDIENTE = { codigo: '8480000123458', nombre: '', marca: '', kcal100: null, proteina100: null, racionG: null, kcalRacion: null, proteinaRacion: null, guardado: '2026-10-24T10:00', pendiente: true }
const OFF = { status: 1, product: { product_name: 'Arroz al curry', brands: 'Hacendado', nutriments: { 'energy-kcal_100g': 167, proteins_100g: 6.1 } } }

beforeEach(async () => { for (const t of TABLAS) await db.table(t).clear() })
afterEach(() => { vi.unstubAllGlobals() })

describe('buscarPendientes', () => {
  it('dos peticiones a la vez hacen una sola búsqueda y el producto deja de estar pendiente', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(OFF), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await db.productos.put(PENDIENTE)
    const [a, b] = await Promise.all([buscarPendientes(), buscarPendientes()])
    expect([a, b]).toEqual([1, 1])
    expect(fetch).toHaveBeenCalledTimes(1)
    const p = await db.productos.get(PENDIENTE.codigo)
    expect(p?.pendiente).toBeFalsy()
    expect(p?.nombre).toBe('Arroz al curry')
  })
})
