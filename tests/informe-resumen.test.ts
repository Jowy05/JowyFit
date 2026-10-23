// Informe en PDF: las palabras y la puntuación del resumen, los objetivos y más casos del resumen
// y de los entrenos (src/informe/calculo/resumen.ts, semanas.ts y entrenos.ts).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import type { Ajustes, Meta, Perfil, Rutina } from '../src/datos/tipos'
import { objetivosInforme } from '../src/informe/calculo/contexto'
import { palabraPuntuacion, puntuacionDe } from '../src/informe/calculo/semanas'
import { evaluarCuerpo } from '../src/informe/calculo/cuerpo'
import { evaluarEntrenos, evaluarProteina, tonoProteinaDia } from '../src/informe/calculo/resumen'
import { calcularInforme } from '../src/informe/calculo/index'
import { resumenSemana } from '../src/dominio/resumen'
import { S, E, SES, diaR, RUTINA, PERFIL, AJUSTES, MED, COM, entrada, idsDesde } from './informe-ejemplo'

describe('palabras, puntuación y objetivos', () => {
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
    idsDesde(4000)
    const ses = [SES('2026-08-04', [E('push-up', [S(10, 10)])]), SES('2026-10-13', [E('push-up', [S(null, 12)], { registro: 'corporal' })])]
    const inf = calcularInforme(entrada({ sesiones: ses }))
    expect(inf.fuerza!.ejercicios).toEqual([])
    expect(inf.resumen.tabla.map(f => f.dato)).toEqual(['Entrenos'])
  })

  it('sin rutina ni días fijos: los entrenos se cuentan sin «de N»', () => {
    idsDesde(4100)
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
    idsDesde(4200)
    const s = SES('2026-10-13', [E('bench-press', [S(40, 8, null, { hecha: false })], { estado: 'saltado' })])
    const e = calcularInforme(entrada({ sesiones: [s] })).entrenos!
    expect(e).toMatchObject({ sesiones: 1, series: 0, kg: 0, saltados: 1 })
    expect(e.evolucionEsfuerzo.nota).toBe('Media de las series con esfuerzo marcado (las que se dejan en blanco no cuentan): 0 de 0 series.')
  })

  it('«Contra el periodo anterior»: el 1RM estimado frente a los 30 días de antes', () => {
    idsDesde(4300)
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
    idsDesde(4400)
    const rutina: Rutina = { ...RUTINA, dias: [diaR('A', 6)] }
    const ajustes = { ...AJUSTES, recolocadas: [{ fecha: '2026-10-05', letra: 'A', desde: '2026-10-04' }] } as Ajustes
    const inf = calcularInforme(entrada({ rutina, ajustes, sesiones: [SES('2026-10-05', [E('bench-press', [S(40, 8)])])] }))
    expect(inf.entrenos!.filas.find(f => f.fecha === '2026-10-04')).toMatchObject({ estado: 'movido' })
    expect(inf.entrenos!.movidos).toBe(1)
  })

  it('la mejor serie: a igual peso, la de más repeticiones', () => {
    idsDesde(4500)
    const inf = calcularInforme(entrada({ sesiones: [SES('2026-10-13', [E('bench-press', [S(40, 8), S(40, 10), S(35, 12)])])] }))
    expect(inf.fuerza!.ejercicios[0]!.unSolo).toBe('40 kg × 10')
  })

  it('semanas sin nada apuntado (antes de empezar a usar la app) no cuentan para la puntuación', () => {
    idsDesde(4600)
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
