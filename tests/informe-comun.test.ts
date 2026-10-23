// Informe en PDF: utilidades de texto y números, esfuerzo de los entrenos y fuerza por ejercicio
// (src/informe/calculo/comun.ts).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import { esfuerzoDe, etiquetaSemana, fechaDia, mediaEsfuerzo, mediana, minutosSesion, palabraEsfuerzo, pctCambio, queDiceEsfuerzo, serieFuerza, textoDuracion, textoFuerza, textoPct, unidadFuerza, valorFuerza, zonaEsfuerzo } from '../src/informe/calculo/comun'
import { conSigno, enLista } from '../src/dominio/formato'
import { mesAnio } from '../src/dominio/fechas'
import { edadEn } from '../src/informe/calculo/contexto'
import { S, E, SES } from './informe-ejemplo'

describe('utilidades de texto y números', () => {
  it('el ejemplo de la banca: 55 contra 50 es +10 %', () => {
    expect(pctCambio(55, 50)).toBe(10)
    expect(textoPct(pctCambio(55, 50)!)).toBe('+10 %')
    expect(textoPct(pctCambio(12, 13)!)).toBe('–8 %')
    expect(textoPct(0)).toBe('0 %')
    expect(pctCambio(5, 0)).toBeNull()
  })
  it('signos con el menos tipográfico y sin «–0»', () => {
    expect(conSigno(1.5)).toBe('+1,5')
    expect(conSigno(-0.7)).toBe('–0,7')
    expect(conSigno(0)).toBe('0')
    expect(conSigno(-0.04)).toBe('0')
    expect(conSigno(15, v => String(v))).toBe('+15')
  })
  it('mediana, listas, duraciones y fechas', () => {
    expect(mediana([])).toBeNull()
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([47.5, 50, 52.5, 50])).toBe(50)
    expect(enLista([])).toBe('')
    expect(enLista(['a'])).toBe('a')
    expect(enLista(['a', 'b'])).toBe('a y b')
    expect(enLista(['a', 'b', 'c'])).toBe('a, b y c')
    expect(textoDuracion(null)).toBe('—')
    expect(textoDuracion(68)).toBe('1 h 8 min')
    expect(textoDuracion(60)).toBe('1 h')
    expect(textoDuracion(59)).toBe('59 min')
    expect(fechaDia('2026-09-22')).toBe('mar 22 sep')
    expect(mesAnio('2027-04-03')).toBe('abril 2027')
    expect(etiquetaSemana('2026-09-21', '2026-09-27')).toBe('21-27 sep')
    expect(etiquetaSemana('2026-09-28', '2026-10-04')).toBe('28 sep-4 oct')
    expect(etiquetaSemana('2026-10-20', '2026-10-20')).toBe('20 oct')
    expect(edadEn('2005-03-23', '2026-10-20')).toBe(21)
    expect(edadEn('', '2026-10-20')).toBeNull()
  })
  it('duración de un entreno: fin − inicio, si no lo que dijo al terminar, si no nada', () => {
    const s = SES('2026-10-20', [])
    expect(minutosSesion(s)).toBe(60)
    expect(minutosSesion({ ...s, fin: undefined, respuestas: { minutosReales: 47 } })).toBe(47)
    expect(minutosSesion({ ...s, fin: undefined })).toBeNull()
    expect(minutosSesion({ ...s, fin: s.inicio })).toBeNull()
  })
})

