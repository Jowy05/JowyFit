// Entreno en curso: todas las operaciones puras sobre la sesión (crear, marcar series, superseries,
// añadir y quitar series, cambiar de ejercicio, reordenar, saltar y el resumen final).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import {
  anadirCalentamiento, anadirSerie, cambiarSerie, crearSesion, desdeBloque, hecha, indiceActual, irA, mover, quitarSerie, quitarUnaSerie,
  resumen, saltar, serieActual, seriesNuevas, sustituir, terminada,
} from '../src/dominio/sesion'
import type { Bloque, DiaRutina, Sesion, EjercicioSesion } from '../src/datos/tipos'
import { restanteSesion } from '../src/dominio/tiempos'

const bloque = (uid: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio: uid, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 120, registro: 'peso', ...x })

const dia = (bloques: Bloque[]): DiaRutina => ({ letra: 'A', nombre: 'Cuerpo completo A', dia: 1, opcional: false, bloques })

const nueva = (bloques: Bloque[], x: Partial<Parameters<typeof crearSesion>[1]> = {}) =>
  crearSesion(dia(bloques), { rutinaId: 1, gimnasioId: 2, version: 'normal', calibracion: false, ahora: new Date(2026, 9, 13, 5, 30).getTime(), ...x })

describe('crear la sesión', () => {
  it('copia el día, pone el primero en curso y la fecha local del momento', () => {
    const s = nueva([bloque('a'), bloque('b')])
    expect(s.fecha).toBe('2026-10-13')
    expect(s.letra).toBe('A')
    expect(s.estado).toBe('curso')
    expect(s.ejercicios.map(e => e.estado)).toEqual(['curso', 'pendiente'])
    expect(s.rutinaId).toBe(1)
    expect(s.gimnasioId).toBe(2)
  })
  it('versión corta: fuera los bloques marcados; normal: todos', () => {
    const bs = [bloque('a'), bloque('b', { fueraEnCorta: true }), bloque('c')]
    expect(nueva(bs, { version: 'corta' }).ejercicios.map(e => e.uid)).toEqual(['a', 'c'])
    expect(nueva(bs).ejercicios).toHaveLength(3)
  })
  it('un día sin ejercicios no rompe (entreno libre)', () => {
    const s = nueva([])
    expect(s.ejercicios).toEqual([])
    expect(indiceActual(s)).toBe(-1)
    expect(terminada(s)).toBe(true)
  })
  it('usa las sugerencias de peso y reps de cada ejercicio', () => {
    const s = nueva([bloque('a'), bloque('b')], { sugerencias: new Map([['a', { peso: 40, reps: 10 }]]) })
    expect(s.ejercicios[0]!.series.map(x => [x.peso, x.reps])).toEqual([[40, 10], [40, 10], [40, 10]])
    // Sin sugerencia: sin peso y el mínimo de reps.
    expect(s.ejercicios[1]!.series[0]).toMatchObject({ peso: null, reps: 8 })
  })
})

const ej = (uid: string, extra: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid, ejercicio: uid, planificado: uid, estado: 'pendiente', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso',
  series: [1, 2, 3].map(n => ({ n, peso: 40, reps: 8, rpe: null, calentamiento: false, hecha: false })), ...extra,
})

const sesion = (ejercicios: EjercicioSesion[]): Sesion => ({ fecha: '2026-10-14', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 0, version: 'normal', estado: 'curso', calibracion: false, ejercicios })

