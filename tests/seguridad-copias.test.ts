// Seguridad de las copias (.jowyfit): cada ataque de la auditoría (copias manipuladas) tiene aquí su prueba.
// Antes todas estas copias se restauraban; ahora se rechazan enteras sin tocar nada (o se limpian).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { db, TABLAS } from '../src/datos/db'
import { borrarTodosLosDatos, exportar, importar, LIMITES_ZIP } from '../src/datos/copias'
import { ajustesPorDefecto, gimnasioNuevo, perfilPorDefecto } from '../src/datos/repos'

const MB = 1024 * 1024
const copia = (datos: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ app: 'JowyFit', version: 1, ...extra, datos })
const json = (o: unknown) => strToU8(JSON.stringify(o))
const zipDe = (o: unknown, archivos: Record<string, Uint8Array> = {}) => zipSync({ 'datos.json': json(o), ...archivos })
const perfil = (cambios: Record<string, unknown> = {}) => ({ ...perfilPorDefecto(), nombre: 'Atacante', altaCompleta: true, ...cambios })
const cuenta = async () => Object.fromEntries(await Promise.all(TABLAS.map(async t => [t, await db.table(t).count()])))
const sesion = (id: number) => ({ id, fecha: '2020-01-01', rutinaId: null, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 1, version: 'normal', estado: 'hecha', calibracion: false, ejercicios: [] })
const comida = (c: Record<string, unknown> = {}) => ({ fecha: '2026-10-13', hora: '14:00', franja: 'comida', nombre: 'Arroz', kcal: 600, proteina: 20, racion: 'N', tipo: 'nota', ...c })

async function sembrar() {
  // Base nueva en cada prueba (un contador de claves agotado sobrevive a clear()).
  await db.delete(); await db.open()
  await db.perfil.put({ ...perfilPorDefecto(), nombre: 'Dueño', altaCompleta: true })
  await db.ajustes.put(ajustesPorDefecto())
  for (let i = 0; i < 5; i++) await db.mediciones.add({ fecha: `2026-10-1${i}T08:00`, origen: 'casa', pesoKg: 80 - i })
  await db.gimnasios.add(gimnasioNuevo('Mi gimnasio'))
}

/** La copia se rechaza con un mensaje claro y la base sigue exactamente igual. */
async function rechazada(bytes: Uint8Array, mensaje: RegExp = /no son de JowyFit|dañad|vacía|versión|grande|no es una copia/) {
  const antes = await cuenta()
  const nombre = (await db.perfil.get('yo'))!.nombre
  await expect(importar(bytes)).rejects.toThrow(mensaje)
  expect(await cuenta()).toEqual(antes)
  expect((await db.perfil.get('yo'))!.nombre).toBe(nombre)
}

