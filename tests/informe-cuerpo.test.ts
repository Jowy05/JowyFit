// Informe en PDF: el cuerpo con pocos datos (sin altura, solo cinta, báscula antigua) (src/informe/calculo/cuerpo.ts).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import { calcularInforme } from '../src/informe/calculo/index'
import { PERFIL, MED, entrada } from './informe-ejemplo'

describe('el cuerpo con pocos datos', () => {
  it('sin altura: fuera IMC, cintura/altura y gasto; nota en el resumen; grasa por medidas imposible', () => {
    const ms = [MED('2026-10-10', { pesoKg: 80, perimetros: { cintura: 95, cuello: 40 } }), MED('2026-10-18', { pesoKg: 79.5, perimetros: { cintura: 94 } })]
    const inf = calcularInforme(entrada({ perfil: { ...PERFIL, alturaCm: 0 }, mediciones: ms, pasos: [{ fecha: '2026-10-18', pasos: 9000, fuente: 'manual' }] }))
    expect(inf.resumen.zonas).toEqual([])
    expect(inf.resumen.lineas.at(-1)).toEqual({ texto: 'Falta tu altura en Perfil', tono: 'warn' })
    expect(inf.cuerpo!.nota).toBe('Falta tu altura en Perfil')
    expect(inf.cuerpo!.tabla).toEqual([
      { medicion: 'Peso', valor: '79,5 kg', rango: '—', evaluacion: { texto: '—', tono: 'gris' } },
      { medicion: 'Cintura', valor: '94 cm', rango: '—', evaluacion: { texto: '—', tono: 'gris' } },
    ])
    expect(inf.pasos!.gasto).toBeNull()
    expect(inf.pasos!.km).toBe(6.8)
    expect(inf.cabecera.alturaCm).toBeNull()
  })
  it('solo cinta: % de grasa por medidas, marcado como tal (punto hueco)', () => {
    const ms = [MED('2026-10-01', { perimetros: { cintura: 99, cuello: 39 } }), MED('2026-10-15', { perimetros: { cintura: 97 } })]
    const inf = calcularInforme(entrada({ mediciones: ms, perfil: { ...PERFIL, sexo: 'mujer' } }))
    expect(inf.cuerpo!.grasa.puntos.every(p => p.fuente === 'medidas')).toBe(true)
    expect(inf.resumen.tabla.some(f => f.dato === 'Grasa corporal (%, por medidas)')).toBe(false) // la mujer necesita cadera
    const hombre = calcularInforme(entrada({ mediciones: ms }))
    expect(hombre.cuerpo!.grasa.puntos.map(p => p.fuente)).toEqual(['medidas', 'medidas'])
    expect(hombre.resumen.tabla.some(f => f.dato === 'Grasa corporal (%, por medidas)')).toBe(true)
    expect(hombre.resumen.zonas.find(z => z.fuente === 'medidas')!.nombre).toBe('Grasa corporal (%) (por medidas)')
    expect(hombre.cuerpo!.tabla[0]!.medicion).toBe('Grasa corporal (por medidas)')
    expect(hombre.resumen.zonasSubtitulo).toBe('cinta del 15 oct')
    expect(inf.resumen.zonasNota).toMatch(/mujeres \(14-32 %\)/)
  })
  it('báscula antigua (más de 4 meses): no cuenta para el % de grasa ni para los indicadores', () => {
    const ms = [MED('2026-05-01', { pesoKg: 85, bascula: { grasaPct: 28, basalKcal: 1700 } }), MED('2026-10-15', { pesoKg: 80 })]
    const inf = calcularInforme(entrada({ mediciones: ms }))
    expect(inf.resumen.indicadores).toBeNull()
    expect(inf.resumen.zonas.map(z => z.nombre)).toEqual(['IMC (kg/m²)'])
    expect(inf.cuerpo!.grasa.puntos).toEqual([])
  })
})
