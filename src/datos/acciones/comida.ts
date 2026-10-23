// Escrituras de la comida: lo apuntado, Mis comidas, los productos escaneados y los suplementos.
import { db } from '../db'
import type { Comida, Guardado, Perfil, Plantilla, Producto } from '../tipos'
import { guardarPerfil } from '../repos'
import { batidoDe, buscarOFF, conRacion, esBatido, franjaPorHora, type Racion } from '../../dominio/comida'
import { horaActual, hoyISO } from '../../dominio/fechas'

type Deshacer = () => void

/** Apunta una comida y devuelve cómo deshacerlo. */
export async function apuntar(c: Omit<Comida, 'id' | 'hora' | 'franja'> & { hora?: string; franja?: Comida['franja'] }): Promise<Deshacer> {
  const hora = c.hora ?? horaActual()
  const id = await db.comidas.add({ ...c, hora, franja: c.franja ?? franjaPorHora(hora) } as Comida)
  return () => { void db.comidas.delete(id) }
}

/** Apunta una plantilla en la ración elegida (un picoteo guarda la bolsa entera; una comida, el plato) y cuenta un uso más. */
export async function apuntarPlantilla(p: Plantilla, r: Racion, fecha: string, franja?: Comida['franja']): Promise<Deshacer> {
  const v = conRacion(p, r, p.tipo)
  const tipo: Comida['tipo'] = p.tipo === 'comida' ? 'plantilla' : p.tipo
  const hora = horaActual()
  const c = { fecha, hora, franja: franja ?? franjaPorHora(hora), nombre: p.nombre, ...v, racion: r, tipo, plantillaId: p.id, codigo: p.codigo, foto: p.foto } as Comida
  const id = await db.transaction('rw', [db.comidas, db.plantillas], async () => {
    const id = await db.comidas.add(c)
    if (p.id != null) await db.plantillas.update(p.id, { usos: p.usos + 1 })
    return id
  })
  return () => {
    void db.transaction('rw', [db.comidas, db.plantillas], async () => {
      await db.comidas.delete(id)
      if (p.id != null) await db.plantillas.update(p.id, { usos: p.usos })
    })
  }
}

/** Guarda los cambios de algo apuntado; deshacer lo deja como estaba. */
export async function guardarComida(c: Comida, original: Comida): Promise<Deshacer> {
  await db.comidas.put(c)
  return () => { void db.comidas.put(original) }
}

/** Borra algo apuntado; deshacer lo vuelve a poner (con el mismo id). */
export async function borrarComida(c: Guardado<Comida>): Promise<Deshacer> {
  await db.comidas.delete(c.id)
  return () => { void db.comidas.put(c) }
}

export async function guardarPlantilla(p: Plantilla): Promise<number> {
  return (await db.plantillas.put(p)) as number
}

export async function borrarPlantilla(p: Guardado<Plantilla>): Promise<Deshacer> {
  await db.plantillas.delete(p.id)
  return () => { void db.plantillas.put(p) }
}

export async function guardarProducto(p: Producto) {
  await db.productos.put(p)
}

export async function borrarProducto(p: Producto): Promise<Deshacer> {
  await db.productos.delete(p.codigo)
  return () => { void db.productos.put(p) }
}

/** Guarda el producto en Mis comidas si aún no está (por su código). False si ya estaba. */
export async function plantillaDeProducto(x: Plantilla & { codigo: string }): Promise<boolean> {
  return db.transaction('rw', db.plantillas, async () => {
    if (await db.plantillas.filter(y => y.codigo === x.codigo).first()) return false
    await db.plantillas.add(x)
    return true
  })
}

/** Busca en Open Food Facts los códigos escaneados sin conexión. Devuelve cuántos encontró. */
export async function buscarPendientes(): Promise<number> {
  const pend = await db.productos.filter(p => !!p.pendiente).toArray()
  let n = 0
  for (const [i, p] of pend.entries()) {
    // Open Food Facts permite unas 15 consultas por minuto: una cada 4,5 s.
    if (i) await new Promise(r => setTimeout(r, 4500))
    const r = await buscarOFF(p.codigo)
    if (r.estado === 'offline') break
    if (r.estado === 'encontrado') { await db.productos.put(r.producto); n++ }
  }
  return n
}

/**
 * Lo marca como tomado y, si es el batido, lo apunta como comida (suma al día). Devuelve cómo deshacerlo, o null si
 * ya estaba tomado: mirar y marcar van en la misma transacción, así un doble toque no apunta dos batidos.
 */
export async function marcarSuplemento(perfil: Perfil, fecha: string, s: string): Promise<Deshacer | null> {
  const r = await db.transaction('rw', [db.suplementos, db.comidas], async () => {
    const tomados = new Set((await db.suplementos.get(fecha))?.tomados ?? [])
    if (tomados.has(s)) return null
    tomados.add(s)
    await db.suplementos.put({ fecha, tomados: [...tomados] })
    if (!esBatido(s)) return { id: undefined }
    const b = batidoDe(perfil.batido)
    const hora = fecha === hoyISO() ? horaActual() : '17:30'
    return { id: (await db.comidas.add({ fecha, hora, franja: franjaPorHora(hora), nombre: s, kcal: b.kcal, proteina: b.proteina, racion: 'N', tipo: 'plantilla', suplemento: s })) as number }
  })
  return r && (() => { void desmarcarSuplemento(fecha, s, r.id) })
}

/** Un toque en el suplemento: si no estaba tomado lo marca (y devuelve cómo deshacerlo); si lo estaba, lo desmarca (null). */
export async function alternarSuplemento(perfil: Perfil, fecha: string, s: string): Promise<Deshacer | null> {
  return db.transaction('rw', [db.suplementos, db.comidas], async () => {
    if (!((await db.suplementos.get(fecha))?.tomados ?? []).includes(s)) return marcarSuplemento(perfil, fecha, s)
    await desmarcarSuplemento(fecha, s)
    return null
  })
}

/** Lo quita de tomados y borra el batido que se apuntó al marcarlo (el apuntado a mano no se toca). */
export async function desmarcarSuplemento(fecha: string, s: string, id?: number) {
  await db.transaction('rw', [db.suplementos, db.comidas], async () => {
    const tomados = new Set((await db.suplementos.get(fecha))?.tomados ?? [])
    tomados.delete(s)
    await db.suplementos.put({ fecha, tomados: [...tomados] })
    if (id != null) await db.comidas.delete(id)
    else await db.comidas.where('fecha').equals(fecha).filter(c => c.suplemento === s).delete()
  })
}

/**
 * Guarda la dosis de un suplemento y, si es el batido, lo que lleva: también en el batido de Mis comidas y en el
 * ya marcado hoy. `nombres` son los del batido en Mis comidas (puede ir traducido: las de partida salen en el idioma).
 */
export async function guardarSuplemento(perfil: Perfil, s: string, dosis: string, batido: NonNullable<Perfil['batido']> | null, nombres: string[]) {
  await db.transaction('rw', [db.perfil, db.plantillas, db.comidas], async () => {
    await guardarPerfil({ dosisSuplementos: { ...perfil.dosisSuplementos, [s]: dosis }, ...(batido ? { batido } : {}) })
    if (!batido) return
    await db.plantillas.filter(p => nombres.includes(p.nombre.toLowerCase())).modify({ kcal: batido.kcal, proteina: batido.proteina })
    await db.comidas.where('fecha').equals(hoyISO()).filter(c => c.suplemento === s).modify({ kcal: batido.kcal, proteina: batido.proteina })
  })
}
