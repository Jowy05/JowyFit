// @vitest-environment jsdom
// Cámara de las fotos de progreso (plataforma/camaraFoto.ts): qué cámara se pide, cuándo hay cámara en vivo y,
// si no la hay o falla, la caída a la cámara del sistema (hacerFoto con la cámara elegida).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { abrirCamaraFoto, alFaltarPermisoCamara, CamaraCancelada, capacidades, falloCamara, hacerFoto, hayCamaraEnVivo, MS_SIN_CAMARA, restriccionesFoto } from '../src/plataforma'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

/** Una cámara simulada: la pista (con su «ended»), el flujo y el <video> que da imagen de `ancho` × 1080. */
function camara(ancho = 1920) {
  const parar = vi.fn()
  const pista = new EventTarget() as EventTarget & { stop: () => void; readyState: MediaStreamTrackState }
  pista.readyState = 'live'
  pista.stop = parar
  const flujo = { getTracks: () => [pista], getVideoTracks: () => [pista] }
  const getUserMedia = vi.fn(async (_r: MediaStreamConstraints) => flujo)
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } })
  const video = document.createElement('video')
  Object.defineProperty(video, 'videoWidth', { value: ancho })
  Object.defineProperty(video, 'videoHeight', { value: 1080 })
  video.play = async () => {}
  return { video, parar, pista, getUserMedia }
}

describe('elegir cámara', () => {
  it('la de delante es la de la pantalla («user») y la de atrás, «environment»; sin sonido', () => {
    const del = restriccionesFoto('delantera')
    const atr = restriccionesFoto('trasera')
    expect((del.video as MediaTrackConstraints).facingMode).toEqual({ ideal: 'user' })
    expect((atr.video as MediaTrackConstraints).facingMode).toEqual({ ideal: 'environment' })
    expect(del.audio).toBe(false)
  })
  it('se abre la cámara elegida y la imagen va al <video>', async () => {
    const { video, getUserMedia } = camara()
    const c = await abrirCamaraFoto(video, 'delantera')
    expect(getUserMedia).toHaveBeenCalledWith(restriccionesFoto('delantera'))
    expect(video.srcObject).not.toBeNull()
    expect(video.getAttribute('playsinline')).toBe('')
    c.parar()
  })
})

describe('hacer la foto del vídeo', () => {
  it('recorta el centro 3:4, lo pasa a JPEG y al parar apaga la cámara', async () => {
    const { video, parar } = camara()
    const dibujar = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: dibujar } as unknown as CanvasRenderingContext2D)
    let tipo = ''
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, hecho, t) {
      tipo = String(t)
      hecho(new Blob([`${this.width}x${this.height}`], { type: 'image/jpeg' }))
    })
    const c = await abrirCamaraFoto(video, 'trasera')
    const foto = await c.capturar()
    expect(await foto.text()).toBe('810x1080')
    expect(tipo).toBe('image/jpeg')
    expect(dibujar).toHaveBeenCalledWith(video, 555, 0, 810, 1080, 0, 0, 810, 1080)
    c.parar()
    expect(parar).toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
  })
  it('si la cámara aún no da imagen, falla (la pantalla deja probar otra vez)', async () => {
    const { video } = camara(0)
    const c = await abrirCamaraFoto(video, 'trasera')
    await expect(c.capturar()).rejects.toThrow()
  })
  it('si la cámara se apaga sola, avisa una vez; si se paró a propósito, no', async () => {
    const { video, pista } = camara()
    const cortada = vi.fn()
    await abrirCamaraFoto(video, 'trasera', cortada)
    pista.dispatchEvent(new Event('ended'))
    pista.dispatchEvent(new Event('ended'))
    expect(cortada).toHaveBeenCalledTimes(1)
    const otra = camara()
    const nada = vi.fn()
    const c = await abrirCamaraFoto(otra.video, 'trasera', nada)
    c.parar()
    otra.pista.dispatchEvent(new Event('ended'))
    expect(nada).not.toHaveBeenCalled()
  })
})

describe('sin cámara en vivo: la de siempre', () => {
  it('sin getUserMedia (http sin cifrar, navegador viejo) no hay cámara en vivo', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 15)' })
    expect(hayCamaraEnVivo()).toBe(false)
    expect(capacidades().camaraEnVivo).toBe(false)
    await expect(abrirCamaraFoto(document.createElement('video'), 'trasera')).rejects.toThrow()
  })
  it('con getUserMedia, sí', () => {
    camara()
    expect(hayCamaraEnVivo()).toBe(true)
    expect(capacidades().camaraEnVivo).toBe(true)
  })
  it('un permiso denegado se distingue de otro fallo', async () => {
    expect(falloCamara(new DOMException('no', 'NotAllowedError'))).toBe('permiso')
    expect(falloCamara(new DOMException('no', 'SecurityError'))).toBe('permiso')
    expect(falloCamara(new DOMException('no', 'NotFoundError'))).toBe('no-se-pudo')
    expect(falloCamara(new DOMException('ocupada', 'NotReadableError'))).toBe('no-se-pudo')
    expect(falloCamara(null)).toBe('no-se-pudo')
    // Y el error de verdad de getUserMedia llega tal cual.
    const { video, getUserMedia } = camara()
    getUserMedia.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
    const e = await abrirCamaraFoto(video, 'delantera').catch(x => x)
    expect(falloCamara(e)).toBe('permiso')
  })
  it('la cámara del sistema se abre con la cámara elegida', async () => {
    const inputs: HTMLInputElement[] = []
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      inputs.push(this)
      Object.defineProperty(this, 'files', { value: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] })
      this.dispatchEvent(new Event('change'))
    })
    expect(await hacerFoto(1280, 'delantera')).toBeInstanceOf(Blob)
    expect(await hacerFoto(1280)).toBeInstanceOf(Blob)
    expect(inputs.map(i => i.getAttribute('capture'))).toEqual(['user', 'environment'])
  })
})

