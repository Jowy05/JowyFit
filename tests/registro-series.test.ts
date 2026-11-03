// Cómo se apunta una serie más allá del peso y las reps: un lado cada vez (reps de cada pierna o brazo), lastre en
// los de peso corporal y km del cardio con su ritmo. En el entreno, Progreso, el informe y las copias.
import { beforeAll, describe, expect, it } from 'vitest'
import type { EjercicioSesion, Serie, Sesion } from '../src/datos/tipos'
import type { Catalogo, Ejercicio } from '../src/catalogo/tipos'
import { admiteLastre, claseDistancia, conDistancia, porLado } from '../src/catalogo/clasificacion'
import { comoEjercicio } from '../src/catalogo/propios'
import { usarCatalogo } from '../src/catalogo/catalogo'
import { corregirSerie, datosDeCampos, hecha, resumen, TOPE_SERIE, type CamposSerie, type ComoSeApunta } from '../src/dominio/sesion'
import { esRecord, repsVolumen, sugerir, volumen } from '../src/dominio/progresion'
import { ritmo, textoKilos, textoMarca, textoReps, textoSerie, textoSerieEnCurso } from '../src/dominio/formato'
import { logros } from '../src/dominio/tendencias'
import { textoFuerza, textoSerie as textoSerieInforme, unidadFuerza, valorFuerza } from '../src/informe/calculo/comun'
import { calcularInforme } from '../src/informe/calculo/index'
import { crearPdf } from '../src/informe/pdf'
import { validarDatos, versionNecesaria } from '../src/datos/validarCopia'
import { db } from '../src/datos/db'
import { perfilPorDefecto } from '../src/datos/repos'
import { sugerenciaPara } from '../src/datos/consultas'
import { E, entrada, idsDesde, S, SES } from './informe-ejemplo'
import { leerPdf } from '../scripts/leer-pdf.mjs'

const ejer = (id: string, x: Partial<Ejercicio> = {}): Ejercicio => ({
  id, nombre: id, descripcion: '', instrucciones: [], consejos: [], categoria: 'strength', fuerza: 'push', mecanica: 'compound', dificultad: 'beginner',
  material: 'dumbbell', zona: 'upper_legs', principales: [], secundarios: [], objetivos: [], etiquetas: [], unilateral: false, pesoCorporal: false,
  poses: ['main'], met: 3.5, ...x,
})
const serie = (x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 10, reps: 8, rpe: null, calentamiento: false, hecha: true, ...x })
const ejSesion = (x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid: 'a', ejercicio: 'bulgarian-split-squat', planificado: 'bulgarian-split-squat', estado: 'curso', series: [serie({ hecha: false }), serie({ n: 2, hecha: false })],
  repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'mancuerna', ...x,
})
const sesion = (ejercicios: EjercicioSesion[]): Sesion => ({
  fecha: '2026-10-13', rutinaId: null, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 0, version: 'normal', estado: 'curso', calibracion: false, ejercicios,
})
const campos = (x: Partial<CamposSerie> = {}): CamposSerie => ({ peso: 10, reps: 8, segundos: 30, izq: 8, der: 8, separar: false, km: null, ...x })
const como = (x: Partial<ComoSeApunta> = {}): ComoSeApunta => ({ registro: 'mancuerna', conPeso: true, lastre: false, porLado: false, distancia: false, ...x })