describe('series nuevas según cómo se apunta', () => {
  it('peso: peso y reps', () => {
    expect(seriesNuevas(2, 20, 10, 'peso')).toEqual([
      { n: 1, peso: 20, reps: 10, segundos: null, rpe: null, calentamiento: false, hecha: false },
      { n: 2, peso: 20, reps: 10, segundos: null, rpe: null, calentamiento: false, hecha: false },
    ])
  })
  it('corporal y cardio: sin peso; tiempo: segundos en vez de reps', () => {
    expect(seriesNuevas(1, 20, 10, 'corporal')[0]).toMatchObject({ peso: null, reps: 10 })
    expect(seriesNuevas(1, 20, 10, 'cardio')[0]).toMatchObject({ peso: null, reps: 10 })
    expect(seriesNuevas(1, 20, 30, 'tiempo')[0]).toMatchObject({ peso: null, reps: null, segundos: 30 })
  })
  it('asistidas guardan el peso negativo de la ayuda', () => {
    expect(seriesNuevas(1, -20, 8, 'asistido')[0]!.peso).toBe(-20)
  })
  it('0 series da una lista vacía', () => expect(seriesNuevas(0, 10, 8, 'peso')).toEqual([]))
})

describe('desde un bloque', () => {
  it('guarda lo planificado y puede hacerse con otro ejercicio (alternativa)', () => {
    const e = desdeBloque(bloque('press', { superserie: 'remo' }), { peso: 30, reps: null }, 'press-maquina')
    expect(e.ejercicio).toBe('press-maquina')
    expect(e.planificado).toBe('press')
    expect(e.superserie).toBe('remo')
    expect(e.series[0]).toMatchObject({ peso: 30, reps: 8 }) // reps null → mínimo del rango
  })
})

describe('marcar una serie como hecha', () => {
  it('apunta los datos, la hora y hereda el peso en las siguientes', () => {
    const s0 = nueva([bloque('a'), bloque('b')])
    const ahora = 1_000_000
    const { sesion, descanso } = hecha(s0, 0, { peso: 50, reps: 10, rpe: 8, segundos: null }, ahora)
    const e = sesion.ejercicios[0]!
    expect(e.series[0]).toMatchObject({ peso: 50, reps: 10, rpe: 8, hecha: true, ts: ahora })
    expect(e.series[1]!.peso).toBe(50)
    expect(e.inicio).toBe(ahora)
    expect(descanso).toBe(120)
    // No cambia la sesión original.
    expect(s0.ejercicios[0]!.series[0]!.hecha).toBe(false)
  })
  it('última serie: el ejercicio queda hecho y el siguiente en curso (descanso corto, como mucho 90 s)', () => {
    let s = nueva([bloque('a', { series: 1, descanso: 180 }), bloque('b')])
    const r = hecha(s, 0, { peso: 50, reps: 10, rpe: null, segundos: null }, 5)
    s = r.sesion
    expect(s.ejercicios[0]!.estado).toBe('hecho')
    expect(s.ejercicios[0]!.fin).toBe(5)
    expect(s.ejercicios[1]!.estado).toBe('curso')
    expect(r.descanso).toBe(90)
  })
  it('la última serie del último ejercicio: sin descanso', () => {
    const r = hecha(nueva([bloque('a', { series: 1 })]), 0, { peso: 50, reps: 10, rpe: null, segundos: null })
    expect(r.descanso).toBe(0)
    expect(terminada(r.sesion)).toBe(true)
  })
  it('índices raros o ejercicio ya terminado: no hace nada', () => {
    const s = nueva([bloque('a', { series: 1 })])
    expect(hecha(s, 7, { peso: 1, reps: 1, rpe: null, segundos: null }).descanso).toBe(0)
    const fin = hecha(s, 0, { peso: 1, reps: 1, rpe: null, segundos: null }).sesion
    expect(hecha(fin, 0, { peso: 2, reps: 2, rpe: null, segundos: null }).sesion).toEqual(fin)
  })
  it('superserie: de A1 a A2 sin descanso y de A2 a A1 con descanso', () => {
    let s = nueva([bloque('a1', { superserie: 'a2', descanso: 100 }), bloque('a2', { superserie: 'a1', descanso: 100 }), bloque('c')])
    let r = hecha(s, 0, { peso: 20, reps: 10, rpe: null, segundos: null })
    expect(r.descanso).toBe(0)
    expect(r.sesion.ejercicios[0]!.estado).toBe('pendiente')
    expect(r.sesion.ejercicios[1]!.estado).toBe('curso')
    s = r.sesion
    r = hecha(s, 1, { peso: 15, reps: 12, rpe: null, segundos: null })
    expect(r.descanso).toBe(100)
    expect(r.sesion.ejercicios[0]!.estado).toBe('curso')
    expect(r.sesion.ejercicios[1]!.estado).toBe('pendiente')
  })
  it('ejercicio por tiempo: las siguientes no heredan reps (van por segundos)', () => {
    const s = nueva([bloque('plancha', { registro: 'tiempo', repsMin: 30, repsMax: 45 })])
    const r = hecha(s, 0, { peso: null, reps: null, rpe: null, segundos: 40 })
    expect(r.sesion.ejercicios[0]!.series[1]).toMatchObject({ reps: null, segundos: 30 })
  })
})

