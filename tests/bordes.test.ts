// Casos límite que faltaban: tiempos del entreno, energía del cardio y por tiempo, báscula
// (dos grasas para una pesada, solo grasa repetida), pesos del gimnasio y progresión.
import { describe, expect, it } from 'vitest'
import { estadoHora, propuestaRecorte, restanteEjercicio, restanteSesion, restoDescanso } from '../src/dominio/tiempos'
import { kcalSesion, zancada } from '../src/dominio/energia'
import { juntarBascula, lecturasNuevas, nombreFuente } from '../src/dominio/bascula'
import { BARRAS, ajustarA, calentamiento, discosPorLado, mancuernasDisponibles, pesosBarra, pesosPara, siguiente } from '../src/dominio/pesos'
import { esRecord, leerReferencia, mejorMarca, pesoPartida, sugerir, volumen } from '../src/dominio/progresion'
import { gimnasioNuevo } from '../src/datos/repos'
import type { EjercicioSesion, Serie, Sesion } from '../src/datos/tipos'

const serie = (x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 40, reps: 8, rpe: null, calentamiento: false, hecha: false, ...x })
const ej = (uid: string, x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({ uid, ejercicio: uid, planificado: uid, estado: 'pendiente', series: [serie(), serie(), serie()], repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const sesion = (ejercicios: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion => ({ fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: new Date(2026, 9, 13, 5, 30).getTime(), version: 'normal', estado: 'curso', calibracion: false, ejercicios, ...x })

describe('tiempos del entreno', () => {
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

describe('energía del entreno', () => {
  const s = (ejercicios: EjercicioSesion[]) => sesion(ejercicios, { estado: 'hecha' })
  it('cardio por sus minutos (las reps son minutos) y por tiempo por sus segundos', () => {
    const cardio = kcalSesion(s([ej('cinta', { registro: 'cardio', series: [serie({ reps: 30, hecha: true, peso: null })] })]), 80, () => 8)
    // (8 − 1) × 80 kg × 0,5 h = 280.
    expect(cardio.hecho).toBe(280)
    const plancha = kcalSesion(s([ej('plancha', { registro: 'tiempo', descanso: 60, series: [serie({ segundos: 60, reps: null, hecha: true })] })]), 80, () => 4)
    // (4 − 1) × 80 × (60 + 60) s.
    expect(plancha.hecho).toBe(Math.round(3 * 80 * (120 / 3600)))
  })
  it('sin MET conocido usa 5; un MET muy bajo cuenta como 1,5; el calentamiento a la mitad', () => {
    const una = (x: Partial<Serie>) => s([ej('a', { series: [serie({ hecha: true, ...x })] })])
    const sinMet = kcalSesion(una({}), 80, () => null).hecho
    expect(sinMet).toBe(Math.round(4 * 80 * (135 / 3600)))
    expect(kcalSesion(una({}), 80, () => 1).hecho).toBe(Math.round(0.5 * 80 * (135 / 3600)))
    expect(kcalSesion(una({ calentamiento: true }), 80, () => null).hecho).toBe(Math.round(sinMet / 2))
  })
  it('lo que falta de un ejercicio en curso no es «saltado»; lo de uno saltado sí', () => {
    const r = kcalSesion(s([ej('a', { estado: 'curso' }), ej('b', { estado: 'saltado' })]), 80, () => 5)
    expect(r.hecho).toBe(0)
    expect(r.saltado).toBe(Math.round(r.plan / 2))
    expect(kcalSesion(s([]), 80, () => 5)).toEqual({ hecho: 0, plan: 0, saltado: 0 })
  })
  it('zancada: el 41,5 % de la altura', () => expect(zancada(200)).toBeCloseTo(0.83))
})

describe('báscula: casos raros', () => {
  const iso = (s: string) => new Date(s).toISOString()
  it('fallaba: dos grasas cerca de un peso se emparejaban por orden de llegada, no con la más cercana', () => {
    const l = juntarBascula([{ fecha: iso('2026-10-13T08:00:00'), valor: 79 }], [
      { fecha: iso('2026-10-13T08:05:00'), valor: 25, id: 'lejos' },
      { fecha: iso('2026-10-13T08:00:30'), valor: 24, id: 'cerca' },
    ])
    expect(l[0]).toMatchObject({ pesoKg: 79, grasaPct: 24, ids: ['cerca'] })
    expect(l.find(x => x.ids.includes('lejos'))!.pesoKg).toBeUndefined()
  })
  it('dos apps con la misma pesada: una sola, con la grasa de la que la tenga', () => {
    const l = juntarBascula([{ fecha: iso('2026-10-13T08:00:00'), valor: 79, id: 'a' }, { fecha: iso('2026-10-13T08:02:00'), valor: 79.05, id: 'b' }], [{ fecha: iso('2026-10-13T08:02:10'), valor: 24, id: 'g' }])
    expect(l).toHaveLength(1)
    expect(l[0]!.ids.sort()).toEqual(['a', 'b', 'g'])
    expect(l[0]!.grasaPct).toBe(24)
  })
  it('solo grasa ya apuntada ese día: no se trae otra vez; los ids ignorados tampoco', () => {
    const l = [{ fecha: iso('2026-10-13T08:00:00'), grasaPct: 24.2, ids: ['g1'] }, { fecha: iso('2026-10-13T09:00:00'), grasaPct: 30, ids: ['g2'] }]
    const ms = [{ fecha: '2026-10-13T07:00', origen: 'casa' as const, bascula: { grasaPct: 24.25 } }]
    expect(lecturasNuevas(l, ms).map(x => x.ids[0])).toEqual(['g2'])
    expect(lecturasNuevas(l, ms, ['g2'])).toEqual([])
  })
  it('nombre de la app: conocidas, paquetes y vacío', () => {
    expect(nombreFuente()).toBe('tu báscula')
    expect(nombreFuente('com.garmin.android.apps.connectmobile')).toBe('Garmin Connect')
    expect(nombreFuente('com.ejemplo.basculita')).toBe('Basculita')
    expect(nombreFuente('MiBascula')).toBe('MiBascula')
  })
})

describe('pesos del gimnasio', () => {
  const g = gimnasioNuevo()
  it('mancuernas: tramos raros (paso 0, NaN) se ignoran y no se repiten', () => {
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 2, hasta: 4, paso: 0 }, { desde: NaN, hasta: 4, paso: 1 }] })).toEqual([])
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 2, hasta: 4, paso: 1 }, { desde: 4, hasta: 6, paso: 2 }] })).toEqual([2, 3, 4, 6])
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 1, hasta: 2, paso: 0.25 }] })).toEqual([1, 1.25, 1.5, 1.75, 2])
    expect(mancuernasDisponibles({ mancuernas: [] })).toEqual([])
  })
  it('barra: sin discos solo la barra; discos 0 o negativos no cuentan', () => {
    expect(pesosBarra(20, [])).toEqual([20])
    expect(pesosBarra(20, [0, -5])).toEqual([20])
    expect(pesosBarra(20, [5], 40)).toEqual([20, 30, 40])
  })
  it('lista según el material: corporal vacía, asistida de −100 a 0, mancuernas, barra Z y máquinas', () => {
    expect(pesosPara(null, 'corporal', g)).toEqual([])
    const asist = pesosPara('assisted_pullup_machine', 'asistido', g)
    expect(asist[0]).toBe(-100)
    expect(asist.at(-1)).toBe(0)
    expect(Object.is(asist.at(-1), -0)).toBe(false)
    expect(pesosPara('dumbbell', 'mancuerna', g)[0]).toBe(2)
    expect(pesosPara('ez_bar', 'peso', g)[0]).toBe(BARRAS.ez_bar)
    expect(pesosPara('dumbbell', 'mancuerna', { ...g, mancuernas: [] })).toHaveLength(121) // sin mancuernas: de 2,5 en 2,5
    expect(pesosPara('cable', 'peso', null)).toHaveLength(121)
  })
  it('ajustar y siguiente: lista vacía y valores fuera de la lista', () => {
    expect(ajustarA([], 7)).toBe(7)
    expect(ajustarA([10, 20], 14)).toBe(10)
    expect(ajustarA([10, 20], 16)).toBe(20)
    expect(ajustarA([10, 20], 19, true)).toBe(10)
    expect(siguiente([], 10, 1)).toBe(12.5)
    expect(siguiente([], 1, -1)).toBe(0)
    expect(siguiente([10, 20], 30, 1)).toBe(30)
    expect(siguiente([10, 20], 5, -1)).toBe(5)
    expect(siguiente([10, 20], 15, -1)).toBe(10)
  })
  it('discos por lado: imposibles, barra sola y pesos absurdos', () => {
    expect(discosPorLado(20, 20, [5])).toEqual([])
    expect(discosPorLado(15, 20, [5])).toBeNull()
    expect(discosPorLado(23, 20, [5])).toBeNull()
    expect(discosPorLado(NaN, 20, [5])).toBeNull()
    expect(discosPorLado(5000, 20, [5])).toBeNull()
    expect(discosPorLado(60, 20, [])).toBeNull()
    expect(discosPorLado(60, 20, [0])).toBeNull()
    expect(discosPorLado(62.5, 20, [20, 1.25])).toEqual([20, 1.25])
  })
  it('calentamiento: peso de trabajo 0 o muy ligero no da aproximaciones; sin lista, de 2,5 en 2,5', () => {
    expect(calentamiento(0, [])).toEqual([])
    expect(calentamiento(2.5, [])).toEqual([])
    expect(calentamiento(30, [])).toEqual([{ peso: 15, reps: 10 }, { peso: 22.5, reps: 5 }])
    // Con un mínimo (la barra) no baja de él y no repite.
    expect(calentamiento(30, [], 20)).toEqual([{ peso: 20, reps: 10 }, { peso: 22.5, reps: 5 }])
    expect(calentamiento(22.5, [], 20)).toEqual([{ peso: 20, reps: 10 }])
  })
})

