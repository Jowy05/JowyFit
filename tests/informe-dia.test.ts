// Informe en PDF: «Tu día» (Hoy y Ayer), todo contra lo normal de las 4 semanas anteriores
// («55 kg · lo normal: 50 kg · +10 %») (src/informe/calculo/dia.ts).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import type { EjercicioSesion, Meta, PasosDia } from '../src/datos/tipos'
import type { EntradaInforme } from '../src/informe/calculo/tipos'
import { diasDe } from '../src/informe/calculo/comun'
import { compararKcal, compararPeso } from '../src/informe/calculo/dia'
import { calcularInforme } from '../src/informe/calculo/index'
import { S, E, SES, PERFIL, MED, COM, entrada, diaDeEjemplo, idsDesde } from './informe-ejemplo'

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
    idsDesde(500)
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
    idsDesde(600)
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
    idsDesde(700)
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

describe('«Tu día»: más comparaciones', () => {
  function dia(hoyEjs: EjercicioSesion[], antesEjs: (i: number) => EjercicioSesion[], x: Partial<EntradaInforme> = {}) {
    idsDesde(5000)
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