describe('qué ejercicios se apuntan por lado, con lastre o con km', () => {
  it('por lado: los unilaterales de RepDB que van por repeticiones; los de tiempo no', () => {
    expect(porLado(ejer('bulgarian-split-squat', { unilateral: true }))).toBe(true)
    expect(porLado(ejer('single-leg-press', { unilateral: true, material: 'leg_press' }))).toBe(true)
    expect(porLado(ejer('side-plank', { unilateral: true, material: null, fuerza: 'static' }))).toBe(false)
    expect(porLado(ejer('bench-press', { material: 'barbell' }))).toBe(false)
  })
  it('por lado: los propios, si el usuario lo dice (y solo con repeticiones)', () => {
    const p = { id: 'mio-1', nombre: 'Zancada en el parque', grupo: 'pierna', material: 'corporal', registro: 'corporal', rutinaAuto: false, creado: '2026-10-20' } as const
    expect(porLado(comoEjercicio({ ...p }))).toBe(false)
    expect(porLado(comoEjercicio({ ...p, unilateral: true }))).toBe(true)
    expect(porLado(comoEjercicio({ ...p, unilateral: true, registro: 'tiempo' }))).toBe(false)
  })
  it('lastre: dominadas y fondos de peso corporal; no las asistidas, las escapulares ni los que ya llevan kilos', () => {
    expect(admiteLastre(ejer('pull-up', { material: 'pull_up_bar' }))).toBe(true)
    expect(admiteLastre(ejer('chin-ups', { material: 'pull_up_bar' }))).toBe(true)
    expect(admiteLastre(ejer('dips', { material: 'dip_station' }))).toBe(true)
    expect(admiteLastre(ejer('ring-dips', { material: 'rings' }))).toBe(true)
    expect(admiteLastre(ejer('scapular-pull-ups', { material: 'pull_up_bar' }))).toBe(false)
    expect(admiteLastre(ejer('assisted-pull-ups', { material: 'assisted_pullup_machine' }))).toBe(false)
    expect(admiteLastre(ejer('weighted-pull-up', { material: 'pull_up_bar' }))).toBe(false) // ya va con kilos
    expect(admiteLastre(ejer('hanging-leg-raise', { material: 'pull_up_bar' }))).toBe(false)
    expect(admiteLastre(ejer('push-up', { material: null }))).toBe(false)
  })
  it('km: el cardio que recorre distancia; el resto no', () => {
    expect(claseDistancia('running')).toBe('pie')
    expect(claseDistancia('stationary-bike')).toBe('rueda')
    expect(claseDistancia('rowing-machine')).toBe('otra')
    expect(claseDistancia('mio-correr')).toBe('otra')
    expect(claseDistancia('jumping-jacks')).toBeNull()
    expect(claseDistancia('__proto__')).toBeNull()
    expect(conDistancia(ejer('walking', { categoria: 'cardio', material: null }))).toBe(true)
    expect(conDistancia(ejer('burpees', { categoria: 'cardio', material: null }))).toBe(false)
    expect(conDistancia(ejer('running'))).toBe(false) // con el id de correr, pero no es cardio
  })
})

describe('lo que se guarda de los contadores', () => {
  it('por lado e igual en los dos: los dos lados con las mismas reps', () => {
    expect(datosDeCampos(campos({ reps: 10 }), como({ porLado: true }))).toEqual({ peso: 10, reps: 10, segundos: null, izq: 10, der: 10 })
  })
  it('cada lado aparte: reps es el lado que menos hizo', () => {
    expect(datosDeCampos(campos({ separar: true, izq: 10, der: 7 }), como({ porLado: true }))).toEqual({ peso: 10, reps: 7, segundos: null, izq: 10, der: 7 })
  })
  it('sin lados, solo reps', () => {
    expect(datosDeCampos(campos({ separar: true, izq: 3, der: 4 }), como())).toEqual({ peso: 10, reps: 8, segundos: null })
  })
  it('lastre: solo en los de peso corporal y solo si es más de 0', () => {
    const corporal = como({ registro: 'corporal', conPeso: false, lastre: true })
    expect(datosDeCampos(campos({ peso: 5 }), corporal).peso).toBe(5)
    expect(datosDeCampos(campos({ peso: null }), corporal).peso).toBeNull()
    expect(datosDeCampos(campos({ peso: 0 }), corporal).peso).toBeNull()
    // Uno ya apuntado se respeta (al corregir un ejercicio que ya no está en el catálogo).
    expect(datosDeCampos(campos({ peso: 5 }), { ...corporal, lastre: false }).peso).toBe(5)
    expect(datosDeCampos(campos({ peso: 5 }), como({ registro: 'cardio', conPeso: false })).peso).toBeNull()
  })
  it('cardio: minutos en reps y los km redondeados, solo si tiene distancia', () => {
    const cardio = como({ registro: 'cardio', conPeso: false, distancia: true })
    expect(datosDeCampos(campos({ reps: 30, km: 5.123 }), cardio)).toEqual({ peso: null, reps: 30, segundos: null, km: 5.12 })
    expect(datosDeCampos(campos({ reps: 30, km: null }), cardio).km).toBeNull()
    expect(datosDeCampos(campos({ reps: 30, km: 5 }), { ...cardio, distancia: false }).km).toBeNull()
  })
  it('tiempo: segundos y nada más', () => {
    expect(datosDeCampos(campos({ segundos: 45 }), como({ registro: 'tiempo', conPeso: false, porLado: true }))).toEqual({ peso: null, reps: null, segundos: 45 })
  })
})

