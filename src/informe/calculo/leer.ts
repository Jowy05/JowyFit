// Lee de la base lo que necesita el informe en PDF (las tablas enteras: el periodo se recorta en el cálculo).
import { db } from '../../datos/db'
import { cargarCatalogo, ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { patron } from '../../catalogo/clasificacion'
import type { CatalogoInforme, Informe, PeriodoInforme, RangoInforme, SeccionesInforme, TablasInforme } from './tipos'
import { hayDatosEn, primerDato, rangoInforme } from './periodo'
import { calcularInforme } from './index'

/** Todo lo que necesita el informe, leído de una vez. */
export async function tablasInforme(): Promise<TablasInforme> {
  const [perfil, ajustes, mediciones, sesiones, rutina, comidas, suplementos, pasos, metas] = await Promise.all([
    db.perfil.get('yo'),
    db.ajustes.get('app'),
    db.mediciones.toArray(),
    db.sesiones.toArray(),
    db.rutinas.filter(r => r.activa).last(),
    db.comidas.toArray(),
    db.suplementos.toArray(),
    db.pasos.toArray(),
    db.metas.toArray(),
  ])
  return { perfil, ajustes, mediciones, sesiones, rutina: rutina ?? null, comidas, suplementos, pasos, metas }
}

/** Nombres, grupos y MET de los ejercicios (RepDB). Sin catálogo (sin conexión la primera vez), el informe sale igual con lo que haya. */
async function catalogoInforme(): Promise<CatalogoInforme> {
  await cargarCatalogo().catch(() => null)
  return {
    nombre: id => (ejercicio(id) ? nombreEjercicio(id) : id),
    patron: id => { const e = ejercicio(id); return e ? patron(e) : undefined },
    met: id => ejercicio(id)?.met,
  }
}

/** Fechas de un periodo y si hay algo apuntado en ellas (para la hoja de Ajustes: el texto y el botón gris). */
export async function periodoInforme(periodo: PeriodoInforme, ahora = new Date()): Promise<RangoInforme & { hayDatos: boolean }> {
  const t = await tablasInforme()
  const r = rangoInforme(periodo, ahora, primerDato(t))
  return { ...r, hayDatos: hayDatosEn(t, r.inicio, r.fin) }
}

/** Todos los datos del informe en PDF de un periodo, listos para dibujar. */
export async function datosInforme(periodo: PeriodoInforme, ahora = new Date(), secciones?: Partial<SeccionesInforme>): Promise<Informe> {
  const [t, catalogo] = await Promise.all([tablasInforme(), catalogoInforme()])
  return calcularInforme({ ...t, periodo, ahora, secciones, catalogo })
}
