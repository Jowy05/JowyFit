// Informe en PDF de principio a fin: el mes de ejemplo del diseño (cada número de §5 del diseño del informe),
// los casos con pocos datos, que no haya huecos inventados y la lectura de la base del móvil.
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import type { Ajustes, Meta, PasosDia, Rutina, Sesion } from '../src/datos/tipos'
import type { Informe } from '../src/informe/calculo/tipos'
import { diasDe } from '../src/informe/calculo/comun'
import { calcularInforme } from '../src/informe/calculo/index'
import { db } from '../src/datos/db'
import { datosInforme, periodoInforme, tablasInforme } from '../src/informe/calculo/leer'
import { S, E, SES, diaR, RUTINA, PERFIL, AJUSTES, MED, COM, AHORA, entrada, mesDeEjemplo, idsDesde } from './informe-ejemplo'

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
    idsDesde(800)
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
    idsDesde(900)
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
    idsDesde(950)
    const ses = ['2026-10-13', '2026-10-15'].map(f => SES(f, [E('bench-press', [S(40, 8, 8), S(40, 8), S(40, 8), S(40, 8)])]))
    const inf = calcularInforme(entrada({ sesiones: ses }))
    expect(inf.resumen.tabla.find(f => f.dato === 'Esfuerzo medio')!.nota).toBe('pocas series marcadas')
  })




  it('subida del peso: «Sube: ojo» y el ejercicio principal que baja en rojo; asistidos al revés', () => {
    idsDesde(1000)
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
    idsDesde(1100)
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
    idsDesde(1200)
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
    idsDesde(1300)
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
    idsDesde(1400)
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
    idsDesde(1500)
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
    idsDesde(2000)
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
    idsDesde(3000)
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
    idsDesde(3100)
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
    idsDesde(3200)
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