describe('volumen y récords con un lado cada vez', () => {
  it('el volumen suma los dos lados', () => {
    expect(repsVolumen({ reps: 7, izq: 10, der: 7 })).toBe(17)
    expect(repsVolumen({ reps: 8 })).toBe(8)
    expect(repsVolumen({ reps: 8, izq: null, der: null })).toBe(8)
    expect(volumen([serie({ peso: 10, reps: 8, izq: 8, der: 8 }), serie({ peso: 10, reps: 6, izq: 7, der: 6 })])).toBe(10 * 16 + 10 * 13)
  })
  it('el resumen del entreno también (kilos movidos)', () => {
    const s = hecha(sesion([ejSesion()]), 0, { peso: 10, reps: 7, rpe: null, segundos: null, izq: 8, der: 7 }).sesion
    expect(resumen(s).volumen).toBe(150)
  })
  it('las siguientes series heredan peso y reps, no los lados', () => {
    const s = hecha(sesion([ejSesion()]), 0, { peso: 12, reps: 7, rpe: null, segundos: null, izq: 8, der: 7 }).sesion
    const [a, b] = s.ejercicios[0]!.series
    expect(a).toMatchObject({ hecha: true, peso: 12, reps: 7, izq: 8, der: 7 })
    expect(b).toMatchObject({ hecha: false, peso: 12 })
    expect(b!.izq).toBeUndefined()
  })
  it('el récord mira el lado que menos hizo', () => {
    const antes = [serie({ peso: 10, reps: 8, izq: 8, der: 8 })]
    expect(esRecord(serie({ peso: 10, reps: 8, izq: 10, der: 8 }), antes)).toBeNull()
    expect(esRecord(serie({ peso: 10, reps: 9, izq: 10, der: 9 }), antes)?.tipo).toBe('reps')
  })
  it('la progresión no sube si un lado se quedó corto', () => {
    const ultimas = [serie({ peso: 10, reps: 9, izq: 12, der: 9 }), serie({ peso: 10, reps: 12, izq: 12, der: 12 })]
    expect(sugerir(ultimas, { repsMin: 8, repsMax: 12, rpe: 8 }, 'mancuerna', [8, 10, 12]).accion).not.toBe('subir')
  })
  it('corregir: los lados se cambian o se quitan, y los km igual', () => {
    const s = hecha(sesion([ejSesion()]), 0, { peso: 10, reps: 7, rpe: null, segundos: null, izq: 8, der: 7 }).sesion
    const otra = corregirSerie(s, 0, 0, { peso: 10, reps: 9, segundos: null, izq: 9, der: 9 })
    expect(otra.ejercicios[0]!.series[0]).toMatchObject({ reps: 9, izq: 9, der: 9 })
    const sin = corregirSerie(s, 0, 0, { peso: 10, reps: 9, segundos: null })
    expect(sin.ejercicios[0]!.series[0]).not.toHaveProperty('izq')
    expect(sin.ejercicios[0]!.series[0]).not.toHaveProperty('der')
  })
})

