import { describe, expect, it } from 'vitest'
import { FRANJAS, NOMBRE_RACION, avisoCafeina, buscarOFF, codigoValido, conRacion, datosQuincena, escaneadosSueltos, franjaPorHora, leerOFF, notaPorTamano, ordenarPlantillas, picoteoDeSemana, picoteoPorTamano, porRacion, tamanoDe, TAMANOS_NOTA, textoRacion } from '../src/dominio/comida'
import { lineaSpark, tendenciaPeso } from '../src/dominio/peso'
import type { Comida, Medicion, Plantilla } from '../src/datos/tipos'

const comida = (fecha: string, x: Partial<Comida> = {}): Comida => ({ fecha, hora: '14:00', franja: 'comida', nombre: 'x', kcal: 500, proteina: 30, racion: 'N', tipo: 'plantilla', ...x })

describe('franjas y raciones', () => {
  it('elige la franja por la hora', () => {
    expect(franjaPorHora('07:15')).toBe('desayuno')
    expect(franjaPorHora('14:05')).toBe('comida')
    expect(franjaPorHora('17:30')).toBe('merienda')
    expect(franjaPorHora('21:00')).toBe('cena')
    expect(franjaPorHora('00:30')).toBe('cena')
  })
  it('escala la ración P/N/G', () => {
    expect(conRacion({ kcal: 600, proteina: 22 }, 'P')).toEqual({ kcal: 420, proteina: 15, cafeina: undefined })
    expect(conRacion({ kcal: 600, proteina: 22 }, 'G').kcal).toBe(840)
    expect(conRacion({ kcal: 230, proteina: 0, cafeina: 160 }, 'N').cafeina).toBe(160)
  })
  it('ordena plantillas por uso', () => {
    const ps: Plantilla[] = [{ nombre: 'B', kcal: 1, proteina: 1, tipo: 'comida', usos: 2 }, { nombre: 'A', kcal: 1, proteina: 1, tipo: 'comida', usos: 9 }, { nombre: 'C', kcal: 1, proteina: 1, tipo: 'comida', usos: 2 }]
    expect(ordenarPlantillas(ps).map(p => p.nombre)).toEqual(['A', 'B', 'C'])
  })
})

