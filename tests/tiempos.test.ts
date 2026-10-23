// Tiempos del entreno: hora límite, cuándo proponer recortar, descanso que queda y tiempo restante.
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import { estadoHora, propuestaRecorte, restoDescanso, restanteEjercicio, restanteSesion } from '../src/dominio/tiempos'
import type { Serie, Sesion, EjercicioSesion } from '../src/datos/tipos'

const serie = (peso: number | null, reps: number, rpe: number | null = 8, extra: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe, calentamiento: false, hecha: true, ...extra })

const ej = (uid: string, extra: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid, ejercicio: uid, planificado: uid, estado: 'pendiente', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso',
  series: [1, 2, 3].map(n => ({ n, peso: 40, reps: 8, rpe: null, calentamiento: false, hecha: false })), ...extra,
})

const sesion = (ejercicios: EjercicioSesion[]): Sesion => ({ fecha: '2026-10-14', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 0, version: 'normal', estado: 'curso', calibracion: false, ejercicios })

describe('tiempos del entreno', () => {
  const base = (horaLimite: string): Sesion => ({
    fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: 1, inicio: 0, horaLimite, version: 'normal', estado: 'curso', calibracion: false,
    ejercicios: [
      { uid: 'a', ejercicio: 'bench-press', planificado: 'bench-press', estado: 'curso', series: [serie(45, 8), { ...serie(45, 8), hecha: false }, { ...serie(45, 8), hecha: false }], repsMin: 6, repsMax: 8, rpe: 8, descanso: 150, registro: 'peso' },
      { uid: 'b', ejercicio: 'lat-pulldown', planificado: 'lat-pulldown', estado: 'pendiente', series: [1, 2, 3].map(() => ({ ...serie(40, 8), hecha: false })), repsMin: 8, repsMax: 10, rpe: 8, descanso: 120, registro: 'peso' },
    ],
  })
  it('a tiempo / tarde según la hora límite', () => {
    const ahora = new Date(2026, 9, 13, 6, 0).getTime()
    expect(estadoHora(base('06:40'), ahora)!.aTiempo).toBe(true)
    const tarde = estadoHora(base('06:05'), ahora)!
    expect(tarde.aTiempo).toBe(false)
    expect(tarde.minutosTarde).toBeGreaterThan(5)
  })
  it('propone quitar una serie del último pendiente', () => {
    const r = propuestaRecorte(base('06:00'), 4, id => id)
    expect(r).toEqual({ tipo: 'serie', uid: 'b', texto: 'Vas 4 min tarde → quita 1 serie de lat-pulldown' })
    expect(propuestaRecorte(base('06:00'), 9, id => id)?.tipo).toBe('corta')
  })
  it('descanso por marcas de tiempo (sobrevive al bloqueo del móvil)', () => {
    expect(restoDescanso(1000, 150, 0, 1000 + 43_000)).toBe(107)
    expect(restoDescanso(1000, 150, 15, 1000 + 200_000)).toBe(0)
  })
})

describe('tiempo restante', () => {
  it('fallaba: superserie con el compañero ya quitado de la sesión restaba el descanso igualmente', () => {
    const solo = ej('a', { superserie: 'no-esta' })
    expect(restanteSesion(sesion([solo]))).toBe(restanteEjercicio(solo))
  })
  it('superserie: el segundo del par solo suma el tiempo de sus series', () => {
    const a = ej('a', { superserie: 'b' }), b = ej('b', { superserie: 'a' })
    expect(restanteSesion(sesion([a, b]))).toBe(restanteEjercicio(a) + 3 * 45)
    // Si el primero ya está hecho, el segundo cuenta entero (con sus descansos).
    const ah = { ...a, estado: 'hecho' as const }
    expect(restanteSesion(sesion([ah, b]))).toBe(restanteEjercicio(b))
  })
})