describe('textos de las series', () => {
  it('reps por lado y cada lado distinto', () => {
    expect(textoReps({ reps: 8 })).toBe('8')
    expect(textoReps({ reps: 8 }, true)).toBe('8 por lado')
    expect(textoReps({ reps: 8, izq: 8, der: 8 })).toBe('8 por lado')
    expect(textoReps({ reps: 7, izq: 8, der: 7 })).toBe('8 izq. · 7 der.')
  })
  it('una serie hecha, en tabla y en corto', () => {
    const lados = serie({ peso: 10, reps: 7, izq: 8, der: 7 })
    expect(textoSerie(lados, 'mancuerna', 'tabla')).toBe('10 × 8 izq. · 7 der.')
    expect(textoSerie(lados, 'mancuerna', 'corto')).toBe('10 kg × 8 izq. · 7 der.')
    expect(textoSerie(serie({ peso: null, reps: 12, izq: 12, der: 12 }), 'corporal', 'corto')).toBe('12 por lado')
    expect(textoSerie(serie({ peso: 5, reps: 6 }), 'corporal', 'tabla')).toBe('lastre 5 × 6')
    expect(textoSerie(serie({ peso: 5, reps: 6 }), 'corporal', 'corto')).toBe('lastre 5 kg × 6')
    expect(textoSerie(serie({ peso: null, reps: 6 }), 'corporal', 'corto')).toBe('6 reps')
    expect(textoSerie(serie({ peso: null, reps: 30, km: 5 }), 'cardio', 'corto', 'running')).toBe('30 min · 5 km')
    expect(textoSerie(serie({ peso: null, reps: 30, km: 5 }), 'cardio', 'tabla', 'running')).toBe('30 min · 5 km · 6:00 min/km')
    expect(textoSerie(serie({ peso: null, reps: 60, km: 20 }), 'cardio', 'tabla', 'cycling')).toBe('60 min · 20 km · 20 km/h')
    expect(textoSerie(serie({ peso: null, reps: 10, km: 2 }), 'cardio', 'tabla', 'rowing-machine')).toBe('10 min · 2 km')
    expect(textoSerie(serie({ peso: null, reps: 30 }), 'cardio', 'tabla', 'running')).toBe('30 min')
  })
  it('en la lista del entreno: el objetivo por lado, el lastre y el cardio en minutos', () => {
    const e = ejSesion()
    expect(textoSerieEnCurso(serie({ hecha: false }), e, true)).toBe('10 kg × 8-12 por lado')
    expect(textoSerieEnCurso(serie({ reps: 7, izq: 8, der: 7 }), e, true)).toBe('10 kg × 8 izq. · 7 der.')
    const dominadas = ejSesion({ ejercicio: 'pull-up', registro: 'corporal' })
    expect(textoSerieEnCurso(serie({ hecha: false, peso: 5 }), dominadas)).toBe('lastre 5 kg × 8-12')
    expect(textoSerieEnCurso(serie({ hecha: false, peso: null }), dominadas)).toBe('8-12 reps')
    const cinta = ejSesion({ ejercicio: 'treadmill-running', registro: 'cardio', repsMin: 20, repsMax: 30 })
    expect(textoSerieEnCurso(serie({ hecha: false, peso: null }), cinta)).toBe('20-30 min')
    expect(textoSerieEnCurso(serie({ peso: null, reps: 25, km: 4 }), cinta)).toBe('25 min · 4 km')
  })
  it('las marcas (récords) dicen si es lastre o por lado', () => {
    expect(textoMarca({ peso: 47.5, reps: 8 })).toBe('47,5 kg × 8')
    expect(textoMarca({ peso: 5, reps: 8, lastre: true })).toBe('lastre 5 kg × 8')
    expect(textoMarca({ peso: 10, reps: 8, porLado: true })).toBe('10 kg × 8 por lado')
    expect(textoKilos(5, 'corporal')).toBe('lastre 5 kg')
    expect(textoKilos(47.5, 'peso')).toBe('47,5 kg')
  })
  it('el ritmo: andando o corriendo en min/km, en bici en km/h; sin sentido, nada', () => {
    expect(ritmo(30, 5, 'pie')).toBe('6:00 min/km')
    expect(ritmo(32, 5, 'pie')).toBe('6:24 min/km')
    expect(ritmo(45, 15, 'rueda')).toBe('20 km/h')
    expect(ritmo(10, 2, 'otra')).toBeNull()
    expect(ritmo(30, 0, 'pie')).toBeNull()
    expect(ritmo(0, 5, 'pie')).toBeNull()
    expect(ritmo(30, null, 'pie')).toBeNull()
    expect(ritmo(600, 0.1, 'pie')).toBeNull() // más de una hora por km: un km mal apuntado
  })
})

