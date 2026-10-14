// Copias de seguridad: exportar → importar deja exactamente los mismos datos (fotos incluidas)
// y un archivo dañado nunca toca la base.
import { beforeEach, describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { db, TABLAS } from '../src/datos/db'
import { exportar, importar } from '../src/datos/copias'
import { ajustesPorDefecto, gimnasioNuevo, perfilPorDefecto } from '../src/datos/repos'

const imagen = (txt: string, tipo = 'image/jpeg') => new Blob([new TextEncoder().encode(txt)], { type: tipo })

async function sembrar() {
  for (const t of TABLAS) await db.table(t).clear()
  await db.perfil.put({ ...perfilPorDefecto(), nombre: 'Álex', altaCompleta: true })
  await db.ajustes.put({ ...ajustesPorDefecto(), gimnasioActivo: 1, recolocadas: [{ fecha: '2026-10-17', letra: 'B', desde: '2026-10-15' }] })
  await db.mediciones.add({ fecha: '2026-10-12T07:05', origen: 'casa', pesoKg: 79.4, perimetros: { cintura: 97.5 }, bascula: { grasaPct: 24.1 } })
  await db.fotos.add({ fecha: '2026-10-12T07:10', pose: 'frente', imagen: imagen('foto-frente', 'image/png') })
  await db.fotos.add({ fecha: '2026-10-12T07:11', pose: 'perfil', imagen: imagen('foto-perfil') })
  await db.gimnasios.add({ ...gimnasioNuevo('Barrio'), propias: [{ id: 'p1', nombre: 'Prensa vieja', parecida: 'leg-press', foto: imagen('maquina') }, { id: 'p2', nombre: 'Sin foto', parecida: null }] })
  await db.marcas.put({ id: 'bench-press', favorito: true, ajustes: 'Banco 3' })
  await db.sesiones.add({ fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'Cuerpo completo A', gimnasioId: 1, inicio: 1, fin: 2, version: 'normal', estado: 'hecha', calibracion: false, ejercicios: [{ uid: 'u1', ejercicio: 'assisted-pull-ups', planificado: 'assisted-pull-ups', estado: 'hecho', repsMin: 6, repsMax: 10, rpe: 8, descanso: 90, registro: 'asistido', series: [{ n: 1, peso: -22.5, reps: 8, rpe: 8.5, calentamiento: false, hecha: true, ts: 3 }] }] })
  await db.comidas.add({ fecha: '2026-10-13', hora: '14:00', franja: 'comida', nombre: 'Lentejas', kcal: 650, proteina: 32, racion: 'N', tipo: 'foto', foto: imagen('plato') })
  await db.plantillas.add({ nombre: 'Batido', kcal: 120, proteina: 24, tipo: 'comida', usos: 3 })
  await db.productos.put({ codigo: '8410000000000', nombre: 'Yogur', marca: 'X', kcal100: 60, proteina100: 10, racionG: 125, kcalRacion: 75, proteinaRacion: 12.5, guardado: '2026-10-01T10:00:00.000Z' })
  await db.pasos.put({ fecha: '2026-10-13', pasos: 8123, fuente: 'manual', troteKm: 2.5 })
  await db.suplementos.put({ fecha: '2026-10-13', tomados: ['Creatina'] })
  await db.metas.add({ tipo: 'peso', titulo: 'Bajar a 75', objetivo: 75, unidad: 'kg', inicio: 80 })
}

/** Instantánea comparable de toda la base (los Blob se pasan a texto + tipo). */
async function instantanea() {
  const conv = async (v: unknown): Promise<unknown> => {
    if (v instanceof Blob) return { blob: await v.text(), tipo: v.type }
    if (Array.isArray(v)) return Promise.all(v.map(conv))
    if (v && typeof v === 'object') return Object.fromEntries(await Promise.all(Object.entries(v).map(async ([k, x]) => [k, await conv(x)])))
    return v
  }
  const out: Record<string, unknown> = {}
  for (const t of TABLAS) out[t] = await conv(await db.table(t).toArray())
  return out
}

describe('copias de seguridad', () => {
  beforeEach(sembrar)

  it('exportar → borrar → importar deja los mismos datos, fotos (Blob) incluidas', async () => {
    const antes = await instantanea()
    const bytes = await exportar()
    for (const t of TABLAS) await db.table(t).clear()
    expect(await importar(bytes)).toBe('copia')
    const despues = await instantanea()
    expect(despues).toEqual(antes)
    const foto = (await db.fotos.toArray())[0]!
    expect(foto.imagen).toBeInstanceOf(Blob)
    expect(foto.imagen.type).toBe('image/png')
    const g = (await db.gimnasios.toArray())[0]!
    expect(g.propias[0]!.foto).toBeInstanceOf(Blob)
    expect(g.propias[1]!.foto).toBeUndefined()
  })

  it('dos vueltas seguidas (exportar → importar → exportar → importar) siguen iguales', async () => {
    const antes = await instantanea()
    await importar(await exportar())
    await importar(await exportar())
    expect(await instantanea()).toEqual(antes)
  })

  const danados: [string, () => Promise<Uint8Array>][] = [
    ['archivo vacío', async () => new Uint8Array()],
    ['bytes al azar', async () => Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256)],
    ['texto que no es JSON', async () => strToU8('hola, esto no es una copia')],
    ['zip cortado por la mitad', async () => { const b = await exportar(); return b.slice(0, Math.floor(b.length / 2)) }],
    ['zip sin datos.json', async () => zipSync({ 'otra.txt': strToU8('x') })],
    ['zip con JSON roto', async () => zipSync({ 'datos.json': strToU8('{"app":"JowyFit","datos":{') })],
    ['copia sin datos', async () => strToU8(JSON.stringify({ app: 'JowyFit', version: 1, datos: {} }))],
    ['copia con datos que no son tablas', async () => strToU8(JSON.stringify({ app: 'JowyFit', version: 1, datos: 'nada' }))],
    ['tabla que no es una lista', async () => strToU8(JSON.stringify({ app: 'JowyFit', version: 1, datos: { perfil: [], sesiones: 'x' } }))],
    ['fila que no es un objeto', async () => strToU8(JSON.stringify({ app: 'JowyFit', version: 1, datos: { perfil: [5] } }))],
    ['perfil sin id', async () => strToU8(JSON.stringify({ app: 'JowyFit', version: 1, datos: { perfil: [{ nombre: 'x' }] } }))],
    ['producto sin código', async () => strToU8(JSON.stringify({ app: 'JowyFit', version: 1, datos: { perfil: [], productos: [{ nombre: 'x' }] } }))],
    ['copia de una versión futura', async () => zipSync({ 'datos.json': strToU8(JSON.stringify({ app: 'JowyFit', version: 99, datos: { perfil: [] } })) })],
    ['JSON que no es un perfil (lista)', async () => strToU8('[1,2,3]')],
    ['JSON null', async () => strToU8('null')],
    ['JSON de otra app', async () => strToU8(JSON.stringify({ app: 'OtraApp', cosas: [1] }))],
  ]
  for (const [nombre, crear] of danados) {
    it(`archivo dañado (${nombre}): da error y no toca la base`, async () => {
      const bytes = await crear()
      const antes = await instantanea()
      await expect(importar(bytes)).rejects.toThrow()
      expect(await instantanea()).toEqual(antes)
    })
  }

  it('el error de un archivo dañado se entiende (no es un SyntaxError de JSON)', async () => {
    await expect(importar(strToU8('{roto'))).rejects.toThrow(/dañado|JowyFit/)
  })

  it('perfil sencillo: la plantilla de ejemplo (todo a null) no crea mediciones vacías ni con fecha «AAAA-MM-DD»', async () => {
    const plantilla = { version: 1, perfil: { nacimiento: 'AAAA-MM-DD', sexo: 'hombre | mujer', altura_cm: null, preocupaciones: [] }, mediciones: [{ fecha: 'AAAA-MM-DDTHH:MM', origen: 'manual', peso_kg: null, grasa_pct: null, perimetros_cm: { cintura_ombligo: null, cuello: null } }] }
    const n = await db.mediciones.count()
    expect(await importar(strToU8(JSON.stringify(plantilla)))).toBe('perfil')
    expect(await db.mediciones.count()).toBe(n)
  })

  it('perfil sencillo: días en mayúsculas, sin repetidos; mediciones solo con lo que tiene número', async () => {
    const datos = { perfil: { sexo: 'mujer', altura_cm: 165 }, logistica: { dias_fijos: ['Martes', 'jueves', 'martes', 'Viernes '], vuelta_casa: { coche: '6:20' } }, mediciones: [{ fecha: '2026-10-01', origen: 'cinta_metrica', perimetros_cm: { cintura_ombligo: 80, cuello: null } }] }
    await importar(strToU8(JSON.stringify(datos)))
    const p = (await db.perfil.get('yo'))!
    expect(p.diasFijos).toEqual([1, 3, 4])
    expect(p.horaLimite.coche).toBe('06:20')
    const m = (await db.mediciones.toArray()).find(x => x.fecha === '2026-10-01T08:00')!
    expect(m.perimetros).toEqual({ cintura: 80 })
    expect(m.origen).toBe('cinta')
  })
})
