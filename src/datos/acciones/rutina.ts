// Escrituras de la rutina y los gimnasios.
import { db } from '../db'
import type { Ajustes, Gimnasio, MaquinaPropia, Rutina } from '../tipos'
import { gimnasioActivo, gimnasioNuevo, guardarAjustes, leerAjustes, leerPerfil, rutinaActiva } from '../repos'
import { catalogoCargado } from '../../catalogo/catalogo'
import { generarRutina } from '../../dominio/generador'

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

/**
 * Rehace la rutina con el perfil de ahora (al quitar o poner el modo mayor desde Ajustes). Conserva si va en semana de
 * prueba; los pesos y el historial no se tocan (salen de los entrenos hechos).
 */
export async function regenerarRutina(): Promise<boolean> {
  const c = catalogoCargado()
  const [perfil, g, actual, a, marcas] = await Promise.all([leerPerfil(), gimnasioActivo(), rutinaActiva(), leerAjustes(), db.marcas.toArray()])
  if (!c || !perfil) return false
  const nueva = generarRutina({
    perfil, gimnasio: g ?? null, marcas: new Map(marcas.map(m => [m.id, m])), ejercicios: c.ejercicios, calibracion: actual?.calibracion ?? false,
    descansos: { compuesto: a.descansoCompuesto, aislamiento: a.descansoAislamiento },
  })
  await activarRutina(nueva)
  return true
}
