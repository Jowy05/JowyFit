// Marcar y desmarcar suplementos (en Comida y en «Pendientes de hoy» de Inicio).
// El batido de proteína, además, se apunta como comida con lo que lleva: así suma al total del día.
import { db } from '../../../datos/db'
import type { Perfil } from '../../../datos/tipos'
import { batidoDe, esBatido, franjaPorHora } from '../../../dominio/comida'
import { horaActual, hoyISO } from '../../../dominio/fechas'

/** ¿Hay un batido apuntado a mano ese día (desde Añadir, no desde el suplemento)? */
// Solo un batido de verdad: «Yogur proteico» o «Barrita proteica» no cuentan.
export const batidoAMano = (comidas: { nombre: string; suplemento?: string }[]) => comidas.some(c => !c.suplemento && /batido/i.test(c.nombre))

/** Lo marca como tomado (y apunta el batido). Devuelve cómo deshacerlo. */
export async function marcarSuplemento(perfil: Perfil, fecha: string, s: string): Promise<() => void> {
  const tomados = new Set((await db.suplementos.get(fecha))?.tomados ?? [])
  tomados.add(s)
  await db.suplementos.put({ fecha, tomados: [...tomados] })
  let id: number | undefined
  if (esBatido(s)) {
    const b = batidoDe(perfil.batido)
    const hora = fecha === hoyISO() ? horaActual() : '17:30'
    id = await db.comidas.add({ fecha, hora, franja: franjaPorHora(hora), nombre: s, kcal: b.kcal, proteina: b.proteina, racion: 'N', tipo: 'plantilla', suplemento: s })
  }
  return () => { void desmarcarSuplemento(fecha, s, id) }
}

/** Lo quita de tomados y borra el batido que se apuntó al marcarlo (el apuntado a mano no se toca). */
export async function desmarcarSuplemento(fecha: string, s: string, id?: number) {
  const tomados = new Set((await db.suplementos.get(fecha))?.tomados ?? [])
  tomados.delete(s)
  await db.suplementos.put({ fecha, tomados: [...tomados] })
  if (id != null) await db.comidas.delete(id)
  else await db.comidas.where('fecha').equals(fecha).filter(c => c.suplemento === s).delete()
}
