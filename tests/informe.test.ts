// Informe en PDF: cada número que sale en el informe (docs/INFORME-PDF-DISENO.md §5), los casos con pocos datos,
// el esfuerzo de los entrenos y las comparaciones con lo normal («55 kg · lo normal: 50 kg · +10 %»).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import type { Ajustes, Comida, DiaRutina, EjercicioSesion, Medicion, Meta, PasosDia, Perfil, Rutina, Serie, Sesion } from '../src/datos/tipos'
import type { CatalogoInforme, EntradaInforme, Informe, PeriodoInforme } from '../src/informe/calculo/tipos'
import { diasDe, esfuerzoDe, etiquetaSemana, fechaDia, lista, mediaEsfuerzo, mediana, mesAnio, minutosSesion, palabraEsfuerzo, pctCambio, queDiceEsfuerzo, serieFuerza, textoDuracion, textoFuerza, textoPct, unidadFuerza, valorFuerza, zonaEsfuerzo } from '../src/informe/calculo/comun'
import { conSigno } from '../src/dominio/formato'
import { etiquetaPeriodo, hayDatosEn, primerDato, rangoInforme } from '../src/informe/calculo/periodo'
import { edadEn, objetivosInforme } from '../src/informe/calculo/contexto'
import { palabraPuntuacion, puntuacionDe } from '../src/informe/calculo/semanas'
import { evaluarCuerpo } from '../src/informe/calculo/cuerpo'
import { evaluarEntrenos, evaluarProteina, tonoProteinaDia } from '../src/informe/calculo/resumen'
import { compararKcal, compararPeso } from '../src/informe/calculo/dia'
import { calcularInforme } from '../src/informe/calculo/index'
import { resumenSemana } from '../src/dominio/resumen'
import { db } from '../src/datos/db'
import { datosInforme, periodoInforme, tablasInforme } from '../src/informe/calculo/leer'

// ---------------------------------------------------------------- datos de ejemplo

const NOMBRES: Record<string, string> = {
  'bench-press': 'Press de banca', 'leg-press': 'Prensa de piernas', 'lat-pulldown': 'Jalón al pecho', 'seated-cable-row': 'Remo sentado en polea',
  'romanian-deadlift': 'Peso muerto rumano', 'bicep-curl': 'Curl de bíceps', 'cable-crunch': 'Crunch en polea', 'tricep-pushdown': 'Jalón de tríceps en polea',
  'lateral-raise': 'Elevaciones laterales en polea', 'assisted-pull-up': 'Dominada asistida', plank: 'Plancha', 'push-up': 'Flexiones',
}
const PATRONES: Record<string, string> = {
  'bench-press': 'empuje-h', 'leg-press': 'rodilla', 'lat-pulldown': 'tiron-v', 'seated-cable-row': 'tiron-h', 'romanian-deadlift': 'cadera',
  'bicep-curl': 'biceps', 'cable-crunch': 'core', 'tricep-pushdown': 'triceps', 'lateral-raise': 'hombro-lat',
}
const CAT: CatalogoInforme = { nombre: id => NOMBRES[id] ?? id, patron: id => PATRONES[id], met: id => (id === 'plank' ? null : 5) }

const S = (peso: number | null, reps: number | null, rpe: number | null = null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe, calentamiento: false, hecha: true, ...x })
const E = (id: string, series: Serie[], x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid: id, ejercicio: id, planificado: id, estado: 'hecho', series: series.map((s, i) => ({ ...s, n: i + 1 })), repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x,
})
let siguienteId = 1
const LETRA: Record<number, string> = { 1: 'A', 3: 'B', 4: 'C' }
function SES(fecha: string, ejs: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion {
  const inicio = new Date(`${fecha}T05:30:00`).getTime()
  const letra = LETRA[(new Date(`${fecha}T12:00:00`).getDay() + 6) % 7] ?? 'L'
  return { id: siguienteId++, fecha, rutinaId: 1, letra, nombre: letra === 'L' ? 'Entreno libre' : `Cuerpo completo ${letra}`, gimnasioId: null, inicio, fin: inicio + 60 * 60_000, version: 'normal', estado: 'hecha', calibracion: false, ejercicios: ejs, ...x }
}
const diaR = (letra: string, d: number | null, opcional = false): DiaRutina => ({ letra, nombre: `Cuerpo completo ${letra}`, dia: d as DiaRutina['dia'], opcional, bloques: [] })
const RUTINA: Rutina = { id: 1, creada: '2026-09-01T10:00:00.000Z', activa: true, estructura: 'Cuerpo completo · 3 días', porque: [], calibracion: false, gimnasioId: null, dias: [diaR('A', 1), diaR('B', 3), diaR('C', 4), diaR('S', 5, true)] }
const PERFIL = {
  id: 'yo', creado: '2026-09-01', altaCompleta: true, nombre: 'Joel', nacimiento: '2005-03-23', sexo: 'hombre', alturaCm: 177, objetivo: 'recomposicion',
  pasosObjetivo: 10_000, diasFijos: [1, 3, 4], trabajo: 'sentado',
} as Perfil
const AJUSTES = { id: 'app', cafeinaLimite: 400, kcalManual: 1850, proteinaManual: 140, recolocadas: [] } as unknown as Ajustes
const MED = (fecha: string, x: Partial<Medicion>): Medicion => ({ fecha: `${fecha}T07:00:00`, origen: 'casa', ...x })
const COM = (fecha: string, hora: string, franja: Comida['franja'], nombre: string, kcal: number, proteina: number, x: Partial<Comida> = {}): Comida => ({ fecha, hora, franja, nombre, kcal, proteina, racion: 'N', tipo: 'plantilla', ...x })
const AHORA = new Date('2026-10-20T22:30:00')

function entrada(x: Partial<EntradaInforme> = {}): EntradaInforme {
  return { perfil: PERFIL, ajustes: AJUSTES, mediciones: [], sesiones: [], rutina: RUTINA, comidas: [], suplementos: [], pasos: [], metas: [], periodo: 'mes', ahora: AHORA, catalogo: CAT, ...x }
}

/** El mes del ejemplo del diseño: 21 sep – 20 oct de 2026, martes A, jueves B y viernes C, semana de prueba al principio y un viernes perdido. */
function mesDeEjemplo() {
  siguienteId = 1
  const fechas = ['2026-09-22', '2026-09-24', '2026-09-25', '2026-09-29', '2026-10-01', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-13', '2026-10-15', '2026-10-16', '2026-10-20']
  const pesos: Record<string, number[]> = {
    'bench-press': [40, 42.5, 45, 47.5, 50, 50, 52.5, 55], 'leg-press': [80, 90, 90, 100, 110, 110, 115, 120], 'lat-pulldown': [40, 42.5, 45, 47.5, 47.5],
    'seated-cable-row': [40, 45, 45, 50], 'romanian-deadlift': [40, 45, 50, 55], 'bicep-curl': [10, 12, 12, 14], 'cable-crunch': [20, 25, 25],
  }
  const vez: Record<string, number> = {}
  const maximo: Record<string, number> = {}
  let marcados = 0
  const ej = (id: string, prueba: boolean): EjercicioSesion => {
    const i = vez[id] ?? 0
    vez[id] = i + 1
    const p = pesos[id]![i]!
    const record = maximo[id] != null && p > maximo[id]!
    if (record) marcados++
    maximo[id] = Math.max(maximo[id] ?? 0, p)
    const r = prueba ? 7 : id === 'bicep-curl' ? 9 : 8
    const series = [S(p, 8, null), S(p, 8, r), S(p, 8, r, { record })]
    if (id === 'bench-press') series.unshift(S(20, 10, 5, { calentamiento: true }))
    return E(id, series, { rpe: prueba ? 7 : 8 })
  }
  const sesiones = fechas.map((f, k) => {
    const d = (new Date(`${f}T12:00:00`).getDay() + 6) % 7
    const prueba = k < 3
    const ids = d === 1 ? ['bench-press', 'leg-press', 'lat-pulldown'] : d === 3 ? ['seated-cable-row', 'romanian-deadlift', 'bicep-curl'] : ['bench-press', 'leg-press', 'cable-crunch']
    return SES(f, ids.map(id => ej(id, prueba)), { calibracion: prueba })
  })
  // Una sesión sin hora de fin (cuenta lo que dijo al terminar) y una cancelada (no cuenta).
  sesiones[3] = { ...sesiones[3]!, fin: undefined, respuestas: { minutosReales: 61 } }
  sesiones.push(SES('2026-10-13', [E('bench-press', [S(100, 10, 10)])], { estado: 'cancelada' }))
  const mediciones: Medicion[] = [
    MED('2026-09-13', { pesoKg: 81 }),
    MED('2026-09-21', { pesoKg: 80.6, bascula: { grasaPct: 25 }, perimetros: { cintura: 99.5, cuello: 39 } }),
    MED('2026-09-28', { pesoKg: 80.2 }),
    MED('2026-10-05', { pesoKg: 79.8, bascula: { grasaPct: 24.8 }, perimetros: { cintura: 99 } }),
    MED('2026-10-12', { pesoKg: 79.4, bascula: { grasaPct: 24.5 } }),
    MED('2026-10-20', { pesoKg: 79.1, bascula: { grasaPct: 24.3, basalKcal: 1665, musculoKg: 56, aguaPct: 55.6, visceral: 7, edadCorporal: 22 }, perimetros: { cintura: 98 } }),
  ]
  const comidas: Comida[] = []
  const pasos: PasosDia[] = []
  for (const f of diasDe('2026-09-21', '2026-10-20')) {
    const n = Number(f.slice(8))
    pasos.push({ fecha: f, pasos: n % 3 === 0 ? 11_000 : 8000, fuente: 'manual', ...(f === '2026-09-26' ? { troteKm: 3 } : {}) })
    if (f === '2026-09-23' || f === '2026-10-04') continue
    comidas.push(COM(f, '07:30', 'desayuno', 'Batido de proteína', 120, 24, { tipo: 'bebida' }))
    comidas.push(COM(f, '06:50', 'desayuno', 'Café', 5, 0, { cafeina: 80, tipo: 'bebida' }))
    comidas.push(COM(f, '14:10', 'comida', 'Pollo teriyaki', 1100, n % 2 ? 90 : 70))
    comidas.push(COM(f, '21:15', 'cena', 'Arroz con atún', 600, 20))
    if (n % 5 === 0) comidas.push(COM(f, '17:45', 'merienda', 'Quicos', 150, 3, { tipo: 'picoteo', racion: 'P' }))
  }
  comidas.push(COM('2026-10-01', '18:20', 'merienda', 'Monster', 230, 0, { cafeina: 400, tipo: 'bebida', hidratos: 56, azucares: 55 }))
  const metas: Meta[] = [
    { id: 1, tipo: 'cintura', titulo: 'Cintura por debajo de 88 cm', objetivo: 88, unidad: 'cm', inicio: 99.5, fecha: '2027-06-30' },
    { id: 2, tipo: 'ejercicio', titulo: 'Press de banca: 65 kg × 5', objetivo: 65, unidad: 'kg', inicio: 40, ejercicio: 'bench-press', fecha: '2027-06-30' },
    { id: 3, tipo: 'grasa', titulo: 'Grasa al 18 %', objetivo: 18, unidad: '%', inicio: 25, fecha: '2027-06-30' },
    { id: 4, tipo: 'dominadas', titulo: '5 dominadas estrictas', objetivo: 5, unidad: 'reps', fecha: '2027-06-30' },
    { id: 5, tipo: 'libre', titulo: 'Ir andando al trabajo', objetivo: 1, unidad: '', hecha: true },
  ]
  return { sesiones, mediciones, comidas, pasos, metas, marcados }
}

// ================================================================ utilidades

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
    expect(lista([])).toBe('')
    expect(lista(['a'])).toBe('a')
    expect(lista(['a', 'b'])).toBe('a y b')
    expect(lista(['a', 'b', 'c'])).toBe('a, b y c')
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
  it('evaluaciones con las mismas palabras y umbrales que la app', () => {
    expect(evaluarEntrenos(null)).toEqual({ texto: '—', tono: 'gris' })
    expect(evaluarEntrenos(92)).toEqual({ texto: 'Bien', tono: 'ok' })
    expect(evaluarEntrenos(75)).toEqual({ texto: 'Casi', tono: 'warn' })
    expect(evaluarEntrenos(50)).toEqual({ texto: 'Pocos', tono: 'bad' })
    expect(evaluarProteina(130, 140).texto).toBe('Bien')
    expect(evaluarProteina(110, 140).texto).toBe('Algo corta')
    expect(evaluarProteina(90, 140).texto).toBe('Corta')
    expect([tonoProteinaDia(126, 140), tonoProteinaDia(100, 140), tonoProteinaDia(97, 140)]).toEqual(['ok', 'warn', 'bad'])
    expect(evaluarCuerpo(-1.5, 'recomposicion', 'peso')).toEqual({ texto: 'Baja: bien', tono: 'ok' })
    expect(evaluarCuerpo(0.5, 'perder', 'cintura')).toEqual({ texto: 'Sube: ojo', tono: 'warn' })
    expect(evaluarCuerpo(0.2, 'perder', 'grasa')).toEqual({ texto: 'Estable', tono: 'gris' })
    expect(evaluarCuerpo(1, 'fuerza', 'peso')).toEqual({ texto: 'Sube', tono: 'gris' })
    expect(evaluarCuerpo(-1, 'fuerza', 'peso').texto).toBe('Baja')
    expect(evaluarCuerpo(0, 'fuerza', 'peso').texto).toBe('Estable')
    expect(evaluarCuerpo(-1, 'fuerza', 'cintura').texto).toBe('Baja: bien')
  })
  it('puntuación: los puntos de «¿Voy bien?» sobre 4,5 y sus palabras', () => {
    expect(puntuacionDe(4.5)).toBe(100)
    expect(puntuacionDe(3.5)).toBe(78)
    expect(puntuacionDe(2)).toBe(44)
    expect(palabraPuntuacion(78, true)).toEqual({ palabra: 'Vas bien', tono: 'ok' })
    expect(palabraPuntuacion(44, true)).toEqual({ palabra: 'Casi', tono: 'warn' })
    expect(palabraPuntuacion(43, true)).toEqual({ palabra: 'Periodo flojo', tono: 'bad' })
    expect(palabraPuntuacion(43, false).palabra).toBe('Semana floja')
    const r = resumenSemana({ hoy: '2026-10-18', sesiones: [], fijos: 3, mediciones: [], comidas: [], pasos: [], objetivoProteina: 140, objetivoPasos: 10_000, recordsSemana: 0, subidasSemana: 0 })
    expect(r.puntos).toBe(1.25) // sin entrenos: 0 + proteína a medias 0,5 + cintura a medias 0,5 + pasos 0,25
  })
  it('objetivos: los manuales de Ajustes mandan; si no, con el peso de esa fecha', () => {
    expect(objetivosInforme(PERFIL, AJUSTES, 79, '2026-10-20')).toEqual({ kcal: 1850, proteina: 140 })
    const auto = objetivosInforme(PERFIL, null, 80, '2026-10-20')
    expect(auto.proteina).toBe(145)
    expect(objetivosInforme({ ...PERFIL, nacimiento: '' }, null, null, '2026-10-20').proteina).toBe(135)
  })
})

