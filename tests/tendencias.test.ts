import { describe, expect, it } from 'vitest'
import type { Comida, EjercicioSesion, Medicion, Serie, Sesion, TipoRegistro } from '../src/datos/tipos'
import {
  datosQuincena, ejerciciosHechos, esDominadaAsistida, esDominadaEstricta, esDominadaNegativa, evolucion, faltaMeta, grasaPorMedidas,
  hitosDominadas, logros, mediasSemanales, mejor1RM, pasosEquivalentes, pendienteSemanal, pesoMaximo, progresoMeta, puntosSpark,
  recordsEn, repsMaximas, serieMedida, seriesPorGrupo, nivelSeries, subidas, ultimoValor, tendenciaPeso, GRUPOS_MUSCULARES, hechasAsc, seriesDe, PASOS_POR_KM, PASOS_POR_MINUTO,
} from '../src/dominio/tendencias'
import {
  cambioDesdeInicio, ejeRedondo, estadoEntrenos, estadoPicoteo, lineasSemaforo, veredictoCinturaAltura, veredictoGrasa, veredictoImc,
} from '../src/dominio/tendencias'
import { lineaSpark } from '../src/ui/graficas'

const serie = (peso: number | null, reps: number, extra: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe: 8, calentamiento: false, hecha: true, ...extra })

const ej = (ejercicio: string, series: Serie[], registro: TipoRegistro = 'peso'): EjercicioSesion => ({
  uid: ejercicio, ejercicio, planificado: ejercicio, estado: 'hecho', series, repsMin: 6, repsMax: 10, rpe: 8, descanso: 120, registro,
})

let siguienteId = 1

const sesion = (fecha: string, ejercicios: EjercicioSesion[], estado: Sesion['estado'] = 'hecha'): Sesion => {
  const id = siguienteId++
  const [a, m, d] = fecha.split('-').map(Number)
  return { id, fecha, rutinaId: 1, letra: 'A', nombre: 'Cuerpo completo A', gimnasioId: null, inicio: new Date(a!, m! - 1, d!, 6).getTime(), version: 'normal', estado, ejercicios, calibracion: false }
}

const med = (fecha: string, o: Partial<Medicion>): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', ...o })

