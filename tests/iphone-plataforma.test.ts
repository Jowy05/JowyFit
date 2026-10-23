// iPhone (versión web): quién es un navegador de Apple, si está instalada, la vibración, el menú Compartir y
// cuándo salen las instrucciones para instalarla.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { capacidades, compartirArchivo, dispositivoApple, esWebApple, estaInstalada, puedeVibrar } from '../src/plataforma'

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 15; NX809J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
}

function navegador(n: Record<string, unknown>) {
  vi.stubGlobal('navigator', { maxTouchPoints: 0, ...n })
}
afterEach(() => { vi.unstubAllGlobals() })

describe('navegador de Apple', () => {
  it('iPhone (también Chrome en iPhone), iPad y Safari de Mac', () => {
    navegador({ userAgent: UA.iphone }); expect(dispositivoApple()).toBe('iphone')
    navegador({ userAgent: UA.chromeIphone }); expect(dispositivoApple()).toBe('iphone')
    navegador({ userAgent: UA.ipad }); expect(dispositivoApple()).toBe('ipad')
    navegador({ userAgent: UA.mac }); expect(dispositivoApple()).toBe('mac')
  })
  it('el iPad que se presenta como un Mac se reconoce por la pantalla táctil', () => {
    navegador({ userAgent: UA.mac, maxTouchPoints: 5 })
    expect(dispositivoApple()).toBe('ipad')
  })
  it('Android y Chrome de Mac no son «de Apple»', () => {
    navegador({ userAgent: UA.android }); expect(esWebApple()).toBe(false)
    navegador({ userAgent: UA.chromeMac }); expect(esWebApple()).toBe(false)
  })
})

describe('lo que puede hacer cada aparato (capacidades)', () => {
  it('pasos a mano en iPhone y en iPad (también el que se presenta como Mac); no en Mac, Android ni Chrome de Mac', () => {
    const pasos = (n: Record<string, unknown>) => { navegador(n); return capacidades().pasosAMano }
    expect(pasos({ userAgent: UA.iphone })).toBe(true)
    expect(pasos({ userAgent: UA.ipad })).toBe(true)
    expect(pasos({ userAgent: UA.mac, maxTouchPoints: 5 })).toBe(true)
    expect(pasos({ userAgent: UA.mac })).toBe(false)
    expect(pasos({ userAgent: UA.android })).toBe(false)
    expect(pasos({ userAgent: UA.chromeMac })).toBe(false)
  })
  it('en la web no hay escáner del sistema, ni recordatorios, ni archivos en Documentos', () => {
    navegador({ userAgent: UA.iphone })
    const c = capacidades()
    expect([c.escanerNativo, c.recordatorios, c.compartirNativo, c.copiasEnDocumentos, c.salud]).toEqual([false, false, false, false, false])
    expect([c.apple, c.aparatoApple, c.instalar]).toEqual([true, 'iphone', 'inicio'])
  })
})

describe('instalada en la pantalla de inicio', () => {
  it('navigator.standalone (iPhone) o display-mode standalone', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    navegador({ userAgent: UA.iphone, standalone: true }); expect(estaInstalada()).toBe(true)
    navegador({ userAgent: UA.iphone, standalone: false }); expect(estaInstalada()).toBe(false)
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') }))
    expect(estaInstalada()).toBe(true)
  })
})

describe('vibración', () => {
  it('Safari no tiene navigator.vibrate: no se ofrece vibrar', () => {
    navegador({ userAgent: UA.iphone }); expect(puedeVibrar()).toBe(false)
    navegador({ userAgent: UA.android, vibrate: () => true }); expect(puedeVibrar()).toBe(true)
  })
})

describe('menú Compartir con un archivo', () => {
  const bytes = new Uint8Array([1, 2, 3])
  it('sin menú Compartir: no se puede (se descargará)', async () => {
    navegador({ userAgent: UA.iphone })
    expect(await compartirArchivo('a.jowyfit', bytes)).toBe('no-se-puede')
  })
  it('compartido, cancelado o sin el toque reciente', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    navegador({ userAgent: UA.iphone, share, canShare: () => true })
    expect(await compartirArchivo('a.jowyfit', bytes)).toBe('compartido')
    expect((share.mock.calls[0]![0] as { files: File[] }).files[0]!.name).toBe('a.jowyfit')
    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }))
    expect(await compartirArchivo('a.jowyfit', bytes)).toBe('cancelado')
    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    expect(await compartirArchivo('a.jowyfit', bytes)).toBe('sin-gesto')
  })
  it('si el navegador dice que no comparte ese archivo, no lo intenta', async () => {
    const share = vi.fn()
    navegador({ userAgent: UA.iphone, share, canShare: () => false })
    expect(await compartirArchivo('a.jowyfit', bytes)).toBe('no-se-puede')
    expect(share).not.toHaveBeenCalled()
  })
})

describe('instrucciones para instalarla', () => {
  function web(url: string, visto: boolean) {
    vi.stubGlobal('location', new URL(url))
    vi.stubGlobal('localStorage', { getItem: () => (visto ? '2026-10-20' : null), setItem: () => {} })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  }
  it('en iPhone sin instalar: con ?instalar=1 siempre; si no, solo la primera vez', async () => {
    const { ensenarAlEmpezar } = await import('../src/pantallas/instalar/Instalar')
    navegador({ userAgent: UA.iphone })
    web('https://jowy05.github.io/JowyFit/app.html?instalar=1', true); expect(ensenarAlEmpezar()).toBe(true)
    web('https://jowy05.github.io/JowyFit/app.html', false); expect(ensenarAlEmpezar()).toBe(true)
    web('https://jowy05.github.io/JowyFit/app.html', true); expect(ensenarAlEmpezar()).toBe(false)
  })
  it('nunca si ya está instalada ni fuera de Apple', async () => {
    const { ensenarAlEmpezar } = await import('../src/pantallas/instalar/Instalar')
    web('https://jowy05.github.io/JowyFit/app.html?instalar=1', false)
    navegador({ userAgent: UA.iphone, standalone: true }); expect(ensenarAlEmpezar()).toBe(false)
    navegador({ userAgent: UA.android }); expect(ensenarAlEmpezar()).toBe(false)
  })
})
