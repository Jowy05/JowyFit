// Celebraciones de Inicio: cuándo se celebra (primer entreno, récord, semana completa, meta), que cada una salga una
// sola vez y que la primera vez con esta versión no se celebre de golpe lo de antes.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anotarCelebradas, celebracionesPosibles, celebracionQueToca, MAX_CELEBRADAS, type Celebracion } from '../src/dominio/celebraciones'
import { tomarCelebracion } from '../src/datos/acciones/celebraciones'
import { TABLAS, db } from '../src/datos/db'
import { guardarAjustes, leerAjustes } from '../src/datos/repos'
import type { Serie, Sesion } from '../src/datos/tipos'

const HOY = '2026-11-04' // miércoles; la semana va del lunes 2 al domingo 8

let n = 0
const serie = (x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 40, reps: 10, rpe: null, calentamiento: false, hecha: true, ...x })
const sesion = (fecha: string, series: Serie[] = [serie()], x: Partial<Sesion> = {}): Sesion => ({
  fecha, rutinaId: 1, letra: 'A', nombre: 'Cuerpo completo A', gimnasioId: null, inicio: Date.parse(`${fecha}T06:00:00`) + n++, fin: Date.parse(`${fecha}T07:00:00`),
  version: 'normal', estado: 'hecha', calibracion: false,
  ejercicios: [{ uid: 'b1', ejercicio: 'bench-press', planificado: 'bench-press', estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', series }],
  ...x,
})
const posibles = (x: Partial<Parameters<typeof celebracionesPosibles>[0]> = {}) =>
  celebracionesPosibles({ hoy: HOY, sesiones: [], fijos: 3, metas: [], nombre: id => (id === 'bench-press' ? 'Press de banca' : id), ...x })
const tipos = (l: Celebracion[]) => l.map(c => c.tipo)

describe('qué se puede celebrar', () => {
  it('nada sin entrenos ni metas', () => {
    expect(posibles()).toEqual([])
  })

  it('el primer entreno, solo si es el único y es reciente', () => {
    expect(tipos(posibles({ sesiones: [sesion('2026-11-03')] }))).toEqual(['primer-entreno'])
    expect(tipos(posibles({ sesiones: [sesion('2026-10-20')] }))).toEqual([])
    expect(tipos(posibles({ sesiones: [sesion('2026-11-02'), sesion('2026-11-03')] }))).toEqual([])
    // Las canceladas y las en curso no cuentan.
    expect(tipos(posibles({ sesiones: [sesion('2026-11-03', undefined, { estado: 'cancelada' })] }))).toEqual([])
  })

  it('un récord del último entreno reciente, con el ejercicio y el peso', () => {
    const l = posibles({ sesiones: [sesion('2026-10-28'), sesion('2026-11-03', [serie({ peso: 60, reps: 8, record: true })])] })
    expect(tipos(l)).toEqual(['record'])
    expect(l[0]!.texto).toBe('En press de banca: 60 kg × 8.')
    // Varios récords en el mismo entreno: uno solo, que los cuenta.
    const varios = posibles({ sesiones: [sesion('2026-10-28'), sesion('2026-11-04', [serie({ record: true }), serie({ n: 2, record: true })])] })
    expect(varios[0]!.texto).toBe('2 récords en tu último entreno, entre ellos press de banca.')
  })

  it('solo el último entreno de verdad: si después hubo otro sin récords, no se celebra el de antes', () => {
    const ayer = sesion('2026-11-03', [serie({ record: true }), serie({ n: 2, record: true })])
    expect(tipos(posibles({ sesiones: [ayer, sesion('2026-11-04')] }))).toEqual([])
  })

  it('el récord conserva el lastre y las repeticiones por lado al integrar las versiones', () => {
    const nuevo = sesion('2026-11-03', [serie({ peso: 5, reps: 7, izq: 8, der: 7, record: true })])
    nuevo.ejercicios[0]!.registro = 'corporal'
    const record = posibles({ sesiones: [sesion('2026-10-28'), nuevo] }).find(c => c.tipo === 'record')!
    expect(record.texto).toContain('lastre 5 kg × 7')
    expect(record.texto).toContain('por lado')
  })

  it('un récord viejo, de calentamiento o de una serie sin hacer no se celebra', () => {
    expect(tipos(posibles({ sesiones: [sesion('2026-10-20'), sesion('2026-10-30', [serie({ record: true })])] }))).toEqual([])
    expect(tipos(posibles({ sesiones: [sesion('2026-10-20'), sesion('2026-11-04', [serie({ record: true, calentamiento: true })])] }))).toEqual([])
    expect(tipos(posibles({ sesiones: [sesion('2026-10-20'), sesion('2026-11-04', [serie({ record: true, hecha: false })])] }))).toEqual([])
  })

  it('la semana completa con tantos días entrenados como días fijos (dos el mismo día cuentan uno)', () => {
    const tres = [sesion('2026-10-30'), sesion('2026-11-02'), sesion('2026-11-03'), sesion('2026-11-04')]
    const l = posibles({ sesiones: tres })
    expect(tipos(l)).toEqual(['semana'])
    expect(l[0]!.clave).toBe('semana:2026-11-02')
    expect(l[0]!.texto).toBe('Has hecho los 3 entrenos de esta semana.')
    expect(tipos(posibles({ sesiones: [sesion('2026-10-30'), sesion('2026-11-02'), sesion('2026-11-02'), sesion('2026-11-03')] }))).toEqual([])
    // Sin rutina no hay semana que completar.
    expect(tipos(posibles({ sesiones: tres, fijos: 0 }))).toEqual([])
  })

  it('cada meta conseguida, con su título', () => {
    const l = posibles({ metas: [{ id: 1, titulo: 'Cintura < 88 cm', conseguida: true }, { id: 2, titulo: 'Peso: 75 kg', conseguida: false }] })
    expect(l).toMatchObject([{ clave: 'meta:1', tipo: 'meta', texto: 'Cintura < 88 cm' }])
  })

  it('en orden de importancia: primer entreno, meta, semana y récord', () => {
    const l = posibles({ sesiones: [sesion('2026-11-04', [serie({ record: true })])], fijos: 1, metas: [{ id: 3, titulo: 'X', conseguida: true }] })
    expect(tipos(l)).toEqual(['primer-entreno', 'meta', 'semana', 'record'])
  })
})

describe('cuál sale', () => {
  const [primero, semana] = posibles({ sesiones: [sesion('2026-11-04')], fijos: 1 })

  it('la primera vez no sale nada y lo que había queda visto', () => {
    expect(celebracionQueToca([primero!, semana!], null)).toEqual({ mostrar: null, marcar: ['primer-entreno', 'semana:2026-11-02'] })
  })
  it('sale la más importante de las nuevas y todas quedan vistas', () => {
    expect(celebracionQueToca([primero!, semana!], [])).toEqual({ mostrar: primero, marcar: ['primer-entreno', 'semana:2026-11-02'] })
    expect(celebracionQueToca([primero!, semana!], ['primer-entreno'])).toEqual({ mostrar: semana, marcar: ['semana:2026-11-02'] })
    expect(celebracionQueToca([primero!, semana!], ['primer-entreno', 'semana:2026-11-02'])).toEqual({ mostrar: null, marcar: [] })
  })
  it('las vistas no se repiten y se quedan las más recientes', () => {
    expect(anotarCelebradas(['a', 'b'], ['b', 'c', 'c'])).toEqual(['a', 'b', 'c'])
    const muchas = Array.from({ length: MAX_CELEBRADAS }, (_, i) => `meta:${i}`)
    const l = anotarCelebradas(muchas, ['primer-entreno'])
    expect(l).toHaveLength(MAX_CELEBRADAS)
    expect(l.at(-1)).toBe('primer-entreno')
    expect(l[0]).toBe('meta:1')
  })
  it('una meta ya vista no vuelve a salir aunque luego se vean muchos récords y semanas', () => {
    const meta: Celebracion = { clave: 'meta:1', tipo: 'meta', titulo: '¡Meta conseguida!', texto: 'X' }
    let vistas: string[] | null = anotarCelebradas([], ['meta:1'])
    // Más de MAX_CELEBRADAS entrenos con récord, con la meta todavía conseguida (vigente) en cada uno.
    for (let i = 0; i < MAX_CELEBRADAS + 20; i++) {
      const record: Celebracion = { clave: `record:${i}`, tipo: 'record', titulo: '', texto: '' }
      const { marcar } = celebracionQueToca([meta, record], vistas)
      vistas = anotarCelebradas(vistas, marcar, [meta.clave, record.clave])
    }
    expect(vistas).toHaveLength(MAX_CELEBRADAS)
    expect(vistas).toContain('meta:1')
    expect(celebracionQueToca([meta], vistas).mostrar).toBeNull()
  })
  it('las vigentes ya vistas pasan al final; las que no se habían visto no se cuelan', () => {
    expect(anotarCelebradas(['meta:1', 'a', 'b'], [], ['meta:1', 'nueva'])).toEqual(['a', 'b', 'meta:1'])
    expect(anotarCelebradas(['meta:1', 'a'], ['c'], ['meta:1', 'c'])).toEqual(['a', 'meta:1', 'c'])
  })
})

describe('tomarCelebracion (IndexedDB simulada)', () => {
  beforeEach(async () => { for (const t of TABLAS) await db.table(t).clear() })

  it('sin nada guardado apunta lo de antes sin enseñarlo; luego cada una sale una sola vez', async () => {
    const antes = posibles({ sesiones: [sesion('2026-11-03')] })
    expect(await tomarCelebracion(antes)).toBeNull()
    expect((await leerAjustes()).celebradas).toEqual(['primer-entreno'])
    expect(await tomarCelebracion(antes)).toBeNull()

    const meta = posibles({ metas: [{ id: 7, titulo: 'Peso: 75 kg', conseguida: true }] })
    expect((await tomarCelebracion(meta))?.clave).toBe('meta:7')
    expect(await tomarCelebracion(meta)).toBeNull()
    expect((await leerAjustes()).celebradas).toEqual(['primer-entreno', 'meta:7'])
  })

  it('una cuenta nueva (sin nada que celebrar aún) celebra su primer entreno', async () => {
    expect(await tomarCelebracion([])).toBeNull()
    expect((await leerAjustes()).celebradas).toEqual([])
    expect((await tomarCelebracion(posibles({ sesiones: [sesion('2026-11-04')] })))?.tipo).toBe('primer-entreno')
  })

  it('una meta vista sube al final de la lista sin volver a salir; si nada cambia, no se escribe', async () => {
    await guardarAjustes({ celebradas: ['meta:7', 'semana:2026-10-26'] })
    const meta = posibles({ metas: [{ id: 7, titulo: 'Peso: 75 kg', conseguida: true }] })
    expect(await tomarCelebracion(meta)).toBeNull()
    expect((await leerAjustes()).celebradas).toEqual(['semana:2026-10-26', 'meta:7'])
    const put = vi.spyOn(db.ajustes, 'put')
    expect(await tomarCelebracion(meta)).toBeNull()
    expect(put).not.toHaveBeenCalled()
    put.mockRestore()
  })

  it('dos a la vez no enseñan la misma dos veces', async () => {
    await guardarAjustes({ celebradas: [] })
    const l = posibles({ metas: [{ id: 1, titulo: 'X', conseguida: true }] })
    const [a, b] = await Promise.all([tomarCelebracion(l), tomarCelebracion(l)])
    expect([a, b].filter(Boolean)).toHaveLength(1)
  })
})
