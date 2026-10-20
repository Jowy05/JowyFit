// @vitest-environment jsdom
// Plataforma en la versión web (sin Capacitor nativo): lo que no hay se queda en nada sin romper,
// y lo que sí hay (vibración, pantalla encendida, descargar, elegir archivo, volver a la app) funciona.
// Lo propio de iPhone (navegador de Apple, instalada, Compartir) está en iphone-plataforma.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as plat from '../src/plataforma'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('dónde se está ejecutando', () => {
  it('en el navegador no es Android ni nativa', () => {
    expect(plat.esAndroid()).toBe(false)
    expect(plat.esNativo()).toBe(false)
  })
  it('esIPhone mira el navegador', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)' })
    expect(plat.esIPhone()).toBe(true)
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 15)' })
    expect(plat.esIPhone()).toBe(false)
  })
})

describe('botón atrás y volver a la app', () => {
  it('sin botón atrás nativo: escuchar no hace nada y se puede dejar de escuchar', async () => {
    const quitar = await plat.alPulsarAtras(() => true)
    expect(typeof quitar).toBe('function')
    quitar()
  })
  it('al volver a la pestaña (visible) avisa; al dejar de escuchar, ya no', async () => {
    const fn = vi.fn()
    const quitar = await plat.alVolverAPrimerPlano(fn)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fn).toHaveBeenCalledTimes(document.visibilityState === 'visible' ? 1 : 0)
    quitar()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fn.mock.calls.length).toBeLessThanOrEqual(1)
  })
})

describe('avisos (solo Android)', () => {
  it('en la web no hay permiso ni se programa nada, y nada falla', async () => {
    expect(await plat.permisoNotificaciones(true)).toBe(false)
    await expect(plat.programar([{ id: plat.ID_DESCANSO, titulo: 'Descanso', texto: 'Siguiente serie', cuando: new Date() }], [1])).resolves.toBeUndefined()
    await expect(plat.cancelar([plat.ID_DESCANSO])).resolves.toBeUndefined()
    await expect(plat.cancelar([])).resolves.toBeUndefined()
  })
  it('programar y cancelar van en fila (en el orden en que se piden)', async () => {
    const orden: string[] = []
    await Promise.all([
      plat.programar([]).then(() => orden.push('programar')),
      plat.cancelar([1]).then(() => orden.push('cancelar')),
      plat.programar([]).then(() => orden.push('programar 2')),
    ])
    expect(orden).toEqual(['programar', 'cancelar', 'programar 2'])
  })
})

describe('Health Connect y escáner nativo (solo Android)', () => {
  it('en la web: no hay pasos, ni permisos, ni escáner nativo', async () => {
    expect(await plat.pasosDisponibles()).toBe(false)
    expect(await plat.escanearNativo()).toBeNull()
    expect(await plat.copiasGuardadas()).toEqual([])
    // Los permisos de salud no se piden en la web (antes se mira pasosDisponibles); si se piden, no rompen.
    expect(typeof await plat.pedirPermisoPasos()).toBe('boolean')
    expect(typeof await plat.pedirPermisoBascula()).toBe('boolean')
    expect(Array.isArray(await plat.pedirPermisosSalud())).toBe(true)
    expect(Array.isArray(await plat.permisosSalud())).toBe(true)
    expect(typeof await plat.abrirHealthConnect()).toBe('boolean')
  })
})

describe('vibración, sonido y pantalla encendida', () => {
  it('vibrar: corta en un toque y doble al acabar el descanso; sin vibración, nada', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { userAgent: 'Android', vibrate })
    await plat.vibrar()
    await plat.vibrar('fin')
    expect(vibrate.mock.calls).toEqual([[40], [[200, 100, 200]]])
    vi.stubGlobal('navigator', { userAgent: 'iPhone' })
    await expect(plat.vibrar('fin')).resolves.toBeUndefined()
  })
  it('pitido sin audio en el navegador: no rompe', () => {
    expect(() => plat.pitido()).not.toThrow()
    expect(plat.sonidoListo()).toBe(false)
  })
  it('pantalla encendida: pide el bloqueo y lo suelta; sin soporte, nada', async () => {
    const release = vi.fn(async () => {})
    const request = vi.fn(async () => ({ release, addEventListener: () => {} }))
    vi.stubGlobal('navigator', { userAgent: 'Android', wakeLock: { request } })
    await plat.pantallaEncendida(true)
    await plat.pantallaEncendida(true) // ya lo tiene: no lo pide otra vez
    expect(request).toHaveBeenCalledTimes(1)
    await plat.pantallaEncendida(false)
    expect(release).toHaveBeenCalledTimes(1)
    vi.stubGlobal('navigator', { userAgent: 'iPhone' })
    await expect(plat.pantallaEncendida(true)).resolves.toBeUndefined()
  })
})

describe('archivos en la web', () => {
  it('guardar un archivo lo descarga con su nombre', async () => {
    const crear = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: () => {} }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(await plat.guardarArchivo('jowyfit-2026-10-13.jowyfit', new Uint8Array([1, 2]))).toBe('jowyfit-2026-10-13.jowyfit')
    expect(crear).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
  })
  it('elegir archivo: devuelve el nombre y los bytes; si no se elige, null', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      const f = new File([new Uint8Array([7, 8, 9])], 'copia.jowyfit')
      Object.defineProperty(this, 'files', { value: [f] })
      this.dispatchEvent(new Event('change'))
    })
    const r = await plat.elegirArchivo()
    expect(r?.nombre).toBe('copia.jowyfit')
    expect([...r!.bytes]).toEqual([7, 8, 9])
    click.mockImplementation(function (this: HTMLInputElement) { this.dispatchEvent(new Event('cancel')) })
    expect(await plat.elegirArchivo()).toBeNull()
  })
  it('reducir una foto: si el navegador no puede, devuelve la original', async () => {
    const b = new Blob(['x'], { type: 'image/png' })
    expect(await plat.reducir(b)).toBe(b)
  })
})
