// Escrituras del cuerpo: mediciones (también las de Health Connect), pasos, fotos y metas.
import { db } from '../db'
import type { Foto, Guardado, Medicion, Meta } from '../tipos'
import { guardarAjustes } from '../repos'
import type { grasaTardia } from '../../dominio/bascula'
import { PASOS_POR_KM } from '../../dominio/tendencias'

/** Guarda una medición y devuelve cómo deshacerlo. */
export async function apuntarMedicion(m: Medicion): Promise<() => void> {
  const id = await db.mediciones.add(m)
  return () => { void db.mediciones.delete(id) }
}

/**
 * Borra una medición. Si venía de Health Connect, sus lecturas pasan a ignoradas (si no, volvía en la siguiente
 * sincronización). Devuelve cómo deshacerlo, o undefined si no existía.
 */
export async function borrarMedicion(id: number): Promise<(() => void) | undefined> {
  const r = await db.transaction('rw', [db.mediciones, db.ajustes], async () => {
    const m = await db.mediciones.get(id)
    await db.mediciones.delete(id)
    const antes = (await db.ajustes.get('app'))?.hcIgnorados ?? []
    if (m?.hc?.length) await guardarAjustes({ hcIgnorados: [...antes, ...m.hc].slice(-500) })
    return m ? { m, antes } : null
  })
  if (!r) return undefined
  return () => {
    void db.transaction('rw', [db.mediciones, db.ajustes], async () => {
      await db.mediciones.put(r.m)
      if (r.m.hc?.length) await guardarAjustes({ hcIgnorados: r.antes })
    })
  }
}

/** Pesadas nuevas de Health Connect y la grasa que llegó más tarde que su peso, de una vez. */
export async function guardarLecturasBascula(nuevas: Medicion[], tardias: ReturnType<typeof grasaTardia>) {
  await db.transaction('rw', db.mediciones, async () => {
    if (nuevas.length) await db.mediciones.bulkAdd(nuevas)
    for (const g of tardias) {
      await db.mediciones.where('id').equals(g.id).modify(m => { m.bascula = { ...m.bascula, grasaPct: g.grasaPct }; m.hc = [...(m.hc ?? []), ...g.ids] })
    }
  })
}

/** Los pasos de un día a mano (el trote apuntado ese día se conserva). */
export async function guardarPasos(fecha: string, pasos: number) {
  await db.transaction('rw', db.pasos, async () => {
    const prev = await db.pasos.get(fecha)
    await db.pasos.put({ fecha, pasos: Math.max(0, Math.round(pasos)), fuente: 'manual', troteKm: prev?.troteKm })
  })
}

/** Suma un trote a los pasos del día. Devuelve cómo deshacerlo (vuelve el día como estaba). */
export async function sumarTrote(fecha: string, pasos: number, km: number): Promise<() => void> {
  const prev = await db.transaction('rw', db.pasos, async () => {
    const prev = await db.pasos.get(fecha)
    await db.pasos.put({ fecha, pasos: (prev?.pasos ?? 0) + pasos, fuente: prev?.fuente ?? 'manual', troteKm: Math.round(((prev?.troteKm ?? 0) + km) * 10) / 10 })
    return prev
  })
  return () => { void (prev ? db.pasos.put(prev) : db.pasos.delete(fecha)) }
}

/** Pasos andados de Health Connect por día; el trote apuntado a mano se suma aparte. */
export async function guardarPasosAuto(dias: Record<string, number>) {
  await db.transaction('rw', db.pasos, async () => {
    for (const [fecha, pasos] of Object.entries(dias)) {
      const prev = await db.pasos.get(fecha)
      const trote = prev?.troteKm ? Math.round(prev.troteKm * PASOS_POR_KM) : 0
      await db.pasos.put({ fecha, pasos: pasos + trote, fuente: 'auto', troteKm: prev?.troteKm })
    }
  })
}

export async function guardarFoto(f: Omit<Foto, 'id'>) {
  await db.fotos.add(f)
}

export async function borrarFoto(id: number) {
  await db.fotos.delete(id)
}

export async function guardarMeta(m: Meta) {
  await db.metas.put(m)
}

/** Borra la meta y devuelve cómo deshacerlo. */
export async function borrarMeta(m: Guardado<Meta>): Promise<() => void> {
  const copia = { ...m }
  await db.metas.delete(m.id)
  return () => { void db.metas.put(copia) }
}