// ================================================================ periodo

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

// ================================================================ esfuerzo

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

// ================================================================ fuerza

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

// ================================================================ el mes de ejemplo

describe('informe del último mes (el ejemplo del diseño)', () => {
  const d = mesDeEjemplo()
  const inf = calcularInforme(entrada({ ...d, suplementos: [{ fecha: '2026-10-01', tomados: ['Creatina', 'Batido', 'Creatina'] }, { fecha: '2026-10-02', tomados: ['Creatina', 'Aceite de pescado'] }, { fecha: '2026-08-01', tomados: ['Creatina'] }] }))

  it('cabecera, periodo y secciones por defecto', () => {
    expect(inf.periodo).toBe('mes')
    expect(inf.hayDatos).toBe(true)
    expect(inf.secciones).toEqual({ entrenos: true, comida: true, cuerpo: true, pasos: true, detalle: false })
    expect(inf.cabecera).toMatchObject({
      titulo: 'Informe de progreso', nombre: 'Joel', sexo: 'Hombre', edad: 21, alturaCm: 177, periodo: 'Último mes · 21 sep – 20 oct 2026',
      creado: '20/10/2026 22:30', creadoPie: 'Creado el 20/10/2026 a las 22:30', tituloPdf: 'Informe JowyFit · Último mes', autor: 'Joel', comparado: null,
    })
    expect(inf.tuDia).toBeNull()
    expect(inf.detalleEntrenos).toBeNull()
    expect(inf.meses).toBeNull()
  })

  it('entrenos: 12 de 13, el viernes perdido, tiempo, series, kg, récords y subidas', () => {
    const e = inf.entrenos!
    expect(e).toMatchObject({ sesiones: 12, hechos: 12, enFijos: 12, tocaban: 13, extra: 0, texto: '12 de 13', pct: 92, evaluacion: { texto: 'Bien', tono: 'ok' }, movidos: 0, saltados: 0 })
    expect(e.perdidos).toEqual([{ fecha: '2026-10-02', nombre: 'Cuerpo completo C' }])
    expect(e.perdidosTexto).toBe('1 perdido (vie 2 oct)')
    expect(e.minutos).toBe(11 * 60 + 61)
    expect(e.minutosMedia).toBe(60)
    expect(e.tiempo).toBe('12 h 1 min')
    expect(e.series).toBe(12 * 9)
    expect(e.records).toBe(d.marcados)
    expect(e.subidas).toBe(d.marcados)
    // Kg movidos: peso × reps de las series de trabajo (sin calentamiento) de todo el mes.
    const kgEsperado = d.sesiones.filter(s => s.estado === 'hecha').flatMap(s => s.ejercicios).flatMap(x => x.series).filter(x => !x.calentamiento).reduce((t, x) => t + x.peso! * x.reps!, 0)
    expect(e.kg).toBe(kgEsperado)
  })

  it('la tabla de entrenos: 13 filas por fecha, «No hecho» y las etiquetas', () => {
    const f = inf.entrenos!.filas
    expect(f).toHaveLength(13)
    expect(f.map(x => x.fecha)).toEqual([...f.map(x => x.fecha)].sort())
    expect(f[0]).toMatchObject({ fechaTexto: 'mar 22 sep', nombre: 'Cuerpo completo A', estado: 'hecho', duracion: '1 h', series: 9, etiquetas: ['semana de prueba'], saltados: 0 })
    expect(f[0]!.esfuerzo).toMatchObject({ media: 7, marcadas: 6, total: 9, texto: '7 bien' })
    expect(f[0]!.kg).toBe(40 * 24 + 80 * 24 + 40 * 24)
    expect(f[3]).toMatchObject({ fecha: '2026-09-29', minutos: 61, duracion: '1 h 1 min' })
    const perdido = f.find(x => x.estado === 'perdido')!
    expect(perdido).toMatchObject({ fecha: '2026-10-02', fechaTexto: 'vie 2 oct', nombre: 'Cuerpo completo C', duracion: 'No hecho', minutos: null, series: null, kg: null, esfuerzo: null, sesionId: null })
    const ultimo = f[12]!
    // En el orden del entreno.
    expect(ultimo.records.map(r => r.texto)).toEqual(['Press de banca 55 × 8', 'Prensa de piernas 120 × 8'])
    expect(inf.entrenos!.porSemana).toBeNull()
  })

  it('subidas de peso (las 8 más recientes) con la estrella de récord', () => {
    const e = inf.entrenos!
    expect(e.subidasLista).toHaveLength(8)
    expect(e.subidasLista.slice(0, 2).map(x => x.ejercicio).sort()).toEqual(['bench-press', 'leg-press'])
    expect(e.subidasLista.find(x => x.ejercicio === 'bench-press')).toMatchObject({ nombre: 'Press de banca', antes: 52.5, ahora: 55, fecha: '2026-10-20', record: true })
    expect(e.subidasMas).toBe(d.marcados - 8)
  })

  it('esfuerzo del periodo y por ejercicio contra el objetivo', () => {
    const e = inf.entrenos!
    // 3 sesiones de prueba a 7, el curl a 9 y lo demás a 8 (2 de cada 3 series marcadas).
    expect(e.esfuerzo).toMatchObject({ marcadas: 72, total: 108, pct: 67, pocas: false })
    expect(e.esfuerzo.media).toBe(7.8) // (18 × 7 + 48 × 8 + 6 × 9) / 72 = 7,83
    const por = Object.fromEntries(e.esfuerzoPorEjercicio.map(x => [x.id, x]))
    expect(por['bicep-curl']).toMatchObject({ media: 8.5, palabra: 'duro', queDice: 'más duro', tonoQueDice: 'warn' })
    expect(por['seated-cable-row']).toMatchObject({ queDice: 'lo previsto', tonoQueDice: 'ok' })
    expect(por['bench-press']!.marcadas).toBe(16)
    expect(por['bench-press']!.total).toBe(24)
    expect(e.sinMarcar).toEqual([])
    const ev = e.evolucionEsfuerzo
    expect(ev).toMatchObject({ agrupado: 'sesion', mostrar: true })
    expect(ev.puntos).toHaveLength(12)
    expect(ev.puntos[0]).toMatchObject({ fecha: '2026-09-22', valor: 7, palabra: 'bien', tono: 'ok' })
    expect(ev.nota).toBe('Media de las series con esfuerzo marcado (las que se dejan en blanco no cuentan): 72 de 108 series (67 %).')
  })

  it('progreso de fuerza: 6 ejercicios más repetidos con su línea, récords y cambio', () => {
    const f = inf.fuerza!
    expect(f.ejercicios.map(x => x.id)).toEqual(['bench-press', 'leg-press', 'lat-pulldown', 'seated-cable-row', 'romanian-deadlift', 'bicep-curl'])
    expect(f.ejercicios[0]).toMatchObject({ nombre: 'Press de banca', unidad: 'kg', desde: 40, hasta: 55, cambio: 15, pct: 38, veces: 8, direccion: 'sube', tono: 'ok', titulo: 'de 40 a 55 kg', pie: '+15 kg (+38 %) · 8 veces', unSolo: null })
    expect(f.ejercicios[0]!.puntos.filter(p => p.record).map(p => p.fecha)).toEqual(['2026-09-25', '2026-09-29', '2026-10-06', '2026-10-09', '2026-10-16', '2026-10-20'])
    expect(f.ejercicios[2]!.titulo).toBe('de 40 a 47,5 kg')
  })

  it('kg por semana, series por grupo y mejor serie de cada ejercicio', () => {
    const f = inf.fuerza!
    expect(f.semanas.map(s => s.etiqueta)).toEqual(['21-27 sep', '28 sep-4 oct', '5-11 oct', '12-18 oct', '19-20 oct'])
    expect(f.semanas.at(-1)!.enCurso).toBe(true)
    expect(f.semanas[0]!.toneladas).toBe(Math.round(inf.semanas[0]!.kg / 100) / 10)
    const pecho = f.grupos.find(g => g.n === 'Pecho')!
    expect(pecho.v).toBe(Math.round((8 * 3) / (30 / 7) * 10) / 10)
    expect(pecho.nivel).toBe('poco')
    expect(pecho.tono).toBe('warn')
    expect(f.grupos.find(g => g.n === 'Hombros')!.v).toBe(0)
    const banca = f.mejores[0]!
    // De las 3 series iguales (55 × 8), la que tiene el esfuerzo marcado.
    expect(banca).toMatchObject({ id: 'bench-press', peso: 55, reps: 8, e1rm: 70, fecha: '2026-10-20', rpe: 8, esfuerzo: '8 bien', tono: 'ok', record: true, contraAnterior: null, contraTexto: '—' })
    expect(f.mejores.find(m => m.id === 'bicep-curl')).toMatchObject({ rpe: 9, esfuerzo: '9 duro', tono: 'warn' })
    expect(f.meses).toBeNull()
  })

  it('semana a semana y puntuación del periodo (media de las semanas completas)', () => {
    const s = inf.semanas
    expect(s).toHaveLength(5)
    expect(s.map(x => x.completa)).toEqual([true, true, true, true, false])
    expect(s[4]).toMatchObject({ enCurso: true, desde: '2026-10-19', hasta: '2026-10-20', etiqueta: '19-20 oct' })
    expect(s[1]!.entrenos).toEqual({ hechos: 2, fijos: 3, circulos: [true, true, false] })
    expect(s[4]!.entrenos.circulos).toEqual([true])
    for (const x of s) expect(x.puntuacion).toBe(Math.round((x.puntos! / 4.5) * 100))
    const p = inf.resumen.puntuacion!
    const completas = s.filter(x => x.completa).map(x => x.puntuacion!)
    expect(p.valor).toBe(Math.round(completas.reduce((a, b) => a + b, 0) / 4))
    expect(p.semanas).toBe(4)
    expect(p.enCurso).toBe(false)
    expect(p.nota).toBe('* Media de las 4 semanas completas. La semana en curso no cuenta hasta el domingo.')
    expect(s[0]!.peso).toBe(80.6)
    expect(s[0]!.pasos).toBe(Math.round((8000 * 4 + 11_000 * 3) / 7))
    expect(s[0]!.esfuerzo).toBe(7)
  })

  it('tabla del resumen: al empezar, ahora, cambio y evaluación', () => {
    const t = Object.fromEntries(inf.resumen.tabla.map(f => [f.dato, f]))
    expect(t['Peso (kg)']).toMatchObject({ inicio: '80,6', ahora: '79,1', cambio: { texto: '–1,5', direccion: 'baja', tono: 'ok' }, evaluacion: { texto: 'Baja: bien', tono: 'ok' } })
    expect(t['Grasa corporal (%)']).toMatchObject({ inicio: '25,0', ahora: '24,3', cambio: { texto: '–0,7' }, evaluacion: { texto: 'Baja: bien' } })
    expect(t['Cintura (cm)']).toMatchObject({ inicio: '99,5', ahora: '98,0', cambio: { texto: '–1,5' } })
    // El ejercicio principal es el de la meta de tipo ejercicio.
    expect(t['Press de banca (kg)']).toMatchObject({ inicio: '40', ahora: '55', cambio: { texto: '+15', direccion: 'sube', tono: 'ok' }, evaluacion: { texto: 'Récord', tono: 'oro' } })
    expect(t['Entrenos']).toMatchObject({ junto: '12 de 13', cambioTexto: '92 %', evaluacion: { texto: 'Bien' } })
    expect(t['Esfuerzo medio']).toMatchObject({ inicio: '7,0', evaluacion: { texto: 'Bien (7-8)', tono: 'ok' } })
    expect(t['Proteína al día (g)']!.cambioTexto).toBe('obj. 140')
    expect(t['Pasos al día']).toMatchObject({ cambioTexto: 'obj. 10.000', evaluacion: { texto: 'A mejorar', tono: 'warn' } })
  })

  it('cómo está tu cuerpo: zonas Bajo / Estándar / Alto con las palabras de la app', () => {
    const z = inf.resumen.zonas
    expect(z.map(x => x.nombre)).toEqual(['IMC (kg/m²)', 'Grasa corporal (%)', 'Cintura / altura'])
    expect(z[0]).toMatchObject({ valor: 25.2, texto: '25,2', palabra: 'algo alto', tono: 'warn', zona: 'alto', cortes: [18.5, 25] })
    expect(z[1]).toMatchObject({ valor: 24.3, palabra: 'normal', tono: 'ok', zona: 'estandar', cortes: [6, 25], fuente: 'bascula' })
    expect(z[2]).toMatchObject({ valor: 0.55, texto: '0,55', zona: 'alto', palabra: 'por encima', tono: 'bad' })
    expect(inf.resumen.zonasSubtitulo).toBe('báscula del 20 oct · cinta del 20 oct')
    expect(inf.resumen.zonasNota).toMatch(/hombres \(6-25 %\)/)
  })

  it('control de peso, metas, indicadores de la báscula, lo destacado y el consejo', () => {
    const cp = inf.resumen.controlPeso!
    expect(cp).toMatchObject({ peso: 79.1, grasa: 24.3, grasaFuente: 'bascula', meta: 18, metaPropia: true })
    const magra = 79.1 * (1 - 0.243)
    expect(cp.pesoConMeta).toBe(Math.round((magra / 0.82) * 10) / 10)
    expect(cp.sobra).toBe(Math.round((79.1 - magra / 0.82) * 10) / 10)
    expect(cp.ritmo).toBeLessThan(0)
    expect(cp.fechaMeta).toMatch(/^\p{L}+ 20\d\d$/u)
    expect(cp.filas.map(f => f.nombre)).toEqual(['Peso ahora', 'Peso con tu meta de grasa (18 %)', 'Grasa que sobra para la meta', 'Ritmo del mes', 'A este ritmo, meta de grasa'])
    const m = Object.fromEntries(inf.resumen.metas.map(x => [x.tipo, x]))
    expect(m.cintura).toMatchObject({ actual: 98, actualTexto: '98 cm', falta: 10, faltaTexto: 'faltan 10 cm', conseguida: false, mes: 'junio 2027' })
    expect(m.cintura!.progreso).toBeCloseTo(1.5 / 11.5)
    expect(m.ejercicio).toMatchObject({ actual: 55, faltaTexto: 'faltan 10 kg' })
    expect(m.grasa).toMatchObject({ actual: 24.3, faltaTexto: 'faltan 6,3 puntos' })
    expect(m.dominadas).toMatchObject({ actual: 0, faltaTexto: 'faltan 5 reps' })
    expect(m.libre).toMatchObject({ actual: null, actualTexto: 'Hecha', progreso: 1, conseguida: true, faltaTexto: '¡Conseguida!', mes: null })
    expect(inf.resumen.metasFecha).toBe('junio 2027')
    expect(inf.resumen.indicadores).toEqual({ fecha: '2026-10-20', filas: [{ nombre: 'Gasto en reposo', valor: '1665 kcal' }, { nombre: 'Músculo', valor: '56,0 kg' }, { nombre: 'Agua', valor: '55,6 %' }, { nombre: 'Grasa visceral', valor: '7' }, { nombre: 'Edad corporal', valor: '22' }] })
    const dest = inf.resumen.destacado
    expect(dest[0]).toEqual({ icono: 'estrella', tono: 'oro', texto: `${d.marcados} récords · ${d.marcados} subidas de peso` })
    expect(dest[1]!.texto).toBe('Prensa de piernas: de 80 a 120 kg')
    expect(dest[2]).toEqual({ icono: 'baja', tono: 'ok', texto: 'Cintura: –1,5 cm' })
    expect(inf.resumen.racha).toBe(2)
    expect(dest[3]!.texto).toBe('Racha: 2 semanas cumplidas')
    expect(inf.resumen.consejo).toMatchObject({ texto: 'Tu cintura baja: vas bien, sigue igual.', tono: 'ok', etiqueta: 'Vas bien' })
    expect(inf.resumen.lineas).toEqual([])
    expect(inf.resumen.casillas).toBeNull()
  })

  it('comida: días apuntados, medias solo de los días con algo, picoteo, cafeína, franjas y lo que más apuntas', () => {
    const c = inf.comida!
    expect(c.texto).toBe('28 de 30 días apuntados')
    expect(c.diasApuntados).toBe(28)
    const dias = c.dias.filter(x => x.apuntado)
    expect(c.dias.find(x => x.fecha === '2026-09-23')).toMatchObject({ apuntado: false, kcal: null, proteina: null, cafeina: null, tonoProteina: 'gris' })
    expect(c.proteina.media).toBe(Math.round(dias.reduce((t, x) => t + x.proteina!, 0) / 28))
    expect(c.proteina.objetivo).toBe(140)
    expect(c.proteina.diasCumplidos).toBe(dias.filter(x => x.proteina! >= 126).length)
    expect(c.proteina.evaluacion.texto).toBe('Algo corta')
    expect(c.kcal).toMatchObject({ objetivo: 1850, franja: [1665, 2035] })
    expect(c.picoteo).toEqual({ dias: 6, anterior: null, texto: 'el mes anterior: sin datos' })
    expect(c.cafeina).toMatchObject({ limite: 400, diasPorEncima: 1 })
    expect(c.porFranja.map(f => f.nombre)).toEqual(['Desayuno', 'Comida', 'Merienda', 'Cena'])
    expect(c.porFranja[0]).toMatchObject({ kcal: 125, proteina: 24 })
    expect(c.top[0]).toEqual({ nombre: 'Arroz con atún', veces: 28 })
    expect(c.top).toHaveLength(5)
    expect(c.macros).toMatchObject({ hidratos: 56, azucares: 55, grasas: null, sal: null, comidas: 1, texto: 'De lo escaneado: hidratos 56 g, azúcares 55 g (solo productos con etiqueta).' })
    expect(c.consejo).toMatchObject({ titulo: 'Para la proteína' })
    expect(c.suplementos).toEqual([{ nombre: 'Creatina', dias: 2 }, { nombre: 'Aceite de pescado', dias: 1 }, { nombre: 'Batido', dias: 1 }])
    expect(c.detalle).toBeNull()
    expect(c.objetivoNota).toBeNull()
    // Media de la semana para la línea de energía: la de los días apuntados de esa semana.
    const semana = c.dias.filter(x => x.fecha >= '2026-09-21' && x.fecha <= '2026-09-27' && x.apuntado)
    expect(c.dias[0]!.kcalSemana).toBe(Math.round(semana.reduce((t, x) => t + x.kcal!, 0) / semana.length))
  })

  it('cuerpo: series del periodo, medias semanales y tabla de valores', () => {
    const c = inf.cuerpo!
    expect(c.peso.puntos.map(p => p.valor)).toEqual([80.6, 80.2, 79.8, 79.4, 79.1])
    expect(c.peso).toMatchObject({ inicio: 80.6, ahora: 79.1, antes: { fecha: '2026-09-13', valor: 81 } })
    expect(c.peso.medias).toHaveLength(5)
    expect(c.grasa.puntos.map(p => p.fuente)).toEqual(['bascula', 'bascula', 'bascula', 'bascula'])
    expect(c.grasa.medias).toEqual([])
    expect(c.cintura.cambio).toMatchObject({ texto: '–1,5', direccion: 'baja' })
    expect(c.tabla.map(f => f.medicion)).toEqual(['Peso', 'Grasa corporal', 'Cintura', 'Cintura / altura', 'IMC', 'Gasto en reposo'])
    expect(c.tabla[0]).toMatchObject({ valor: '79,1 kg', rango: '58–78,3 kg', evaluacion: { texto: 'algo alto', tono: 'warn' } })
    expect(c.tabla[2]!.rango).toBe('hasta 88,5 cm')
    expect(c.nota).toBeNull()
  })

  it('pasos y gasto: con el peso de ESE día, no el de hoy', () => {
    const p = inf.pasos!
    expect(p.diasConDato).toBe(30)
    expect(p.diasCumplidos).toBe(p.dias.filter(x => x.pasos === 11_000).length)
    expect(p.media).toBe(Math.round(p.dias.reduce((t, x) => t + x.pasos!, 0) / 30))
    expect(p).toMatchObject({ objetivo: 10_000, troteKm: 3, diasTrote: 1 })
    expect(p.dias.find(x => x.fecha === '2026-09-26')!.pasosTrote).toBe(3900)
    expect(p.km).toBe(Math.round(p.dias.reduce((t, x) => t + x.pasos!, 0) * 1.77 * 0.415 / 100) / 10)
    const g21 = p.gastoDias.find(x => x.fecha === '2026-09-21')!
    // 21 sep: 80,6 kg y 25 % de grasa → Katch-McArdle 370 + 21,6 × 60,45 = 1676 (con el peso de hoy saldría 1663).
    expect(g21).toMatchObject({ reposo: 1676, formula: 'katch', entreno: 0 })
    expect(p.gastoDias.find(x => x.fecha === '2026-10-20')!.reposo).toBe(1663)
    expect(p.gastoDias.find(x => x.fecha === '2026-09-22')!.entreno).toBeGreaterThan(0)
    expect(p.gasto!.dias).toBe(30)
    expect(p.gasto!.total).toBe(Math.round(p.gastoDias.reduce((t, x) => t + x.total, 0) / 30))
  })
})

