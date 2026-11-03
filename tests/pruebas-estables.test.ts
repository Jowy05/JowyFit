// Las pruebas de extremo a extremo, estables en la integración continua: reintento de lo que falla (solo en CI),
// esperas a que algo se cumpla, recargas que no pide ninguna prueba y la descarga de RepDB con reintentos.
import { describe, expect, it, vi } from 'vitest'
import { conReintento, reintentarEnCI, resumen } from '../scripts/e2e/reintento.mjs'
import { hastaQue, leerHasta } from '../scripts/e2e/esperas.mjs'
import { contarNavegaciones, trasCarga } from '../scripts/e2e/navegador.mjs'
import { descargarConReintentos, huella } from '../scripts/preparar-repdb.mjs'

describe('reintento de las pruebas (solo en la integración continua)', () => {
  it('solo se reintenta con CI puesto', () => {
    expect(reintentarEnCI({ CI: 'true' })).toBe(true)
    expect(reintentarEnCI({})).toBe(false)
  })
  it('lo que pasa a la primera no se repite', async () => {
    const f = vi.fn(async () => {})
    expect(await conReintento(f, { reintentar: true })).toEqual({ ok: true, reintentado: false })
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('si falla y luego pasa, cuenta como bien pero «reintentado», con el primer error apuntado', async () => {
    let n = 0
    const antes = vi.fn()
    const r = await conReintento(async () => { if (n++ === 0) throw new Error('lento') }, { reintentar: true, antesDeReintentar: antes })
    expect(r).toMatchObject({ ok: true, reintentado: true })
    expect((r.primerError as Error).message).toBe('lento')
    expect(antes).toHaveBeenCalledWith(r.primerError)
  })
  it('una sola vez más: si vuelve a fallar, falla con el segundo error', async () => {
    let n = 0
    const f = vi.fn(async () => { throw new Error(`fallo ${++n}`) })
    const r = await conReintento(f, { reintentar: true })
    expect(f).toHaveBeenCalledTimes(2)
    expect(r.ok).toBe(false)
    expect((r.error as Error).message).toBe('fallo 2')
    expect((r.primerError as Error).message).toBe('fallo 1')
  })
  it('fuera de la integración continua un fallo se ve a la primera', async () => {
    const f = vi.fn(async () => { throw new Error('mal') })
    const r = await conReintento(f)
    expect(f).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ ok: false, reintentado: false })
  })
  it('la línea final dice cuántos se han reintentado', () => {
    expect(resumen({ bien: 46, mal: 0, reintentados: 0, segundos: 653 })).toBe('46 bien, 0 mal · 653 s')
    expect(resumen({ bien: 46, mal: 1, reintentados: 1, segundos: 653 })).toBe('46 bien (1 reintentado), 1 mal · 653 s')
    expect(resumen({ bien: 49, mal: 0, reintentados: 2, segundos: '700' })).toBe('49 bien (2 reintentados), 0 mal · 700 s')
  })
})

describe('esperar a que algo se cumpla, no un tiempo fijo', () => {
  it('devuelve el valor en cuanto cumple', async () => {
    let n = 0
    expect(await leerHasta(async () => ++n, v => v >= 3, 'no llega')).toBe(3)
  })
  it('si no llega a tiempo, falla con el mensaje (también hecho con el último valor)', async () => {
    await expect(hastaQue(() => false, 'no se guarda', 50)).rejects.toThrow('no se guarda')
    await expect(leerHasta(() => 7, v => v > 10, v => `vale ${v}`, 50)).rejects.toThrow('vale 7')
  })
})

/** Un CDP de mentira: guarda los oyentes y deja lanzar sus eventos a mano. */
function cdpFalso() {
  const oyentes = new Map<string, ((p: unknown) => void)[]>()
  const emitir = (ev: string, p: unknown = {}) => { for (const f of oyentes.get(ev) ?? []) f(p) }
  const cdp = contarNavegaciones({
    enviar: async () => undefined,
    al: (ev: string, f: (p: never) => void) => { oyentes.set(ev, [...(oyentes.get(ev) ?? []), f as (p: unknown) => void]) },
  })
  const navegar = (url = 'http://127.0.0.1/app.html') => { emitir('Page.frameNavigated', { frame: { url } }); emitir('Page.loadEventFired') }
  return { cdp, navegar, emitir }
}

