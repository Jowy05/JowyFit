import { describe, expect, it } from 'vitest'
import { fechaLocal, grasaTardia, juntarBascula, lecturasNuevas, medicionDeLectura, nombreFuente } from '../src/dominio/bascula'
import type { Medicion } from '../src/datos/tipos'

const iso = (s: string) => new Date(s).toISOString()

describe('báscula por Health Connect', () => {
  it('junta el peso y la grasa de la misma pesada', () => {
    const l = juntarBascula(
      [{ fecha: iso('2026-10-13T08:00:00'), valor: 79.12, id: 'p1', fuente: 'Fitdays' }, { fecha: iso('2026-10-15T08:30:00'), valor: 78.6, id: 'p2' }],
      [{ fecha: iso('2026-10-13T08:00:20'), valor: 24.2, id: 'g1' }, { fecha: iso('2026-10-14T09:00:00'), valor: 24.0, id: 'g2' }],
    )
    expect(l).toHaveLength(3)
    expect(l[0]).toMatchObject({ pesoKg: 79.1, grasaPct: 24.2, ids: ['p1', 'g1'], fuente: 'Fitdays' })
    // Grasa sin peso cerca: va sola.
    expect(l[1]).toMatchObject({ grasaPct: 24, ids: ['g2'] })
    expect(l[1]!.pesoKg).toBeUndefined()
    expect(l[2]).toMatchObject({ pesoKg: 78.6 })
  })
  it('descarta valores imposibles', () => {
    expect(juntarBascula([{ fecha: iso('2026-10-13T08:00:00'), valor: 0.5 }], [{ fecha: iso('2026-10-13T08:00:00'), valor: 0.24 }])).toHaveLength(0)
  })
  it('no trae dos veces lo mismo ni lo que ya apuntaste a mano ese día', () => {
    const l = juntarBascula(
      [{ fecha: iso('2026-10-13T08:00:00'), valor: 79.1, id: 'p1' }, { fecha: iso('2026-10-14T08:00:00'), valor: 78.9, id: 'p2' }, { fecha: iso('2026-10-15T08:00:00'), valor: 78.7, id: 'p3' }],
      [],
    )
    const ya: Medicion[] = [
      { fecha: '2026-10-13T08:00', origen: 'casa', pesoKg: 79.1, hc: ['p1'] },
      { fecha: '2026-10-14T07:55', origen: 'casa', pesoKg: 78.9 },
    ]
    expect(lecturasNuevas(l, ya).map(x => x.ids[0])).toEqual(['p3'])
  })
  it('la guarda como báscula de casa con su hora local', () => {
    const m = medicionDeLectura({ fecha: iso('2026-10-13T08:05:00'), pesoKg: 79.1, grasaPct: 24.2, ids: ['p1', 'g1'], fuente: 'Fitdays' })
    expect(m).toEqual({ fecha: '2026-10-13T08:05', origen: 'casa', pesoKg: 79.1, bascula: { grasaPct: 24.2 }, hc: ['p1', 'g1'], fuente: 'Fitdays' })
    expect(fechaLocal(iso('2026-10-13T23:59:00'))).toBe('2026-10-13T23:59')
  })
  it('dice de qué app viene con un nombre que se entiende', () => {
    expect(nombreFuente('com.garmin.android.apps.connectmobile')).toBe('Garmin Connect')
    expect(nombreFuente('com.fitdays.fitdays')).toBe('Fitdays')
    expect(nombreFuente('com.ejemplo.balanza')).toBe('Balanza')
    expect(nombreFuente('Mi báscula')).toBe('Mi báscula')
    expect(nombreFuente(undefined)).toBe('tu báscula')
  })
  it('lo borrado en la app no se vuelve a traer', () => {
    const l = juntarBascula([{ fecha: iso('2026-10-15T08:00:00'), valor: 92, id: 'p9' }], [])
    expect(lecturasNuevas(l, [], ['p9'])).toHaveLength(0)
    expect(lecturasNuevas(l, [])).toHaveLength(1)
  })
  it('la grasa que llega después se añade a su pesada', () => {
    const l = juntarBascula([{ fecha: iso('2026-10-13T08:00:00'), valor: 79.1, id: 'p1' }], [{ fecha: iso('2026-10-13T08:00:30'), valor: 24.2, id: 'g1' }])
    const ya: Medicion[] = [{ id: 7, fecha: '2026-10-13T08:00', origen: 'casa', pesoKg: 79.1, hc: ['p1'] }]
    expect(lecturasNuevas(l, ya)).toHaveLength(0)
    expect(grasaTardia(l, ya)).toEqual([{ id: 7, grasaPct: 24.2, ids: ['g1'] }])
    // Si ya tenía grasa, no se toca.
    expect(grasaTardia(l, [{ ...ya[0]!, bascula: { grasaPct: 24 } }])).toEqual([])
  })
  it('la misma pesada escrita por dos apps cuenta una vez', () => {
    const l = juntarBascula([{ fecha: iso('2026-10-13T08:00:00'), valor: 79.1, id: 'a' }, { fecha: iso('2026-10-13T08:00:05'), valor: 79.1, id: 'b' }], [])
    expect(l).toHaveLength(1)
    expect(l[0]!.ids).toEqual(['a', 'b'])
  })
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