describe('serie actual e índice actual', () => {
  it('la primera sin hacer y −1 cuando no queda ninguna', () => {
    let s = nueva([bloque('a', { series: 2 })])
    expect(serieActual(s.ejercicios[0]!)).toBe(0)
    s = hecha(s, 0, { peso: 1, reps: 8, rpe: null, segundos: null }).sesion
    expect(serieActual(s.ejercicios[0]!)).toBe(1)
    s = hecha(s, 0, { peso: 1, reps: 8, rpe: null, segundos: null }).sesion
    expect(serieActual(s.ejercicios[0]!)).toBe(-1)
  })
  it('sin ninguno en curso, el primero pendiente', () => {
    const s = nueva([bloque('a'), bloque('b')])
    s.ejercicios[0]!.estado = 'hecho'
    expect(indiceActual(s)).toBe(1)
  })
})

describe('cambiar, añadir y quitar series', () => {
  it('cambiarSerie solo toca esa serie', () => {
    const s0 = nueva([bloque('a')])
    const s = cambiarSerie(s0, 0, 1, { peso: 77, nota: 'agarre ancho' })
    expect(s.ejercicios[0]!.series[1]).toMatchObject({ peso: 77, nota: 'agarre ancho' })
    expect(s.ejercicios[0]!.series[0]!.peso).toBeNull()
    expect(s0.ejercicios[0]!.series[1]!.peso).toBeNull()
  })
  it('añadir una serie copia la última y reabre un ejercicio ya hecho', () => {
    let s = nueva([bloque('a', { series: 1 })])
    s = hecha(s, 0, { peso: 40, reps: 9, rpe: null, segundos: null }).sesion
    expect(s.ejercicios[0]!.estado).toBe('hecho')
    s = anadirSerie(s, 0)
    expect(s.ejercicios[0]!.series[1]).toMatchObject({ n: 2, peso: 40, reps: 9, hecha: false })
    expect(s.ejercicios[0]!.estado).toBe('curso')
  })
  it('fallaba: añadir una serie a un ejercicio por tiempo la ponía con reps y sin segundos', () => {
    const s0 = nueva([bloque('plancha', { registro: 'tiempo', repsMin: 30, repsMax: 45, series: 1 })])
    const s = anadirSerie(s0, 0)
    expect(s.ejercicios[0]!.series[1]).toMatchObject({ n: 2, reps: null, segundos: 30 })
    const vacio = anadirSerie(nueva([bloque('plancha', { registro: 'tiempo', repsMin: 30, series: 0 })]), 0)
    expect(vacio.ejercicios[0]!.series[0]).toMatchObject({ reps: null, segundos: 30 })
  })
  it('añadir a un ejercicio sin series pone el mínimo de reps', () => {
    const s0 = nueva([bloque('a', { series: 0 })])
    const s = anadirSerie(s0, 0)
    expect(s.ejercicios[0]!.series[0]).toMatchObject({ n: 1, peso: null, reps: 8 })
  })
  it('quitar deja al menos una serie de trabajo y renumera', () => {
    let s = nueva([bloque('a', { series: 2 })])
    s = quitarSerie(s, 0)
    expect(s.ejercicios[0]!.series).toHaveLength(1)
    s = quitarSerie(s, 0)
    expect(s.ejercicios[0]!.series).toHaveLength(1)
    expect(quitarSerie(s, 9)).toEqual(s)
  })
  it('quitar la única que faltaba termina el ejercicio y pasa al siguiente', () => {
    let s = nueva([bloque('a', { series: 2 }), bloque('b')])
    s = hecha(s, 0, { peso: 40, reps: 9, rpe: null, segundos: null }).sesion
    s = quitarSerie(s, 0)
    expect(s.ejercicios[0]!.estado).toBe('hecho')
    expect(s.ejercicios[1]!.estado).toBe('curso')
  })
  it('quitarUnaSerie por uid; un uid que no existe devuelve la misma sesión', () => {
    const s = nueva([bloque('a'), bloque('b')])
    expect(quitarUnaSerie(s, 'b').ejercicios[1]!.series).toHaveLength(2)
    expect(quitarUnaSerie(s, 'zzz')).toBe(s)
  })
  it('calentamiento: se pone delante y no se duplica', () => {
    let s = nueva([bloque('a')])
    s = anadirCalentamiento(s, 0, [{ peso: 20, reps: 10 }, { peso: 30, reps: 5 }])
    expect(s.ejercicios[0]!.series.slice(0, 2).map(x => [x.peso, x.calentamiento])).toEqual([[20, true], [30, true]])
    expect(anadirCalentamiento(s, 0, [{ peso: 25, reps: 8 }]).ejercicios[0]!.series).toHaveLength(5)
  })
})

