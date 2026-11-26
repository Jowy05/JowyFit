// Escrituras de los intentos de retos: guarda la marca comprobando en la misma transacción si bate el récord.
import { db } from '../db'
import type { Guardado, IntentoReto } from '../tipos'
import { esNuevoRecordReto } from '../../dominio/retos'
import { horaActual, hoyISO } from '../../dominio/fechas'

export async function guardarIntentoReto(datos: Omit<IntentoReto, 'id' | 'fecha' | 'record'> & { fecha?: string }): Promise<Guardado<IntentoReto>> {
  const fecha = datos.fecha ?? `${hoyISO()}T${horaActual()}`
  return db.transaction('rw', db.retos, async () => {
    const previos = await db.retos.where('reto').equals(datos.reto).toArray()
    const record = esNuevoRecordReto(previos, datos.reto, datos.valor)
    const fila: IntentoReto = { ...datos, fecha, record }
    const id = (await db.retos.add(fila as Guardado<IntentoReto>)) as number
    return { ...fila, id }
  })
}

export async function borrarIntentoReto(id: number): Promise<void> {
  await db.retos.delete(id)
}
