import { describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo, perfilEjemplo } from './ayuda'
import { duracionDia, generarRutina, plantillas } from '../src/dominio/generador'
import { gimnasioNuevo } from '../src/datos/repos'
import type { MarcaEjercicio } from '../src/datos/tipos'
import { ejercicio } from '../src/catalogo/catalogo'
import { patron } from '../src/catalogo/clasificacion'

describe('estructura según los días', () => {
  it('3 días → cuerpo completo A/B/C', () => {
    expect(plantillas(3).dias.map(d => d.letra)).toEqual(['A', 'B', 'C'])
    expect(plantillas(3).estructura).toContain('Cuerpo completo')
  })
  it('4 días → torso / pierna', () => expect(plantillas(4).estructura).toContain('Torso'))
  it('6 días → empuje / tirón / pierna', () => expect(plantillas(6).dias).toHaveLength(6))
})

describe.skipIf(!hayCatalogo)('generador con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const gym = { ...gimnasioNuevo(), id: 1, material: [...gimnasioNuevo().material, 'leg_extension', 'pec_deck', 'reverse_fly_machine', 'assisted_pullup_machine', 'ab_crunch_machine'] }
  const odiados: MarcaEjercicio[] = [
    { id: 'leg-extension', duele: true, odiado: true },
    { id: 'pec-deck', odiado: true },
    { id: 'machine-reverse-fly', odiado: true },
  ]
  const marcas = new Map(odiados.map(m => [m.id, m]))
  const r = c ? generarRutina({ perfil: perfilEjemplo(), gimnasio: gym, marcas, ejercicios: c.ejercicios }) : null

  it('crea A, B, C y la sesión opcional del sábado', () => {
    expect(r!.dias.map(d => d.letra)).toEqual(['A', 'B', 'C', 'S'])
    expect(r!.dias[0]!.dia).toBe(1)
    expect(r!.dias[3]!.opcional).toBe(true)
  })

  it('nunca propone ejercicios odiados o que duelen, ni como alternativa', () => {
    for (const d of r!.dias) for (const b of d.bloques) {
      for (const id of [b.ejercicio, ...b.alternativas]) expect(['leg-extension', 'pec-deck', 'machine-reverse-fly']).not.toContain(id)
    }
  })

  it('todo el material está en el gimnasio', () => {
    const mat = new Set(gym.material)
    for (const d of r!.dias) for (const b of d.bloques) for (const id of [b.ejercicio, ...b.alternativas]) {
      const e = ejercicio(id)!
      expect(e.material === null || mat.has(e.material)).toBe(true)
    }
  })

  it('cada día cabe en su tiempo (normal y corta)', () => {
    for (const d of r!.dias.filter(x => !x.opcional)) {
      expect(duracionDia(d.bloques) / 60).toBeLessThanOrEqual(60)
      expect(duracionDia(d.bloques, true) / 60).toBeLessThanOrEqual(45)
      expect(d.bloques.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('las alternativas son del mismo patrón y distinto del elegido', () => {
    for (const d of r!.dias) for (const b of d.bloques) {
      expect(b.alternativas).not.toContain(b.ejercicio)
      for (const a of b.alternativas) expect(patron(ejercicio(a)!)).toBe(patron(ejercicio(b.ejercicio)!))
    }
  })

  it('superseries de brazos emparejadas', () => {
    const a = r!.dias[0]!
    const bi = a.bloques.find(b => patron(ejercicio(b.ejercicio)!) === 'biceps')!
    const tri = a.bloques.find(b => patron(ejercicio(b.ejercicio)!) === 'triceps')!
    expect(bi.superserie).toBe(tri.uid)
    expect(tri.superserie).toBe(bi.uid)
  })

  it('variedad: el empuje horizontal no se repite igual los tres días', () => {
    const empujes = r!.dias.slice(0, 3).map(d => d.bloques.find(b => patron(ejercicio(b.ejercicio)!) === 'empuje-h')?.ejercicio)
    expect(new Set(empujes).size).toBe(3)
  })

  it('muestra la rutina generada (para revisarla a ojo)', () => {
    const texto = r!.dias.map(d => `${d.nombre}: ` + d.bloques.map(b => `${ejercicio(b.ejercicio)!.nombre} ${b.series}×${b.repsMin}-${b.repsMax}${b.superserie ? '(SS)' : ''}${b.fueraEnCorta ? '(fuera corta)' : ''} [${b.alternativas.map(a => ejercicio(a)!.nombre).join(' / ')}]`).join(' | ') + ` · ${Math.round(duracionDia(d.bloques) / 60)}/${Math.round(duracionDia(d.bloques, true) / 60)} min`).join('\n')
    console.log(texto)
    expect(texto.length).toBeGreaterThan(0)
  })
})