describe('cambiar de ejercicio, reordenar y saltar', () => {
  it('sustituir mantiene las series hechas y adapta las pendientes', () => {
    let s = nueva([bloque('press')])
    s = hecha(s, 0, { peso: 40, reps: 10, rpe: null, segundos: null }).sesion
    s = sustituir(s, 0, 'press-maquina', 'ocupado', { peso: 35, reps: 12 })
    const e = s.ejercicios[0]!
    expect(e.ejercicio).toBe('press-maquina')
    expect(e.planificado).toBe('press')
    expect(e.motivo).toBe('ocupado')
    expect(e.series[0]).toMatchObject({ peso: 40, reps: 10, hecha: true })
    expect(e.series[1]).toMatchObject({ peso: 35, reps: 12 })
  })
  it('sustituir por uno de peso corporal quita el peso; uno que no existe no hace nada', () => {
    const s0 = nueva([bloque('press', { series: 2 })], { sugerencias: new Map([['press', { peso: 40, reps: 8 }]]) })
    const s = sustituir(s0, 0, 'flexiones', 'cambio', undefined, 'corporal')
    expect(s.ejercicios[0]!.registro).toBe('corporal')
    expect(s.ejercicios[0]!.series.every(x => x.peso === null && x.reps === 8)).toBe(true)
    expect(sustituir(s0, 5, 'x', 'cambio')).toEqual(s0)
  })
  it('irA pone otro en curso y deja el anterior pendiente (o hecho si ya acabó)', () => {
    let s = nueva([bloque('a'), bloque('b'), bloque('c')])
    s = irA(s, 2)
    expect(s.ejercicios.map(e => e.estado)).toEqual(['pendiente', 'pendiente', 'curso'])
    s.ejercicios[1]!.estado = 'hecho'
    expect(irA(s, 1).ejercicios[1]!.estado).toBe('hecho')
  })
  it('mover cambia el orden y con índices fuera de rango no rompe', () => {
    const s = nueva([bloque('a'), bloque('b'), bloque('c')])
    expect(mover(s, 0, 2).ejercicios.map(e => e.uid)).toEqual(['b', 'c', 'a'])
    expect(mover(s, 2, -5).ejercicios.map(e => e.uid)).toEqual(['c', 'a', 'b'])
    expect(mover(s, 2, 99).ejercicios.map(e => e.uid)).toEqual(['a', 'b', 'c'])
    expect(mover(s, 9, 0).ejercicios.map(e => e.uid)).toEqual(['a', 'b', 'c'])
    expect(mover(s, 0.5, 1).ejercicios.map(e => e.uid)).toEqual(['a', 'b', 'c'])
  })
  it('saltar el que está en curso pasa al siguiente; saltar uno pendiente no cambia el actual', () => {
    let s = nueva([bloque('a'), bloque('b'), bloque('c')])
    s = saltar(s, 2)
    expect(s.ejercicios.map(e => e.estado)).toEqual(['curso', 'pendiente', 'saltado'])
    s = saltar(s, 0)
    expect(s.ejercicios.map(e => e.estado)).toEqual(['saltado', 'curso', 'saltado'])
    expect(saltar(s, 9)).toEqual(s)
  })
  it('terminada cuando todo está hecho o saltado', () => {
    let s = nueva([bloque('a', { series: 1 }), bloque('b')])
    expect(terminada(s)).toBe(false)
    s = hecha(s, 0, { peso: 10, reps: 8, rpe: null, segundos: null }).sesion
    s = saltar(s, 1)
    expect(terminada(s)).toBe(true)
  })
})

