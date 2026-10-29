// Escrituras del cuerpo: mediciones (también las de Health Connect), pasos y cardio, fotos y metas.
import { db } from '../db'
import type { Foto, Guardado, Medicion, Meta, TipoCardio } from '../tipos'
import { guardarAjustes, leerPerfil } from '../repos'
import type { grasaTardia } from '../../dominio/bascula'
import { PASOS_POR_KM } from '../../dominio/tendencias'
import { CARDIO_INICIO, metaMovimiento } from '../../dominio/cardio'
import { diasEntre, edad, hoyISO, sumarDias } from '../../dominio/fechas'
import { reprogramarNotificaciones } from './avisos'

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
    await db.pasos.put({ ...prev, fecha, pasos: Math.max(0, Math.round(pasos)), fuente: 'manual', troteKm: prev?.troteKm })
  })
}

/** Suma un trote a los pasos del día. Devuelve cómo deshacerlo (vuelve el día como estaba). */
export async function sumarTrote(fecha: string, pasos: number, km: number): Promise<() => void> {
  const prev = await db.transaction('rw', db.pasos, async () => {
    const prev = await db.pasos.get(fecha)
    await db.pasos.put({ ...prev, fecha, pasos: (prev?.pasos ?? 0) + pasos, fuente: prev?.fuente ?? 'manual', troteKm: Math.round(((prev?.troteKm ?? 0) + km) * 10) / 10 })
    return prev
  })
  return () => { void (prev ? db.pasos.put(prev) : db.pasos.delete(fecha)) }
}

/** Minutos de cardio fuera del gimnasio (caminar, bici…). No suma pasos: los pasos no son minutos de cardio. */
export async function apuntarCardio(fecha: string, tipo: TipoCardio, min: number): Promise<() => void> {
  const prev = await db.transaction('rw', db.pasos, async () => {
    const prev = await db.pasos.get(fecha)
    await db.pasos.put({ ...(prev ?? { fecha, pasos: 0, fuente: 'manual' as const }), cardio: [...(prev?.cardio ?? []), { tipo, min: Math.max(1, Math.round(min)) }] })
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
      await db.pasos.put({ ...prev, fecha, pasos: pasos + trote, fuente: 'auto', troteKm: prev?.troteKm })
    }
  })
}

// El aviso de la foto cuenta desde la última: al hacer o borrar una, se vuelve a calcular.
export async function guardarFoto(f: Omit<Foto, 'id'>) {
  await db.fotos.add(f)
  await reprogramarNotificaciones()
}

export async function borrarFoto(id: number) {
  await db.fotos.delete(id)
  await reprogramarNotificaciones()
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

/**
 * La subida poco a poco (al abrir la app): cada 2 semanas desde `progresoMovimiento`, +1.000 pasos y +15 min de
 * cardio hasta lo bueno para su edad. Solo si la meta ya se tocó en Perfil → Pasos y cardio.
 */
export async function subirMovimiento(hoy = hoyISO()): Promise<void> {
  await db.transaction('rw', db.perfil, async () => {
    const p = await leerPerfil()
    if (!p?.progresoMovimiento) return
    const semanas = Math.floor(diasEntre(p.progresoMovimiento, hoy) / 7)
    if (semanas < 2) return
    const meta = metaMovimiento({ pasos: p.pasosObjetivo, cardio: p.cardioMin ?? CARDIO_INICIO, edad: edad(p.nacimiento), semanas })
    const escalones = Math.floor(semanas / 2)
    await db.perfil.put({ ...p, pasosObjetivo: meta.pasos, cardioMin: meta.cardio, progresoMovimiento: sumarDias(p.progresoMovimiento, escalones * 14) })
  })
}