/** Un flujo simulado nuevo (cada apertura de la cámara da el suyo). */
function flujoNuevo() {
  const pista = Object.assign(new EventTarget(), { readyState: 'live' as MediaStreamTrackState, stop: vi.fn() })
  return { pista, flujo: { getTracks: () => [pista], getVideoTracks: () => [pista] } }
}

describe('abrir la cámara dos veces a la vez (el permiso de Android cuenta como salir y volver)', () => {
  it('al parar una apertura vieja no se quita la imagen de la nueva', async () => {
    const { video } = camara()
    const a = flujoNuevo(), b = flujoNuevo()
    const getUserMedia = vi.fn().mockResolvedValueOnce(a.flujo).mockResolvedValueOnce(b.flujo)
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } })
    const vieja = await abrirCamaraFoto(video, 'trasera')
    const nueva = await abrirCamaraFoto(video, 'trasera')
    vieja.parar()
    expect(a.pista.stop).toHaveBeenCalled()
    expect(video.srcObject).toBe(b.flujo)
    expect(nueva.viva()).toBe(true)
    nueva.parar()
    expect(video.srcObject).toBeNull()
  })
  it('si se canceló mientras se abría, apaga su cámara sin tocar el <video> y no lo cuenta como fallo', async () => {
    const { video } = camara()
    const otra = flujoNuevo()
    video.srcObject = otra.flujo as unknown as MediaStream
    const a = flujoNuevo()
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(a.flujo) } })
    const e = await abrirCamaraFoto(video, 'trasera', undefined, () => true).catch(x => x)
    expect(e).toBeInstanceOf(CamaraCancelada)
    expect(a.pista.stop).toHaveBeenCalled()
    expect(video.srcObject).toBe(otra.flujo)
  })
  it('viva: sí al abrir; no tras pararla ni si el sistema la apagó', async () => {
    const { video, pista } = camara()
    const c = await abrirCamaraFoto(video, 'trasera')
    expect(c.viva()).toBe(true)
    pista.readyState = 'ended'
    expect(c.viva()).toBe(false)
    pista.readyState = 'live'
    c.parar()
    expect(c.viva()).toBe(false)
  })
})

describe('cámara del sistema en Android sin permiso', () => {
  /** El selector vuelve vacío (como cuando Android no deja abrir la cámara); el segundo, con una foto. */
  function selectorVacioYLuegoGaleria() {
    const inputs: HTMLInputElement[] = []
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      inputs.push(this)
      if (inputs.length === 1) { this.dispatchEvent(new Event('cancel')); return }
      Object.defineProperty(this, 'files', { value: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] })
      this.dispatchEvent(new Event('change'))
    })
    return inputs
  }
  it('si vuelve vacío al momento, avisa del permiso y abre la galería (sin «capture»)', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const inputs = selectorVacioYLuegoGaleria()
    const avisado = vi.fn()
    const quitar = alFaltarPermisoCamara(avisado)
    expect(await hacerFoto(900)).toBeInstanceOf(Blob)
    quitar()
    expect(avisado).toHaveBeenCalledTimes(1)
    expect(inputs.map(i => i.getAttribute('capture'))).toEqual(['environment', null])
    expect(capacidades().permisoCamaraDeLaApp).toBe(true)
  })
  it('si se tardó (se abrió la cámara y se canceló), no pasa nada: era la persona', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const ahora = Date.now()
    vi.spyOn(Date, 'now').mockReturnValueOnce(ahora).mockReturnValue(ahora + MS_SIN_CAMARA + 1)
    const inputs = selectorVacioYLuegoGaleria()
    const avisado = vi.fn()
    const quitar = alFaltarPermisoCamara(avisado)
    expect(await hacerFoto(900)).toBeNull()
    quitar()
    expect(avisado).not.toHaveBeenCalled()
    expect(inputs).toHaveLength(1)
  })
  it('fuera de Android, vacío es vacío (allí la cámara del sistema no pide el permiso de la app)', async () => {
    const inputs = selectorVacioYLuegoGaleria()
    expect(await hacerFoto(900)).toBeNull()
    expect(inputs).toHaveLength(1)
    expect(capacidades().permisoCamaraDeLaApp).toBe(false)
  })
})


describe('cancelación mientras el vídeo empieza', () => {
  it('al salir durante play, apaga el flujo y suelta el vídeo', async () => {
    const { video, parar } = camara()
    let seguir!: () => void
    video.play = vi.fn(() => new Promise<void>(r => { seguir = r }))
    let cancelado = false
    const apertura = abrirCamaraFoto(video, 'trasera', undefined, () => cancelado)
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled())
    cancelado = true
    seguir()
    await expect(apertura).rejects.toBeInstanceOf(CamaraCancelada)
    expect(parar).toHaveBeenCalledTimes(1)
    expect(video.srcObject).toBeNull()
  })
  it('una apertura cancelada durante play no borra la imagen de la siguiente', async () => {
    const { video, parar } = camara()
    let seguir!: () => void
    video.play = vi.fn(() => new Promise<void>(r => { seguir = r }))
    let cancelado = false
    const apertura = abrirCamaraFoto(video, 'trasera', undefined, () => cancelado)
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled())
    cancelado = true
    const nueva = flujoNuevo()
    video.srcObject = nueva.flujo as unknown as MediaStream
    seguir()
    await expect(apertura).rejects.toBeInstanceOf(CamaraCancelada)
    expect(parar).toHaveBeenCalledTimes(1)
    expect(nueva.pista.stop).not.toHaveBeenCalled()
    expect(video.srcObject).toBe(nueva.flujo)
  })
})