describe('Progreso: récords con lastre y por lado', () => {
  it('logros marca el lastre (peso corporal) y las reps por lado', () => {
    idsDesde(9000)
    const s = [
      SES('2026-10-06', [E('dips', [S(5, 8)], { registro: 'corporal' }), E('bulgarian-split-squat', [S(10, 8, null, { izq: 8, der: 8 })], { registro: 'mancuerna' })]),
      SES('2026-10-08', [E('dips', [S(10, 8, null, { record: true })], { registro: 'corporal' }), E('bulgarian-split-squat', [S(12, 8, null, { izq: 9, der: 8, record: true })], { registro: 'mancuerna' })]),
    ]
    const l = logros(s)
    expect(l.find(x => x.ejercicio === 'dips')).toMatchObject({ tipo: 'peso', peso: 10, lastre: true })
    expect(l.find(x => x.ejercicio === 'dips')!.porLado).toBeUndefined()
    expect(l.find(x => x.ejercicio === 'bulgarian-split-squat')).toMatchObject({ tipo: 'peso', peso: 12, porLado: true })
    expect(l.find(x => x.ejercicio === 'bulgarian-split-squat')!.lastre).toBeUndefined()
  })
})

describe('informe en PDF', () => {
  idsDesde(9100)
  const sesiones = [
    SES('2026-10-14', [
      E('dips', [S(null, 10), S(5, 8)], { registro: 'corporal' }),
      E('bulgarian-split-squat', [S(10, 7, 8, { izq: 8, der: 7 })], { registro: 'mancuerna' }),
      E('running', [S(null, 30, null, { km: 5 })], { registro: 'cardio' }),
    ]),
    SES('2026-10-15', [E('dips', [S(7.5, 8, null, { record: true })], { registro: 'corporal' })]),
  ]
  it('la unidad de los de peso corporal con lastre es «lastre» y cuenta solo los días con él', () => {
    expect(unidadFuerza(sesiones, 'dips')).toBe('lastre')
    expect(unidadFuerza(sesiones, 'bulgarian-split-squat')).toBe('kg')
    expect(valorFuerza(sesiones[0]!.ejercicios[0]!.series, 'lastre')).toBe(5)
    expect(valorFuerza([S(null, 10)], 'lastre')).toBeNull()
    expect(textoFuerza(7.5, 'lastre')).toBe('lastre 7,5 kg')
    expect(textoSerieInforme(sesiones[0]!.ejercicios[0]!.series, 'lastre')).toBe('lastre 5 kg × 8')
    expect(textoSerieInforme(sesiones[0]!.ejercicios[1]!.series, 'kg')).toBe('10 kg × 7 por lado')
  })
  it('el detalle lleva los lados, los km y el ritmo; las mejores series no ponen 1RM al lastre', () => {
    const inf = calcularInforme(entrada({ sesiones, periodo: 'semana', secciones: { detalle: true } }))
    const d = inf.detalleEntrenos!.find(x => x.fecha === '2026-10-14')!
    expect(d.ejercicios[0]!.registro).toBe('corporal')
    expect(d.ejercicios[1]!.series[0]).toMatchObject({ porLado: true, izq: 8, der: 7 })
    expect(d.ejercicios[2]!.series[0]).toMatchObject({ km: 5, ritmo: '6:00 min/km' })
    expect(inf.fuerza!.mejores.map(m => m.id)).not.toContain('dips')
    expect(inf.fuerza!.ejercicios.find(g => g.id === 'dips')).toMatchObject({ unidad: 'lastre' })
  })
  it('el PDF sale y dice lastre, los lados y los km', async () => {
    const inf = calcularInforme(entrada({ sesiones, periodo: 'semana', secciones: { detalle: true } }))
    const pdf = await leerPdf(await crearPdf(inf, { version: '9.9.9', creado: new Date('2026-10-20T22:30:00') }))
    expect(pdf.texto).toContain('lastre 5 kg')
    expect(pdf.texto).toContain('8 izq. · 7 der.')
    expect(pdf.texto).toContain('5 km · 6:00 min/km')
    expect(pdf.texto).toContain('30 min')
  })
})

