import { describe, expect, it } from 'vitest'
import { desdeReferencia, leerReferencia } from '../src/dominio/progresion'
import { pesosBarra } from '../src/dominio/pesos'

describe('pesos de referencia del perfil', () => {
  it('entiende cómo los escribe la gente', () => {
    expect(leerReferencia('40 kg × 8')).toEqual({ peso: 40, reps: 8 })
    expect(leerReferencia('40x10')).toEqual({ peso: 40, reps: 10 })
    expect(leerReferencia('40-50 kg')).toEqual({ peso: 40, reps: 8 })
    expect(leerReferencia('22,5 kg * 6')).toEqual({ peso: 22.5, reps: 6 })
    expect(leerReferencia('?')).toBeNull()
    expect(leerReferencia('')).toBeNull()
    expect(leerReferencia(undefined)).toBeNull()
  })
  it('propone una primera carga cómoda y que se puede montar', () => {
    const lista = pesosBarra(20, [20, 15, 10, 5, 2.5, 1.25])
    const s = desdeReferencia('bench-press', { banca: '40 kg × 8' }, { repsMin: 8, rpe: 7 }, lista)!
    expect(s.accion).toBe('primera')
    expect(lista).toContain(s.peso)
    // 1RM ≈ 50,7 kg; −10 % por el parón; 8 reps dejando 3 en reserva → ~32 kg: por debajo de la referencia.
    expect(s.peso!).toBeGreaterThanOrEqual(25)
    expect(s.peso!).toBeLessThan(40)
    expect(s.texto).toContain('40 kg × 8')
  })
  it('no inventa nada si no hay referencia o el ejercicio no tiene equivalencia', () => {
    expect(desdeReferencia('bench-press', {}, { repsMin: 8, rpe: 7 }, [])).toBeNull()
    expect(desdeReferencia('bench-press', { banca: '?' }, { repsMin: 8, rpe: 7 }, [])).toBeNull()
    expect(desdeReferencia('leg-extension', { banca: '40x8' }, { repsMin: 8, rpe: 7 }, [])).toBeNull()
  })
  it('nunca baja de cero ni pasa del peso de referencia', () => {
    for (const ref of ['10x1', '20x3', '60x5', '100x10', '200x2']) for (const reps of [5, 8, 12, 15]) for (const rpe of [6, 7, 8, 9]) {
      const s = desdeReferencia('lat-pulldown', { jalon: ref }, { repsMin: reps, rpe }, [])
      if (s) { expect(s.peso!).toBeGreaterThan(0); expect(s.peso!).toBeLessThanOrEqual(parseFloat(ref)) }
    }
  })
})

describe('nombres como en el gimnasio', () => {
  it('«Cable» pasa a «Polea» y «Barra EZ» a «Barra Z», sin tocar otras palabras', async () => {
    const { nombreComun } = await import('../src/catalogo/catalogo')
    expect(nombreComun('Jalón de Tríceps en Cable')).toBe('Jalón de Tríceps en Polea')
    expect(nombreComun('Cruce con Cable')).toBe('Cruce en Polea')
    expect(nombreComun('Curl con Barra EZ')).toBe('Curl con Barra Z')
    expect(nombreComun('Cables y Cablea')).toBe('Cables y Cablea')
  })
  it('«Máquina Smith» pasa a «Máquina de barra guiada», en los nombres y en las frases', async () => {
    const { nombreComun, textoComun } = await import('../src/catalogo/catalogo')
    expect(nombreComun('Sentadilla en Máquina Smith')).toBe('Sentadilla en Máquina de Barra Guiada')
    expect(textoComun('Máquina Smith')).toBe('Máquina de barra guiada')
    expect(textoComun('Coloca un banco dentro de la máquina Smith.')).toBe('Coloca un banco dentro de la máquina de barra guiada.')
    expect(textoComun('Salir de debajo de una barra Smith cargada')).toBe('Salir de debajo de una barra guiada cargada')
  })
})