describe('progresión: lo que faltaba', () => {
  const s = (peso: number | null, reps: number | null, x: Partial<Serie> = {}) => serie({ peso, reps, hecha: true, ...x })
  const obj = { repsMin: 8, repsMax: 12, rpe: 8 }
  it('corporal: sube una rep si las hizo todas; si no, repite', () => {
    expect(sugerir([s(null, 12), s(null, 12)], obj, 'corporal', [])).toMatchObject({ accion: 'subir', reps: 13, texto: 'Hoy: 13 reps' })
    expect(sugerir([s(null, 10)], obj, 'corporal', [])).toMatchObject({ accion: 'mantener', reps: 10 })
    expect(sugerir([s(null, 12, { rpe: 10 })], obj, 'corporal', [])).toMatchObject({ accion: 'mantener' })
  })
  it('por tiempo: +5 s', () => {
    expect(sugerir([s(null, null, { segundos: 45 })], { repsMin: 30, repsMax: 45, rpe: 8 }, 'tiempo', [])).toMatchObject({ accion: 'subir', reps: 50, texto: 'Hoy: aguanta 50 s' })
  })
  it('en el peso más alto que hay: busca más reps', () => {
    expect(sugerir([s(50, 12), s(50, 12)], obj, 'peso', [40, 45, 50])).toMatchObject({ accion: 'mantener', peso: 50, reps: 12 })
  })
  it('muy fácil (esfuerzo ≤ 6): salto doble', () => {
    expect(sugerir([s(40, 12, { rpe: 6 }), s(40, 12, { rpe: 6 })], obj, 'peso', [40, 42.5, 45, 47.5]).peso).toBe(45)
  })
  it('costó demasiado pero no hay peso menor: mantener', () => {
    expect(sugerir([s(40, 5, { rpe: 10 })], obj, 'peso', [40, 45])).toMatchObject({ accion: 'mantener', peso: 40 })
  })
  it('mismo peso, una rep más (sin pasar del máximo)', () => {
    expect(sugerir([s(40, 9, { rpe: 8 }), s(40, 10, { rpe: 8 })], obj, 'peso', [40, 45])).toMatchObject({ accion: 'mantener', reps: 11, texto: 'Mismo peso, una rep más' })
  })
  it('marca, récord y volumen con datos vacíos o asistidos', () => {
    expect(mejorMarca([])).toBeNull()
    expect(mejorMarca([s(-20, 8)])).toBeNull()
    expect(esRecord(s(50, 8), [])).toBeNull()
    expect(esRecord(s(50, 8, { calentamiento: true }), [s(40, 8)])).toBeNull()
    expect(esRecord(s(40, 8), [s(40, 8)])).toBeNull()
    expect(esRecord(s(40, 9), [s(40, 8), s(45, 3)])).toMatchObject({ tipo: 'reps' })
    expect(volumen([s(-20, 8), s(40, 10)])).toBe(400)
  })
  it('referencias raras', () => {
    expect(leerReferencia(undefined)).toBeNull()
    expect(leerReferencia('sin número')).toBeNull()
    expect(leerReferencia('0 kg')).toBeNull()
    expect(leerReferencia('500 kg')).toBeNull()
    expect(leerReferencia('47,5 kg x 6')).toEqual({ peso: 47.5, reps: 6 })
    expect(leerReferencia('40 × 50')).toEqual({ peso: 40, reps: 8 }) // 50 reps no es creíble
  })
  it('peso de partida sin lista: el mínimo del material', () => {
    expect(pesoPartida('barbell', 'peso', [])).toBe(20)
    expect(pesoPartida('dumbbell', 'mancuerna', [])).toBe(4)
    expect(pesoPartida('loop_band', 'peso', [])).toBe(5)
    expect(pesoPartida('dumbbell', 'mancuerna', [1, 2, 3])).toBe(3) // todas más ligeras: la más pesada
    expect(pesoPartida(null, 'corporal', [])).toBeNull()
  })
})