describe('resumen del entreno', () => {
  it('cuenta ejercicios, series de trabajo, volumen (sin asistencias negativas) y duración', () => {
    const inicio = new Date(2026, 9, 13, 5, 30).getTime()
    let s: Sesion = nueva([bloque('a', { series: 2 }), bloque('asist', { registro: 'asistido' }), bloque('c')], { ahora: inicio })
    s = anadirCalentamiento(s, 0, [{ peso: 20, reps: 10 }])
    s = hecha(s, 0, { peso: 20, reps: 10, rpe: null, segundos: null }).sesion // calentamiento: no cuenta
    s = hecha(s, 0, { peso: 50, reps: 10, rpe: null, segundos: null }).sesion
    s = hecha(s, 0, { peso: 50, reps: 8, rpe: null, segundos: null }).sesion
    s = hecha(s, 1, { peso: -20, reps: 8, rpe: null, segundos: null }).sesion
    s = sustituir(s, 2, 'otro', 'cambio')
    s = saltar(s, 2)
    s.fin = inicio + 45 * 60_000
    const r = resumen(s)
    expect(r).toEqual({ ejercicios: 3, hechos: 2, saltados: 1, sustituidos: 1, series: 3, volumen: 900, segundos: 2700 })
  })
  it('sin fin usa la hora actual y una sesión vacía da ceros', () => {
    const s = nueva([], { ahora: Date.now() - 10_000 })
    const r = resumen(s)
    expect(r.series).toBe(0)
    expect(r.volumen).toBe(0)
    expect(r.segundos).toBeGreaterThanOrEqual(9)
  })
})