describe('series y ejercicios', () => {
  it('peso máximo, 1RM y reps ignoran calentamiento y series sin hacer', () => {
    const s = [serie(20, 10, { calentamiento: true }), serie(40, 8), serie(45, 6), serie(60, 5, { hecha: false })]
    expect(pesoMaximo(s)).toBe(45)
    expect(mejor1RM(s)).toBeCloseTo(54, 0)
    expect(repsMaximas(s)).toBe(8)
    expect(pesoMaximo([serie(null, 10)])).toBeNull()
  })

  it('evolución por ejercicio en orden de fecha y solo sesiones hechas', () => {
    const ses = [
      sesion('2026-09-29', [ej('bench-press', [serie(42.5, 8), serie(42.5, 7)])]),
      sesion('2026-09-22', [ej('bench-press', [serie(40, 8)])]),
      sesion('2026-10-06', [ej('bench-press', [serie(45, 8)])], 'cancelada'),
      sesion('2026-10-13', [ej('squat', [serie(50, 8)])]),
    ]
    expect(evolucion(ses, 'bench-press', 'peso').map(p => p.valor)).toEqual([40, 42.5])
    expect(evolucion(ses, 'bench-press', 'volumen').map(p => p.valor)).toEqual([320, 637.5])
    expect(evolucion(ses, 'bench-press', 'e1rm')[0]!.valor).toBeCloseTo(50.7, 1)
    expect(ejerciciosHechos(ses)).toEqual(['bench-press', 'squat'])
  })

  it('subidas: peso máximo mayor que la sesión anterior del mismo ejercicio', () => {
    const ses = [
      sesion('2026-09-22', [ej('bench-press', [serie(40, 8)]), ej('squat', [serie(50, 8)])]),
      sesion('2026-09-29', [ej('bench-press', [serie(42.5, 8)]), ej('squat', [serie(50, 8)])]),
      sesion('2026-10-06', [ej('bench-press', [serie(42.5, 8)]), ej('squat', [serie(55, 6)])]),
    ]
    const s = subidas(ses)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ ejercicio: 'squat', antes: 50, ahora: 55, fecha: '2026-10-06' })
    expect(s[1]).toMatchObject({ ejercicio: 'bench-press', antes: 40, ahora: 42.5 })
  })

  it('logros: récord de peso con su mejora y récord de reps', () => {
    const ses = [
      sesion('2026-09-22', [ej('bench-press', [serie(45, 6)])]),
      sesion('2026-09-29', [ej('bench-press', [serie(47.5, 6, { record: true })])]),
      sesion('2026-10-06', [ej('bench-press', [serie(47.5, 8, { record: true }), serie(47.5, 7, { record: true })])]),
    ]
    const l = logros(ses)
    expect(l).toHaveLength(2)
    expect(l[0]).toMatchObject({ tipo: 'reps', reps: 8, mejora: 2 })
    expect(l[1]).toMatchObject({ tipo: 'peso', peso: 47.5, mejora: 2.5 })
    expect(recordsEn(ses, ['2026-10-06'])).toBe(2)
    expect(recordsEn(ses, ['2026-10-07'])).toBe(0)
  })

  it('series por grupo muscular de la semana', () => {
    const ses = [sesion('2026-10-13', [ej('bench-press', [serie(40, 8), serie(40, 8), serie(20, 10, { calentamiento: true })]), ej('curl', [serie(10, 10)])])]
    const patrones: Record<string, string> = { 'bench-press': 'empuje-h', curl: 'biceps' }
    const g = seriesPorGrupo(ses, ['2026-10-13'], id => patrones[id])
    expect(g.find(x => x.n === 'Pecho')!.v).toBe(2)
    expect(g.find(x => x.n === 'Brazos')!.v).toBe(1)
    expect(g.find(x => x.n === 'Piernas')!.v).toBe(0)
    expect(g.map(x => x.n)).toContain('Abdomen')
  })

  it('palabra para las series de un grupo', () => {
    expect(nivelSeries(0, [8, 16])).toBe('poco')
    expect(nivelSeries(7, [8, 16])).toBe('poco')
    expect(nivelSeries(8, [8, 16])).toBe('bien')
    expect(nivelSeries(16, [8, 16])).toBe('bien')
    expect(nivelSeries(17, [8, 16])).toBe('mucho')
  })
})

