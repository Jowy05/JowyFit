// Fotos de progreso (dominio/fotos.ts): qué pose toca después, la cuenta atrás del temporizador y el recorte 3:4
// de la imagen de la cámara.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FORMA_FOTO, ORDEN_POSES, SEGUNDOS_ESPERA, cuentaAtras, recorteFoto, siguientePose } from '../src/dominio/fotos'

afterEach(() => { vi.useRealTimers() })

describe('siguiente pose', () => {
  it('va en el orden de siempre y se salta las ya hechas hoy', () => {
    expect(ORDEN_POSES).toEqual(['frente', 'perfil', 'espalda'])
    expect(siguientePose([])).toBe('frente')
    expect(siguientePose(['frente'])).toBe('perfil')
    expect(siguientePose(['espalda', 'frente'])).toBe('perfil')
    expect(siguientePose(['perfil'])).toBe('frente')
    // Repetir una pose no cuenta como otra.
    expect(siguientePose(['frente', 'frente', 'perfil'])).toBe('espalda')
  })
  it('con las tres hechas no queda ninguna', () => {
    expect(siguientePose(['frente', 'perfil', 'espalda'])).toBeNull()
  })
})

describe('cuenta atrás del temporizador', () => {
  it('son 5 segundos', () => {
    expect(SEGUNDOS_ESPERA).toBe(5)
  })
  it('avisa al empezar y cada segundo (5, 4, 3, 2, 1) y hace la foto al llegar a 0, una sola vez', () => {
    vi.useFakeTimers()
    const tics: number[] = []
    const fin = vi.fn()
    cuentaAtras(5, n => tics.push(n), fin)
    expect(tics).toEqual([5])
    vi.advanceTimersByTime(3000)
    expect(tics).toEqual([5, 4, 3, 2])
    expect(fin).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999)
    expect(fin).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1001)
    expect(tics).toEqual([5, 4, 3, 2, 1])
    expect(fin).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(fin).toHaveBeenCalledTimes(1)
    expect(tics).toHaveLength(5)
  })
  it('parada a mitad, ya no avisa ni hace la foto', () => {
    vi.useFakeTimers()
    const tics: number[] = []
    const fin = vi.fn()
    const parar = cuentaAtras(5, n => tics.push(n), fin)
    vi.advanceTimersByTime(2000)
    parar()
    vi.advanceTimersByTime(10_000)
    expect(tics).toEqual([5, 4, 3])
    expect(fin).not.toHaveBeenCalled()
    // Pararla otra vez no rompe nada.
    expect(() => parar()).not.toThrow()
  })
  it('sin segundos (o negativos) hace la foto enseguida, sin avisos', () => {
    const tics: number[] = []
    const fin = vi.fn()
    cuentaAtras(0, n => tics.push(n), fin)
    cuentaAtras(-3, n => tics.push(n), fin)
    expect(tics).toEqual([])
    expect(fin).toHaveBeenCalledTimes(2)
  })
})

describe('recorte de la foto', () => {
  it('de una imagen apaisada se queda con el centro, de pie (3:4)', () => {
    expect(recorteFoto(1920, 1080)).toEqual({ sx: 555, sy: 0, sw: 810, sh: 1080, ancho: 810, alto: 1080 })
  })
  it('de una imagen de pie más alargada quita arriba y abajo, y la reduce a 1280 de alto', () => {
    const r = recorteFoto(1080, 1920)
    expect(r).toEqual({ sx: 0, sy: 240, sw: 1080, sh: 1440, ancho: 960, alto: 1280 })
    expect(r.ancho / r.alto).toBeCloseTo(FORMA_FOTO, 5)
  })
  it('una imagen pequeña ya de 3:4 se deja igual (nunca se agranda)', () => {
    expect(recorteFoto(300, 400)).toEqual({ sx: 0, sy: 0, sw: 300, sh: 400, ancho: 300, alto: 400 })
  })
  it('con otro tope, el lado largo es ese', () => {
    const r = recorteFoto(1080, 1440, 800)
    expect(Math.max(r.ancho, r.alto)).toBe(800)
    expect(r.ancho).toBe(600)
  })
})