describe('sesión en curso', () => {
  it('fallaba: marcar una serie de calentamiento cambiaba el peso de todas las de trabajo', () => {
    let s = sesion([ej('a', { estado: 'curso' })])
    s = anadirCalentamiento(s, 0, [{ peso: 20, reps: 10 }, { peso: 30, reps: 5 }])
    s = hecha(s, 0, { peso: 20, reps: 10, rpe: null }).sesion
    const trabajo = s.ejercicios[0]!.series.filter(x => !x.calentamiento)
    expect(trabajo.map(x => x.peso)).toEqual([40, 40, 40])
    // Una serie de trabajo sí arrastra su peso a las siguientes.
    s = hecha(s, 0, { peso: 30, reps: 5, rpe: null }).sesion
    s = hecha(s, 0, { peso: 42.5, reps: 8, rpe: 8 }).sesion
    expect(s.ejercicios[0]!.series.filter(x => !x.calentamiento).map(x => x.peso)).toEqual([42.5, 42.5, 42.5])
  })
  it('fallaba: quitar serie con todo el trabajo hecho borraba una de calentamiento pendiente', () => {
    let s = sesion([ej('a', { estado: 'curso', series: [{ n: 1, peso: 40, reps: 8, rpe: 8, calentamiento: false, hecha: true }, { n: 2, peso: 40, reps: 8, rpe: 8, calentamiento: false, hecha: true }] })])
    s = anadirCalentamiento(s, 0, [{ peso: 20, reps: 10 }])
    const r = quitarSerie(s, 0)
    expect(r.ejercicios[0]!.series.filter(x => x.calentamiento)).toHaveLength(1)
    expect(r.ejercicios[0]!.series).toHaveLength(3)
  })
  it('fallaba: mover con índices fuera de rango metía un hueco vacío en la sesión', () => {
    const s = sesion([ej('a'), ej('b')])
    expect(mover(s, 5, 0).ejercicios.map(e => e.uid)).toEqual(['a', 'b'])
    expect(mover(s, 0, 9).ejercicios.map(e => e.uid)).toEqual(['b', 'a'])
    expect(mover(s, -1, 0).ejercicios.every(Boolean)).toBe(true)
  })
  it('fallaba: cambiar a un ejercicio por tiempo dejaba «reps» y ningún segundo', () => {
    const s = sustituir(sesion([ej('a', { estado: 'curso' })]), 0, 'plank', 'cambio', { peso: null, reps: 40 }, 'tiempo')
    for (const x of s.ejercicios[0]!.series) { expect(x.segundos).toBe(40); expect(x.reps).toBeNull(); expect(x.peso).toBeNull() }
    const c = sustituir(sesion([ej('a')]), 0, 'push-up', 'cambio', { peso: 40, reps: null }, 'corporal')
    for (const x of c.ejercicios[0]!.series) { expect(x.peso).toBeNull(); expect(x.reps).toBe(8) }
  })
  it('índices que no existen no revientan (hecha, saltar, quitar serie)', () => {
    const s = sesion([ej('a')])
    expect(hecha(s, 7, { peso: 1, reps: 1, rpe: null }).descanso).toBe(0)
    expect(saltar(s, 7).ejercicios).toHaveLength(1)
    expect(quitarSerie(s, 7).ejercicios).toHaveLength(1)
  })
  it('una sesión a medias de una rutina sin días/bloques no rompe', () => {
    const dia: DiaRutina = { letra: 'A', nombre: 'A', dia: 0, opcional: false, bloques: [] }
    const s = crearSesion(dia, { rutinaId: 1, gimnasioId: null, version: 'corta', calibracion: false, ahora: 0 })
    expect(s.ejercicios).toEqual([])
    expect(restanteSesion(s)).toBe(0)
  })
  it('propiedad: hacer todas las series de una sesión con superseries termina la sesión y deja un solo «curso» cada vez', () => {
    const bloques: Bloque[] = ['a', 'b', 'c', 'd'].map(uid => ({ uid, ejercicio: uid, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 60, registro: 'peso' }))
    bloques[1]!.superserie = 'c'; bloques[2]!.superserie = 'b'
    let s = crearSesion({ letra: 'A', nombre: 'A', dia: 0, opcional: false, bloques }, { rutinaId: 1, gimnasioId: null, version: 'normal', calibracion: false, ahora: 0 })
    for (let paso = 0; paso < 20; paso++) {
      const i = s.ejercicios.findIndex(e => e.estado === 'curso')
      if (i < 0) break
      s = hecha(s, i, { peso: 40, reps: 10, rpe: 8 }, paso).sesion
      expect(s.ejercicios.filter(e => e.estado === 'curso').length).toBeLessThanOrEqual(1)
    }
    expect(s.ejercicios.every(e => e.estado === 'hecho')).toBe(true)
  })
})