describe('esfuerzo de los entrenos', () => {
  it('palabras: hasta 6,4 fácil · 6,5-8,4 bien · 8,5-9,4 duro · desde 9,5 al límite', () => {
    expect([6, 6.4, 6.5, 8.4, 8.45, 8.5, 9.4, 9.5, 10].map(v => palabraEsfuerzo(v).palabra)).toEqual(['fácil', 'fácil', 'bien', 'bien', 'duro', 'duro', 'duro', 'al límite', 'al límite'])
    expect(palabraEsfuerzo(8.2)).toEqual({ palabra: 'bien', tono: 'ok', rango: '7-8', texto: '8,2 bien' })
    expect(palabraEsfuerzo(6).tono).toBe('azul')
    expect(palabraEsfuerzo(9).tono).toBe('warn')
    expect(palabraEsfuerzo(10).tono).toBe('bad')
    expect(zonaEsfuerzo(6.44)).toBe(0)
  })
  it('«Qué dice» compara la palabra, no los decimales: 8,4 con objetivo 8 es lo previsto y 8,7 más duro', () => {
    expect(queDiceEsfuerzo(8.4, 8)).toEqual({ texto: 'lo previsto', tono: 'ok' })
    expect(queDiceEsfuerzo(8.7, 8)).toEqual({ texto: 'más duro', tono: 'warn' })
    expect(queDiceEsfuerzo(6.4, 8)).toEqual({ texto: 'más fácil', tono: 'azul' })
  })
  it('las series en blanco no cuentan (ni como 0 ni como el objetivo); el calentamiento tampoco', () => {
    const e = E('bench-press', [S(20, 10, 5, { calentamiento: true }), S(50, 8, null), S(50, 8, 8), S(50, 7, 9), S(50, 8, 9, { hecha: false })], { rpe: 8 })
    expect(mediaEsfuerzo(e.series)).toBe(8.5)
    const r = esfuerzoDe([e])
    expect(r).toMatchObject({ media: 8.5, marcadas: 2, total: 3, pct: 67, pocas: false, objetivo: 8, palabra: 'duro', texto: '8,5 duro' })
  })
  it('cada serie pesa lo mismo (no la media de medias) y el objetivo es la media de los ejercicios con series marcadas', () => {
    const r = esfuerzoDe([E('a', [S(10, 8, 6)], { rpe: 7 }), E('b', [S(10, 8, 9), S(10, 8, 9), S(10, 8, 9)], { rpe: 9 }), E('c', [S(10, 8, null)], { rpe: 6 })])
    expect(r.media).toBe(8.3) // (6 + 9 + 9 + 9) / 4 = 8,25 → 8,3 (la media de medias daría 7,5)
    expect(r.objetivo).toBe(8)
  })
  it('todo en blanco: «sin marcar», sin media ni objetivo; con menos del 30 % marcado, «pocas»', () => {
    expect(esfuerzoDe([E('a', [S(10, 8), S(10, 8)])])).toMatchObject({ media: null, palabra: null, texto: 'sin marcar', tono: 'gris', marcadas: 0, total: 2, pct: 0, pocas: true, objetivo: null })
    expect(esfuerzoDe([])).toMatchObject({ media: null, total: 0, pct: null, pocas: false })
    expect(esfuerzoDe([E('a', [S(10, 8, 8), S(10, 8), S(10, 8), S(10, 8)])]).pocas).toBe(true)
  })
})

describe('fuerza por ejercicio', () => {
  const s1 = SES('2026-10-13', [E('x', [S(40, 8)]), E('as', [S(-20, 6)], { registro: 'asistido' }), E('pl', [S(null, null, null, { segundos: 40 })], { registro: 'tiempo' }), E('fl', [S(null, 12)], { registro: 'corporal' })])
  const s2 = SES('2026-10-15', [E('x', [S(45, 8), S(42.5, 10)]), E('as', [S(-15, 6), S(-20, 8)], { registro: 'asistido' }), E('pl', [S(null, null, null, { segundos: 50 })], { registro: 'tiempo' }), E('fl', [S(null, 15)], { registro: 'corporal' })])
  it('la unidad: kg, ayuda (asistidos), repeticiones o segundos', () => {
    expect(unidadFuerza([s1, s2], 'x')).toBe('kg')
    expect(unidadFuerza([s1, s2], 'as')).toBe('asistido')
    expect(unidadFuerza([s1, s2], 'fl')).toBe('reps')
    expect(unidadFuerza([s1, s2], 'pl')).toBe('s')
    expect(unidadFuerza([], 'nada')).toBe('s')
  })
  it('el valor de cada día y su texto', () => {
    expect(valorFuerza(s2.ejercicios[0]!.series, 'kg')).toBe(45)
    expect(valorFuerza(s2.ejercicios[1]!.series, 'asistido')).toBe(15)
    expect(valorFuerza(s2.ejercicios[2]!.series, 's')).toBe(50)
    expect(valorFuerza(s2.ejercicios[3]!.series, 'reps')).toBe(15)
    expect(valorFuerza([S(null, 10)], 'kg')).toBeNull()
    expect(valorFuerza([S(10, 10)], 'asistido')).toBeNull()
    expect(valorFuerza([S(null, null)], 's')).toBeNull()
    expect([textoFuerza(47.5, 'kg'), textoFuerza(15, 'asistido'), textoFuerza(12, 'reps'), textoFuerza(40, 's')]).toEqual(['47,5 kg', 'ayuda 15 kg', '12 reps', '40 s'])
    expect(serieFuerza([s2, s1], 'x').map(p => p.valor)).toEqual([40, 45])
    expect(serieFuerza([s1, s2], 'as').map(p => p.valor)).toEqual([20, 15])
  })
})
