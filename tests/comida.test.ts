import { describe, expect, it } from 'vitest'
import { FRANJAS, NOMBRE_RACION, nombreFranja, batidoDe, dosisDe, esBatido, kcalBatido, avisoCafeina, buscarOFF, codigoValido, conRacion, datosQuincena, escaneadosSueltos, franjaPorHora, leerOFF, notaPorTamano, escalarMacros, factorRacion, ordenarPlantillas, picoteoDeSemana, porRacion, tamanoDe, TAMANOS_NOTA, textoRacion, aspecto, CLAVES_MACROS, NOMBRE_MACRO, PISTA_RACION, soloMacros, tipoRacion, URL_OFF, macros100, deAyer, recientes, dosisPorDefecto } from '../src/dominio/comida'
import type { Comida, Medicion, Plantilla, Producto } from '../src/datos/tipos'

const comida = (fecha: string, x: Partial<Comida> = {}): Comida => ({ fecha, hora: '14:00', franja: 'comida', nombre: 'x', kcal: 500, proteina: 30, racion: 'N', tipo: 'plantilla', ...x })

describe('franjas y raciones', () => {
  it('elige la franja por la hora', () => {
    expect(franjaPorHora('07:15')).toBe('desayuno')
    expect(franjaPorHora('14:05')).toBe('comida')
    expect(franjaPorHora('17:30')).toBe('merienda')
    expect(franjaPorHora('21:00')).toBe('cena')
    expect(franjaPorHora('00:30')).toBe('cena')
  })
  it('un plato: Poco = ⅓, Normal = el plato, Mucho = plato y medio', () => {
    expect(conRacion({ kcal: 600, proteina: 24 }, 'P')).toEqual({ kcal: 200, proteina: 8, cafeina: undefined })
    expect(conRacion({ kcal: 600, proteina: 24 }, 'N').kcal).toBe(600)
    expect(conRacion({ kcal: 600, proteina: 24 }, 'G').kcal).toBe(900)
    expect(conRacion({ kcal: 230, proteina: 0, cafeina: 160 }, 'N', 'bebida').cafeina).toBe(160)
    // Si se cambian las kcal del plato, Poco y Mucho cambian en proporción.
    expect(conRacion({ kcal: 900, proteina: 30 }, 'P', 'comida').kcal).toBe(300)
    expect(conRacion({ kcal: 900, proteina: 30 }, 'G', 'comida').kcal).toBe(1350)
  })
  it('un picoteo guarda la bolsa entera: Poco = ⅓, Normal = la mitad, Mucho = todo', () => {
    expect(conRacion({ kcal: 800, proteina: 9 }, 'P', 'picoteo').kcal).toBe(267)
    expect(conRacion({ kcal: 800, proteina: 9 }, 'N', 'picoteo')).toMatchObject({ kcal: 400, proteina: 5 })
    expect(conRacion({ kcal: 800, proteina: 9 }, 'G', 'picoteo').kcal).toBe(800)
    expect(factorRacion('G', 'plantilla')).toBe(1.5)
    expect(factorRacion('N', 'picoteo')).toBe(0.5)
  })
  it('los macros (hidratos, azúcares, grasas, sal) siguen a la ración', () => {
    expect(conRacion({ kcal: 300, proteina: 6, hidratos: 30, azucares: 12, grasas: 9, sal: 0.9 }, 'P', 'comida')).toMatchObject({ hidratos: 10, azucares: 4, grasas: 3, sal: 0.3 })
    expect(conRacion({ kcal: 300, proteina: 6 }, 'G')).not.toHaveProperty('hidratos')
    expect(escalarMacros({ sal: 1.25 }, 2)).toEqual({ sal: 2.5 })
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
      nutriments: { 'energy-kcal_100g': 167, proteins_100g: 6.1, carbohydrates_100g: 23, fat_100g: 5, sugars_100g: 2.5, salt_100g: 0.8 },
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
    // Hidratos, azúcares, grasas y sal de la etiqueta, pasados a la ración de 360 g.
    expect(p.azucares100).toBe(2.5)
    expect(p.sal100).toBe(0.8)
    expect(porRacion(p)).toMatchObject({ hidratos: 82.8, azucares: 9, grasas: 18, sal: 2.9 })
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
    // Las mismas proporciones que un plato: ⅓, el plato, plato y medio.
    expect(notaPorTamano('normal', 'comida')).toEqual({ kcal: 600, proteina: 25 })
    expect(notaPorTamano('ligera', 'cena')).toEqual({ kcal: 200, proteina: 8 })
    expect(notaPorTamano('abundante', 'comida')).toEqual({ kcal: 900, proteina: 38 })
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
    expect(nombreFranja(FRANJAS.find(f => f.v === 'merienda')!.v)).toBe('Merienda')
  })
  it('reconoce el tamaño de una comida guardada', () => {
    expect(tamanoDe(600, 25, 'comida')).toBe('normal')
    expect(tamanoDe(120, 5, 'desayuno')).toBe('ligera')
    expect(tamanoDe(900, 38, 'cena')).toBe('abundante')
    expect(tamanoDe(610, 25, 'comida')).toBeNull()
  })
  it('no repite los escaneados que ya están en Mis comidas', () => {
    const ps = [{ codigo: '1' }, { codigo: '2' }, { codigo: '3' }]
    expect(escaneadosSueltos(ps, [{ codigo: '2' }, {}]).map(p => p.codigo)).toEqual(['1', '3'])
    expect(escaneadosSueltos(ps, [])).toHaveLength(3)
  })
})