describe('seguridad · copias con tipos cambiados (antes dejaban la app en blanco)', () => {
  beforeEach(sembrar)
  const casos: [string, Record<string, unknown>][] = [
    ['nombre del gimnasio como objeto', { perfil: [perfil()], gimnasios: [{ ...gimnasioNuevo('x'), nombre: { a: 1 } }] }],
    ['nombre de un día de la rutina como objeto', { perfil: [perfil()], rutinas: [{ creada: '2026-10-01', activa: true, estructura: 'x', porque: [], calibracion: false, gimnasioId: null, dias: [{ letra: 'A', nombre: { a: 1 }, dia: 1, opcional: false, bloques: [] }] }] }],
    ['nombre del perfil como objeto', { perfil: [perfil({ nombre: { a: 1 } })] }],
    ['nombre del perfil como número', { perfil: [perfil({ nombre: 7 })] }],
    ['nombre con forma de elemento de React', { perfil: [perfil({ nombre: { $$typeof: 'x', type: 'img', props: { onError: 'x' } } })] }],
    ['suplementos como texto', { perfil: [perfil({ suplementos: 'Creatina' })] }],
    ['días fijos como texto', { perfil: [perfil({ diasFijos: 'abc' })] }],
    ['fecha de una medida como número', { perfil: [perfil()], mediciones: [{ fecha: 123, origen: 'casa', pesoKg: 80 }] }],
    ['hora y nombre de una comida como números', { perfil: [perfil()], comidas: [comida({ hora: 99, nombre: 7 })] }],
    ['texto de 100.000 letras', { perfil: [perfil()], plantillas: [{ nombre: 'Ä'.repeat(100_000), kcal: 1, proteina: 1, tipo: 'comida', usos: 0 }] }],
    ['tipo de comida desconocido', { perfil: [perfil()], comidas: [comida({ tipo: 'constructor' })] }],
    ['un ejercicio con mil millones de series', { perfil: [perfil()], rutinas: [{ creada: '2026-10-01', activa: true, estructura: 'x', porque: [], calibracion: false, gimnasioId: null, dias: [{ letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques: [{ uid: 'b', ejercicio: 'x', alternativas: [], series: 1e9, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso' }] }] }] }],
    ['mancuernas de 0 en 0 (bucle sin fin)', { perfil: [perfil()], gimnasios: [{ ...gimnasioNuevo('x'), mancuernas: [{ desde: 2, hasta: 50, paso: 0 }] }] }],
    ['tabla que no es una lista', { perfil: [perfil()], sesiones: 'x' }],
  ]
  for (const [nombre, datos] of casos) {
    it(`rechaza la copia entera: ${nombre}`, async () => {
      await rechazada(json(copia(datos)))
      await rechazada(zipDe(copia(datos)))
    })
  }
  it('el mensaje dice qué dato falla y que no se ha cambiado nada', async () => {
    await expect(importar(zipDe(copia(casos[0]![1])))).rejects.toThrow(/gimnasios 1 › nombre.*No se ha cambiado nada/)
  })
  it('un valor raro del perfil (sexo «x») se cambia por el de siempre en vez de romper', async () => {
    await importar(zipDe(copia({ perfil: [perfil({ sexo: 'x', reps: 'constructor', zonasSensibles: ['rodilla', 'constructor'] })] })))
    const p = (await db.perfil.get('yo'))!
    expect(p.sexo).toBe(perfilPorDefecto().sexo)
    expect(p.reps).toBe(perfilPorDefecto().reps)
    expect(p.zonasSensibles).toEqual(['rodilla'])
  })
  it('los campos que no son de JowyFit se quitan', async () => {
    await importar(zipDe(copia({ perfil: [perfil({ raro: { mucho: 'x' } })], mediciones: [{ fecha: '2026-10-01T08:00', origen: 'casa', pesoKg: 80, extra: 1 }] })))
    expect((await db.perfil.get('yo')) as unknown as Record<string, unknown>).not.toHaveProperty('raro')
    expect((await db.mediciones.toArray())[0]).not.toHaveProperty('extra')
  })
})

describe('seguridad · copia vacía o sin perfil (antes borraba todo)', () => {
  beforeEach(sembrar)
  it('{perfil: []} se rechaza y no borra nada', async () => { await rechazada(json(copia({ perfil: [] })), /vacía o incompleta/) })
  it('perfil sin el alta hecha se rechaza', async () => { await rechazada(json(copia({ perfil: [perfil({ altaCompleta: false })] })), /vacía o incompleta/) })
  it('perfil con otro id se rechaza', async () => { await rechazada(json(copia({ perfil: [perfil({ id: 'otro' })] }))) })
  it('dos perfiles se rechazan', async () => { await rechazada(json(copia({ perfil: [perfil(), perfil()] }))) })
})

describe('seguridad · ids enormes (antes agotaban el contador de IndexedDB para siempre)', () => {
  beforeEach(sembrar)
  for (const id of [2 ** 53, 2 ** 53 - 1, 1e308, 1e9 + 1, 1.5, 0, -5]) {
    it(`id ${id} se rechaza y después se puede seguir apuntando`, async () => {
      await rechazada(json(copia({ perfil: [perfil()], sesiones: [sesion(id)] })))
      await rechazada(json(copia({ perfil: [perfil()], mediciones: [{ id, fecha: '2026-01-01T08:00', origen: 'casa', pesoKg: 1 }] })))
      await expect(db.sesiones.add(sesion(undefined as unknown as number) as never)).resolves.toBeGreaterThan(0)
    })
  }
  it('una referencia (rutinaId) enorme también se rechaza', async () => {
    await rechazada(json(copia({ perfil: [perfil()], sesiones: [{ ...sesion(1), rutinaId: 2 ** 53 }] })))
  })
  it('«Borrar todos los datos» arregla un móvil ya envenenado (borra la base, no solo las tablas)', async () => {
    await db.sesiones.put(sesion(2 ** 53) as never)
    await expect(db.sesiones.add({ ...sesion(1), id: undefined } as never)).rejects.toThrow()
    await borrarTodosLosDatos()
    await db.open()
    expect(await db.sesiones.count()).toBe(0)
    await expect(db.sesiones.add({ ...sesion(1), id: undefined } as never)).resolves.toBe(1)
  })
})

describe('seguridad · versión de la copia', () => {
  beforeEach(sembrar)
  for (const version of ['999', null, {}, [2], 0, -1, 1.5]) {
    it(`versión ${JSON.stringify(version)} se rechaza`, async () => { await rechazada(json(copia({ perfil: [perfil()] }, { version })), /versión/) })
  }
  it('sin versión se rechaza', async () => { await rechazada(json({ app: 'JowyFit', datos: { perfil: [perfil()] } }), /versión/) })
  it('una versión más nueva lo dice', async () => { await rechazada(zipDe(copia({ perfil: [perfil()] }, { version: 2 })), /más nueva/) })
})

describe('seguridad · fotos de la copia (SVG/HTML podían ejecutar código)', () => {
  beforeEach(sembrar)
  const svg = strToU8('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"><script>window.__pwned=2</script></svg>')
  const ref = (n: string, tipo: string) => ({ __archivo: `archivos/${n}`, tipo })
  it('solo entran fotos jpeg, png, webp o heic: las demás se descartan', async () => {
    const datos = {
      perfil: [perfil()],
      fotos: [
        { fecha: '2026-10-01T08:00', pose: 'frente', imagen: ref('a.jpg', 'image/svg+xml') },
        { fecha: '2026-10-01T08:01', pose: 'perfil', imagen: ref('b.jpg', 'text/html') },
        { fecha: '2026-10-01T08:02', pose: 'espalda', imagen: ref('c.jpg', 'image/jpeg') },
        { fecha: '2026-10-01T08:03', pose: 'frente', imagen: ref('d.jpg', '') },
      ],
      comidas: [comida({ foto: ref('a.jpg', 'image/svg+xml') }), comida({ foto: ref('c.jpg', 'IMAGE/PNG') })],
      gimnasios: [{ ...gimnasioNuevo('g'), propias: [{ id: 'p', nombre: 'P', parecida: null, foto: ref('b.jpg', 'application/xhtml+xml') }] }],
    }
    await importar(zipDe(copia(datos), { 'archivos/a.jpg': svg, 'archivos/b.jpg': svg, 'archivos/c.jpg': strToU8('jpeg'), 'archivos/d.jpg': svg }))
    const fotos = await db.fotos.toArray()
    expect(fotos).toHaveLength(1)
    expect(fotos[0]!.imagen.type).toBe('image/jpeg')
    const cs = await db.comidas.toArray()
    expect(cs[0]!.foto).toBeUndefined()
    expect(cs[1]!.foto?.type).toBe('image/png')
    expect((await db.gimnasios.toArray())[0]!.propias[0]!.foto).toBeUndefined()
  })
  it('un nombre de archivo con «..» o raro se rechaza', async () => {
    await rechazada(zipDe(copia({ perfil: [perfil()], fotos: [{ fecha: '2026-10-01T08:00', pose: 'frente', imagen: { __archivo: '../../x', tipo: 'image/jpeg' } }] })))
  })
})

describe('seguridad · imagen de producto (píxel espía)', () => {
  beforeEach(sembrar)
  const producto = (imagen: string) => ({ codigo: '8410000000002', nombre: 'Yogur', marca: 'X', imagen, kcal100: 60, proteina100: 10, racionG: 125, kcalRacion: 75, proteinaRacion: 12.5, guardado: '2026-10-01T10:00:00.000Z' })
  it('solo se guardan las de Open Food Facts por https', async () => {
    const buenas = ['https://images.openfoodfacts.org/images/products/841/000/000/0002/front_es.3.200.jpg', 'https://static.openfoodfacts.org/images/x.png', 'https://images.openfoodfacts.net/x.jpg']
    const malas = ['https://seguimiento.invalid/pixel.gif?quien=jowyfit', 'http://images.openfoodfacts.org/x.jpg', 'javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', 'https://openfoodfacts.org.atacante.example/x.jpg', 'https://x@images.openfoodfacts.org/x.jpg', 'https://images.openfoodfacts.org:8443/x.jpg']
    const productos = [...buenas, ...malas].map((u, i) => ({ ...producto(u), codigo: String(8410000000000 + i) }))
    await importar(zipDe(copia({ perfil: [perfil()], productos })))
    const guardadas = (await db.productos.toArray()).map(p => p.imagen).filter(Boolean)
    expect(guardadas.sort()).toEqual([...buenas].sort())
  })
})

describe('seguridad · zip bomba y archivos raros', () => {
  beforeEach(sembrar)
  it('un datos.json de más de 50 MB (comprimido en unos KB) se rechaza sin descomprimirlo', async () => {
    const enorme = new Uint8Array(LIMITES_ZIP.json + MB).fill(32)
    const bomba = zipSync({ 'datos.json': enorme }, { level: 9 })
    expect(bomba.length).toBeLessThan(MB)
    await rechazada(bomba, /demasiado grande/)
  })
  it('las entradas que no usa la copia no se descomprimen (300 MB de basura no cuestan nada)', async () => {
    const basura = new Uint8Array(100 * MB)
    const z = zipSync({ 'datos.json': json(copia({ perfil: [perfil()] })), 'basura/0': basura, 'basura/1': basura, 'basura/2': basura }, { level: 9 })
    const antes = process.memoryUsage().arrayBuffers
    const t = performance.now()
    expect(await importar(z)).toBe('copia')
    expect(performance.now() - t).toBeLessThan(3000)
    expect(process.memoryUsage().arrayBuffers - antes).toBeLessThan(50 * MB)
  })
  it('fotos que suman más de 300 MB se rechazan', async () => {
    const grande = new Uint8Array(LIMITES_ZIP.foto - MB)
    const archivos: Record<string, Uint8Array> = {}
    const fotos = []
    for (let i = 0; i < 11; i++) { archivos[`archivos/f${i}.jpg`] = grande; fotos.push({ fecha: '2026-10-01T08:00', pose: 'frente', imagen: { __archivo: `archivos/f${i}.jpg`, tipo: 'image/jpeg' } }) }
    await rechazada(zipSync({ 'datos.json': json(copia({ perfil: [perfil()], fotos })), ...archivos }, { level: 9 }), /demasiado grande/)
  })
  it('un zip que miente sobre el tamaño de datos.json no se descomprime de más (y se rechaza)', async () => {
    const z = zipSync({ 'datos.json': new Uint8Array(10 * MB).fill(32) }, { level: 9 })
    // El tamaño original del directorio central dice 100 bytes.
    const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
    const fin = z.length - 22
    const cd = v.getUint32(fin + 16, true)
    v.setUint32(cd + 24, 100, true)
    await rechazada(z)
  })
  for (const [nombre, bytes] of [
    ['un PNG', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])],
    ['un PDF', strToU8('%PDF-1.7\n%âãÏÓ\n1 0 obj')],
    ['un «zip» que no lo es', Uint8Array.from([0x50, 0x4b, 3, 4, 9, 9, 9, 9])],
    ['texto suelto', strToU8('hola')],
  ] as const) {
    it(`${nombre} se rechaza bien`, async () => { await rechazada(bytes as Uint8Array, /dañado|no es una copia|perfil/) })
  }
})

describe('seguridad · las copias buenas siguen entrando igual', () => {
  beforeEach(sembrar)
  it('exportar → importar da los mismos datos, con dosis llamadas «constructor» o «__proto__»', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), altaCompleta: true, suplementos: ['Creatina', 'constructor', '__proto__'], dosisSuplementos: { Creatina: '5 g', constructor: '1 g', ['__proto__']: '2 g' } })
    const antes = (await db.perfil.get('yo'))!
    await importar(await exportar())
    const p = (await db.perfil.get('yo'))!
    expect(p).toEqual(antes)
    expect(Object.prototype.hasOwnProperty.call(p.dosisSuplementos, '__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('seguridad · la copia automática ya no pisa la de hoy', () => {
  it('hacer copia → recuperar otra → copia automática: dos archivos distintos y el primero intacto', async () => {
    await sembrar()
    const guardados: Record<string, Uint8Array> = {}
    vi.resetModules()
    vi.doMock('../src/plataforma', async orig => {
      const m = (await orig()) as Record<string, unknown>
      return { ...m, esNativo: () => true, guardarArchivo: async (n: string, b: Uint8Array) => { guardados[n] = b; return n }, copiasGuardadas: async () => Object.keys(guardados).map(nombre => ({ nombre, fecha: 0, tam: 0 })) }
    })
    try {
      const { hacerCopiaAhora, copiaAutomatica } = await import('../src/ui/servicios')
      const { importar: imp } = await import('../src/datos/copias')
      await hacerCopiaAhora()
      const [primera] = Object.keys(guardados)
      const buena = guardados[primera!]!
      // Una copia (propia y antigua, o ajena) con la última copia de hace mucho: la automática sale enseguida.
      await imp(json(copia({ perfil: [perfil()], ajustes: [{ ...ajustesPorDefecto(), copiaAuto: true, ultimaCopia: null }], mediciones: [{ fecha: '2026-01-01T08:00', origen: 'casa', pesoKg: 1 }] })))
      expect(await copiaAutomatica()).toBe(true)
      expect(Object.keys(guardados)).toHaveLength(2)
      expect(guardados[primera!]).toBe(buena)
      expect(Object.keys(guardados)[1]).toMatch(/^jowyfit-\d{4}-\d{2}-\d{2}-\d{4}(-\d+)?\.jowyfit$/)
    } finally {
      vi.doUnmock('../src/plataforma')
      vi.resetModules()
    }
  })
})