describe('medidas del cuerpo', () => {
  const ms = [
    med('2026-09-15', { pesoKg: 80.4, perimetros: { cintura: 97, cuello: 39 } }),
    med('2026-09-17', { pesoKg: 80.2 }),
    med('2026-09-22', { pesoKg: 80, perimetros: { cintura: 96 } }),
    med('2026-09-29', { pesoKg: 79.8 }),
    med('2026-10-06', { pesoKg: 79.6, perimetros: { cintura: 94.5 } }),
  ]

  it('serie por día, último valor y medias semanales', () => {
    expect(serieMedida(ms, m => m.perimetros?.cintura).map(p => p.valor)).toEqual([97, 96, 94.5])
    expect(ultimoValor(ms, m => m.perimetros?.cintura, '2026-10-01')).toEqual({ fecha: '2026-09-22', valor: 96 })
    const sem = mediasSemanales(ms, m => m.pesoKg)
    expect(sem[0]!.fecha).toBe('2026-09-14')
    expect(sem[0]!.valor).toBeCloseTo(80.3, 5)
    expect(sem).toHaveLength(4)
  })

  it('pendiente semanal por mínimos cuadrados', () => {
    expect(pendienteSemanal([{ fecha: '2026-09-14', valor: 80 }, { fecha: '2026-09-21', valor: 79.8 }, { fecha: '2026-09-28', valor: 79.6 }])).toBeCloseTo(-0.2, 5)
    expect(pendienteSemanal([{ fecha: '2026-09-14', valor: 80 }])).toBeNull()
  })

  it('% de grasa por medidas usa el último cuello conocido', () => {
    const g = grasaPorMedidas(ms, 'hombre', 177)
    expect(g).toHaveLength(3)
    expect(g[0]!.valor).toBeGreaterThan(g[2]!.valor)
  })

  it('datos de la quincena: cintura, peso, picoteo y proteína', () => {
    const comidas: Comida[] = [
      { fecha: '2026-10-01', hora: '17:00', franja: 'merienda', nombre: 'Patatas', kcal: 800, proteina: 9, racion: 'N', tipo: 'picoteo' },
      { fecha: '2026-10-02', hora: '14:00', franja: 'comida', nombre: 'Pollo', kcal: 600, proteina: 51, racion: 'N', tipo: 'plantilla' },
    ]
    const q = datosQuincena({ domingo: '2026-10-11', mediciones: ms, comidas })
    expect(q.cinturaDelta).toBeCloseTo(94.5 - 96, 5)
    expect(q.pesoDelta).toBeCloseTo(79.6 - 80, 5)
    expect(q.picoteoDias).toBe(1)
    expect(q.proteinaMedia).toBe(30)
  })
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
  it('progreso hacia un objetivo que baja o sube', () => {
    expect(progresoMeta(97, 94.5, 88)).toBeCloseTo(2.5 / 9, 5)
    expect(progresoMeta(40, 47.5, 65)).toBeCloseTo(0.3, 5)
    expect(progresoMeta(40, 70, 65)).toBe(1)
    expect(progresoMeta(97, 99, 88)).toBe(0)
    expect(progresoMeta(undefined, 94.5, 88)).toBe(0)
    expect(progresoMeta(97, null, 88)).toBe(0)
  })
  it('lo que falta', () => {
    expect(faltaMeta(97, 94.5, 88)).toBeCloseTo(6.5, 5)
    expect(faltaMeta(40, 47.5, 65)).toBeCloseTo(17.5, 5)
    expect(faltaMeta(97, 87, 88)).toBe(0)
    expect(faltaMeta(undefined, 1, 5)).toBe(4)
    expect(faltaMeta(1, null, 5)).toBeNull()
  })
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

describe('dominadas', () => {
  it('reconoce estrictas, asistidas y negativas', () => {
    expect(esDominadaEstricta('pull-ups', 'corporal')).toBe(true)
    expect(esDominadaEstricta('chin-ups', 'corporal')).toBe(true)
    expect(esDominadaEstricta('lat-pulldown', 'peso')).toBe(false)
    expect(esDominadaEstricta('assisted-pull-ups', 'asistido')).toBe(false)
    expect(esDominadaAsistida('assisted-pull-ups', 'asistido')).toBe(true)
    expect(esDominadaNegativa('negative-pull-ups')).toBe(true)
  })

  it('hitos guiados con sus fechas', () => {
    const ses = [
      sesion('2026-09-15', [ej('assisted-pull-ups', [serie(-30, 8)], 'asistido')]),
      sesion('2026-09-22', [ej('assisted-pull-ups', [serie(-15, 6)], 'asistido')]),
      sesion('2026-10-01', [ej('negative-pull-ups', [serie(null, 5), serie(null, 5), serie(null, 5)], 'corporal')]),
      sesion('2026-10-08', [ej('pull-ups', [serie(null, 1)], 'corporal')]),
    ]
    const h = hitosDominadas(ses)
    expect(h.hay).toBe(true)
    expect(h.estrictas).toBe(1)
    expect(h.hitos.map(x => x.estado)).toEqual(['hecho', 'hecho', 'hecho', 'actual', 'pendiente'])
    expect(h.hitos.map(x => x.fecha)).toEqual(['2026-09-22', '2026-10-01', '2026-10-08', null, null])
  })

  it('un hito superado cuenta como hecho aunque no se registrara', () => {
    const h = hitosDominadas([sesion('2026-10-08', [ej('pull-ups', [serie(null, 3)], 'corporal')])])
    expect(h.hitos.map(x => x.estado)).toEqual(['hecho', 'hecho', 'hecho', 'hecho', 'actual'])
    expect(h.hitos[0]!.fecha).toBeNull()
    expect(hitosDominadas([]).hay).toBe(false)
  })
})

describe('pasos y mini gráfica', () => {
  it('trote a pasos equivalentes', () => {
    expect(pasosEquivalentes(3, 'km')).toBe(3900)
    expect(pasosEquivalentes(20, 'min')).toBe(3200)
    expect(pasosEquivalentes(-1, 'km')).toBe(0)
    expect(pasosEquivalentes(2.25, 'km')).toBe(2930)
  })
  it('puntos de la sparkline dentro del lienzo', () => {
    const p = puntosSpark([80, 79.5, 79], 120, 40, 4)
    expect(p[0]).toEqual({ x: 4, y: 4 })
    expect(p[2]).toEqual({ x: 116, y: 36 })
    expect(puntosSpark([5])).toEqual([{ x: 60, y: 20 }])
    expect(puntosSpark([])).toEqual([])
  })
})

// ---------- palabras de Progreso y Perfil ----------

describe('veredictos en palabras', () => {
  it('cintura/altura', () => {
    expect(veredictoCinturaAltura(0.45)).toEqual({ palabra: 'saludable', tono: 'ok' })
    expect(veredictoCinturaAltura(0.514).palabra).toBe('un poco por encima de lo saludable')
    expect(veredictoCinturaAltura(0.57).tono).toBe('bad')
    expect(veredictoCinturaAltura(0.65).palabra).toBe('bastante por encima de lo saludable')
    expect(veredictoCinturaAltura(0.38).tono).toBe('warn')
  })
  it('grasa según el sexo', () => {
    expect(veredictoGrasa(20.7, 'hombre').palabra).toBe('normal')
    expect(veredictoGrasa(22, 'mujer').palabra).toBe('en forma')
    expect(veredictoGrasa(30, 'hombre').tono).toBe('bad')
    expect(veredictoGrasa(10, 'hombre').palabra).toBe('de deportista')
  })
  it('IMC', () => {
    expect(veredictoImc(24.5).palabra).toBe('normal')
    expect(veredictoImc(27).palabra).toBe('algo alto')
    expect(veredictoImc(17).tono).toBe('warn')
  })
})

describe('ejeRedondo', () => {
  it('pone números redondos en vez de 91,2 / 88,8', () => {
    const e = ejeRedondo([89.5, 90.4])
    expect(e.marcas.every(m => Number.isInteger(m * 2))).toBe(true)
    expect(e.min).toBeLessThanOrEqual(89.5)
    expect(e.max).toBeGreaterThanOrEqual(90.4)
  })
  it('un solo valor repetido abre un margen redondo', () => {
    const e = ejeRedondo([90, 90])
    expect(e.min).toBe(88)
    expect(e.max).toBe(92)
    expect(e.decimales).toBe(0)
  })
  it('cintura/altura con dos decimales como mucho', () => {
    const e = ejeRedondo([0.498, 0.514, 0.5])
    expect(e.decimales).toBeLessThanOrEqual(2)
    expect(e.min).toBeLessThanOrEqual(0.498)
    expect(e.max).toBeGreaterThanOrEqual(0.514)
  })
  it('kilos de 20 a 27,5', () => {
    const e = ejeRedondo([20, 22.5, 27.5])
    expect(e.paso).toBe(5)
    expect(e.marcas).toEqual([20, 25, 30])
  })
})

describe('cambioDesdeInicio', () => {
  it('primer y último valor', () => {
    expect(cambioDesdeInicio([{ fecha: '2026-10-01', valor: 20 }, { fecha: '2026-10-08', valor: 22.5 }, { fecha: '2026-10-15', valor: 27.5 }]))
      .toEqual({ inicio: 20, ahora: 27.5, delta: 7.5, desde: '2026-10-01' })
    expect(cambioDesdeInicio([])).toBeNull()
  })
})

describe('estado de la semana en curso', () => {
  it('al día con 1 de 3 si solo tocaba 1', () => {
    expect(estadoEntrenos(1, 3, 1)).toEqual({ estado: 'ok', alDia: true })
    expect(estadoEntrenos(0, 3, 0)).toEqual({ estado: 'ok', alDia: true })
    expect(estadoEntrenos(1, 3, 2).estado).toBe('warn')
    expect(estadoEntrenos(0, 3, 2).estado).toBe('bad')
    expect(estadoEntrenos(1, 3).estado).toBe('bad')
    expect(estadoEntrenos(3, 3).estado).toBe('ok')
  })
  it('picoteo nunca en verde si va peor', () => {
    expect(estadoPicoteo(1, 0, true)).toBe('warn')
    expect(estadoPicoteo(0, 0, true)).toBe('ok')
    expect(estadoPicoteo(1, 2, true)).toBe('ok')
    expect(estadoPicoteo(3, 1, true)).toBe('bad')
    expect(estadoPicoteo(2, 3, true)).toBe('warn')
    expect(estadoPicoteo(0, 0, false)).toBe('nada')
  })
  it('frase del semáforo en líneas y con palabras', () => {
    expect(lineasSemaforo({ frase: 'Bien: 1/3 entrenos. A mejorar: proteína baja.', semaforo: 'ambar', entrenos: 1, fijos: 3, esperados: 1, enCurso: true }))
      .toEqual(['Vas al día: 1 de 3 entrenos', 'A mejorar: proteína baja'])
    expect(lineasSemaforo({ frase: '3/3 entrenos, proteína OK, cintura estable.', semaforo: 'verde', entrenos: 3, fijos: 3, enCurso: false }))
      .toEqual(['Entrenos hechos: 3 de 3', 'Bien: proteína, cintura estable'])
    expect(lineasSemaforo({ frase: 'Bien: proteína OK. A mejorar: 0/3 entrenos.', semaforo: 'rojo', entrenos: 0, fijos: 3, esperados: 2, enCurso: true }))
      .toEqual(['Vas con retraso: 0 de 3 entrenos', 'Bien: proteína'])
    expect(lineasSemaforo({ frase: 'A mejorar: 1/3 entrenos, +0,5 cm de cintura.', semaforo: 'rojo', entrenos: 1, fijos: 3, enCurso: false }))
      .toEqual(['Te faltaron entrenos: 1 de 3 entrenos', 'A mejorar: +0,5 cm de cintura'])
  })
})

describe('tendencia del peso', () => {
  it('calcula kg por semana', () => {
    const ms: Medicion[] = [0, 7, 14, 21].map((d, i) => ({ fecha: `2026-09-${String(20 + d > 30 ? 0 : 20 + d).padStart(2, '0')}`, origen: 'casa' as const, pesoKg: 80 - i * 0.3 }))
      .map((m, i) => ({ ...m, fecha: ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11'][i]! }))
    expect(tendenciaPeso(ms, '2026-10-14').kgSemana).toBe(-0.3)
    expect(tendenciaPeso(ms.slice(0, 1), '2026-10-14').kgSemana).toBeNull()
    expect(lineaSpark([80, 79.5, 79.7]).split(' ')).toHaveLength(3)
  })
  const m = (fecha: string, pesoKg?: number): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', pesoKg })
  it('pocas medidas o muy juntas (< 5 días): sin tendencia', () => {
    expect(tendenciaPeso([], '2026-10-13').kgSemana).toBeNull()
    expect(tendenciaPeso([m('2026-10-13', 80)], '2026-10-13').kgSemana).toBeNull()
    expect(tendenciaPeso([m('2026-10-10', 80), m('2026-10-13', 79)], '2026-10-13').kgSemana).toBeNull()
  })
  it('las del futuro, las de hace más de 30 días y las que no tienen peso no cuentan', () => {
    const t = tendenciaPeso([m('2026-08-01', 90), m('2026-10-01', 80), m('2026-10-08', 79.3), m('2026-10-09'), m('2026-10-20', 70)], '2026-10-13')
    expect(t.puntos).toEqual([80, 79.3])
    expect(t.kgSemana).toBe(-0.7)
  })
  it('la línea pequeña: con menos de 2 puntos vacía; con valores iguales, plana', () => {
    expect(lineaSpark([80])).toBe('')
    expect(lineaSpark([80, 80])).toBe('2,4 118,4')
  })
})

describe('sesiones y series', () => {
  const serie = (peso: number | null, reps: number | null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe: 8, calentamiento: false, hecha: true, ...x })
  const ej = (ejercicio: string, series: Serie[], registro: TipoRegistro = 'peso'): EjercicioSesion => ({ uid: ejercicio, ejercicio, planificado: ejercicio, estado: 'hecho', series, repsMin: 6, repsMax: 10, rpe: 8, descanso: 120, registro })
  let n = 1
  const sesion = (fecha: string, ejercicios: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion => ({ id: n++, fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: new Date(`${fecha}T06:00`).getTime(), version: 'normal', estado: 'hecha', ejercicios, calibracion: false, ...x })
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
