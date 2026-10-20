// @vitest-environment jsdom
// useCatalogo: carga el catálogo al montar la pantalla, y si no se puede (sin conexión la primera vez) no rompe.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

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
  it('si falla la carga se queda en null (sin error sin capturar)', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('sin conexión') })
    const { useCatalogo } = await import('../src/catalogo/catalogo')
    const { result } = renderHook(() => useCatalogo())
    await new Promise(r => setTimeout(r, 30))
    expect(result.current).toBeNull()
  })
})