describe('suplementos', () => {
  it('cada uno con su cantidad, o la habitual si no la ha puesto', () => {
    expect(dosisDe(undefined, 'Creatina')).toBe('3-5 g')
    expect(dosisDe({ Creatina: '10 g' }, 'Creatina')).toBe('10 g')
    expect(dosisDe({ Creatina: '  ' }, 'Creatina')).toBe('3-5 g')
    expect(dosisDe({}, 'Omega 3')).toBe('')
  })
  it('el batido lleva su proteína (24 g si no se ha dicho)', () => {
    expect(esBatido('Batido de proteína')).toBe(true)
    expect(esBatido('Creatina')).toBe(false)
    expect(batidoDe(undefined)).toEqual({ proteina: 24, kcal: 120 })
    expect(batidoDe({ proteina: 30, kcal: 150 }).proteina).toBe(30)
    expect(kcalBatido(30)).toBe(150)
  })
  it('dosis habitual: creatina 3-5 g, batido un cacito, los demás nada', () => {
    expect(dosisPorDefecto('Creatina monohidrato')).toBe('3-5 g')
    expect(dosisPorDefecto('Batido de proteína')).toBe('1 cacito')
    expect(dosisPorDefecto('Proteína whey')).toBe('1 cacito')
    expect(dosisPorDefecto('Vitamina D')).toBe('')
    expect(esBatido('Vitamina D')).toBe(false)
  })
  it('una dosis en blanco cuenta como no puesta', () => {
    expect(dosisDe({ Creatina: '   ' }, 'Creatina')).toBe('3-5 g')
    expect(dosisDe({ Creatina: ' 10 g ' }, 'Creatina')).toBe('10 g')
  })
})

describe('miniatura de cada comida (aspecto)', () => {
  const icono = (n: string, t?: string) => aspecto(n, t).icono
  it('bebidas, café, batidos, pan, guisos, sopas y picoteo', () => {
    expect(aspecto('Monster Energy')).toEqual({ fp: 'f-dr', icono: 'lightning' })
    expect(aspecto('Café con leche')).toEqual({ fp: 'f-dr', icono: 'coffee' })
    expect(icono('Coca-Cola Zero')).toBe('lightning')
    expect(icono('Zumo de naranja')).toBe('lightning')
    expect(icono('Batido de proteína')).toBe('drop')
    expect(icono('Yogur griego')).toBe('drop')
    expect(icono('Pizza barbacoa')).toBe('pizza')
    expect(icono('Bocadillo de jamón')).toBe('bread')
    expect(icono('Pan con tomate')).toBe('bread')
    expect(icono('Lentejas de mi madre')).toBe('cooking-pot')
    expect(icono('Ramen de pollo')).toBe('bowl-steam')
    expect(icono('Bolsa de patatas')).toBe('cookie')
    expect(icono('Macarrones')).toBe('bowl-food')
  })
  it('el tipo manda: una bebida o un picoteo con cualquier nombre', () => {
    expect(aspecto('Lo que sea', 'bebida').fp).toBe('f-dr')
    expect(aspecto('Lo que sea', 'picoteo').fp).toBe('f-sn')
  })
  it('fallaba: «chocolate» salía como bebida (por «cola») y «aguacate» también (por «agua»)', () => {
    expect(icono('Chocolate con almendras')).toBe('cookie')
    expect(icono('Tostada con aguacate')).toBe('bread')
    expect(icono('Ensalada de aguacate')).toBe('bowl-food')
  })
  it('fallaba: «té» no se reconocía nunca como bebida; y «panceta» o «empanada» no son pan', () => {
    expect(icono('Té verde')).toBe('lightning')
    expect(icono('Un té')).toBe('lightning')
    expect(icono('Panceta a la plancha')).toBe('bowl-food')
    expect(icono('Empanada gallega')).toBe('bowl-food')
    expect(icono('Paté de campaña')).toBe('bowl-food')
  })
  it('nombre vacío: miniatura normal', () => expect(aspecto('')).toEqual({ fp: 'f-cu', icono: 'bowl-food' }))
})

