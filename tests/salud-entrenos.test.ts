// Entrenos hacia Health Connect con el plugin propio simulado (EntrenosSalud.java): el permiso se pide al encender
// el ajuste, cada entreno terminado va como sesión con sus kcal (y se quita si se borra en la app) y, apagado, sin
// permiso o fuera de Android, no se manda nada.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLAS, db } from '../src/datos/db'
import type { Sesion } from '../src/datos/tipos'

const nativo = vi.hoisted(() => ({
  plataforma: 'android',
  plugin: { permisos: vi.fn(), pedirPermiso: vi.fn(), guardar: vi.fn(), borrar: vi.fn() },
  // El de lectura (@capgo/capacitor-health), para «Comprobar qué llega».
  health: { isAvailable: vi.fn(async () => ({ available: true })), checkAuthorization: vi.fn(async () => ({ readAuthorized: [] })) },
}))
vi.mock('@capgo/capacitor-health', () => ({ Health: nativo.health }))
vi.mock('@capacitor/core', async original => ({
  ...(await original<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => nativo.plataforma, isNativePlatform: () => nativo.plataforma !== 'web' },
  registerPlugin: (nombre: string) => {
    if (nombre !== 'EntrenosSalud') throw new Error(`plugin inesperado: ${nombre}`)
    return nativo.plugin
  },
}))

const { borrarEntrenoDeSalud, guardarEntrenoEnSalud, pedirPermisoEntrenos, permisoEntrenos } = await import('../src/plataforma')
const { borrarSesion, entrenoASalud, idEnSalud, terminarEntreno } = await import('../src/datos/acciones/entreno')
const { cambiarEntrenosSalud, comprobarSalud } = await import('../src/app/servicios')
const { guardarAjustes, leerAjustes } = await import('../src/datos/repos')

const plugin = nativo.plugin
const INICIO = new Date(2026, 10, 3, 18, 0).getTime()
const FIN = INICIO + 50 * 60_000

const sesion = (x: Partial<Sesion> = {}): Sesion => ({
  id: 7, fecha: '2026-11-03', rutinaId: 1, letra: 'A', nombre: 'Cuerpo completo A', gimnasioId: 1, inicio: INICIO, version: 'normal', estado: 'curso', calibracion: false,
  ejercicios: [{
    uid: 'u1', ejercicio: 'squat', planificado: 'squat', estado: 'hecho', repsMin: 6, repsMax: 10, rpe: 8, descanso: 120, registro: 'peso',
    series: [1, 2, 3].map(n => ({ n, peso: 60, reps: 8, rpe: 8, calentamiento: false, hecha: true, ts: INICIO + n * 600_000 })),
  }],
  ...x,
})

