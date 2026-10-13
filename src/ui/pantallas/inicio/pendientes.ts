// Pendientes de hoy: pesarse, suplementos, medir cintura, foto de progreso.
import { db } from '../../../datos/db'
import type { Perfil } from '../../../datos/tipos'
import { deISO, diaSemana, diasEntre } from '../../../dominio/fechas'

export type Pendiente = { id: string; titulo: string; detalle: string; icono: string; accion: 'peso' | 'medir' | 'foto' | 'suplemento'; hecho?: boolean }

export async function pendientesDeHoy(p: Perfil, hoy: string): Promise<Pendiente[]> {
  const out: Pendiente[] = []
  const mediciones = await db.mediciones.toArray()
  if (p.diasPesaje.includes(diaSemana(deISO(hoy))) && !mediciones.some(m => m.fecha.startsWith(hoy) && m.pesoKg != null)) {
    out.push({ id: 'peso', titulo: 'Toca pesarse', detalle: 'En ayunas y después del baño', icono: 'scales', accion: 'peso' })
  }
  const tomados = (await db.suplementos.get(hoy))?.tomados ?? []
  for (const s of p.suplementos) {
    if (tomados.includes(s)) continue
    const detalle = /creatina/i.test(s) ? '3-5 g · cualquier hora' : /prote/i.test(s) ? 'Después de entrenar o en la merienda' : 'Hoy'
    out.push({ id: s, titulo: s, detalle, icono: /prote/i.test(s) ? 'drop' : 'pill', accion: 'suplemento' })
  }
  const cinturas = mediciones.filter(m => m.perimetros?.cintura != null).map(m => m.fecha.slice(0, 10)).sort()
  const ultima = cinturas[cinturas.length - 1]
  if (!ultima || diasEntre(ultima, hoy) >= 10) out.push({ id: 'cintura', titulo: 'Medir la cintura', detalle: 'Toca cada 1-2 semanas', icono: 'ruler', accion: 'medir' })
  if (p.fotosCadaSemanas > 0) {
    const fotos = (await db.fotos.orderBy('fecha').reverse().first())?.fecha
    if (!fotos || diasEntre(fotos.slice(0, 10), hoy) >= p.fotosCadaSemanas * 7) out.push({ id: 'foto', titulo: 'Foto de progreso', detalle: fotos ? `Cada ${p.fotosCadaSemanas} semanas` : 'La primera: para comparar después', icono: 'camera', accion: 'foto' })
  }
  return out
}