describe('franjas, raciones y macros: constantes y casos límite', () => {
  it('franjas en orden y con nombre', () => {
    expect(FRANJAS.map(f => f.v)).toEqual(['desayuno', 'comida', 'merienda', 'cena'])
    expect(FRANJAS.map(f => nombreFranja(f.v))).toEqual(['Desayuno', 'Comida', 'Merienda', 'Cena'])
  })
  it('franja en los bordes exactos (5:00, 11:00, 16:30, 19:30) y con una hora mal escrita', () => {
    expect(franjaPorHora('04:59')).toBe('cena')
    expect(franjaPorHora('05:00')).toBe('desayuno')
    expect(franjaPorHora('10:59')).toBe('desayuno')
    expect(franjaPorHora('11:00')).toBe('comida')
    expect(franjaPorHora('16:29')).toBe('comida')
    expect(franjaPorHora('16:30')).toBe('merienda')
    expect(franjaPorHora('19:30')).toBe('cena')
    expect(franjaPorHora('')).toBe('cena') // 0:00
  })
  it('tipo de ración: solo el picoteo guarda la bolsa entera', () => {
    expect(tipoRacion('picoteo')).toBe('picoteo')
    expect(tipoRacion('bebida')).toBe('plato')
    expect(tipoRacion()).toBe('plato')
    expect(PISTA_RACION.picoteo.G).toBe('todo')
    expect(PISTA_RACION.plato.N).toBe('el plato')
  })
  it('macros: claves, nombres, copiar y escalar sin inventarse los que faltan', () => {
    expect(CLAVES_MACROS).toEqual(['hidratos', 'azucares', 'grasas', 'sal'])
    for (const k of CLAVES_MACROS) expect(NOMBRE_MACRO[k]).toBeTruthy()
    expect(soloMacros({ hidratos: 10, sal: 0.25, ...{ kcal: 5 } } as never)).toEqual({ hidratos: 10, sal: 0.3 })
    expect(escalarMacros({}, 3)).toEqual({})
    expect(escalarMacros({ grasas: 0 }, 3)).toEqual({ grasas: 0 })
  })
  it('ración de 0 kcal y con cafeína 0', () => {
    expect(conRacion({ kcal: 0, proteina: 0, cafeina: 0 }, 'G')).toEqual({ kcal: 0, proteina: 0, cafeina: undefined })
  })
})

describe('Open Food Facts: datos raros', () => {
  it('URL solo con el código (codificado) y los campos que hacen falta', () => {
    const u = URL_OFF('84 80/1')
    expect(u).toContain('/product/84%2080%2F1.json')
    expect(u).toContain('lc=es')
    expect(u).toContain('app_name=JowyFit')
  })
  it('sin nombre usa «Producto <código>»; números con coma y texto; energía en kJ', () => {
    const p = leerOFF('123', { status: 1, product: { brands: ' Marca , Otra', nutriments: { energy_100g: '418,4', proteins_100g: '7,5', salt_100g: 'nada' } } })!
    expect(p.nombre).toBe('Producto 123')
    expect(p.marca).toBe('Marca')
    expect(p.kcal100).toBe(100)
    expect(p.proteina100).toBe(7.5)
    expect(p.sal100).toBeNull()
    expect(p.racionG).toBeNull()
    expect(p.kcalRacion).toBeNull()
    expect(p.cafeina100).toBeNull()
  })
  it('respuesta vacía o sin producto: null', () => {
    expect(leerOFF('1', null)).toBeNull()
    expect(leerOFF('1', {})).toBeNull()
    expect(leerOFF('1', { status: 1 })).toBeNull()
  })
  it('nombre en español primero y la fecha de guardado la que se pase', () => {
    const p = leerOFF('9', { status: 1, product: { product_name: 'Rice', product_name_es: 'Arroz', nutriments: {} } }, new Date('2026-10-13T10:00:00Z'))!
    expect(p.nombre).toBe('Arroz')
    expect(p.guardado).toBe('2026-10-13T10:00:00.000Z')
  })
  it('por ración sin el peso de la ración: los macros no se pueden pasar (se quedan fuera)', () => {
    const base: Producto = { codigo: '1', nombre: 'x', marca: '', kcal100: 400, proteina100: 10, hidratos100: 60, racionG: null, kcalRacion: 120, proteinaRacion: 3.4, guardado: '' }
    const r = porRacion(base)
    expect(r).toMatchObject({ kcal: 120, proteina: 3, base: 'racion' })
    expect(r).not.toHaveProperty('hidratos')
    expect(macros100(base)).toEqual({ hidratos: 60 })
    // Sin datos de nada: 0 kcal por 100 g, no NaN.
    expect(porRacion({ ...base, kcal100: null, proteina100: null, hidratos100: null, kcalRacion: null })).toMatchObject({ kcal: 0, proteina: 0, base: '100g' })
  })
  it('buscarOFF: error de red, 500 y JSON sin producto', async () => {
    const f = (r: Partial<Response> | Error) => (async () => { if (r instanceof Error) throw r; return r as Response }) as typeof fetch
    expect(await buscarOFF('1', f(new Error('red')))).toEqual({ estado: 'offline' })
    expect(await buscarOFF('1', f({ status: 500, ok: false }))).toEqual({ estado: 'offline' })
    expect(await buscarOFF('1', f({ status: 200, ok: true, json: async () => ({ status: 0 }) }))).toEqual({ estado: 'no' })
  })
  it('códigos: con espacios alrededor valen; con letras o cortos no', () => {
    expect(codigoValido(' 84800001 ')).toBe(true)
    expect(codigoValido('8480000123458')).toBe(true)
    expect(codigoValido('1234567')).toBe(false)
    expect(codigoValido('123456789012345')).toBe(false)
    expect(codigoValido('84800001234AB')).toBe(false)
    expect(codigoValido('')).toBe(false)
  })
})