describe('tiempos del entreno: casos límite', () => {
  const serie = (x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 40, reps: 8, rpe: null, calentamiento: false, hecha: false, ...x })
  const ej = (uid: string, x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({ uid, ejercicio: uid, planificado: uid, estado: 'pendiente', series: [serie(), serie(), serie()], repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
  const sesion = (ejercicios: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion => ({ fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: new Date(2026, 9, 13, 5, 30).getTime(), version: 'normal', estado: 'curso', calibracion: false, ejercicios, ...x })
  it('lo que falta de un ejercicio: hecho o saltado 0; sin series pendientes 0; por tiempo, mínimo 30 s por serie', () => {
    expect(restanteEjercicio(ej('a', { estado: 'hecho' }))).toBe(0)
    expect(restanteEjercicio(ej('a', { estado: 'saltado' }))).toBe(0)
    expect(restanteEjercicio(ej('a', { series: [serie({ hecha: true })] }))).toBe(0)
    expect(restanteEjercicio(ej('a', { series: [serie({ calentamiento: true })] }))).toBe(0)
    // Pendiente: 3 series + 2 descansos + el cambio de sitio.
    expect(restanteEjercicio(ej('a'))).toBe(3 * 45 + 2 * 90 + 75)
    // En curso: cada serie con su descanso detrás y sin cambio de sitio.
    expect(restanteEjercicio(ej('a', { estado: 'curso' }))).toBe(3 * 45 + 3 * 90)
    expect(restanteEjercicio(ej('p', { registro: 'tiempo', repsMax: 20, series: [serie()] }))).toBe(30 + 75)
  })
  it('superserie con el compañero ya hecho: cuenta entero', () => {
    const a = ej('a', { superserie: 'b', estado: 'hecho' })
    const b = ej('b', { superserie: 'a' })
    expect(restanteSesion(sesion([a, b]))).toBe(restanteEjercicio(b))
    expect(restanteSesion(sesion([]))).toBe(0)
  })
  it('hora límite: sin hora, nada; entrenando por la tarde con límite de madrugada, nada; a tiempo o tarde', () => {
    const s = sesion([ej('a')])
    expect(estadoHora(s, s.inicio)).toBeNull()
    const tarde = sesion([ej('a')], { inicio: new Date(2026, 9, 13, 18).getTime(), horaLimite: '06:45' })
    expect(estadoHora(tarde, tarde.inicio)).toBeNull()
    const temprano = sesion([ej('a')], { horaLimite: '06:45' })
    expect(estadoHora(temprano, temprano.inicio)!.aTiempo).toBe(true)
    const justo = sesion([ej('a'), ej('b'), ej('c'), ej('d'), ej('e'), ej('f'), ej('g'), ej('h'), ej('i'), ej('j'), ej('k'), ej('l'), ej('m'), ej('n'), ej('o'), ej('p')], { horaLimite: '06:00' })
    const e = estadoHora(justo, justo.inicio)!
    expect(e.aTiempo).toBe(false)
    expect(e.minutosTarde).toBeGreaterThan(0)
  })
  it('propuesta de recorte: menos de 2 min nada; en la corta quita una serie; sin candidatos nada', () => {
    const s = sesion([ej('a', { estado: 'curso' }), ej('b')])
    expect(propuestaRecorte(s, 1, id => id)).toBeNull()
    expect(propuestaRecorte({ ...s, version: 'corta' }, 12, id => id.toUpperCase())).toEqual({ tipo: 'serie', uid: 'b', texto: 'Vas 12 min tarde → quita 1 serie de B' })
    expect(propuestaRecorte(sesion([ej('a', { estado: 'curso' }), ej('b', { series: [serie()] })]), 3, id => id)).toBeNull()
  })
  it('descanso: con tiempo extra y nunca negativo', () => {
    expect(restoDescanso(0, 90, 30, 60_000)).toBe(60)
    expect(restoDescanso(0, 90, 0, 999_999)).toBe(0)
  })
})
