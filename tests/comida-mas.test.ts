// Comida: lo que faltaba por probar (miniaturas, macros, Open Food Facts raro, cafeína en el límite,
// suplementos, «lo de ayer» y recientes con datos vacíos) y los cálculos de energía.
import { describe, expect, it } from 'vitest'
import {
  CLAVES_MACROS, FRANJAS, NOMBRE_FRANJA, NOMBRE_MACRO, PISTA_RACION, URL_OFF, aspecto, avisoCafeina, buscarOFF, codigoValido, conRacion, deAyer,
  dosisDe, dosisPorDefecto, esBatido, escalarMacros, franjaPorHora, leerOFF, macros100, notaPorTamano, picoteoDeSemana, porRacion, recientes,
  soloMacros, tamanoDe, tipoRacion,
} from '../src/dominio/comida'
import { DEFICIT, FACTOR_ACTIVIDAD, basalMifflin, cinturaAltura, epley, gastoDiario, grasaMarina, imc, kcalEntreno, kg, num, objetivos } from '../src/dominio/calculos'
import { lineaSpark, tendenciaPeso } from '../src/dominio/peso'
import type { Comida, Medicion, Producto } from '../src/datos/tipos'

const comida = (fecha: string, x: Partial<Comida> = {}): Comida => ({ fecha, hora: '14:00', franja: 'comida', nombre: 'x', kcal: 500, proteina: 30, racion: 'N', tipo: 'plantilla', ...x })

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
    for (const f of FRANJAS) expect(NOMBRE_FRANJA[f.v]).toBe(f.t)
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

describe('suplementos', () => {
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

describe('cálculos de energía y cuerpo', () => {
  it('factor de actividad y gasto del día', () => {
    expect(FACTOR_ACTIVIDAD).toEqual({ sentado: 1.2, depie: 1.375, fisico: 1.55 })
    expect(gastoDiario(1800, 'sentado')).toBeCloseTo(2160)
    expect(gastoDiario(1800, 'fisico')).toBeCloseTo(2790)
  })
  it('kcal de un entreno: MET × kg × horas (0 minutos = 0)', () => {
    expect(kcalEntreno(5, 80, 60)).toBe(400)
    expect(kcalEntreno(5, 80, 30)).toBe(200)
    expect(kcalEntreno(5, 80, 0)).toBe(0)
  })
  it('objetivos: déficit según el objetivo, kcal de 50 en 50 y proteína de 5 en 5', () => {
    const base = { pesoKg: 79.1, alturaCm: 177, edad: 21, sexo: 'hombre' as const, trabajo: 'sentado' as const, entrenosSemana: 3 }
    const r = objetivos({ ...base, objetivo: 'recomposicion' })
    const f = objetivos({ ...base, objetivo: 'fuerza' })
    const p = objetivos({ ...base, objetivo: 'perder' })
    expect(f.kcal - r.kcal).toBe(350)
    expect(DEFICIT.perder).toBe(500)
    expect(r.kcal % 50).toBe(0)
    expect(r.proteina % 5).toBe(0)
    expect(p.proteina).toBe(160) // 2 g/kg al perder
    expect(r.proteina).toBe(140) // 1,8 g/kg
    expect(r.basal).toBe(Math.round(basalMifflin(79.1, 177, 21, 'hombre')))
    expect(objetivos({ ...base, objetivo: 'fuerza', entrenosSemana: 0 }).gasto).toBe(Math.round(gastoDiario(basalMifflin(79.1, 177, 21, 'hombre'), 'sentado')))
  })
  it('mujer: −161 en el basal y cadera en la grasa', () => {
    expect(basalMifflin(60, 165, 30, 'mujer')).toBeCloseTo(600 + 1031.25 - 150 - 161)
    expect(grasaMarina('mujer', 165, 75, 32)).toBeNull() // sin cadera
    const g = grasaMarina('mujer', 165, 75, 32, 98)!
    expect(g).toBeGreaterThan(20)
    expect(g).toBeLessThan(40)
  })
  it('cintura/altura, IMC y Epley con una sola repetición', () => {
    expect(cinturaAltura(98, 177)).toBeCloseTo(0.5537, 3)
    expect(imc(79.1, 177)).toBeCloseTo(25.25, 1)
    expect(imc(0, 177)).toBeNaN()
    expect(epley(100, 1)).toBe(100)
    expect(epley(100, 0)).toBe(0)
    expect(epley(NaN, 5)).toBe(0)
  })
  it('números en español: coma, sin «-0» y «—» si no hay número', () => {
    expect(num(79.14)).toBe('79,1')
    expect(num(-0.04)).toBe('0')
    expect(num(null)).toBe('—')
    expect(num(undefined)).toBe('—')
    expect(num(Infinity)).toBe('—')
    expect(num(1234.5, 0)).toBe('1235')
    expect(kg(47.5)).toBe('47,5')
    expect(kg(40)).toBe('40')
    expect(kg(1.25)).toBe('1,25')
  })
})

describe('tendencia del peso', () => {
  const m = (fecha: string, pesoKg?: number): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', pesoKg })
  it('pocas medidas o muy juntas (< 5 días): sin tendencia', () => {
    expect(tendenciaPeso([], '2026-10-13').kgSemana).toBeNull()
    expect(tendenciaPeso([m('2026-10-13', 80)], '2026-10-13').kgSemana).toBeNull()
    expect(tendenciaPeso([m('2026-10-10', 80), m('2026-10-13', 79)], '2026-10-13').kgSemana).toBeNull()
  })
  it('las del futuro, las de hace más de 30 días y las que no tienen peso no cuentan', () => {
    const t = tendenciaPeso([m('2026-08-01', 90), m('2026-10-01', 80), m('2026-10-08', 79.3), m('2026-10-09'), m('2026-10-20', 70)], '2026-10-13')
    expect(t.puntos).toEqual([80, 79.3])
    expect(t.kgSemana).toBe(-0.7)
  })
  it('la línea pequeña: con menos de 2 puntos vacía; con valores iguales, plana', () => {
    expect(lineaSpark([80])).toBe('')
    expect(lineaSpark([80, 80])).toBe('2,4 118,4')
  })
})
