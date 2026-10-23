// Escrituras de la rutina y los gimnasios.
import { db } from '../db'
import type { Ajustes, Gimnasio, MaquinaPropia, Rutina } from '../tipos'
import { gimnasioNuevo, guardarAjustes, leerAjustes } from '../repos'

/** Fecha de «la saltamos esta semana»: la sesión perdida no se pasa a ningún día. */
export const SIN_DIA = '0000-00-00'

/**
 * Pasa una sesión perdida a otro día (o, con SIN_DIA, la salta). Leer y añadir van en la misma transacción: dos
 * toques seguidos (o la copia automática a la vez) no se pisan.
 */
export async function recolocarSesion(r: Ajustes['recolocadas'][number]) {
  await db.transaction('rw', db.ajustes, async () => {
    await guardarAjustes({ recolocadas: [...((await leerAjustes()).recolocadas ?? []), r] })
  })
}

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
