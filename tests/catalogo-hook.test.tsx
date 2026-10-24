// @vitest-environment jsdom
// useCatalogo: carga el catálogo al montar la pantalla, y si no se puede (sin conexión la primera vez) no rompe.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

const catalogo = { fuente: 'RepDB', version: 1, generado: '', etiquetas: {}, musculos: {}, material: {}, ejercicios: [] }

beforeEach(() => vi.resetModules())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('useCatalogo', () => {
  it('empieza vacío y se rellena al cargar', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => structuredClone(catalogo) }))
    const { useCatalogo } = await import('../src/catalogo/catalogo')
    const { result } = renderHook(() => useCatalogo())
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current!.fuente).toBe('RepDB')
  })
  it('ya cargado: lo da al momento', async () => {
    const m = await import('../src/catalogo/catalogo')
    m.usarCatalogo(structuredClone(catalogo))
    const { result } = renderHook(() => m.useCatalogo())
    expect(result.current).not.toBeNull()
  })
  it('vuelve a pintar al crear o borrar un ejercicio propio', async () => {
    const m = await import('../src/catalogo/catalogo')
    const { comoEjercicio } = await import('../src/catalogo/propios')
    m.usarCatalogo(structuredClone(catalogo))
    const { result } = renderHook(() => m.useCatalogo())
    const p = { id: 'mio-1', nombre: 'Remo con goma', grupo: 'espalda', material: 'otro', registro: 'peso', rutinaAuto: false, creado: '2026-10-20' } as const
    act(() => m.usarPropios([comoEjercicio(p)]))
    expect(result.current!.ejercicios.map(e => e.id)).toEqual(['mio-1'])
    act(() => m.usarPropios([comoEjercicio({ ...p, borrado: '2026-10-21' })]))
    expect(result.current!.ejercicios).toEqual([])
  })
  it('si falla la carga se queda en null (sin error sin capturar)', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('sin conexión') })
    const { useCatalogo } = await import('../src/catalogo/catalogo')
    const { result } = renderHook(() => useCatalogo())
    await new Promise(r => setTimeout(r, 30))
    expect(result.current).toBeNull()
  })
})