describe('copias', () => {
  const base = { perfil: [{ ...perfilPorDefecto(), altaCompleta: true, objetivo: 'fuerza' }] }
  const conSerie = (x: Record<string, unknown>) => ({
    ...base,
    sesiones: [{ fecha: '2026-10-13', rutinaId: null, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 1, version: 'normal', estado: 'hecha', calibracion: false,
      ejercicios: [{ uid: 'a', ejercicio: 'x', planificado: 'x', estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'mancuerna',
        series: [{ n: 1, peso: 10, reps: 7, rpe: null, calentamiento: false, hecha: true, ...x }] }] }],
  })
  const serieDe = (datos: Record<string, unknown[]>) => {
    const { tablas } = validarDatos(datos)
    return ((tablas.sesiones as Sesion[])[0]!.ejercicios[0]!.series[0]!)
  }
  it('los lados y los km se guardan; con números absurdos, al tope', () => {
    expect(serieDe(conSerie({ izq: 8, der: 7, km: 2.5 }))).toMatchObject({ izq: 8, der: 7, km: 2.5 })
    expect(serieDe(conSerie({ izq: 1e300, der: null, km: 1e9 }))).toMatchObject({ izq: TOPE_SERIE.reps, der: null, km: TOPE_SERIE.km })
    expect(() => validarDatos(conSerie({ km: 'cinco' }))).toThrow()
  })
  it('una app anterior pide actualizar si hay lados, km o propios de un lado', () => {
    expect(versionNecesaria(conSerie({}))).toBeLessThan(4)
    expect(versionNecesaria(conSerie({ izq: 8, der: 7 }))).toBe(4)
    expect(versionNecesaria(conSerie({ km: 3 }))).toBe(4)
    const propio = { id: 'mio-1', nombre: 'Zancada', grupo: 'pierna', material: 'corporal', registro: 'corporal', rutinaAuto: false, creado: '2026-10-20' }
    expect(versionNecesaria({ ...base, propios: [propio] })).toBe(2)
    expect(versionNecesaria({ ...base, propios: [{ ...propio, unilateral: true }] })).toBe(4)
    // El lastre no hace falta: una app anterior lo guarda igual (es el peso de la serie).
    expect(versionNecesaria(conSerie({ peso: 5 }))).toBeLessThan(4)
  })
})

describe('lastre al sugerir el peso de hoy', () => {
  const catalogo: Catalogo = {
    fuente: 'RepDB', version: 1, generado: '', etiquetas: {}, musculos: {}, material: {},
    ejercicios: [ejer('dips', { material: 'dip_station', zona: 'chest' }), ejer('pull-up', { material: 'pull_up_bar', zona: 'back', fuerza: 'pull' })],
  }
  const hechaCon = (id: string, registro: EjercicioSesion['registro'], peso: number | null, inicio: number): Sesion => ({
    ...sesion([{ ...ejSesion({ ejercicio: id, planificado: id, registro, estado: 'hecho' }), series: [serie({ peso, reps: 8 })] }]), estado: 'hecha', inicio,
  })
  beforeAll(async () => {
    usarCatalogo(catalogo)
    await db.sesiones.bulkAdd([hechaCon('dips', 'corporal', 10, 1), hechaCon('pull-up', 'peso', 40, 2)])
  })
  it('el lastre de la última vez pasa a hoy', async () => {
    expect((await sugerenciaPara('dips', { repsMin: 8, repsMax: 12, rpe: 8 })).peso).toBe(10)
  })
  it('los kilos de un día apuntado «con peso» no pasan como lastre', async () => {
    expect((await sugerenciaPara('pull-up', { repsMin: 8, repsMax: 12, rpe: 8 })).peso).toBeNull()
  })
})