// ================================================================ «Tu día»

/** El día de la página 5 del diseño: martes 20 de octubre, con 4 semanas de historial detrás. */
function diaDeEjemplo(extra: Partial<Sesion> = {}) {
  siguienteId = 100
  const ant = ['2026-10-06', '2026-10-09', '2026-10-13', '2026-10-16']
  const banca = [47.5, 50, 50, 52.5]
  const curl = [13, 13, 13, 14]
  const previas = ant.map((f, i) => SES(f, [
    E('bench-press', [S(banca[i]!, 8, 8), S(banca[i]!, 8, 8)]),
    E('lat-pulldown', [S(47.5, 8, 8), S(47.5, 8, 8)]),
    E('bicep-curl', [S(curl[i]!, 10, 8.5)]),
    E('tricep-pushdown', [S(27.5, 12)]),
    E('assisted-pull-up', [S(-20, 6)], { registro: 'asistido' }),
    E('leg-press', [S(110, 10, 7.5)]),
  ]))
  const hoy = SES('2026-10-20', [
    E('bench-press', [S(20, 10, 5, { calentamiento: true }), S(55, 6, 9, { record: true }), S(52.5, 8, 9)]),
    E('lat-pulldown', [S(47.5, 10, 7), S(47.5, 9, 7)]),
    E('bicep-curl', [S(12, 10, 9)]),
    E('tricep-pushdown', [S(27.5, 12)]),
    E('lateral-raise', [S(7.5, 12, 8)]),
    E('assisted-pull-up', [S(-15, 6)], { registro: 'asistido' }),
    E('leg-press', [S(110, 10, 8.5)]),
  ], { ...extra })
  const mediciones = [
    MED('2026-10-14', { pesoKg: 79.4 }), MED('2026-10-17', { pesoKg: 79.2 }),
    MED('2026-10-13', { perimetros: { cintura: 98 } }),
    MED('2026-10-20', { pesoKg: 79.1, bascula: { grasaPct: 24.3 } }),
  ]
  const comidas: Comida[] = []
  for (const f of diasDe('2026-09-22', '2026-10-19')) comidas.push(COM(f, '14:00', 'comida', 'Comida', 1800, 131))
  comidas.push(
    COM('2026-10-20', '06:50', 'desayuno', 'Café', 5, 0, { cafeina: 80, tipo: 'bebida' }),
    COM('2026-10-20', '14:10', 'comida', 'Pollo teriyaki', 1465, 112),
    COM('2026-10-20', '17:45', 'merienda', 'Quicos', 150, 3, { tipo: 'picoteo', racion: 'P' }),
    COM('2026-10-20', '18:20', 'merienda', 'Monster', 230, 0, { cafeina: 160, tipo: 'bebida' }),
  )
  const pasos: PasosDia[] = diasDe('2026-09-22', '2026-10-19').map(f => ({ fecha: f, pasos: 8420, fuente: 'manual' }))
  pasos.push({ fecha: '2026-10-20', pasos: 6240, fuente: 'manual' })
  return { sesiones: [...previas, hoy], mediciones, comidas, pasos }
}

