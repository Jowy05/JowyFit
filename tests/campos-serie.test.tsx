// @vitest-environment jsdom
// Contadores de una serie: al tocar «Añadir lastre» o «Un lado ha salido distinto», el botón desaparece y sale otro
// control en su sitio. El foco tiene que ir a ese control nuevo (si no, se pierde y TalkBack no dice nada).
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { EjercicioSesion } from '../src/datos/tipos'
import type { CamposSerie as Campos, ComoSeApunta } from '../src/dominio/sesion'
import { CamposSerie, camposDe } from '../src/pantallas/entreno/CamposSerie'

afterEach(cleanup)

const ej = (x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid: 'a', ejercicio: 'pull-up', planificado: 'pull-up', estado: 'curso', series: [], repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'corporal', ...x,
})
const como = (x: Partial<ComoSeApunta> = {}): ComoSeApunta => ({ registro: 'corporal', conPeso: false, lastre: false, porLado: false, distancia: false, ...x })

/** CamposSerie con su estado, como en el panel del entreno. */
function Prueba({ e, c }: { e: EjercicioSesion; c: ComoSeApunta }) {
  const [v, setV] = useState<Campos>({ peso: null, reps: 8, segundos: 30, izq: 8, der: 8, separar: false, km: null })
  return <CamposSerie e={e} como={c} lista={[]} v={v} cambiar={x => setV(y => ({ ...y, ...x }))} />
}

const dentroDe = (etiqueta: string) => screen.getByRole('group', { name: etiqueta }).contains(document.activeElement)

describe('el foco al cambiar los contadores', () => {
  it('«Añadir lastre» lleva al contador del lastre, y bajarlo a 0 devuelve al enlace', () => {
    render(<Prueba e={ej()} c={como({ lastre: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir lastre' }))
    expect(dentroDe('Lastre')).toBe(true)
    // De 2,5 a 0: se quita el lastre.
    fireEvent.click(screen.getByRole('group', { name: 'Lastre' }).querySelector('button')!)
    expect(screen.queryByRole('group', { name: 'Lastre' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Añadir lastre' }))
  })
  it('un lado distinto lleva a «Izquierda», e igual en los dos vuelve a las repeticiones', () => {
    render(<Prueba e={ej({ ejercicio: 'bulgarian-split-squat', registro: 'mancuerna' })} c={como({ registro: 'mancuerna', porLado: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Un lado ha salido distinto' }))
    expect(dentroDe('Repeticiones con el lado izquierdo')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Igual en los dos lados' }))
    expect(dentroDe('Repeticiones')).toBe(true)
  })
})

describe('corregir una serie', () => {
  const cardio = { uid: 'c', ejercicio: 'cinta', planificado: 'cinta', estado: 'hecho', series: [], repsMin: 20, repsMax: 30, rpe: 7, descanso: 0, registro: 'cardio' } as EjercicioSesion
  it('un cardio antiguo guardado en segundos arranca con sus minutos, no con el objetivo', () => {
    expect(camposDe({ n: 1, peso: null, reps: null, segundos: 1800, rpe: null, calentamiento: false, hecha: true }, cardio).reps).toBe(30)
    expect(camposDe({ n: 1, peso: null, reps: 25, rpe: null, calentamiento: false, hecha: true }, cardio).reps).toBe(25)
    expect(camposDe({ n: 1, peso: null, reps: null, rpe: null, calentamiento: false, hecha: false }, cardio).reps).toBe(20)
  })
})
