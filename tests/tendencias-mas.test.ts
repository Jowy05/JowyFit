// Progreso: casos límite de las cuentas de la pestaña Progreso (vacíos, asistidas, empates,
// fechas repetidas, ejes, metas) y del estancamiento.
import { describe, expect, it } from 'vitest'
import type { EjercicioSesion, Medicion, Serie, Sesion, TipoRegistro } from '../src/datos/tipos'
import {
  GRUPOS_MUSCULARES, PASOS_POR_KM, PASOS_POR_MINUTO, cambioDesdeInicio, ejeRedondo, ejerciciosHechos, estadoEntrenos, estadoPicoteo, evolucion, faltaMeta,
  grasaPorMedidas, hechasAsc, hitosDominadas, lineasSemaforo, logros, mediasSemanales, mejor1RM, pasosEquivalentes, pendienteSemanal, pesoMaximo,
  progresoMeta, puntosSpark, recordsEn, repsMaximas, serieMedida, seriesDe, seriesPorGrupo, subidas, ultimoValor, veredictoCinturaAltura, veredictoGrasa, veredictoImc,
} from '../src/dominio/tendencias'
import { SEMANAS_SIN_DESCARGA, SESIONES_ESTANCADO, estancado, mejor1RM as mejor1RMDescarga, pesoReinicio, pesoTop, propuestaDescarga } from '../src/dominio/descarga'