describe('«Tu día» (Hoy): todo contra lo normal de las 4 semanas anteriores', () => {
  const d = diaDeEjemplo()
  const inf = calcularInforme(entrada({ ...d, periodo: 'hoy' }))
  const t = inf.tuDia!
  const fila = (id: string) => t.ejercicios.find(e => e.id === id)!

  it('cabecera de «Tu día» sin puntuación', () => {
    expect(inf.cabecera).toMatchObject({ titulo: 'Tu día', periodo: 'Hoy · martes 20 oct 2026', comparado: 'Comparado con tus últimas 4 semanas' })
    expect(inf.resumen.puntuacion).toBeNull()
    expect(inf.semanas).toEqual([])
    expect(t).toMatchObject({ fecha: '2026-10-20', palabra: 'hoy', primerDia: false })
  })

  it('banca: «55 kg · lo normal: 50 kg · +10 %» y ¡Récord!', () => {
    expect(fila('bench-press')).toMatchObject({
      nombre: 'Press de banca', unidad: 'kg', hoy: 55, normal: 50, min: 47.5, max: 52.5, pct: 10, juicio: 'mejor', direccion: 'sube', tono: 'ok', por: 'peso',
      frase: '55 kg · lo normal: 50 kg · +10 %', hoyTexto: 'hoy 55 kg × 6', record: true, primera: false,
    })
    // Más peso y le costó más: es lo esperable y no se marca.
    expect(fila('bench-press').esfuerzo).toMatchObject({ hoy: 9, normal: 8, texto: '9,0 duro', tono: 'warn', normalTexto: 'lo normal: 8,0', costo: null, deObjetivo: false })
  })

  it('mismo peso con más repeticiones es mejor; y costó menos con el mismo peso', () => {
    expect(fila('lat-pulldown')).toMatchObject({ juicio: 'mejor', por: 'reps', frase: 'Mismo peso, 2 reps más que lo normal', tono: 'ok' })
    expect(fila('lat-pulldown').esfuerzo).toMatchObject({ hoy: 7, normal: 8, costo: 'menos' })
  })

  it('menos peso es peor (–8 %); igual que lo normal; primera vez; ayuda en asistidos', () => {
    expect(fila('bicep-curl')).toMatchObject({ hoy: 12, normal: 13, pct: -8, juicio: 'peor', tono: 'bad', frase: '12 kg · lo normal: 13 kg · –8 %' })
    expect(fila('bicep-curl').esfuerzo.normalTexto).toBe('lo normal: 8,5')
    expect(fila('tricep-pushdown')).toMatchObject({ juicio: 'igual', tono: 'tinta', frase: '27,5 kg · igual que lo normal', por: null })
    expect(fila('tricep-pushdown').esfuerzo).toMatchObject({ hoy: null, texto: 'sin marcar', tono: 'gris', normalTexto: 'objetivo: 8', deObjetivo: true })
    expect(fila('lateral-raise')).toMatchObject({ primera: true, normal: null, juicio: 'neutro', tono: 'azul', frase: 'Primera vez: aún no hay con qué comparar', min: null })
    expect(fila('lateral-raise').esfuerzo).toMatchObject({ normal: 8, normalTexto: 'objetivo: 8' })
    expect(fila('assisted-pull-up')).toMatchObject({ unidad: 'asistido', hoy: 15, normal: 20, pct: -25, direccion: 'baja', juicio: 'mejor', frase: 'ayuda 15 kg · lo normal: ayuda 20 kg · –25 %', hoyTexto: 'hoy ayuda 15 kg × 6' })
    // Mismo peso y 1 punto más de esfuerzo: «costó más».
    expect(fila('leg-press').esfuerzo).toMatchObject({ hoy: 8.5, normal: 7.5, costo: 'más' })
  })

  it('proteína, pasos y peso contra lo normal', () => {
    expect(t.proteina).toMatchObject({ valor: 115, normal: 131, pct: -12, direccion: 'baja', juicio: 'peor', tono: 'bad', texto: '–12 %', normalTexto: 'lo normal: 131 g' })
    expect(t.pasos).toMatchObject({ valor: 6240, normal: 8420, pct: -26, juicio: 'peor', normalTexto: 'lo normal: 8420' })
    expect(t.peso).toMatchObject({ valor: 79.1, normal: 79.3, diferencia: -0.2, direccion: 'baja', juicio: 'mejor', tono: 'ok', texto: '–0,2 kg', normalTexto: 'media de los 7 días antes: 79,3 kg' })
    expect(t.kcal).toMatchObject({ valor: 1850, normal: 1850, direccion: 'igual', tono: 'ok', texto: 'dentro del objetivo' })
    expect(t.cafeina).toEqual({ valor: 240, limite: 400, tono: 'tinta' })
  })

  it('recuento y frase del día', () => {
    // Mejor: banca, jalón, asistida y peso. Peor: curl, proteína y pasos. Igual: tríceps y prensa.
    expect(t.recuento).toEqual({ mejor: 4, peor: 3, igual: 2 })
    expect(t.frase).toBe('Buen día de fuerza. Récord en press de banca (55 kg), mejor en dominada asistida, más repeticiones en jalón al pecho y bajas de peso. Peor: curl de bíceps, la proteína y los pasos.')
  })

  it('ficha del entreno, ejercicio principal con su banda de lo normal, gasto y comida', () => {
    expect(t.entreno).toMatchObject({ estado: 'hecho', nombre: 'Cuerpo completo A', minutos: 60, normal: 60, diferencia: 0, texto: '0 min', normalTexto: 'lo normal: 60 min · hoy 1 h' })
    expect(t.principal).toMatchObject({ id: 'bench-press', titulo: 'Press de banca, tus últimas 5 veces', banda: { min: 47.5, max: 52.5, mediana: 50 } })
    expect(t.principal!.puntos.at(-1)).toEqual({ fecha: '2026-10-20', valor: 55, record: true })
    const g = t.gasto!
    expect(g.reposo).toBe(1663)
    expect(g.pasos).toBe(181)
    expect(g.total).toBe(g.reposo + g.pasos + g.entreno)
    expect(g.comido).toBe(1850)
    expect(g.diferencia).toBe(1850 - g.total)
    expect(g.texto).toBe(`unas ${Math.round((g.total - 1850) / 10) * 10} menos de lo gastado`)
    expect(g.tono).toBe('ok')
    expect(t.comidas.map(c => c.hora)).toEqual(['06:50', '14:10', '17:45', '18:20'])
    expect(t.comidas[2]).toMatchObject({ franjaTexto: 'Merienda', racion: 'Poco', picoteo: true, cafeina: null })
    expect(t.total).toEqual({ kcal: 1850, proteina: 115, cafeina: 240 })
    expect(t.tonoProteina).toBe('warn')
    expect(t.cuerpo).toBe('Cuerpo hoy: 79,1 kg · 24,3 % · cintura sin medir (última: 98 cm el 13 oct)')
  })

  it('con «una a una» añade el detalle de cada serie', () => {
    const conDetalle = calcularInforme(entrada({ ...d, periodo: 'hoy', secciones: { detalle: true } }))
    const det = conDetalle.detalleEntrenos!
    expect(det).toHaveLength(1)
    expect(det[0]!.titulo).toBe('mar 20 oct · Cuerpo completo A · 1 h')
    expect(det[0]!.ejercicios[0]!.series[0]).toMatchObject({ calentamiento: true, record: false })
    expect(det[0]!.ejercicios[0]!.series[1]).toMatchObject({ peso: 55, reps: 6, record: true })
    expect(conDetalle.comida!.detalle![0]!.total).toEqual({ kcal: 1850, proteina: 115, cafeina: 240 })
  })
})

