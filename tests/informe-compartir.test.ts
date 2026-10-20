// @vitest-environment jsdom
// Android: el PDF del informe se comparte desde la caché («compartir/», la carpeta que deja el FileProvider)
// con el menú del sistema; cerrar el menú sin elegir nada no es un error.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fsNativo = vi.hoisted(() => ({ writeFile: vi.fn() }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fsNativo, Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE' } }))
const share = vi.hoisted(() => ({ share: vi.fn() }))
vi.mock('@capacitor/share', () => ({ Share: share }))

import { compartirNativo } from '../src/plataforma'

beforeEach(() => {
  fsNativo.writeFile.mockReset().mockResolvedValue({ uri: 'file:///data/cache/compartir/JowyFit-informe-hoy-2026-10-20.pdf' })
  share.share.mockReset()
})

describe('compartirNativo', () => {
  it('deja el PDF en la caché y abre el menú Compartir con él', async () => {
    share.share.mockResolvedValue({})
    const bytes = new TextEncoder().encode('%PDF-1.7')
    expect(await compartirNativo('JowyFit-informe-hoy-2026-10-20.pdf', bytes, 'Informe JowyFit · Hoy')).toBe('compartido')
    const w = fsNativo.writeFile.mock.calls[0]![0]
    expect(w).toMatchObject({ path: 'compartir/JowyFit-informe-hoy-2026-10-20.pdf', directory: 'CACHE', recursive: true })
    expect(atob(w.data)).toBe('%PDF-1.7')
    expect(share.share).toHaveBeenCalledWith({ title: 'Informe JowyFit · Hoy', files: ['file:///data/cache/compartir/JowyFit-informe-hoy-2026-10-20.pdf'], dialogTitle: 'Informe JowyFit · Hoy' })
  })
  it('cerrar el menú sin elegir nada: «cancelado»', async () => {
    share.share.mockRejectedValue(new Error('Share canceled'))
    expect(await compartirNativo('a.pdf', new Uint8Array([1]), 'x')).toBe('cancelado')
  })
  it('otro fallo sí se avisa', async () => {
    share.share.mockRejectedValue(new Error('No Activity found'))
    await expect(compartirNativo('a.pdf', new Uint8Array([1]), 'x')).rejects.toThrow('No Activity found')
  })
})