const serie = (peso: number | null, reps: number | null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe: 8, calentamiento: false, hecha: true, ...x })
const ej = (ejercicio: string, series: Serie[], registro: TipoRegistro = 'peso'): EjercicioSesion => ({ uid: ejercicio, ejercicio, planificado: ejercicio, estado: 'hecho', series, repsMin: 6, repsMax: 10, rpe: 8, descanso: 120, registro })
let n = 1
const sesion = (fecha: string, ejercicios: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion => ({ id: n++, fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: new Date(`${fecha}T06:00`).getTime(), version: 'normal', estado: 'hecha', ejercicios, calibracion: false, ...x })
const med = (fecha: string, x: Partial<Medicion>): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', ...x })

describe('sesiones y series', () => {
  it('hechasAsc: solo las hechas, de la más antigua a la más reciente', () => {
    const ss = [sesion('2026-10-15', []), sesion('2026-10-13', []), sesion('2026-10-14', [], { estado: 'cancelada' }), sesion('2026-10-16', [], { estado: 'curso' })]
    expect(hechasAsc(ss).map(s => s.fecha)).toEqual(['2026-10-13', '2026-10-15'])
    expect(hechasAsc([])).toEqual([])
  })
  it('seriesDe junta el mismo ejercicio aunque salga dos veces en la sesión', () => {
    const s = sesion('2026-10-13', [ej('curl', [serie(10, 10)]), ej('press', [serie(40, 8)]), ej('curl', [serie(12, 8), serie(12, 7)])])
    expect(seriesDe(s, 'curl')).toHaveLength(3)
    expect(seriesDe(s, 'nada')).toEqual([])
  })
  it('sin series de trabajo: nulls (no 0 ni -Infinity)', () => {
    const cal = [serie(20, 10, { calentamiento: true }), serie(40, 8, { hecha: false })]
    expect(pesoMaximo(cal)).toBeNull()
    expect(mejor1RM(cal)).toBeNull()
    expect(repsMaximas(cal)).toBeNull()
    expect(pesoMaximo([serie(40, 0)])).toBeNull() // sin reps no cuenta
    expect(mejor1RM([serie(-20, 8)])).toBeNull() // asistida
    expect(repsMaximas([serie(null, 12)])).toBe(12)
  })
  it('evolución en volumen y 1RM: sesiones sin ese ejercicio o sin peso no salen', () => {
    const ss = [sesion('2026-10-13', [ej('press', [serie(40, 10), serie(40, 8)])]), sesion('2026-10-15', [ej('dominadas', [serie(null, 5)], 'corporal')]), sesion('2026-10-17', [ej('press', [serie(null, 10)])])]
    expect(evolucion(ss, 'press', 'volumen')).toEqual([{ fecha: '2026-10-13', valor: 720 }])
    expect(evolucion(ss, 'press', 'e1rm')).toEqual([{ fecha: '2026-10-13', valor: 53.3 }])
    expect(evolucion([], 'press', 'peso')).toEqual([])
  })
  it('ejercicios hechos: a igualdad de veces, el más reciente primero', () => {
    const ss = [sesion('2026-10-13', [ej('a', [serie(1, 1)]), ej('b', [serie(1, 1)])]), sesion('2026-10-15', [ej('b', [serie(1, 1)]), ej('c', [serie(1, 1, { hecha: false })])])]
    expect(ejerciciosHechos(ss)).toEqual(['b', 'a'])
  })
  it('subidas: las asistidas y las bajadas no cuentan', () => {
    const ss = [sesion('2026-10-13', [ej('asist', [serie(-30, 8)], 'asistido'), ej('press', [serie(50, 8)])]), sesion('2026-10-15', [ej('asist', [serie(-20, 8)], 'asistido'), ej('press', [serie(45, 8)])])]
    expect(subidas(ss)).toEqual([])
  })
  it('logros: el primer récord de un ejercicio es «primero»; las reps mejoran al menos 1', () => {
    const ss = [
      sesion('2026-10-13', [ej('press', [serie(40, 8, { record: true })])]),
      sesion('2026-10-15', [ej('press', [serie(40, 9, { record: true })])]),
      sesion('2026-10-17', [ej('press', [serie(37.5, 12, { record: true })])]),
    ]
    const l = logros(ss)
    expect(l.map(x => [x.tipo, x.mejora])).toEqual([['reps', 1], ['reps', 1], ['primero', 0]])
    expect(recordsEn(ss, ['2026-10-15', '2026-10-17'])).toBe(2)
    expect(recordsEn(ss, [])).toBe(0)
    expect(logros([])).toEqual([])
  })
  it('series por grupo: ejercicios sin patrón conocido no suman; sesiones no hechas tampoco', () => {
    const ss = [sesion('2026-10-13', [ej('press', [serie(40, 8), serie(40, 8)]), ej('raro', [serie(1, 1)])]), sesion('2026-10-13', [ej('press', [serie(40, 8)])], { estado: 'curso' })]
    const g = seriesPorGrupo(ss, ['2026-10-13'], id => (id === 'press' ? 'empuje-h' : undefined))
    expect(g.find(x => x.n === 'Pecho')!.v).toBe(2)
    expect(g.reduce((t, x) => t + x.v, 0)).toBe(2)
    expect(g.map(x => x.n)).toEqual(GRUPOS_MUSCULARES.map(x => x.n))
  })
})

describe('medidas del cuerpo', () => {
  it('serieMedida: el último del día (aunque vengan desordenadas)', () => {
    const ms = [med('2026-10-13', { pesoKg: 80 }), { fecha: '2026-10-13T21:00', origen: 'casa' as const, pesoKg: 81 }, med('2026-10-12', { pesoKg: 79 })]
    expect(serieMedida(ms, m => m.pesoKg)).toEqual([{ fecha: '2026-10-12', valor: 79 }, { fecha: '2026-10-13', valor: 81 }])
  })
  it('ultimoValor: ninguno, o hasta una fecha', () => {
    expect(ultimoValor([], m => m.pesoKg)).toBeNull()
    const ms = [med('2026-10-01', { pesoKg: 80 }), med('2026-10-20', { pesoKg: 78 })]
    expect(ultimoValor(ms, m => m.pesoKg, '2026-10-10')).toEqual({ fecha: '2026-10-01', valor: 80 })
    expect(ultimoValor(ms, m => m.pesoKg)!.valor).toBe(78)
  })
  it('medias semanales: el punto va en el lunes, también en la semana del cambio de hora', () => {
    const ms = [med('2026-10-25', { pesoKg: 80 }), med('2026-10-19', { pesoKg: 79 }), med('2026-10-26', { pesoKg: 78 })]
    expect(mediasSemanales(ms, m => m.pesoKg)).toEqual([{ fecha: '2026-10-19', valor: 79.5 }, { fecha: '2026-10-26', valor: 78 }])
  })
  it('pendiente: un punto o todos el mismo día → null', () => {
    expect(pendienteSemanal([{ fecha: '2026-10-13', valor: 80 }])).toBeNull()
    expect(pendienteSemanal([{ fecha: '2026-10-13', valor: 80 }, { fecha: '2026-10-13', valor: 81 }])).toBeNull()
    expect(pendienteSemanal([{ fecha: '2026-10-06', valor: 80 }, { fecha: '2026-10-13', valor: 79 }])).toBeCloseTo(-1)
  })
  it('grasa por medidas: sin cuello no hay; mujer necesita cadera', () => {
    expect(grasaPorMedidas([med('2026-10-13', { perimetros: { cintura: 98 } })], 'hombre', 177)).toEqual([])
    const ms = [med('2026-10-01', { perimetros: { cuello: 33, cadera: 100 } }), med('2026-10-13', { perimetros: { cintura: 80 } })]
    expect(grasaPorMedidas(ms, 'mujer', 165)).toHaveLength(1)
    expect(grasaPorMedidas(ms, 'hombre', 0)).toEqual([])
  })
})

describe('metas', () => {
  it('progreso: sin valor actual 0; sin inicio usa el actual; inicio = objetivo', () => {
    expect(progresoMeta(80, null, 75)).toBe(0)
    expect(progresoMeta(null, 80, 75)).toBe(0)
    expect(progresoMeta(75, 75, 75)).toBe(1)
    expect(progresoMeta(75, 76, 75)).toBe(0)
    expect(progresoMeta(80, 70, 75)).toBe(1) // pasado: no más del 100 %
    expect(progresoMeta(80, 85, 75)).toBe(0) // peor que al empezar: no negativo
  })
  it('lo que falta: null sin dato y 0 si ya se pasó', () => {
    expect(faltaMeta(80, null, 75)).toBeNull()
    expect(faltaMeta(80, 74, 75)).toBe(0)
    expect(faltaMeta(5, 8, 10)).toBe(2)
    expect(faltaMeta(undefined, 8, 10)).toBe(2)
  })
})

describe('dominadas, pasos y gráficas', () => {
  it('sin dominadas: «hay» falso y el primer hito es el actual', () => {
    const h = hitosDominadas([])
    expect(h.hay).toBe(false)
    expect(h.estrictas).toBe(0)
    expect(h.hitos.map(x => x.estado)).toEqual(['actual', 'pendiente', 'pendiente', 'pendiente', 'pendiente'])
  })
  it('pasos equivalentes: negativos cuentan como 0', () => {
    expect(PASOS_POR_KM).toBe(1300)
    expect(PASOS_POR_MINUTO).toBe(160)
    expect(pasosEquivalentes(-3, 'km')).toBe(0)
    expect(pasosEquivalentes(2.5, 'km')).toBe(3250)
    expect(pasosEquivalentes(20, 'min')).toBe(3200)
  })
  it('sparkline: vacía, un punto en el centro y valores iguales en medio', () => {
    expect(puntosSpark([])).toEqual([])
    expect(puntosSpark([5])).toEqual([{ x: 60, y: 20 }])
    expect(puntosSpark([5, 5]).map(p => p.y)).toEqual([20, 20])
  })
  it('eje: sin valores, con NaN y con negativos', () => {
    const vacio = ejeRedondo([])
    expect(vacio.min).toBe(0)
    expect(vacio.max).toBeGreaterThan(0)
    const conNaN = ejeRedondo([NaN, 80, 82])
    expect(conNaN.min).toBeLessThanOrEqual(80)
    expect(conNaN.max).toBeGreaterThanOrEqual(82)
    const neg = ejeRedondo([-30, -10])
    expect(neg.marcas[0]).toBeLessThanOrEqual(-30)
    expect(neg.marcas.at(-1)).toBeGreaterThanOrEqual(-10)
  })
  it('cambio desde el inicio: vacío null; un solo punto, sin cambio', () => {
    expect(cambioDesdeInicio([])).toBeNull()
    expect(cambioDesdeInicio([{ fecha: '2026-10-13', valor: 40 }])).toEqual({ inicio: 40, ahora: 40, delta: 0, desde: '2026-10-13' })
    expect(cambioDesdeInicio([{ fecha: 'a', valor: 0.1 }, { fecha: 'b', valor: 0.3 }])!.delta).toBe(0.2)
  })
})

describe('palabras para quien no sabe de números', () => {
  it('cintura/altura en los bordes', () => {
    expect(veredictoCinturaAltura(0.39).tono).toBe('warn')
    expect(veredictoCinturaAltura(0.4).palabra).toBe('saludable')
    expect(veredictoCinturaAltura(0.5).tono).toBe('warn')
    expect(veredictoCinturaAltura(0.55).tono).toBe('bad')
    expect(veredictoCinturaAltura(0.6).palabra).toBe('bastante por encima de lo saludable')
  })
  it('grasa en los bordes, hombre y mujer', () => {
    expect(veredictoGrasa(5, 'hombre').palabra).toBe('muy bajo')
    expect(veredictoGrasa(6, 'hombre').palabra).toBe('de deportista')
    expect(veredictoGrasa(14, 'hombre').palabra).toBe('en forma')
    expect(veredictoGrasa(18, 'hombre').palabra).toBe('normal')
    expect(veredictoGrasa(25, 'hombre').palabra).toBe('alto')
    expect(veredictoGrasa(24.2, 'mujer').palabra).toBe('en forma')
    expect(veredictoGrasa(32, 'mujer').tono).toBe('bad')
  })
  it('IMC en los bordes', () => {
    expect(veredictoImc(18.49).palabra).toBe('bajo')
    expect(veredictoImc(18.5).palabra).toBe('normal')
    expect(veredictoImc(25).palabra).toBe('algo alto')
    expect(veredictoImc(30).palabra).toBe('alto')
  })
  it('estado de entrenos: sin fijos siempre al día; 1 fijo y 0 hechos, mal', () => {
    expect(estadoEntrenos(0, 0)).toEqual({ estado: 'ok', alDia: true })
    expect(estadoEntrenos(0, 1)).toEqual({ estado: 'bad', alDia: false })
    expect(estadoEntrenos(2, 3)).toEqual({ estado: 'warn', alDia: false })
    expect(estadoEntrenos(1, 3, 0)).toEqual({ estado: 'ok', alDia: true })
  })
  it('picoteo: igual que la semana pasada con 2+ días, ámbar', () => {
    expect(estadoPicoteo(2, 2, true)).toBe('warn')
    expect(estadoPicoteo(0, 0, true)).toBe('ok')
    expect(estadoPicoteo(1, 0, true)).toBe('warn')
    expect(estadoPicoteo(3, 1, true)).toBe('bad')
    expect(estadoPicoteo(5, 0, false)).toBe('nada')
  })
  it('líneas del semáforo: rojo sin nada bueno, retraso y semana cerrada', () => {
    expect(lineasSemaforo({ frase: 'A mejorar: 0/3 entrenos, proteína baja.', semaforo: 'rojo', entrenos: 0, fijos: 3, enCurso: true }))
      .toEqual(['Vas con retraso: 0 de 3 entrenos', 'A mejorar: proteína baja'])
    expect(lineasSemaforo({ frase: 'A mejorar: 1/3 entrenos.', semaforo: 'rojo', entrenos: 1, fijos: 3, enCurso: false }))
      .toEqual(['Te faltaron entrenos: 1 de 3 entrenos'])
    expect(lineasSemaforo({ frase: '3/3 entrenos, pasos OK.', semaforo: 'verde', entrenos: 3, fijos: 3, enCurso: false }))
      .toEqual(['Entrenos hechos: 3 de 3', 'Bien: pasos'])
    expect(lineasSemaforo({ frase: '.', semaforo: 'verde', entrenos: 0, fijos: 0, enCurso: true })).toEqual([])
  })
})

describe('estancamiento: casos límite', () => {
  const s = (peso: number | null, reps: number | null, x: Partial<Serie> = {}) => serie(peso, reps, { rpe: null, ...x })
  it('peso más alto y mejor 1RM de una sesión (sin calentamiento ni asistidas)', () => {
    expect(pesoTop([s(20, 10, { calentamiento: true }), s(50, 5), s(45, 8)])).toBe(50)
    expect(pesoTop([s(-20, 8)])).toBe(0)
    expect(pesoTop([])).toBe(0)
    expect(mejor1RMDescarga([s(100, 1)])).toBe(100)
    expect(mejor1RMDescarga([s(100, null)])).toBe(0)
  })
  it('una sesión de las 3 últimas sin series con peso: no está estancado', () => {
    const h = (p: number) => ({ series: [s(p, 8), s(p, 8)] })
    expect(estancado([h(50), h(50), h(50), h(50)])).toBe(true)
    expect(estancado([h(50), { series: [] }, h(50), h(50)])).toBe(false)
    expect(estancado([h(50), h(50), h(50), { series: [s(null, 10)] }])).toBe(false)
    expect(SESIONES_ESTANCADO).toBe(3)
  })
  it('mejora de menos del 1 % sigue siendo estancamiento; más del 1 %, no', () => {
    const h = (p: number, r: number) => ({ series: [s(p, r)] })
    expect(estancado([h(50.25, 8), h(50, 8), h(50, 8), h(50, 8)])).toBe(true)
    expect(estancado([h(50, 9), h(50, 8), h(50, 8), h(50, 8)])).toBe(false)
  })
  it('peso de reinicio sin lista: −10 % redondeado a 2,5; con 0 o negativo, el mismo', () => {
    expect(pesoReinicio(50, [])).toBe(45)
    expect(pesoReinicio(2, [])).toBe(2)
    expect(pesoReinicio(0, [])).toBe(0)
    expect(pesoReinicio(50, [50, 60])).toBe(50) // no hay nada por debajo
  })
  it('propuesta: ya en semana suave o aplazada este lunes, nada; el motivo nombra los estancados', () => {
    const base = { hoy: '2026-10-14', sesiones: [] as Sesion[], ejerciciosRutina: [], nombre: (id: string) => id.toUpperCase() }
    expect(propuestaDescarga({ ...base, semanaSuave: '2026-10-12', pospuesta: null })).toBeNull()
    expect(propuestaDescarga({ ...base, semanaSuave: null, pospuesta: '2026-10-12' })).toBeNull()
    const h = (fecha: string) => sesion(fecha, ['a', 'b', 'c', 'd'].map(id => ej(id, [s(50, 8)])))
    const ss = ['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].map(h)
    const p = propuestaDescarga({ ...base, sesiones: ss, ejerciciosRutina: ['a', 'b', 'c', 'd', 'a'], semanaSuave: null, pospuesta: null })!
    expect(p.estancados).toEqual(['a', 'b', 'c', 'd'])
    expect(p.motivo).toBe('4 ejercicios llevan 3 sesiones sin mejorar (A, B, C…)')
    expect(SEMANAS_SIN_DESCARGA).toBe(6)
  })
})