beforeEach(async () => {
  for (const t of TABLAS) await db.table(t).clear()
  nativo.plataforma = 'android'
  plugin.permisos.mockReset().mockResolvedValue({ sesion: true, calorias: true })
  plugin.pedirPermiso.mockReset().mockResolvedValue({ sesion: true, calorias: true })
  plugin.guardar.mockReset().mockResolvedValue({ calorias: true })
  plugin.borrar.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { vi.restoreAllMocks() })

describe('plataforma: el plugin de entrenos', () => {
  it('guarda la sesión con su id, su hora y las kcal redondeadas', async () => {
    expect(await guardarEntrenoEnSalud({ id: 'jowyfit-sesion-1', inicio: INICIO, fin: FIN, titulo: 'Empuje', kcal: 212.6 })).toBe(true)
    expect(plugin.guardar).toHaveBeenCalledWith({ id: 'jowyfit-sesion-1', inicio: INICIO, fin: FIN, titulo: 'Empuje', kcal: 213 })
  })
  it('sin kcal (o con 0) no manda el campo', async () => {
    await guardarEntrenoEnSalud({ id: 'a', inicio: INICIO, fin: FIN, titulo: 'A', kcal: 0 })
    await guardarEntrenoEnSalud({ id: 'b', inicio: INICIO, fin: FIN, titulo: 'B' })
    for (const [e] of plugin.guardar.mock.calls) expect(e).not.toHaveProperty('kcal')
  })
  it('un fin que no va después del inicio no se manda (Health Connect lo rechazaría)', async () => {
    expect(await guardarEntrenoEnSalud({ id: 'a', inicio: INICIO, fin: INICIO, titulo: 'A' })).toBe(false)
    expect(plugin.guardar).not.toHaveBeenCalled()
  })
  it('si Health Connect falla, devuelve false sin lanzar', async () => {
    plugin.guardar.mockRejectedValue(new Error('Sin permiso para guardar entrenos'))
    expect(await guardarEntrenoEnSalud({ id: 'a', inicio: INICIO, fin: FIN, titulo: 'A' })).toBe(false)
  })
  it('el permiso cuenta si se da la sesión, aunque no se den las calorías', async () => {
    plugin.pedirPermiso.mockResolvedValue({ sesion: true, calorias: false })
    expect(await pedirPermisoEntrenos()).toBe(true)
    plugin.pedirPermiso.mockResolvedValue({ sesion: false, calorias: true })
    expect(await pedirPermisoEntrenos()).toBe(false)
    plugin.permisos.mockRejectedValue(new Error('Health Connect no está disponible'))
    expect(await permisoEntrenos()).toBe(false)
  })
  it('fuera de Android no se toca el plugin', async () => {
    nativo.plataforma = 'web'
    expect(await pedirPermisoEntrenos()).toBe(false)
    expect(await permisoEntrenos()).toBe(false)
    expect(await guardarEntrenoEnSalud({ id: 'a', inicio: INICIO, fin: FIN, titulo: 'A' })).toBe(false)
    expect(plugin.pedirPermiso).not.toHaveBeenCalled()
    expect(plugin.guardar).not.toHaveBeenCalled()
  })
})

describe('Ajustes: guardar los entrenos en Health Connect', () => {
  it('viene apagado', async () => {
    expect((await leerAjustes()).entrenosASalud).toBe(false)
  })
  it('al encenderlo pide el permiso y, si lo dan, se queda encendido', async () => {
    expect(await cambiarEntrenosSalud(true)).toBe('Cada entreno que termines se guardará en Health Connect')
    expect(plugin.pedirPermiso).toHaveBeenCalledTimes(1)
    expect((await leerAjustes()).entrenosASalud).toBe(true)
  })
  it('sin permiso se queda apagado y lo dice', async () => {
    plugin.pedirPermiso.mockResolvedValue({ sesion: false, calorias: false })
    expect(await cambiarEntrenosSalud(true)).toMatch(/Sin permiso/)
    expect((await leerAjustes()).entrenosASalud).toBe(false)
  })
  it('al apagarlo no pide nada', async () => {
    await guardarAjustes({ entrenosASalud: true })
    await cambiarEntrenosSalud(false)
    expect(plugin.pedirPermiso).not.toHaveBeenCalled()
    expect((await leerAjustes()).entrenosASalud).toBe(false)
  })
  it('«Comprobar qué llega» dice si hay permiso para los entrenos (solo con el ajuste encendido)', async () => {
    expect((await comprobarSalud()).some(l => l.startsWith('Guardar entrenos'))).toBe(false)
    await guardarAjustes({ entrenosASalud: true })
    plugin.permisos.mockResolvedValue({ sesion: false, calorias: false })
    expect(await comprobarSalud()).toContain('Guardar entrenos · permiso: no')
  })
})

describe('al terminar un entreno', () => {
  it('con el ajuste apagado no se manda nada', async () => {
    await db.sesiones.put(sesion())
    await terminarEntreno(sesion(), FIN, { minutosReales: 50 })
    await new Promise(r => setTimeout(r, 30))
    expect(plugin.guardar).not.toHaveBeenCalled()
    expect((await db.sesiones.get(7))!.estado).toBe('hecha')
  })
  it('encendido, va como sesión con su nombre, inicio, fin y las kcal de las series hechas', async () => {
    await guardarAjustes({ entrenosASalud: true })
    await db.mediciones.add({ fecha: '2026-11-01T07:00', origen: 'manual', pesoKg: 80 })
    await db.sesiones.put(sesion())
    await terminarEntreno(sesion(), FIN, { minutosReales: 50 })
    await vi.waitFor(() => expect(plugin.guardar).toHaveBeenCalledTimes(1))
    const e = plugin.guardar.mock.calls[0]![0]
    expect(e).toMatchObject({ id: `jowyfit-sesion-7-${INICIO}`, inicio: INICIO, fin: FIN, titulo: 'Cuerpo completo A' })
    expect(e.kcal).toBeGreaterThan(0)
  })
  it('sin peso apuntado, la sesión va igual pero sin kcal', async () => {
    await guardarAjustes({ entrenosASalud: true })
    expect(await entrenoASalud({ ...sesion(), fin: FIN })).toBe(true)
    expect(plugin.guardar.mock.calls[0]![0]).not.toHaveProperty('kcal')
  })
  it('si Health Connect falla, el entreno se queda guardado en la app', async () => {
    await guardarAjustes({ entrenosASalud: true })
    plugin.guardar.mockRejectedValue(new Error('Sin permiso para guardar entrenos'))
    await db.sesiones.put(sesion())
    await terminarEntreno(sesion(), FIN, {})
    await vi.waitFor(() => expect(plugin.guardar).toHaveBeenCalled())
    expect((await db.sesiones.get(7))!).toMatchObject({ estado: 'hecha', fin: FIN })
  })
  it('una sesión sin id (no guardada) no se manda', async () => {
    await guardarAjustes({ entrenosASalud: true })
    expect(await entrenoASalud({ ...sesion({ id: undefined }), fin: FIN })).toBe(false)
    expect(plugin.guardar).not.toHaveBeenCalled()
  })
})

describe('el id en Health Connect', () => {
  it('la misma sesión lleva siempre el mismo id (mandarla otra vez no la duplica)', () => {
    expect(idEnSalud(sesion())).toBe(idEnSalud({ ...sesion(), fin: FIN } as Sesion))
  })
  it('fallaba: tras «Borrar todos los datos» o reinstalar, el id 1 nuevo sobrescribía el entreno 1 viejo', () => {
    const vieja = sesion({ id: 1, inicio: INICIO - 30 * 86_400_000 })
    const nueva = sesion({ id: 1, inicio: INICIO })
    expect(idEnSalud(vieja)).not.toBe(idEnSalud(nueva))
  })
})

describe('al borrar un entreno en la app', () => {
  it('plataforma: pide quitarlo y, si Health Connect falla, devuelve false sin lanzar', async () => {
    expect(await borrarEntrenoDeSalud('x')).toBe(true)
    expect(plugin.borrar).toHaveBeenCalledWith({ id: 'x' })
    plugin.borrar.mockRejectedValue(new Error('Sin permiso para guardar entrenos'))
    expect(await borrarEntrenoDeSalud('x')).toBe(false)
    nativo.plataforma = 'web'
    plugin.borrar.mockClear()
    expect(await borrarEntrenoDeSalud('x')).toBe(false)
    expect(plugin.borrar).not.toHaveBeenCalled()
  })
  it('encendido, un entreno terminado se quita también de Health Connect con el mismo id con que se guardó', async () => {
    await guardarAjustes({ entrenosASalud: true })
    await db.sesiones.put(sesion({ estado: 'hecha', fin: FIN }))
    await borrarSesion(7)
    expect(await db.sesiones.get(7)).toBeUndefined()
    await vi.waitFor(() => expect(plugin.borrar).toHaveBeenCalledWith({ id: idEnSalud(sesion()) }))
  })
  it('si el entreno no estaba terminado, no se toca Health Connect', async () => {
    await db.sesiones.put(sesion({ id: 8, estado: 'cancelada' }))
    await borrarSesion(8)
    await new Promise(r => setTimeout(r, 30))
    expect(plugin.borrar).not.toHaveBeenCalled()
  })
  it('si Health Connect falla, el entreno se borra igual en la app', async () => {
    await guardarAjustes({ entrenosASalud: true })
    plugin.borrar.mockRejectedValue(new Error('Health Connect no está disponible'))
    await db.sesiones.put(sesion({ estado: 'hecha', fin: FIN }))
    await borrarSesion(7)
    await vi.waitFor(() => expect(plugin.borrar).toHaveBeenCalled())
    expect(await db.sesiones.get(7)).toBeUndefined()
  })
})


describe('envío y borrado del mismo entreno', () => {
  it('apagar los envíos no impide borrar un entreno enviado antes', async () => {
    await guardarAjustes({ entrenosASalud: true })
    const s = { ...sesion({ estado: 'hecha' }), fin: FIN }
    await db.sesiones.put(s)
    await entrenoASalud(s)
    await guardarAjustes({ entrenosASalud: false })
    await borrarSesion(7)
    await vi.waitFor(() => expect(plugin.borrar).toHaveBeenCalledWith({ id: idEnSalud(s) }))
  })
  it('el borrado remoto espera al envío en curso y no deja reaparecer el entreno', async () => {
    await guardarAjustes({ entrenosASalud: true })
    let acabar!: () => void
    plugin.guardar.mockImplementationOnce(() => new Promise<{ calorias: boolean }>(r => { acabar = () => r({ calorias: false }) }))
    const s = { ...sesion({ estado: 'hecha' }), fin: FIN }
    await db.sesiones.put(s)
    const envio = entrenoASalud(s)
    await vi.waitFor(() => expect(plugin.guardar).toHaveBeenCalledTimes(1))
    await borrarSesion(7)
    expect(await db.sesiones.get(7)).toBeUndefined()
    expect(plugin.borrar).not.toHaveBeenCalled()
    acabar()
    await envio
    await vi.waitFor(() => expect(plugin.borrar).toHaveBeenCalledWith({ id: idEnSalud(s) }))
  })
})
