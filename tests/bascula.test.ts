import { describe, expect, it } from 'vitest'
import { fechaLocal, juntarBascula, lecturasNuevas, medicionDeLectura, nombreFuente } from '../src/dominio/bascula'
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
})
