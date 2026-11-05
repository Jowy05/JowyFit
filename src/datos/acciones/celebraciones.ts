// Celebraciones de Inicio: decidir cuál sale y apuntarla como vista van en la misma transacción, para que dos
// pantallas abiertas a la vez (o el doble montaje de React en desarrollo) no enseñen la misma dos veces.
import { db } from '../db'
import { leerAjustes } from '../repos'
import { anotarCelebradas, celebracionQueToca, type Celebracion } from '../../dominio/celebraciones'

/** La celebración que toca enseñar ahora (null si ninguna); la deja apuntada como vista. */
export async function tomarCelebracion(posibles: Celebracion[]): Promise<Celebracion | null> {
  return db.transaction('rw', db.ajustes, async () => {
    const a = await leerAjustes()
    const vistas = a.celebradas ?? null
    const { mostrar, marcar } = celebracionQueToca(posibles, vistas)
    const celebradas = anotarCelebradas(vistas, marcar, posibles.map(c => c.clave))
    // Se escribe solo si algo cambia (una nueva, o una vigente que sube al final): Inicio lo llama a menudo.
    const igual = vistas != null && celebradas.length === vistas.length && celebradas.every((c, i) => c === vistas[i])
    if (!igual) await db.ajustes.put({ ...a, celebradas })
    return mostrar
  })
}