describe('recargas de la página', () => {
  it('trasCarga espera a que cargue el documento nuevo, y esa recarga no cuenta como «sola»', async () => {
    const { cdp, navegar } = cdpFalso()
    await trasCarga(cdp, () => { setTimeout(() => navegar(), 30) })
    expect(cdp.navegacion()).toEqual({ navegaciones: 1, cargada: 1 })
    expect(cdp.recargasSolas()).toEqual([])
  })
  it('una recarga que no pide ninguna prueba se apunta (y se olvida al leerla)', () => {
    const { cdp, navegar, emitir } = cdpFalso()
    navegar('http://127.0.0.1/app.html?sola')
    // Los marcos de dentro (iframes) no cuentan.
    emitir('Page.frameNavigated', { frame: { url: 'http://otro/', parentId: 'x' } })
    expect(cdp.recargasSolas()).toEqual(['http://127.0.0.1/app.html?sola'])
    expect(cdp.recargasSolas()).toEqual([])
  })
  it('si la página no termina de cargar, falla diciendo tras qué', async () => {
    const { cdp, navegar } = cdpFalso()
    await expect(trasCarga(cdp, () => {}, '«Borrar todo»', 60)).rejects.toThrow('La página no termina de cargar tras «Borrar todo»')
    // Y se deja de esperar: lo que venga luego sí cuenta como recarga sola.
    navegar('http://127.0.0.1/tarde')
    expect(cdp.recargasSolas()).toEqual(['http://127.0.0.1/tarde'])
  })
})

describe('descarga de RepDB con reintentos (la huella sigue mandando)', () => {
  const bueno = Buffer.from('zip revisado')
  const esperada = huella(bueno)
  const respuesta = (datos: Buffer, status = 200) => ({ ok: status < 400, status, arrayBuffer: async () => datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength) as ArrayBuffer })
  const sinEsperas = { dormir: vi.fn(async () => {}), avisar: vi.fn() }

  it('a la primera, sin esperar nada', async () => {
    const o = { ...sinEsperas, dormir: vi.fn(async () => {}) }
    const datos = await descargarConReintentos('u', { esperada, traer: async () => respuesta(bueno), ...o })
    expect(Buffer.from(datos).toString()).toBe('zip revisado')
    expect(o.dormir).not.toHaveBeenCalled()
  })
  it('sin red o con error del servidor, lo vuelve a intentar tras esperar', async () => {
    const dormir = vi.fn(async () => {})
    const avisar = vi.fn()
    let n = 0
    const traer = async () => {
      n++
      if (n === 1) throw new TypeError('fetch failed')
      if (n === 2) return respuesta(Buffer.from('Service Unavailable'), 503)
      return respuesta(bueno)
    }
    const datos = await descargarConReintentos('u', { esperada, esperas: [1, 2, 3], traer, dormir, avisar })
    expect(Buffer.from(datos).toString()).toBe('zip revisado')
    expect(dormir.mock.calls).toEqual([[1], [2]])
    expect(avisar).toHaveBeenCalledTimes(2)
    expect(avisar.mock.calls[1]![0]).toContain('HTTP 503')
  })
  it('lo que no cuadra con la huella no se acepta nunca: tras el último intento, el error de siempre', async () => {
    const traer = vi.fn(async () => respuesta(Buffer.from('<html>otra cosa</html>')))
    await expect(descargarConReintentos('u', { esperada, esperas: [1, 1], traer, ...sinEsperas })).rejects.toThrow(/no es el esperado[\s\S]*Huella esperada/)
    expect(traer).toHaveBeenCalledTimes(3)
  })
})