describe('Open Food Facts', () => {
  const json = {
    status: 1,
    product: {
      product_name: 'Arroz al curry con pollo', brands: 'Hacendado, Mercadona', serving_quantity: '360',
      nutriments: { 'energy-kcal_100g': 167, proteins_100g: 6.1, carbohydrates_100g: 23, fat_100g: 5 },
      image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
    },
  }
  it('lee el producto y calcula la ración', () => {
    const p = leerOFF('8480000123458', json)!
    expect(p.nombre).toBe('Arroz al curry con pollo')
    expect(p.marca).toBe('Hacendado')
    expect(p.kcalRacion).toBe(601)
    expect(p.proteinaRacion).toBe(22)
    expect(porRacion(p)).toMatchObject({ kcal: 601, proteina: 22, base: 'racion' })
  })
  it('usa kJ si no hay kcal y por 100 g si no hay ración', () => {
    const p = leerOFF('1', { status: 1, product: { product_name: 'Galletas', nutriments: { 'energy-kj_100g': 2092, proteins_100g: 7 } } })!
    expect(p.kcal100).toBe(500)
    expect(porRacion(p)).toMatchObject({ kcal: 500, proteina: 7, base: '100g' })
  })
  it('pasa la cafeína a mg', () => {
    const p = leerOFF('2', { status: 1, product: { product_name: 'Energética', serving_quantity: 500, nutriments: { 'energy-kcal_100g': 46, proteins_100g: 0, caffeine_100g: 0.032 } } })!
    expect(p.cafeina100).toBe(32)
    expect(porRacion(p).cafeina).toBe(160)
  })
  it('sin producto devuelve null', () => {
    expect(leerOFF('3', { status: 0 })).toBeNull()
  })
  it('distingue encontrado, no encontrado y sin conexión', async () => {
    const ok = (async () => new Response(JSON.stringify(json), { status: 200 })) as unknown as typeof fetch
    const no = (async () => new Response(JSON.stringify({ status: 0 }), { status: 404 })) as unknown as typeof fetch
    const caido = (async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
    expect((await buscarOFF('8480000123458', ok)).estado).toBe('encontrado')
    expect((await buscarOFF('1', no)).estado).toBe('no')
    expect((await buscarOFF('1', caido)).estado).toBe('offline')
  })
  it('valida códigos de barras', () => {
    expect(codigoValido('8480000123458')).toBe(true)
    expect(codigoValido('1234')).toBe(false)
  })
})

describe('picoteo, cafeína y quincena', () => {
  const semana = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']
  it('cuenta días con picoteo y energéticas', () => {
    const cs = [comida('2026-10-12', { tipo: 'picoteo' }), comida('2026-10-12', { tipo: 'picoteo' }), comida('2026-10-14', { tipo: 'picoteo' }), comida('2026-10-14', { tipo: 'bebida', kcal: 230, cafeina: 160 }), comida('2026-10-14', { tipo: 'bebida', kcal: 0, cafeina: 160 })]
    expect(picoteoDeSemana(cs, semana)).toEqual({ dias: 2, energeticas: 1 })
  })
  it('avisa de la cafeína por límite y por hora', () => {
    expect(avisoCafeina(450, 400, '16:00', '10:00').tono).toBe('bad')
    expect(avisoCafeina(160, 400, '16:00', '17:00').tono).toBe('warn')
    expect(avisoCafeina(160, 400, '16:00', '10:00').tono).toBe('ok')
  })
  it('da el consejo quincenal por tendencias', () => {
    const ms: Medicion[] = [
      { fecha: '2026-09-20T07:00', origen: 'casa', perimetros: { cintura: 95 }, pesoKg: 80 },
      { fecha: '2026-10-10T07:00', origen: 'casa', perimetros: { cintura: 93.5 }, pesoKg: 79.8 },
    ]
    const q = datosQuincena({ hoy: '2026-10-14', mediciones: ms, comidas: [], objetivoProteina: 140, objetivo: 'recomposicion' })
    expect(q.cinturaDelta).toBe(-1.5)
    expect(q.tono).toBe('ok')
    expect(datosQuincena({ hoy: '2026-10-14', mediciones: [], comidas: [], objetivoProteina: 140, objetivo: 'recomposicion' }).tono).toBe('neutral')
  })
})

describe('tendencia del peso', () => {
  it('calcula kg por semana', () => {
    const ms: Medicion[] = [0, 7, 14, 21].map((d, i) => ({ fecha: `2026-09-${String(20 + d > 30 ? 0 : 20 + d).padStart(2, '0')}`, origen: 'casa' as const, pesoKg: 80 - i * 0.3 }))
      .map((m, i) => ({ ...m, fecha: ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11'][i]! }))
    expect(tendenciaPeso(ms, '2026-10-14').kgSemana).toBe(-0.3)
    expect(tendenciaPeso(ms.slice(0, 1), '2026-10-14').kgSemana).toBeNull()
    expect(lineaSpark([80, 79.5, 79.7]).split(' ')).toHaveLength(3)
  })
})

describe('lo de ayer y recientes', () => {
  const c = (fecha: string, hora: string, nombre: string, x: Partial<Comida> = {}): Comida => ({ fecha, hora, franja: franjaPorHora(hora), nombre, kcal: 300, proteina: 20, racion: 'N', tipo: 'nota', ...x })
  it('repite la misma franja de ayer, en orden', async () => {
    const { deAyer } = await import('../src/dominio/comida')
    const cs = [c('2026-10-13', '08:30', 'Tostadas'), c('2026-10-13', '07:45', 'Café'), c('2026-10-13', '14:00', 'Lentejas'), c('2026-10-12', '08:00', 'Otro')]
    expect(deAyer(cs, '2026-10-13', 'desayuno').map(x => x.nombre)).toEqual(['Café', 'Tostadas'])
    expect(deAyer(cs, '2026-10-13', 'cena')).toEqual([])
  })
  it('recientes: sin repetir, sin plantillas y el más nuevo primero', async () => {
    const { recientes } = await import('../src/dominio/comida')
    const cs = [
      c('2026-10-10', '14:00', 'Menú del día'), c('2026-10-13', '14:00', 'menú del día '), c('2026-10-12', '21:00', 'Pizza'),
      c('2026-10-13', '17:00', 'Batido de proteína', { plantillaId: 3 }), c('2026-10-11', '10:00', 'Yogur'),
    ]
    expect(recientes(cs, '2026-10-14', [{ nombre: 'Yogur' }]).map(x => x.nombre)).toEqual(['menú del día ', 'Pizza'])
    expect(recientes(cs, '2026-10-14', [], 1)).toHaveLength(1)
  })
})

describe('nota rápida y Mis comidas', () => {
  it('rellena kcal y proteína según el tamaño y la franja', () => {
    expect(notaPorTamano('normal', 'comida')).toEqual({ kcal: 600, proteina: 25 })
    expect(notaPorTamano('ligera', 'cena')).toEqual({ kcal: 350, proteina: 15 })
    expect(notaPorTamano('abundante', 'comida')).toEqual({ kcal: 900, proteina: 35 })
    // Desayuno y merienda, más pequeños.
    expect(notaPorTamano('normal', 'desayuno').kcal).toBeLessThan(notaPorTamano('normal', 'comida').kcal)
    expect(notaPorTamano('ligera', 'merienda').kcal).toBeLessThan(notaPorTamano('normal', 'merienda').kcal)
    expect(notaPorTamano('normal', 'merienda').kcal).toBeLessThan(notaPorTamano('abundante', 'merienda').kcal)
  })
  it('raciones y franjas con palabras', () => {
    // Las mismas palabras en Añadir, la nota, el producto y Mis comidas.
    expect(Object.values(NOMBRE_RACION)).toEqual(['Poco', 'Normal', 'Mucho'])
    expect(TAMANOS_NOTA.map(t => t.t)).toEqual(['Poco', 'Normal', 'Mucho'])
    expect(textoRacion('N')).toBe('')
    expect(textoRacion('G')).toBe('mucho')
    expect(FRANJAS.find(f => f.v === 'merienda')!.t).toBe('Merienda')
  })
  it('reconoce el tamaño de una comida guardada', () => {
    expect(tamanoDe(600, 25, 'comida')).toBe('normal')
    expect(tamanoDe(200, 8, 'desayuno')).toBe('ligera')
    expect(tamanoDe(900, 35, 'cena')).toBe('abundante')
    expect(tamanoDe(610, 25, 'comida')).toBeNull()
  })
  it('el picoteo tiene sus propios «Poco · Normal · Mucho», más pequeños que una comida', () => {
    const [p, n, m] = TAMANOS_NOTA.map(t => picoteoPorTamano(t.v))
    expect(p!.kcal).toBeLessThan(n!.kcal)
    expect(n!.kcal).toBeLessThan(m!.kcal)
    expect(m!.kcal).toBeLessThan(notaPorTamano('normal', 'desayuno').kcal + 1)
    expect(tamanoDe(200, 3, 'comida', true)).toBe('normal')
    expect(tamanoDe(200, 3, 'comida')).toBeNull()
    expect(tamanoDe(210, 3, 'merienda', true)).toBeNull()
  })
  it('no repite los escaneados que ya están en Mis comidas', () => {
    const ps = [{ codigo: '1' }, { codigo: '2' }, { codigo: '3' }]
    expect(escaneadosSueltos(ps, [{ codigo: '2' }, {}]).map(p => p.codigo)).toEqual(['1', '3'])
    expect(escaneadosSueltos(ps, [])).toHaveLength(3)
  })
})
