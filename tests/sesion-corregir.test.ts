import { describe, expect, it } from 'vitest'
import { corregirSerie, crearSesion, hecha } from '../src/dominio/sesion'
import type { Bloque } from '../src/datos/tipos'

const bloque = (id: string): Bloque => ({ uid: id, ejercicio: id, alternativas: [], series: 3, repsMin: 6, repsMax: 10, rpe: 7, descanso: 90, registro: 'peso' })
const nueva = () => crearSesion({ letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques: [bloque('a'), bloque('b')] }, { rutinaId: 1, gimnasioId: null, version: 'normal', calibracion: false, ahora: 0 })

describe('corregir una serie ya hecha', () => {
  it('cambia peso y reps de la serie hecha sin tocar el resto de la sesión', () => {
    const s = hecha(nueva(), 0, { peso: 20, reps: 6, rpe: null, segundos: null }).sesion
    const c = corregirSerie(s, 0, 0, { peso: 22.5, reps: 9, segundos: null })
    expect(c.ejercicios[0]!.series[0]).toMatchObject({ peso: 22.5, reps: 9, hecha: true })
    // La original no cambia (operación pura).
    expect(s.ejercicios[0]!.series[0]).toMatchObject({ peso: 20, reps: 6 })
    expect(c.ejercicios[1]).toEqual(s.ejercicios[1])
  })

  it('las series siguientes que heredaron el peso equivocado pasan al corregido; las tocadas a mano, no', () => {
    let s = hecha(nueva(), 0, { peso: 20, reps: 6, rpe: null, segundos: null }).sesion
    s.ejercicios[0]!.series[2]!.peso = 30
    s = corregirSerie(s, 0, 0, { peso: 25, reps: 8, segundos: null })
    expect(s.ejercicios[0]!.series[1]!.peso).toBe(25)
    expect(s.ejercicios[0]!.series[2]!.peso).toBe(30)
  })

  it('una serie sin hacer o fuera de rango no se toca', () => {
    const s = nueva()
    expect(corregirSerie(s, 0, 0, { peso: 50, reps: 1, segundos: null })).toEqual(s)
    expect(corregirSerie(s, 5, 0, { peso: 50, reps: 1, segundos: null })).toEqual(s)
    expect(corregirSerie(s, 0, 9, { peso: 50, reps: 1, segundos: null })).toEqual(s)
  })

  it('puede quitar o poner la marca de récord', () => {
    let s = hecha(nueva(), 0, { peso: 20, reps: 6, rpe: null, segundos: null }).sesion
    s.ejercicios[0]!.series[0]!.record = true
    s = corregirSerie(s, 0, 0, { peso: 15, reps: 6, segundos: null, record: false })
    expect(s.ejercicios[0]!.series[0]!.record).toBeFalsy()
    s = corregirSerie(s, 0, 0, { peso: 40, reps: 6, segundos: null, record: true })
    expect(s.ejercicios[0]!.series[0]!.record).toBe(true)
  })
})