describe('«Tu día»: semana suave, ayer, descanso y primer día', () => {
  it('semana suave: bajar es lo previsto, sale en gris y no cuenta como peor', () => {
    const d = diaDeEjemplo({ suave: true })
    const t = calcularInforme(entrada({ ...d, periodo: 'hoy' })).tuDia!
    const curl = t.ejercicios.find(e => e.id === 'bicep-curl')!
    expect(curl).toMatchObject({ suave: true, juicio: 'neutro', tono: 'gris', frase: 'semana suave: –10 % previsto' })
    expect(t.ejercicios.find(e => e.id === 'bench-press')).toMatchObject({ juicio: 'neutro', frase: '55 kg · lo normal: 50 kg · +10 %' })
    expect(t.recuento!.peor).toBe(2)
  })

  it('Ayer: compara con las 4 semanas anteriores a ayer y dice «ayer»', () => {
    const d = diaDeEjemplo()
    const t = calcularInforme(entrada({ ...d, periodo: 'ayer', ahora: new Date('2026-10-21T08:00:00') })).tuDia!
    expect(t.palabra).toBe('ayer')
    expect(t.ejercicios.find(e => e.id === 'bench-press')!.hoyTexto).toBe('ayer 55 kg × 6')
    expect(t.entreno.normalTexto).toBe('lo normal: 60 min · ayer 1 h')
  })

  it('sin entreno ese día: «No hecho» si tocaba, «Descanso» si no; principal el más repetido', () => {
    const d = diaDeEjemplo()
    const sin = d.sesiones.filter(s => s.fecha !== '2026-10-20')
    const martes = calcularInforme(entrada({ ...d, sesiones: sin, periodo: 'hoy', ahora: new Date('2026-10-20T23:00:00') })).tuDia!
    expect(martes.entreno).toMatchObject({ estado: 'no hecho', texto: 'No hecho', nombre: 'Cuerpo completo A' })
    expect(martes.ejercicios).toEqual([])
    expect(martes.principal!.id).toBe('bench-press')
    expect(martes.principal!.banda).toEqual({ min: 47.5, max: 52.5, mediana: 50 })
    expect(martes.frase).toBe('Día sin entreno. Bajas de peso. Peor: la proteína y los pasos.')
    const lunes = calcularInforme(entrada({ ...d, sesiones: sin, periodo: 'ayer', ahora: new Date('2026-10-20T08:00:00') })).tuDia!
    expect(lunes.entreno).toMatchObject({ estado: 'descanso', texto: 'Descanso', nombre: null })
  })

  it('primer día con datos: sin recuento y con la frase de bienvenida', () => {
    siguienteId = 500
    const s = SES('2026-10-20', [E('bench-press', [S(40, 8)])])
    const inf = calcularInforme(entrada({ sesiones: [s], mediciones: [MED('2026-10-20', { pesoKg: 80 })], periodo: 'hoy' }))
    const t = inf.tuDia!
    expect(t.primerDia).toBe(true)
    expect(t.recuento).toBeNull()
    expect(t.frase).toBe('Es tu primer día con datos: a partir de ahora el informe te comparará contigo mismo.')
    expect(t.ejercicios[0]).toMatchObject({ primera: true, frase: 'Primera vez: aún no hay con qué comparar' })
    expect(t.proteina).toMatchObject({ valor: null, juicio: null, normalTexto: 'lo normal: —' })
    expect(t.peso).toMatchObject({ valor: 80, normal: null, juicio: null })
    expect(t.total).toBeNull()
    expect(t.gasto).toMatchObject({ comido: null, diferencia: null, texto: null, tono: 'gris' })
    expect(t.cuerpo).toBe('Cuerpo hoy: 80,0 kg · cintura sin medir')
    expect(t.cafeina).toEqual({ valor: null, limite: 400, tono: 'gris' })
    expect(t.tonoProteina).toBe('gris')
  })

  it('comer más de lo gastado sale en ámbar; día flojo; más cafeína del límite en rojo', () => {
    siguienteId = 600
    const ant = SES('2026-10-13', [E('bench-press', [S(60, 8)])])
    const hoy = SES('2026-10-20', [E('bench-press', [S(50, 8)])], { fin: undefined })
    const inf = calcularInforme(entrada({
      sesiones: [ant, hoy], mediciones: [MED('2026-10-20', { pesoKg: 80, perimetros: { cintura: 97 } })], periodo: 'hoy',
      comidas: [COM('2026-10-20', '14:00', 'comida', 'Mucho', 4000, 50, { cafeina: 500 })],
    }))
    const t = inf.tuDia!
    expect(t.gasto!.tono).toBe('warn')
    expect(t.gasto!.texto).toMatch(/^unas \d+ más de lo gastado$/)
    expect(t.frase).toBe('Día flojo de fuerza. Peor: press de banca.')
    expect(t.cafeina.tono).toBe('bad')
    expect(t.kcal).toMatchObject({ direccion: 'sube', tono: 'warn', juicio: 'neutro' })
    expect(t.tonoProteina).toBe('bad')
    expect(t.entreno).toMatchObject({ minutos: null, texto: '—', normalTexto: 'lo normal: 60 min · hoy —' })
    expect(t.cuerpo).toBe('Cuerpo hoy: 80,0 kg · cintura 97 cm')
  })

  it('gasto igual a lo comido; objetivo «fuerza»: el peso no se juzga; grasa por medidas el mismo día', () => {
    siguienteId = 700
    const ms = [MED('2026-10-19', { pesoKg: 80 }), MED('2026-10-20', { pesoKg: 81, perimetros: { cintura: 90, cuello: 40 } })]
    const base = calcularInforme(entrada({ mediciones: ms, periodo: 'hoy', perfil: { ...PERFIL, objetivo: 'fuerza' } })).tuDia!
    expect(base.peso).toMatchObject({ juicio: 'neutro', tono: 'gris', direccion: 'sube' })
    expect(base.cuerpo).toMatch(/^Cuerpo hoy: 81,0 kg · [\d,]+ % \(por medidas\) · cintura 90 cm$/)
    const comido = base.gasto!.total
    const igual = calcularInforme(entrada({ mediciones: ms, periodo: 'hoy', comidas: [COM('2026-10-20', '14:00', 'comida', 'x', comido, 140)] })).tuDia!
    expect(igual.gasto!.texto).toBe('lo mismo que lo gastado')
    expect(igual.frase).toBe('Día sin entreno. Peor: el peso (sube).')
  })

  it('comparadores: kcal fuera por abajo, peso igual y sin datos', () => {
    expect(compararKcal(1500, 1850)).toMatchObject({ direccion: 'baja', tono: 'warn', texto: '–19 %' })
    expect(compararKcal(null, 1850)).toMatchObject({ juicio: null, tono: 'gris', normalTexto: 'objetivo: 1850 kcal' })
    expect(compararPeso(79.2, 79.3, 'perder')).toMatchObject({ direccion: 'igual', juicio: 'igual', tono: 'tinta' })
    expect(compararPeso(null, 79.3, 'perder').juicio).toBeNull()
  })
})

// ================================================================ casos límite

