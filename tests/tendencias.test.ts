import { describe, expect, it } from 'vitest'
import type { Comida, EjercicioSesion, Medicion, Serie, Sesion, TipoRegistro } from '../src/datos/tipos'
import {
  datosQuincena, ejerciciosHechos, esDominadaAsistida, esDominadaEstricta, esDominadaNegativa, evolucion, faltaMeta, grasaPorMedidas,
  hitosDominadas, logros, mediasSemanales, mejor1RM, pasosEquivalentes, pendienteSemanal, pesoMaximo, progresoMeta, puntosSpark,
  recordsEn, repsMaximas, serieMedida, seriesPorGrupo, subidas, ultimoValor,
} from '../src/dominio/tendencias'

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
