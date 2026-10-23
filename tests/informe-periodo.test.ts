// Informe en PDF: el periodo elegido (fechas, etiqueta y si hay datos) (src/informe/calculo/periodo.ts).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import type { PeriodoInforme } from '../src/informe/calculo/tipos'
import { diasDe } from '../src/informe/calculo/comun'
import { etiquetaPeriodo, hayDatosEn, primerDato, rangoInforme } from '../src/informe/calculo/periodo'
import { SES, MED, COM, AHORA } from './informe-ejemplo'

describe('periodo', () => {
  it('días exactos de cada botón y su texto', () => {
    const r = (p: PeriodoInforme, primer: string | null = null) => rangoInforme(p, AHORA, primer)
    expect(r('hoy')).toMatchObject({ inicio: '2026-10-20', fin: '2026-10-20', dias: 1, unDia: true, texto: 'martes 20 oct 2026', textoHoja: 'Hoy, martes 20 de octubre', nombreArchivo: 'JowyFit-informe-2026-10-20-hoy.pdf' })
    expect(r('hoy').notaHoja).toMatch(/compara lo de ese día/)
    expect(r('ayer')).toMatchObject({ inicio: '2026-10-19', fin: '2026-10-19', dias: 1, unDia: true, textoHoja: 'Ayer, lunes 19 de octubre' })
    expect(r('semana')).toMatchObject({ inicio: '2026-10-14', fin: '2026-10-20', dias: 7, unDia: false, notaHoja: null, nombreArchivo: 'JowyFit-informe-2026-10-20-ultima-semana.pdf' })
    expect(r('mes')).toMatchObject({ inicio: '2026-09-21', fin: '2026-10-20', dias: 30, texto: '21 sep – 20 oct 2026', textoHoja: 'Del 21 sep al 20 oct de 2026', etiqueta: 'Último mes', nombreArchivo: 'JowyFit-informe-2026-10-20-ultimo-mes.pdf' })
    expect(r('todo', '2026-10-12')).toMatchObject({ inicio: '2026-10-12', dias: 9, textoHoja: 'Desde el 12 oct de 2026, tu primer dato' })
    expect(r('todo')).toMatchObject({ inicio: '2026-10-20', dias: 1, textoHoja: 'Aún no hay nada apuntado' })
    // Un primer dato con fecha futura no da un periodo al revés.
    expect(r('todo', '2026-12-01').inicio).toBe('2026-10-20')
    expect(etiquetaPeriodo('todo')).toBe('Todo')
  })
  it('periodo que cruza de año', () => {
    const r = rangoInforme('mes', new Date('2027-01-10T09:00:00'))
    expect(r.texto).toBe('12 dic 2026 – 10 ene 2027')
    expect(r.textoHoja).toBe('Del 12 dic de 2026 al 10 ene de 2027')
  })
  it('cambio de hora (25 oct): 30 días seguidos, sin repetir ni saltar ninguno', () => {
    const r = rangoInforme('mes', new Date('2026-11-10T12:00:00'))
    expect(r).toMatchObject({ inicio: '2026-10-12', fin: '2026-11-10', dias: 30 })
    const dias = diasDe(r.inicio, r.fin)
    expect(dias).toHaveLength(30)
    expect(new Set(dias).size).toBe(30)
    expect(dias).toContain('2026-10-25')
    expect(rangoInforme('ayer', new Date('2026-10-26T00:30:00')).fin).toBe('2026-10-25')
    // Primavera: el 29 de marzo de 2026 también está una sola vez.
    expect(diasDe('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30'])
  })
  it('primer dato y si hay algo en esos días', () => {
    const t = { sesiones: [SES('2026-10-15', []), SES('2026-09-01', [], { estado: 'cancelada' })], mediciones: [MED('2026-10-10', { pesoKg: 80 })], comidas: [COM('2026-10-12', '10:00', 'comida', 'x', 1, 1)], pasos: [{ fecha: '2026-10-11', pasos: 5, fuente: 'manual' as const }] }
    expect(primerDato(t)).toBe('2026-10-10')
    expect(primerDato({ sesiones: [], mediciones: [], comidas: [], pasos: [] })).toBeNull()
    expect(hayDatosEn(t, '2026-10-01', '2026-10-09')).toBe(false)
    expect(hayDatosEn(t, '2026-10-15', '2026-10-15')).toBe(true)
    expect(hayDatosEn(t, '2026-10-11', '2026-10-11')).toBe(true)
    expect(hayDatosEn(t, '2026-10-12', '2026-10-12')).toBe(true)
    expect(hayDatosEn(t, '2026-09-01', '2026-09-01')).toBe(false)
  })
})