describe('casos con pocos datos', () => {
  it('sin nada apuntado (y sin perfil): nada de ceros inventados', () => {
    const inf = calcularInforme(entrada({ perfil: null, ajustes: null, rutina: null }))
    expect(inf.hayDatos).toBe(false)
    expect(inf.cabecera).toMatchObject({ nombre: null, sexo: null, edad: null, alturaCm: null, autor: '' })
    expect(inf.entrenos).toBeNull()
    expect(inf.fuerza).toBeNull()
    expect(inf.comida).toBeNull()
    expect(inf.cuerpo).toBeNull()
    expect(inf.pasos).toBeNull()
    expect(inf.resumen.tabla).toEqual([])
    expect(inf.resumen.zonas).toEqual([])
    expect(inf.resumen.zonasSubtitulo).toBeNull()
    expect(inf.resumen.controlPeso).toBeNull()
    expect(inf.resumen.indicadores).toBeNull()
    expect(inf.resumen.consejo).toBeNull()
    expect(inf.resumen.destacado).toEqual([])
    expect(inf.resumen.racha).toBe(0)
    expect(inf.resumen.lineas.map(l => l.texto)).toEqual([
      'Entrenos: no hay entrenos de estos días', 'Comida: no hay comidas apuntadas de estos días', 'Cuerpo: no te has pesado ni medido estos días', 'Pasos: no hay pasos apuntados de estos días',
    ])
    // Sin rutina ni días fijos y sin nada apuntado: semanas vacías, sin barra ni puntuación.
    expect(inf.semanas.every(s => s.entrenos.fijos === 0 && s.entrenos.hechos === 0)).toBe(true)
    expect(inf.semanas.every(s => s.puntos === null && s.puntuacion === null && s.palabra === null && s.tono === 'gris' && s.tonoPalabra === 'gris')).toBe(true)
    expect(inf.resumen.puntuacion).toBeNull()
    expect(inf.semanas.every(s => s.peso === null && s.proteina === null && s.pasos === null && s.esfuerzo === null)).toBe(true)
  })

  it('periodo sin entrenos con rutina: «Entrenos: 0 de N» en rojo y un solo peso de antes', () => {
    const inf = calcularInforme(entrada({ periodo: 'semana', mediciones: [MED('2026-10-01', { pesoKg: 80 })], comidas: [COM('2026-10-18', '14:00', 'comida', 'x', 1000, 50)] }))
    expect(inf.hayDatos).toBe(true)
    expect(inf.entrenos).toBeNull()
    // Jueves y viernes perdidos; el martes 20 es hoy y aún no cuenta.
    expect(inf.resumen.lineas[0]).toEqual({ texto: 'Entrenos: 0 de 2', tono: 'bad' })
    expect(inf.resumen.lineas.find(l => l.texto.startsWith('Cuerpo'))!.texto).toBe('Cuerpo: no te has pesado ni medido estos días (último peso: 80,0 kg, 1 oct)')
    const peso = inf.resumen.tabla.find(f => f.dato === 'Peso (kg)')!
    expect(peso).toMatchObject({ inicio: '80', ahora: null, cambio: null, evaluacion: { texto: 'Sin medir', tono: 'gris' }, nota: 'último: 80 (1 oct)' })
    // «Última semana»: las 7 casillas del miércoles 14 al martes 20.
    const cas = inf.resumen.casillas!
    expect(cas.map(c => c.inicial).join('')).toBe('XJVSDLM')
    expect(cas.map(c => c.estado)).toEqual(['descanso', 'perdido', 'perdido', 'opcional', 'descanso', 'descanso', 'plan'])
    // Sin semanas completas en el periodo y la semana en curso sin nada apuntado: no hay puntuación.
    expect(inf.resumen.puntuacion).toBeNull()
    expect(inf.comida!.picoteo.texto).toBe('la semana anterior: sin datos')
  })

  it('un solo dato: sin tendencia, «Un solo dato» y la gráfica con un punto', () => {
    siguienteId = 800
    const s = SES('2026-10-15', [E('bench-press', [S(40, 8, 8)]), E('plank', [S(null, null, null, { segundos: 45 })], { registro: 'tiempo' })])
    const inf = calcularInforme(entrada({ sesiones: [s], mediciones: [MED('2026-10-15', { pesoKg: 80 })] }))
    const peso = inf.resumen.tabla.find(f => f.dato === 'Peso (kg)')!
    expect(peso).toMatchObject({ inicio: null, ahora: '80', cambio: null, evaluacion: { texto: 'Un solo dato' } })
    expect(inf.cuerpo!.peso).toMatchObject({ inicio: null, ahora: 80, cambio: null, antes: null })
    const g = inf.fuerza!.ejercicios[0]!
    expect(g).toMatchObject({ veces: 1, titulo: '40 kg', pie: '1 vez', unSolo: '40 kg × 8', direccion: 'igual', tono: 'gris' })
    expect(inf.fuerza!.ejercicios[1]).toMatchObject({ unidad: 's', unSolo: '45 s', titulo: '45 s' })
    const banca = inf.resumen.tabla.find(f => f.dato === 'Press de banca (kg)')!
    expect(banca).toMatchObject({ inicio: null, ahora: '40', cambio: null, nota: 'Un solo entreno en estos días', evaluacion: { texto: 'Igual' } })
    expect(inf.entrenos!.evolucionEsfuerzo.mostrar).toBe(false)
    expect(inf.resumen.controlPeso).toMatchObject({ grasa: null, pesoConMeta: null, sobra: null, ritmo: null, fechaMeta: null, metaPropia: false, meta: 18 })
    expect(inf.resumen.controlPeso!.filas).toEqual([{ nombre: 'Peso ahora', valor: '80,0 kg' }])
    expect(inf.resumen.zonasSubtitulo).toBe('peso del 15 oct')
  })

  it('esfuerzos en blanco: «sin marcar», sin gráfica, sin fila de esfuerzo en el resumen', () => {
    siguienteId = 900
    const ses = ['2026-10-13', '2026-10-15', '2026-10-16'].map(f => SES(f, [E('bench-press', [S(40, 8), S(40, 8)])]))
    const inf = calcularInforme(entrada({ sesiones: ses }))
    const e = inf.entrenos!
    expect(e.esfuerzo).toMatchObject({ media: null, texto: 'sin marcar', marcadas: 0, total: 6, pocas: true })
    expect(e.esfuerzoPorEjercicio).toEqual([])
    expect(e.sinMarcar).toEqual(['Press de banca'])
    expect(e.evolucionEsfuerzo).toMatchObject({ puntos: [], mostrar: false, objetivo: null })
    expect(e.evolucionEsfuerzo.nota).toMatch(/0 de 6 series \(0 %\)\. Pocas series marcadas\.$/)
    expect(inf.resumen.tabla.some(f => f.dato === 'Esfuerzo medio')).toBe(false)
    expect(inf.fuerza!.mejores[0]).toMatchObject({ esfuerzo: 'sin marcar', tono: 'gris', rpe: null })
    expect(inf.fuerza!.ejercicios[0]).toMatchObject({ titulo: '40 kg, igual', tono: 'gris', pie: '3 veces' })
  })

  it('pocas series marcadas: la cifra lo dice', () => {
    siguienteId = 950
    const ses = ['2026-10-13', '2026-10-15'].map(f => SES(f, [E('bench-press', [S(40, 8, 8), S(40, 8), S(40, 8), S(40, 8)])]))
    const inf = calcularInforme(entrada({ sesiones: ses }))
    expect(inf.resumen.tabla.find(f => f.dato === 'Esfuerzo medio')!.nota).toBe('pocas series marcadas')
  })

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

  it('subida del peso: «Sube: ojo» y el ejercicio principal que baja en rojo; asistidos al revés', () => {
    siguienteId = 1000
    const ses = [
      SES('2026-10-06', [E('bench-press', [S(50, 8)]), E('assisted-pull-up', [S(-20, 6)], { registro: 'asistido' })]),
      SES('2026-10-13', [E('bench-press', [S(45, 8)]), E('assisted-pull-up', [S(-25, 6)], { registro: 'asistido' })]),
    ]
    const ms = [MED('2026-10-01', { pesoKg: 80 }), MED('2026-10-15', { pesoKg: 81 })]
    const inf = calcularInforme(entrada({ sesiones: ses, mediciones: ms }))
    expect(inf.resumen.tabla.find(f => f.dato === 'Peso (kg)')!.evaluacion).toEqual({ texto: 'Sube: ojo', tono: 'warn' })
    expect(inf.resumen.tabla.find(f => f.dato === 'Press de banca (kg)')).toMatchObject({ cambio: { direccion: 'baja', tono: 'bad' }, evaluacion: { texto: 'Baja', tono: 'bad' } })
    const asist = inf.fuerza!.ejercicios.find(x => x.id === 'assisted-pull-up')!
    expect(asist).toMatchObject({ unidad: 'asistido', menosEsMejor: true, desde: 20, hasta: 25, direccion: 'sube', tono: 'bad' })
    expect(inf.resumen.destacado).toEqual([])
    // Con la asistida como meta: «Más ayuda».
    const meta: Meta = { tipo: 'ejercicio', titulo: 'x', objetivo: 0, unidad: 'kg', ejercicio: 'assisted-pull-up' }
    const conMeta = calcularInforme(entrada({ sesiones: ses, metas: [meta] }))
    expect(conMeta.resumen.tabla.find(f => f.dato.startsWith('Dominada asistida'))).toMatchObject({ dato: 'Dominada asistida (ayuda, kg)', evaluacion: { texto: 'Más ayuda' } })
    const menos = calcularInforme(entrada({ sesiones: [...ses, SES('2026-10-15', [E('assisted-pull-up', [S(-10, 6)], { registro: 'asistido' })])], metas: [meta] }))
    expect(menos.resumen.tabla.find(f => f.dato.startsWith('Dominada asistida'))!.evaluacion).toEqual({ texto: 'Menos ayuda', tono: 'ok' })
  })

  it('el principal baja en semana suave: gris; sube sin récord: «Sube»; reps en corporales', () => {
    siguienteId = 1100
    const suave = [SES('2026-10-06', [E('bench-press', [S(50, 8)])]), SES('2026-10-13', [E('bench-press', [S(45, 8)])], { suave: true })]
    expect(calcularInforme(entrada({ sesiones: suave })).resumen.tabla.find(f => f.dato === 'Press de banca (kg)')!.evaluacion).toEqual({ texto: 'Semana suave', tono: 'gris' })
    const sube = [SES('2026-10-06', [E('bench-press', [S(50, 8)])]), SES('2026-10-13', [E('bench-press', [S(55, 8)])])]
    expect(calcularInforme(entrada({ sesiones: sube })).resumen.tabla.find(f => f.dato === 'Press de banca (kg)')!.evaluacion).toEqual({ texto: 'Sube', tono: 'ok' })
    const flex = [SES('2026-10-06', [E('push-up', [S(null, 10)], { registro: 'corporal' })]), SES('2026-10-13', [E('push-up', [S(null, 14)], { registro: 'corporal' })])]
    const inf = calcularInforme(entrada({ sesiones: flex }))
    expect(inf.resumen.tabla.find(f => f.dato === 'Flexiones (reps)')).toMatchObject({ inicio: '10', ahora: '14', cambio: { texto: '+4' } })
    expect(inf.fuerza!.ejercicios[0]).toMatchObject({ unidad: 'reps', titulo: 'de 10 a 14 reps', pie: '+4 reps (+40 %) · 2 veces' })
  })

  it('sesiones extra, movidas, cortas, libres, saltadas, sin entreno en un día fijo antes de la rutina', () => {
    siguienteId = 1200
    const ajustes = { ...AJUSTES, recolocadas: [{ fecha: '2026-10-17', letra: 'C', desde: '2026-10-16' }] } as Ajustes
    const ses = [
      SES('2026-10-13', [E('bench-press', [S(40, 8, 8)]), E('leg-press', [S(80, 8)], { estado: 'saltado', series: [S(80, 8, null, { hecha: false })] })], { version: 'corta' }),
      SES('2026-10-13', [E('bicep-curl', [S(10, 10, 8)])], { letra: 'L', nombre: 'Entreno libre' }),
      SES('2026-10-14', [E('bicep-curl', [S(10, 10, 8)])], { letra: 'L', nombre: 'Entreno libre' }),
      SES('2026-10-17', [E('bench-press', [S(42.5, 8, 8)])], { letra: 'C', nombre: 'Cuerpo completo C' }),
    ]
    const inf = calcularInforme(entrada({ sesiones: ses, ajustes, periodo: 'semana', ahora: new Date('2026-10-19T20:00:00'), rutina: { ...RUTINA, creada: '2026-10-16T10:00:00.000Z' } }))
    const e = inf.entrenos!
    // Martes 13 hecho (y un libre el mismo día: un solo día); miércoles 14 libre (extra); jueves 15 anterior a la rutina
    // (no se pudo perder); viernes 16 movido al sábado 17, que se hizo.
    expect(e).toMatchObject({ sesiones: 4, hechos: 3, enFijos: 2, tocaban: 2, extra: 1, movidos: 1, texto: '2 de 2', saltados: 1, perdidos: [] })
    expect(e.filas.find(f => f.estado === 'movido')).toMatchObject({ fecha: '2026-10-16', duracion: 'Movido' })
    expect(e.filas.find(f => f.fecha === '2026-10-13' && f.nombre === 'Cuerpo completo A')!.etiquetas).toEqual(['corta'])
    expect(e.filas.find(f => f.nombre === 'Entreno libre')!.etiquetas).toEqual(['libre'])
    expect(inf.resumen.tabla.find(f => f.dato === 'Entrenos')).toMatchObject({ junto: '2 de 2', cambioTexto: '100 %', nota: '1 extra', evaluacion: { texto: 'Bien' } })
    expect(inf.resumen.casillas!.find(c => c.fecha === '2026-10-15')!.estado).toBe('descanso')
    expect(inf.resumen.casillas!.find(c => c.fecha === '2026-10-16')!.estado).toBe('movido')
  })

  it('domingo de una semana pasada con entreno fijo: perdido, o descanso si es anterior a la rutina', () => {
    siguienteId = 1300
    const rutina: Rutina = { ...RUTINA, dias: [diaR('A', 6)] }
    const inf = calcularInforme(entrada({ rutina, sesiones: [SES('2026-10-11', [E('bench-press', [S(40, 8)])], { letra: 'A' })] }))
    expect(inf.entrenos!.perdidos.map(p => p.fecha)).toEqual(['2026-09-27', '2026-10-04', '2026-10-18'])
    expect(inf.entrenos!.texto).toBe('1 de 4')
    expect(inf.entrenos!.perdidosTexto).toBe('3 perdidos')
    const nueva = calcularInforme(entrada({ rutina: { ...rutina, creada: '2026-10-05T10:00:00.000Z' }, sesiones: [SES('2026-10-11', [E('bench-press', [S(40, 8)])])] }))
    expect(nueva.entrenos!.perdidos.map(p => p.fecha)).toEqual(['2026-10-18'])
  })

  it('una sola semana completa: su palabra del semáforo; sin datos de la semana en curso', () => {
    // Periodo «Última semana» un domingo: la semana del lunes al domingo, pero aún en curso hasta el domingo.
    siguienteId = 1400
    const ses = ['2026-10-13', '2026-10-15', '2026-10-16'].map(f => SES(f, [E('bench-press', [S(40, 8)])]))
    const domingo = calcularInforme(entrada({ sesiones: ses, periodo: 'semana', ahora: new Date('2026-10-18T20:00:00') }))
    expect(domingo.semanas).toHaveLength(1)
    expect(domingo.semanas[0]!.enCurso).toBe(true)
    expect(domingo.resumen.puntuacion).toMatchObject({ enCurso: true, semanas: 0, palabra: 'Vas bien', tono: 'ok', nota: '* La semana en curso, con los entrenos que ya tocaban hasta hoy.' })
    // «Último mes» un miércoles: la primera semana empieza antes del periodo y la última está en curso.
    const mes = calcularInforme(entrada({ sesiones: ses, periodo: 'mes', ahora: new Date('2026-10-21T20:00:00') }))
    const completas = mes.semanas.filter(s => s.completa)
    expect(completas.length).toBe(3)
    const una = calcularInforme(entrada({ sesiones: ses, periodo: 'semana', ahora: new Date('2026-10-26T08:00:00') }))
    expect(una.semanas.map(s => s.completa)).toEqual([false, false])
    expect(una.resumen.puntuacion).toBeNull()
    // Exactamente una semana completa: lunes 12 a domingo 18 dentro de un periodo del 12 al 20.
    const todo = calcularInforme(entrada({ sesiones: ses, mediciones: [MED('2026-10-12', { pesoKg: 80 })], periodo: 'todo' }))
    expect(todo.semanas.filter(s => s.completa)).toHaveLength(1)
    expect(todo.resumen.puntuacion).toMatchObject({ semanas: 1, nota: '* La semana completa del periodo. La semana en curso no cuenta hasta el domingo.', palabra: todo.semanas[0]!.palabra })
  })

  it('sin semanas puntuables: no hay puntuación', () => {
    expect(calcularInforme(entrada({ periodo: 'ayer' })).resumen.puntuacion).toBeNull()
  })

  it('metas: dominadas por las asistidas o las negativas, ejercicio sin hacer, grasa conseguida', () => {
    siguienteId = 1500
    const metas: Meta[] = [
      { tipo: 'dominadas', titulo: '5 dominadas', objetivo: 5, unidad: 'reps' },
      { tipo: 'ejercicio', titulo: 'Sentadilla 100', objetivo: 100, unidad: 'kg', ejercicio: 'squat', inicio: 60 },
      { tipo: 'ejercicio', titulo: 'Sin ejercicio', objetivo: 100, unidad: 'kg' },
      { tipo: 'grasa', titulo: 'Grasa al 26', objetivo: 26, unidad: '%', inicio: 30, fecha: '2027-01-01' },
      { tipo: 'peso', titulo: 'Peso 75', objetivo: 75, unidad: 'kg', inicio: 82, fecha: '2027-03-01' },
    ]
    const asist = SES('2026-10-13', [E('assisted-pull-up', [S(-30, 5)], { registro: 'asistido' })])
    const inf = calcularInforme(entrada({ sesiones: [asist], metas, mediciones: [MED('2026-10-13', { pesoKg: 80, bascula: { grasaPct: 25 } })] }))
    const m = inf.resumen.metas
    expect(m[0]).toMatchObject({ actual: 0, faltaTexto: 'vas por las asistidas' })
    expect(m[1]).toMatchObject({ actual: null, actualTexto: '—', falta: null, faltaTexto: '', progreso: 0 })
    expect(m[2]!.actual).toBeNull()
    expect(m[3]).toMatchObject({ actual: 25, conseguida: true, faltaTexto: '¡Conseguida!', progreso: 1 })
    expect(m[4]).toMatchObject({ actual: 80, actualTexto: '80 kg', faltaTexto: 'faltan 5 kg' })
    expect(inf.resumen.metasFecha).toBeNull()
    // Con la meta de grasa conseguida ya no hay meta propia: 18 % por defecto y la grasa que sobra.
    expect(inf.resumen.controlPeso).toMatchObject({ metaPropia: true, meta: 26, sobra: 0 })
    expect(inf.resumen.controlPeso!.filas.find(f => f.nombre === 'Grasa que sobra para la meta')!.valor).toBe('ya estás')
    const ayuda10 = SES('2026-10-14', [E('assisted-pull-up', [S(-10, 6)], { registro: 'asistido' })])
    expect(calcularInforme(entrada({ sesiones: [asist, ayuda10], metas: [metas[0]!] })).resumen.metas[0]!.faltaTexto).toBe('vas por las negativas')
    const neg = SES('2026-10-15', [E('negative-pull-up', [S(null, 5), S(null, 5), S(null, 5)], { registro: 'corporal' })])
    expect(calcularInforme(entrada({ sesiones: [asist, ayuda10, neg], metas: [metas[0]!] })).resumen.metas[0]!.faltaTexto).toBe('faltan 5 reps')
    const est = SES('2026-10-15', [E('pull-up', [S(null, 2)], { registro: 'corporal' })])
    expect(calcularInforme(entrada({ sesiones: [est], metas: [metas[0]!] })).resumen.metas[0]).toMatchObject({ actual: 2, faltaTexto: 'faltan 3 reps' })
    const solo = calcularInforme(entrada({ sesiones: [], metas: [metas[0]!] })).resumen.metas[0]!
    expect(solo.faltaTexto).toBe('faltan 5 reps')
    const libre = calcularInforme(entrada({ metas: [{ tipo: 'libre', titulo: 'x', objetivo: 1, unidad: '' }] })).resumen.metas[0]!
    expect(libre).toMatchObject({ actualTexto: 'Pendiente', progreso: 0 })
  })

  it('periodo «Todo» largo: mes a mes, una fila por semana y esfuerzo por semanas', () => {
    siguienteId = 2000
    const ses: Sesion[] = []
    for (let f = '2026-01-06'; f <= '2026-10-20'; f = new Date(new Date(`${f}T12:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10)) {
      const d = (new Date(`${f}T12:00:00`).getDay() + 6) % 7
      const sinNada = f >= '2026-03-02' && f <= '2026-03-08'
      if (d === 1 || d === 3 || d === 4) ses.push(SES(f, [E('bench-press', [S(40, 8, sinNada ? null : 8), S(40, 8, sinNada ? null : 8), S(40, 8, sinNada ? null : 8), S(40, 8, sinNada ? null : 8)])], sinNada ? { fin: undefined } : {}))
    }
    const ms = [MED('2026-01-06', { pesoKg: 85, perimetros: { cintura: 102 } }), MED('2026-06-01', { pesoKg: 82 }), MED('2026-10-20', { pesoKg: 79 })]
    const inf = calcularInforme(entrada({ sesiones: ses, mediciones: ms, periodo: 'todo', rutina: { ...RUTINA, creada: '2026-01-01T10:00:00.000Z' } }))
    expect(inf.rango.inicio).toBe('2026-01-06')
    const meses = inf.meses!
    expect(meses.map(m => m.etiqueta)).toEqual(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct'])
    expect(meses[0]).toMatchObject({ mes: '2026-01', anio: 2026, enCurso: false, peso: 85, cintura: 102, esfuerzo: 8 })
    expect(meses[0]!.entrenos).toBe(meses[0]!.tocaban)
    expect(meses[9]).toMatchObject({ enCurso: true, peso: 79 })
    expect(meses[1]!.peso).toBeNull()
    expect(inf.fuerza!.meses).toBe(meses)
    expect(inf.entrenos!.porSemana!.length).toBe(inf.semanas.length)
    expect(inf.entrenos!.porSemana![0]).toMatchObject({ lunes: '2026-01-05', etiqueta: '6-11 ene', entrenos: 3, duracion: '3 h', esfuerzo: 8, records: 0 })
    expect(inf.entrenos!.evolucionEsfuerzo.agrupado).toBe('semana')
    expect(inf.entrenos!.evolucionEsfuerzo.puntos.some(p => p.fecha === '2026-03-02')).toBe(false)
    expect(inf.entrenos!.porSemana!.find(x => x.lunes === '2026-03-02')).toMatchObject({ minutos: null, duracion: '—', esfuerzo: null })
    expect(inf.fuerza!.grupos.find(g => g.n === 'Pecho')).toMatchObject({ v: 12.1, nivel: 'bien', tono: 'ok' }) // 4 series × 3 días, con 41,3 semanas de periodo
    expect(inf.entrenos!.evolucionEsfuerzo.puntos[0]!.fecha).toBe('2026-01-05')
    expect(inf.comida).toBeNull()
  })

  it('detalle «una a una» de entrenos: alternativa por «Ocupado», saltado y nota', () => {
    siguienteId = 3000
    const s = SES('2026-10-13', [
      E('leg-press', [S(80, 10, 8, { nota: 'asiento 4' })], { planificado: 'squat', motivo: 'ocupado' }),
      E('bicep-curl', [S(10, 10, null, { hecha: false })], { estado: 'saltado' }),
      E('lat-pulldown', [S(40, 10)], { planificado: 'pull-up', motivo: 'cambio' }),
    ], { fin: undefined })
    const inf = calcularInforme(entrada({ sesiones: [s], secciones: { detalle: true } }))
    const d = inf.detalleEntrenos![0]!
    expect(d.titulo).toBe('mar 13 oct · Cuerpo completo A')
    expect(d.ejercicios[0]).toMatchObject({ nombre: 'Prensa de piernas', enVezDe: 'squat', motivo: 'ocupado', saltado: false })
    expect(d.ejercicios[0]!.series[0]).toMatchObject({ nota: 'asiento 4', segundos: null })
    expect(d.ejercicios[1]).toMatchObject({ saltado: true, enVezDe: null, motivo: null })
    expect(d.ejercicios[2]!.motivo).toBe('cambio')
    const sinEntrenos = calcularInforme(entrada({ sesiones: [s], secciones: { detalle: true, entrenos: false } }))
    expect(sinEntrenos.detalleEntrenos).toBeNull()
    expect(sinEntrenos.entrenos).toBeNull()
    expect(sinEntrenos.resumen.lineas).toHaveLength(3)
  })

  it('secciones desmarcadas: fuera y sin línea en el resumen', () => {
    const d = mesDeEjemplo()
    const inf = calcularInforme(entrada({ ...d, secciones: { entrenos: false, comida: false, cuerpo: false, pasos: false } }))
    expect([inf.entrenos, inf.fuerza, inf.comida, inf.cuerpo, inf.pasos]).toEqual([null, null, null, null, null])
    expect(inf.resumen.lineas).toEqual([])
    // El resumen va siempre: su tabla sigue con todo.
    expect(inf.resumen.tabla.length).toBe(8)
  })

  it('comida con «Todo»: nota del objetivo; picoteo del periodo anterior; sin catálogo, los ids', () => {
    siguienteId = 3100
    const comidas = [COM('2026-09-20', '17:00', 'merienda', 'Patatas', 300, 3, { tipo: 'picoteo' }), COM('2026-10-20', '14:00', 'comida', 'x', 1000, 150, { sal: 1.25, grasas: 10 })]
    const mes = calcularInforme(entrada({ comidas }))
    expect(mes.comida!.picoteo).toEqual({ dias: 0, anterior: 1, texto: 'el mes anterior: 1 (en 1 día)' })
    expect(mes.comida!.consejo).toBeNull()
    expect(mes.comida!.proteina.evaluacion).toEqual({ texto: 'Bien', tono: 'ok' })
    expect(mes.comida!.macros!.texto).toBe('De lo escaneado: grasas 10 g, sal 1,3 g (solo productos con etiqueta).')
    expect(mes.comida!.porFranja.map(f => f.franja)).toEqual(['comida'])
    const todo = calcularInforme(entrada({ comidas, periodo: 'todo' }))
    expect(todo.comida!.objetivoNota).toMatch(/son los de hoy/)
    expect(todo.comida!.picoteo.texto).toBe('antes: sin datos')
    const hoy = calcularInforme(entrada({ comidas: [COM('2026-10-20', '14:00', 'comida', 'x', 1000, 150)], periodo: 'hoy' }))
    expect(hoy.comida!.texto).toBe('1 de 1 día apuntado')
    const s = SES('2026-10-13', [E('bench-press', [S(40, 8)])])
    const sinCat = calcularInforme({ ...entrada({ sesiones: [s] }), catalogo: undefined })
    expect(sinCat.fuerza!.ejercicios[0]!.nombre).toBe('bench-press')
    expect(sinCat.fuerza!.grupos.every(g => g.v === 0)).toBe(true)
  })

  it('pasos sin entrenos ni pesadas: sin gasto (falta el peso), medias de los días con dato', () => {
    const pasos: PasosDia[] = [{ fecha: '2026-10-18', pasos: 12_000, fuente: 'auto' }, { fecha: '2026-10-19', pasos: 2000, fuente: 'auto' }]
    const inf = calcularInforme(entrada({ pasos, periodo: 'semana' }))
    expect(inf.pasos).toMatchObject({ media: 7000, diasConDato: 2, diasCumplidos: 1, gasto: null, gastoDias: [] })
    expect(inf.pasos!.dias.filter(d => d.pasos == null)).toHaveLength(5)
    expect(inf.resumen.tabla.find(f => f.dato === 'Pasos al día')!.evaluacion).toEqual({ texto: 'Pocos', tono: 'bad' })
    const bien = calcularInforme(entrada({ pasos: [{ fecha: '2026-10-19', pasos: 12_000, fuente: 'auto' }], periodo: 'semana' }))
    expect(bien.resumen.tabla.find(f => f.dato === 'Pasos al día')!.evaluacion.texto).toBe('Bien')
  })

  it('una semana del informe con el cambio de hora (25 oct) cuenta sus 7 días y la duración real', () => {
    siguienteId = 3200
    const inicio = new Date('2026-10-25T01:30:00').getTime()
    const s = SES('2026-10-25', [E('bench-press', [S(40, 8, 8)])], { inicio, fin: new Date('2026-10-25T03:30:00').getTime(), letra: 'L', nombre: 'Entreno libre' })
    const inf = calcularInforme(entrada({ sesiones: [s], periodo: 'semana', ahora: new Date('2026-10-28T10:00:00') }))
    expect(inf.rango).toMatchObject({ inicio: '2026-10-22', fin: '2026-10-28', dias: 7 })
    expect(inf.semanas.map(x => x.etiqueta)).toEqual(['22-25 oct', '26-28 oct'])
    // De 1:30 (verano) a 3:30 (invierno) pasan 3 horas de verdad.
    expect(inf.entrenos!.filas.find(f => f.estado === 'hecho')!.duracion).toBe('3 h')
    expect(inf.resumen.casillas!.map(c => c.fecha)).toEqual(diasDe('2026-10-22', '2026-10-28'))
  })
})

describe('más casos del resumen y de los entrenos', () => {
  it('sin fecha de nacimiento: sin edad ni gasto en reposo; mujer con poca grasa: zona «Bajo» y meta del 25 %', () => {
    const perfil = { ...PERFIL, sexo: 'mujer', nacimiento: '' } as Perfil
    const inf = calcularInforme(entrada({ perfil, mediciones: [MED('2026-10-15', { pesoKg: 60, bascula: { grasaPct: 12 } })] }))
    expect(inf.cabecera).toMatchObject({ edad: null, sexo: 'Mujer' })
    expect(inf.cuerpo!.tabla.some(f => f.medicion === 'Gasto en reposo')).toBe(false)
    const grasa = inf.resumen.zonas.find(z => z.nombre.startsWith('Grasa'))!
    expect(grasa).toMatchObject({ zona: 'bajo', cortes: [14, 32], escala: [0, 50], palabra: 'muy bajo', tono: 'warn' })
    expect(inf.resumen.controlPeso).toMatchObject({ meta: 25, metaPropia: false, sobra: 0 })
    expect(inf.resumen.controlPeso!.filas[1]!.nombre).toBe('Peso con un 25 % de grasa')
  })

  it('metas sin datos: sin valor actual ni «faltan»', () => {
    const metas: Meta[] = [
      { tipo: 'cintura', titulo: 'c', objetivo: 88, unidad: 'cm' }, { tipo: 'peso', titulo: 'p', objetivo: 75, unidad: 'kg' }, { tipo: 'grasa', titulo: 'g', objetivo: 18, unidad: '%' },
    ]
    const m = calcularInforme(entrada({ metas })).resumen.metas
    expect(m.map(x => [x.actual, x.actualTexto, x.faltaTexto])).toEqual([[null, '—', ''], [null, '—', ''], [null, '—', '']])
  })

  it('ejercicio con peso antes del periodo y sin peso en él: no hay gráfica ni fila de ejercicio principal', () => {
    siguienteId = 4000
    const ses = [SES('2026-08-04', [E('push-up', [S(10, 10)])]), SES('2026-10-13', [E('push-up', [S(null, 12)], { registro: 'corporal' })])]
    const inf = calcularInforme(entrada({ sesiones: ses }))
    expect(inf.fuerza!.ejercicios).toEqual([])
    expect(inf.resumen.tabla.map(f => f.dato)).toEqual(['Entrenos'])
  })

  it('sin rutina ni días fijos: los entrenos se cuentan sin «de N»', () => {
    siguienteId = 4100
    const ses = ['2026-10-13', '2026-10-14', '2026-10-17'].map(f => SES(f, [E('bench-press', [S(40, 8)])]))
    const inf = calcularInforme(entrada({ sesiones: ses, rutina: null, perfil: { ...PERFIL, diasFijos: [] } }))
    expect(inf.entrenos).toMatchObject({ texto: '3', tocaban: 0, pct: null, evaluacion: { texto: '—', tono: 'gris' }, perdidos: [], perdidosTexto: null })
    expect(inf.resumen.tabla.find(f => f.dato === 'Entrenos')).toMatchObject({ junto: '3', cambioTexto: null, evaluacion: { texto: '—' } })
  })

  it('un récord y una subida (en singular); la cintura que sube; sesiones sin id', () => {
    const a = { ...SES('2026-10-06', [E('bench-press', [S(40, 8)])]), id: undefined }
    const b = { ...SES('2026-10-13', [E('bench-press', [S(42.5, 8, 8, { record: true })])]), id: undefined }
    const ms = [MED('2026-10-01', { perimetros: { cintura: 95 } }), MED('2026-10-15', { perimetros: { cintura: 96 } })]
    const inf = calcularInforme(entrada({ sesiones: [a, b], mediciones: ms }))
    expect(inf.resumen.destacado[0]!.texto).toBe('1 récord · 1 subida de peso')
    expect(inf.resumen.destacado.find(x => x.texto.startsWith('Cintura'))).toEqual({ icono: 'sube', tono: 'warn', texto: 'Cintura: +1 cm' })
    const fila = inf.entrenos!.filas.find(f => f.fecha === '2026-10-13')!
    expect(fila).toMatchObject({ sesionId: null, records: [{ ejercicio: 'bench-press', texto: 'Press de banca 42,5 × 8' }] })
    expect(inf.entrenos!.evolucionEsfuerzo.puntos[0]!.sesionId).toBeNull()
    const igual = calcularInforme(entrada({ mediciones: [MED('2026-10-01', { perimetros: { cintura: 95 } }), MED('2026-10-15', { perimetros: { cintura: 95 } })] }))
    expect(igual.resumen.destacado).toEqual([{ icono: 'igual', tono: 'gris', texto: 'Cintura: igual (95 cm)' }])
    const soloSubida = calcularInforme(entrada({ sesiones: [a, { ...b, ejercicios: [E('bench-press', [S(42.5, 8)])] }] }))
    expect(soloSubida.resumen.destacado[0]!.texto).toBe('1 subida de peso')
  })

  it('un entreno con todo saltado: sale, sin series ni porcentaje de marcadas', () => {
    siguienteId = 4200
    const s = SES('2026-10-13', [E('bench-press', [S(40, 8, null, { hecha: false })], { estado: 'saltado' })])
    const e = calcularInforme(entrada({ sesiones: [s] })).entrenos!
    expect(e).toMatchObject({ sesiones: 1, series: 0, kg: 0, saltados: 1 })
    expect(e.evolucionEsfuerzo.nota).toBe('Media de las series con esfuerzo marcado (las que se dejan en blanco no cuentan): 0 de 0 series.')
  })

  it('«Contra el periodo anterior»: el 1RM estimado frente a los 30 días de antes', () => {
    siguienteId = 4300
    const antes = SES('2026-09-10', [E('bench-press', [S(50, 8)])])
    const ahora = SES('2026-10-13', [E('bench-press', [S(55, 8)])])
    const m = calcularInforme(entrada({ sesiones: [antes, ahora] })).fuerza!.mejores[0]!
    expect(m).toMatchObject({ contraAnterior: 10, contraTexto: '+10 %' })
  })

  it('sin ajustes: límite de cafeína de 400 mg y objetivos automáticos', () => {
    const inf = calcularInforme(entrada({ ajustes: null, comidas: [COM('2026-10-15', '10:00', 'desayuno', 'Café', 5, 0, { cafeina: 450 })], mediciones: [MED('2026-10-15', { pesoKg: 80 })] }))
    expect(inf.comida!.cafeina).toMatchObject({ limite: 400, diasPorEncima: 1, media: 450 })
    expect(inf.comida!.proteina.objetivo).toBe(145)
    const hoy = calcularInforme(entrada({ ajustes: null, periodo: 'hoy', comidas: [COM('2026-10-20', '10:00', 'desayuno', 'Café', 5, 0, { cafeina: 100 })] }))
    expect(hoy.tuDia!.cafeina.limite).toBe(400)
  })

  it('un domingo fijo movido a otro día cuenta como movido', () => {
    siguienteId = 4400
    const rutina: Rutina = { ...RUTINA, dias: [diaR('A', 6)] }
    const ajustes = { ...AJUSTES, recolocadas: [{ fecha: '2026-10-05', letra: 'A', desde: '2026-10-04' }] } as Ajustes
    const inf = calcularInforme(entrada({ rutina, ajustes, sesiones: [SES('2026-10-05', [E('bench-press', [S(40, 8)])])] }))
    expect(inf.entrenos!.filas.find(f => f.fecha === '2026-10-04')).toMatchObject({ estado: 'movido' })
    expect(inf.entrenos!.movidos).toBe(1)
  })

  it('la mejor serie: a igual peso, la de más repeticiones', () => {
    siguienteId = 4500
    const inf = calcularInforme(entrada({ sesiones: [SES('2026-10-13', [E('bench-press', [S(40, 8), S(40, 10), S(35, 12)])])] }))
    expect(inf.fuerza!.ejercicios[0]!.unSolo).toBe('40 kg × 10')
  })

  it('semanas sin nada apuntado (antes de empezar a usar la app) no cuentan para la puntuación', () => {
    siguienteId = 4600
    const ses = ['2026-10-13', '2026-10-15', '2026-10-16'].map(f => SES(f, [E('bench-press', [S(40, 8)])]))
    const inf = calcularInforme(entrada({ sesiones: ses }))
    expect(inf.semanas.map(s => s.puntuacion === null)).toEqual([true, true, true, false, true])
    expect(inf.resumen.puntuacion!.semanas).toBe(1)
    expect(inf.resumen.puntuacion!.valor).toBe(inf.semanas[3]!.puntuacion)
  })

  it('sin ningún entreno no hay fila «Entrenos» en la tabla (lo dice la línea del resumen)', () => {
    const inf = calcularInforme(entrada({ mediciones: [MED('2026-10-15', { pesoKg: 80 })] }))
    expect(inf.resumen.tabla.some(f => f.dato === 'Entrenos')).toBe(false)
    expect(inf.resumen.lineas[0]!.texto).toMatch(/^Entrenos: 0 de \d+$/)
  })
})

describe('«Tu día»: más comparaciones', () => {
  function dia(hoyEjs: EjercicioSesion[], antesEjs: (i: number) => EjercicioSesion[], x: Partial<EntradaInforme> = {}) {
    siguienteId = 5000
    const ant = ['2026-10-06', '2026-10-09', '2026-10-13', '2026-10-16'].map((f, i) => SES(f, antesEjs(i)))
    return calcularInforme(entrada({ sesiones: [...ant, SES('2026-10-20', hoyEjs)], periodo: 'hoy', ...x })).tuDia!
  }

  it('más peso en lo normal, más proteína, pasos iguales y la meta de ejercicio como principal', () => {
    const comidas = [...diasDe('2026-10-01', '2026-10-19').map(f => COM(f, '14:00', 'comida', 'x', 1800, 100)), COM('2026-10-20', '14:00', 'comida', 'x', 1800, 120)]
    const pasos: PasosDia[] = [...diasDe('2026-10-01', '2026-10-19').map(f => ({ fecha: f, pasos: 8000, fuente: 'manual' as const })), { fecha: '2026-10-20', pasos: 8200, fuente: 'manual' }]
    const metas: Meta[] = [{ tipo: 'ejercicio', titulo: 'Remo', objetivo: 60, unidad: 'kg', ejercicio: 'seated-cable-row' }]
    const t = dia([E('leg-press', [S(120, 10)]), E('seated-cable-row', [S(50, 10)])], () => [E('leg-press', [S(110, 10)]), E('seated-cable-row', [S(50, 10)])], { comidas, pasos, metas })
    expect(t.proteina).toMatchObject({ juicio: 'mejor', pct: 20, tono: 'ok' })
    expect(t.pasos).toMatchObject({ juicio: 'igual', direccion: 'igual', tono: 'tinta', texto: '+3 %' })
    expect(t.frase).toBe('Buen día de fuerza. Más peso en prensa de piernas y más proteína.')
    expect(t.principal!.id).toBe('seated-cable-row')
    expect(t.ejercicios.find(e => e.id === 'seated-cable-row')).toMatchObject({ juicio: 'igual', frase: '50 kg · igual que lo normal' })
  })

  it('más pasos; todo igual que lo normal; 1 rep menos con el mismo peso; un 1 % más es «igual»', () => {
    const pasos: PasosDia[] = [...diasDe('2026-10-01', '2026-10-19').map(f => ({ fecha: f, pasos: 8000, fuente: 'manual' as const })), { fecha: '2026-10-20', pasos: 10_000, fuente: 'manual' }]
    const t = dia([E('bench-press', [S(50, 7)]), E('leg-press', [S(101, 10)])], () => [E('bench-press', [S(50, 8)]), E('leg-press', [S(100, 10)])], { pasos })
    expect(t.ejercicios[0]).toMatchObject({ juicio: 'peor', por: 'reps', frase: 'Mismo peso, 1 rep menos que lo normal' })
    expect(t.ejercicios[1]).toMatchObject({ juicio: 'igual', direccion: 'igual', frase: '101 kg · igual que lo normal', pct: 1 })
    expect(t.frase).toBe('Día flojo de fuerza. Más pasos. Peor: press de banca.')
    const igual = dia([E('leg-press', [S(100, 10)])], () => [E('leg-press', [S(100, 10)])])
    expect(igual.frase).toBe('Buen día de fuerza. Hoy, como lo normal.')
  })

  it('lo normal (mediana) sin ninguna vez a ese peso: igual, sin mirar reps', () => {
    const t = dia([E('bench-press', [S(50, 8)])], i => [E('bench-press', [S(i % 2 ? 52.5 : 47.5, 8)])])
    expect(t.ejercicios[0]).toMatchObject({ normal: 50, juicio: 'igual', por: null })
  })

  it('una serie hecha sin nada apuntado no se compara; medición del día solo con cinta', () => {
    const t = dia([E('plank', [S(null, null)], { registro: 'tiempo' }), E('bench-press', [S(50, 8)])], () => [E('bench-press', [S(50, 8)])], {
      mediciones: [MED('2026-10-20', { perimetros: { cintura: 97 } })],
    })
    expect(t.ejercicios.map(e => e.id)).toEqual(['bench-press'])
    expect(t.cuerpo).toBe('Cuerpo hoy: peso sin apuntar · cintura 97 cm')
  })

  it('pasos de antes en 0: no hay porcentaje con qué comparar', () => {
    const pasos: PasosDia[] = [{ fecha: '2026-10-10', pasos: 0, fuente: 'manual' }, { fecha: '2026-10-20', pasos: 5000, fuente: 'manual' }]
    const t = dia([], () => [], { pasos })
    expect(t.pasos).toMatchObject({ valor: 5000, normal: 0, pct: null, texto: '', direccion: 'igual' })
  })
})

describe('el informe es estable y sin huecos inventados', () => {
  it('ningún número del mes de ejemplo es NaN o infinito', () => {
    const inf: Informe = calcularInforme(entrada(mesDeEjemplo()))
    const malos: string[] = []
    const mirar = (v: unknown, ruta: string) => {
      if (typeof v === 'number' && !Number.isFinite(v)) malos.push(ruta)
      else if (typeof v === 'string' && /NaN|Infinity|undefined/.test(v)) malos.push(ruta)
      else if (Array.isArray(v)) v.forEach((x, i) => mirar(x, `${ruta}[${i}]`))
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) mirar(x, `${ruta}.${k}`)
    }
    mirar(inf, 'informe')
    expect(malos).toEqual([])
  })
})

describe('datosInforme: lee todo de la base del móvil y calcula', () => {
  it('con la base vacía: sin datos y el botón en gris', async () => {
    const r = await periodoInforme('mes', AHORA)
    expect(r).toMatchObject({ inicio: '2026-09-21', fin: '2026-10-20', hayDatos: false })
    const inf = await datosInforme('mes', AHORA)
    expect(inf.hayDatos).toBe(false)
    expect(inf.cabecera.nombre).toBeNull()
  })

  it('con el mes de ejemplo guardado: lo mismo que el cálculo puro, con la rutina activa', async () => {
    const d = mesDeEjemplo()
    await db.perfil.put(PERFIL)
    await db.ajustes.put(AJUSTES)
    await db.rutinas.bulkAdd([{ ...RUTINA, id: undefined, activa: false, dias: [diaR('A', 0)] }, { ...RUTINA, id: undefined }])
    await db.sesiones.bulkAdd(d.sesiones.map(s => ({ ...s, id: undefined })))
    await db.mediciones.bulkAdd(d.mediciones)
    await db.comidas.bulkAdd(d.comidas)
    await db.pasos.bulkPut(d.pasos)
    await db.metas.bulkAdd(d.metas)
    await db.suplementos.put({ fecha: '2026-10-01', tomados: ['Creatina'] })
    const t = await tablasInforme()
    expect(t.rutina!.dias.map(x => x.letra)).toEqual(['A', 'B', 'C', 'S'])
    expect(t.suplementos).toHaveLength(1)
    const inf = await datosInforme('mes', AHORA, { detalle: true })
    expect(inf.hayDatos).toBe(true)
    expect(inf.secciones.detalle).toBe(true)
    expect(inf.entrenos!.texto).toBe('12 de 13')
    expect(inf.comida!.diasApuntados).toBe(28)
    const puro = calcularInforme(entrada({ ...t, periodo: 'mes', secciones: { detalle: true }, catalogo: undefined }))
    expect(inf.resumen.tabla).toEqual(puro.resumen.tabla)
    expect((await periodoInforme('todo', AHORA)).textoHoja).toBe('Desde el 13 sep de 2026, tu primer dato')
  })
})
