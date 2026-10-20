// Pendientes de hoy: pesarse, suplementos, medir cintura, foto de progreso (y en iPhone, apuntar los pasos).
import { db } from '../../../datos/db'
import type { Perfil } from '../../../datos/tipos'
import { deISO, diaSemana, diasEntre } from '../../../dominio/fechas'
import { batidoDe, dosisDe, esBatido } from '../../../dominio/comida'

export type Pendiente = { id: string; titulo: string; detalle: string; icono: string; accion: 'peso' | 'medir' | 'foto' | 'suplemento' | 'pasos'; hecho?: boolean }

/**
 * `pasosAMano` + `tarde`: en iPhone no hay recordatorios ni pasos automáticos; por la tarde (desde las 18 h), si hoy
 * no hay pasos apuntados, se recuerda apuntarlos (se miran en la app Salud).
 */
export async function pendientesDeHoy(p: Perfil, hoy: string, o: { pasosAMano?: boolean; tarde?: boolean } = {}): Promise<Pendiente[]> {
  const out: Pendiente[] = []
  const mediciones = await db.mediciones.toArray()
  if (p.diasPesaje.includes(diaSemana(deISO(hoy))) && !mediciones.some(m => m.fecha.startsWith(hoy) && m.pesoKg != null)) {
    out.push({ id: 'peso', titulo: 'Toca pesarse', detalle: 'Mejor por la mañana, en ayunas', icono: 'scales', accion: 'peso' })
  }
  const tomados = (await db.suplementos.get(hoy))?.tomados ?? []
  for (const s of p.suplementos) {
    if (tomados.includes(s)) continue
    const dosis = dosisDe(p.dosisSuplementos, s)
    const detalle = esBatido(s) ? `${dosis} · ${batidoDe(p.batido).proteina} g proteína · después de entrenar o en la merienda` : dosis ? `${dosis} · cualquier hora` : 'Hoy'
    out.push({ id: s, titulo: s, detalle, icono: /prote/i.test(s) ? 'drop' : 'pill', accion: 'suplemento' })
  }
  const cinturas = mediciones.filter(m => m.perimetros?.cintura != null).map(m => m.fecha.slice(0, 10)).sort()
  const ultima = cinturas[cinturas.length - 1]
  if (!ultima || diasEntre(ultima, hoy) >= 10) out.push({ id: 'cintura', titulo: 'Medir la cintura', detalle: 'Toca cada 1-2 semanas', icono: 'ruler', accion: 'medir' })
  if (p.fotosCadaSemanas > 0) {
    const fotos = (await db.fotos.orderBy('fecha').reverse().first())?.fecha
    if (!fotos || diasEntre(fotos.slice(0, 10), hoy) >= p.fotosCadaSemanas * 7) out.push({ id: 'foto', titulo: 'Foto de progreso', detalle: fotos ? `Cada ${p.fotosCadaSemanas} semanas` : 'La primera: para comparar después', icono: 'camera', accion: 'foto' })
  }
  if (o.pasosAMano && o.tarde && !(await db.pasos.get(hoy))?.pasos) {
    out.push({ id: 'pasos', titulo: 'Apunta tus pasos de hoy', detalle: 'Míralos en la app Salud y escríbelos', icono: 'footprints', accion: 'pasos' })
  }
  return out
}
