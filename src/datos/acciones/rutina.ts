// Escrituras de la rutina y los gimnasios.
import { db } from '../db'
import type { Gimnasio, MaquinaPropia, Rutina } from '../tipos'
import { gimnasioNuevo, guardarAjustes } from '../repos'

/** Guarda la rutina como la activa: las demás dejan de serlo. */
export async function activarRutina(r: Omit<Rutina, 'id'>): Promise<number> {
  return db.transaction('rw', db.rutinas, async () => {
    await db.rutinas.toCollection().modify({ activa: false })
    return (await db.rutinas.add({ ...r, activa: true })) as number
  })
}

export async function guardarRutina(r: Rutina) {
  await db.rutinas.put(r)
}

export async function crearGimnasio(nombre: string): Promise<number> {
  return (await db.gimnasios.add(gimnasioNuevo(nombre))) as number
}

export async function guardarGimnasio(g: Gimnasio) {
  await db.gimnasios.put(g)
}

/** Borra el gimnasio; si era el activo, pasa a serlo el primero que quede. */
export async function borrarGimnasio(id: number) {
  await db.transaction('rw', [db.gimnasios, db.ajustes], async () => {
    await db.gimnasios.delete(id)
    const a = await db.ajustes.get('app')
    if (a?.gimnasioActivo === id) await guardarAjustes({ gimnasioActivo: (await db.gimnasios.toCollection().first())?.id ?? null })
  })
}

/** Añade o cambia una máquina propia; la «parecida» suma su material al gimnasio. False si el gimnasio ya no está. */
export async function guardarMaquinaPropia(gymId: number, m: MaquinaPropia): Promise<boolean> {
  return db.transaction('rw', db.gimnasios, async () => {
    const g = await db.gimnasios.get(gymId)
    if (!g) return false
    const propias = [...g.propias.filter(x => x.id !== m.id), m]
    const material = m.parecida && !g.material.includes(m.parecida) ? [...g.material, m.parecida] : g.material
    await db.gimnasios.put({ ...g, propias, material })
    return true
  })
}
