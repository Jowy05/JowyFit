// @vitest-environment jsdom
// Plataforma con los plugins simulados: pasos y báscula de Health Connect, leer una copia guardada en
// Documentos, la foto (reducida) y el escáner de la cámara web (dos lecturas iguales antes de dar el código).
import { afterEach, describe, expect, it, vi } from 'vitest'

const health = vi.hoisted(() => ({
  queryAggregated: vi.fn(),
  readSamples: vi.fn(),
}))
vi.mock('@capgo/capacitor-health', () => ({ Health: health }))
const fsNativo = vi.hoisted(() => ({ readFile: vi.fn(), deleteFile: vi.fn() }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fsNativo, Directory: { Documents: 'DOCUMENTS' } }))
const detector = vi.hoisted(() => ({ lecturas: [] as string[][] }))
vi.mock('barcode-detector/ponyfill', () => ({
  prepareZXingModule: () => {},
  BarcodeDetector: class { async detect() { return (detector.lecturas.shift() ?? []).map(rawValue => ({ rawValue })) } },
}))

import { borrarCopiaGuardada, hacerFoto, leerBascula, leerCopiaGuardada, leerPasos, marcarPlataforma, prepararSonido } from '../src/plataforma'
import { abrirCamara } from '../src/plataforma/escanerWeb'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Health Connect simulado', () => {
  it('pasos por día (en hora local) desde el primer día hasta el último incluido', async () => {
    health.queryAggregated.mockResolvedValue({ samples: [
      { startDate: new Date(2026, 9, 12, 0, 0).toISOString(), value: 8123.4 },
      { startDate: new Date(2026, 9, 13, 0, 0).toISOString(), value: 950 },
    ] })
    expect(await leerPasos('2026-10-12', '2026-10-13')).toEqual({ '2026-10-12': 8123, '2026-10-13': 950 })
    const pedido = health.queryAggregated.mock.calls[0]![0]
    expect(pedido).toMatchObject({ dataType: 'steps', bucket: 'day' })
    // Hasta el final del último día (el siguiente a las 00:00).
    expect(new Date(pedido.endDate).getDate()).toBe(14)
  })
  it('báscula: pesos y grasas con su id y la app; si falta un permiso, esa parte vacía', async () => {
    health.readSamples.mockImplementation(async ({ dataType }: { dataType: string }) => {
      if (dataType === 'bodyFat') throw new Error('sin permiso')
      return { samples: [{ startDate: '2026-10-13T06:00:00.000Z', value: 79.1, platformId: 'p1', sourceName: 'com.fitdays.fitdays' }] }
    })
    const r = await leerBascula(new Date('2026-10-01T00:00:00Z'))
    expect(r.pesos).toEqual([{ fecha: '2026-10-13T06:00:00.000Z', valor: 79.1, id: 'p1', fuente: 'com.fitdays.fitdays' }])
    expect(r.grasas).toEqual([])
  })
})

describe('copias guardadas en Documentos (Android)', () => {
  it('lee el archivo en base64 y lo devuelve en bytes', async () => {
    fsNativo.readFile.mockResolvedValue({ data: btoa(String.fromCharCode(80, 75, 3, 4)) })
    expect([...await leerCopiaGuardada('jowyfit-2026-10-13.jowyfit')]).toEqual([80, 75, 3, 4])
    expect(fsNativo.readFile.mock.calls[0]![0]).toMatchObject({ path: 'JowyFit/jowyfit-2026-10-13.jowyfit', directory: 'DOCUMENTS' })
  })
  it('borra una copia de la carpeta; un nombre con carpetas no sale de Documentos/JowyFit', async () => {
    fsNativo.deleteFile.mockResolvedValue(undefined)
    await borrarCopiaGuardada('jowyfit-auto-2026-10-13-1900-cifrada.jowyfit')
    expect(fsNativo.deleteFile.mock.calls[0]![0]).toEqual({ path: 'JowyFit/jowyfit-auto-2026-10-13-1900-cifrada.jowyfit', directory: 'DOCUMENTS' })
    // Una copia renombrada a mano («(1)», espacios) se sigue pudiendo leer.
    fsNativo.readFile.mockResolvedValue({ data: btoa('PK') })
    await leerCopiaGuardada('jowyfit-2026-10-13 (1).jowyfit')
    for (const malo of ['../perfil.jowyfit', 'otra/carpeta.jowyfit', '..\\x.jowyfit', 'sub\\x.jowyfit', 'datos.json', '..jowyfit']) {
      await expect(borrarCopiaGuardada(malo)).rejects.toThrow(/no válido/)
      await expect(leerCopiaGuardada(malo)).rejects.toThrow(/no válido/)
    }
    expect(fsNativo.deleteFile).toHaveBeenCalledTimes(1)
  })
})

describe('foto', () => {
  it('hace la foto con la cámara trasera y, si no se puede reducir, la deja como está', async () => {
    let input: HTMLInputElement | null = null
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      input = this
      Object.defineProperty(this, 'files', { value: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] })
      this.dispatchEvent(new Event('change'))
    })
    const f = await hacerFoto()
    expect(f).toBeInstanceOf(Blob)
    expect(input!.accept).toBe('image/*')
    expect(input!.getAttribute('capture')).toBe('environment')
  })
})

describe('marcas para los estilos y el sonido', () => {
  it('fuera de Apple no marca la página como «apple»', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 15)', maxTouchPoints: 5 })
    marcarPlataforma()
    expect(document.documentElement.dataset.plataforma).toBeUndefined()
  })
  it('en Safari de iPhone sí, y si está instalada también lo dice', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Safari/604.1', maxTouchPoints: 5, standalone: true })
    marcarPlataforma()
    expect(document.documentElement.dataset.plataforma).toBe('apple')
    expect('instalada' in document.documentElement.dataset).toBe(true)
  })
  it('preparar el sonido escucha el primer toque una sola vez y no rompe sin audio', () => {
    const add = vi.spyOn(window, 'addEventListener')
    prepararSonido()
    prepararSonido()
    expect(add.mock.calls.filter(c => ['touchend', 'click', 'keydown'].includes(String(c[0])))).toHaveLength(3)
    expect(() => window.dispatchEvent(new Event('click'))).not.toThrow()
  })
})

describe('escáner con la cámara web', () => {
  const camara = () => {
    const parar = vi.fn()
    const pista = { stop: parar, getCapabilities: () => ({ torch: true }), applyConstraints: vi.fn(async () => {}) }
    const flujo = { getTracks: () => [pista], getVideoTracks: () => [pista] }
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn(async () => flujo) } })
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 4 })
    video.play = async () => {}
    return { video, parar, pista }
  }
  it('da el código tras dos lecturas iguales seguidas (una suelta mal leída no cuenta) y apaga la cámara al parar', async () => {
    const { video, parar, pista } = camara()
    detector.lecturas = [['1111111111111'], [], ['8480000123458'], ['8480000123458'], ['8480000123458']]
    const leidos: string[] = []
    const c = await abrirCamara(video, x => leidos.push(x))
    await vi.waitFor(() => expect(leidos).toEqual(['8480000123458']), { timeout: 3000, interval: 50 })
    await new Promise(r => setTimeout(r, 400))
    expect(leidos).toHaveLength(1) // solo una vez
    expect(c.tieneLinterna).toBe(true)
    expect(await c.linterna(true)).toBe(true)
    expect(pista.applyConstraints).toHaveBeenCalled()
    c.parar()
    expect(parar).toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
  })
})