describe('cafeína en el límite', () => {
  it('justo en el límite no es pasarse; un mg más sí', () => {
    expect(avisoCafeina(400, 400, '16:00', '10:00').tono).toBe('warn') // > 75 %
    expect(avisoCafeina(401, 400, '16:00', '10:00').tono).toBe('bad')
    expect(avisoCafeina(300, 400, '16:00', '10:00').tono).toBe('ok')
  })
  it('a la hora tope justa ya avisa, y quita el cero de la hora', () => {
    const a = avisoCafeina(0, 400, '06:00', '06:00')
    expect(a.tono).toBe('warn')
    expect(a.texto).toContain('6:00')
    expect(avisoCafeina(0, 400, '16:00', '15:59').texto).toContain('16:00')
  })
})

describe('picoteo de la semana, lo de ayer y recientes', () => {
  it('sin comidas: ceros y listas vacías', () => {
    expect(picoteoDeSemana([], ['2026-10-13'])).toEqual({ dias: 0, energeticas: 0 })
    expect(deAyer([], '2026-10-12', 'comida')).toEqual([])
    expect(recientes([], '2026-10-13', [])).toEqual([])
  })
  it('una energética sin azúcar (pocas kcal) no cuenta como energética', () => {
    const cs = [comida('2026-10-13', { tipo: 'bebida', cafeina: 160, kcal: 10 }), comida('2026-10-13', { tipo: 'bebida', cafeina: 160, kcal: 230 })]
    expect(picoteoDeSemana(cs, ['2026-10-13']).energeticas).toBe(1)
  })
  it('recientes: sin nombre o con nombre de plantilla no salen; el límite se respeta; lo de mañana no cuenta', () => {
    const cs = [
      comida('2026-10-13', { nombre: '  ', tipo: 'nota' }),
      comida('2026-10-13', { nombre: 'Batido', tipo: 'nota' }),
      comida('2026-10-14', { nombre: 'Futuro', tipo: 'nota' }),
      ...Array.from({ length: 8 }, (_, i) => comida('2026-10-12', { nombre: `Nota ${i}`, hora: `1${i}:00`, tipo: 'nota' })),
    ]
    const r = recientes(cs, '2026-10-13', [{ nombre: 'batido ' }], 3)
    expect(r.map(c => c.nombre)).toEqual(['Nota 7', 'Nota 6', 'Nota 5'])
  })
})

describe('«Escribir lo que he comido»: tamaños', () => {
  it('desayuno y merienda más pequeños que comida y cena; ida y vuelta con tamanoDe', () => {
    expect(notaPorTamano('normal', 'desayuno')).toEqual({ kcal: 350, proteina: 15 })
    expect(notaPorTamano('normal', 'cena')).toEqual({ kcal: 600, proteina: 25 })
    expect(notaPorTamano('ligera', 'merienda')).toEqual({ kcal: 120, proteina: 5 })
    expect(notaPorTamano('abundante', 'comida')).toEqual({ kcal: 900, proteina: 38 })
    for (const f of ['desayuno', 'comida', 'merienda', 'cena'] as const) for (const t of ['ligera', 'normal', 'abundante'] as const) {
      const v = notaPorTamano(t, f)
      expect(tamanoDe(v.kcal, v.proteina, f)).toBe(t)
    }
    expect(tamanoDe(601, 25, 'cena')).toBeNull()
  })
})
