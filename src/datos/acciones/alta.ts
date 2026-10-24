// Fin del alta: gimnasio, perfil, primera medición, rutina de prueba y ajustes, todo o nada.
import { db } from '../db'
import type { Gimnasio, Medicion, Perfil, Rutina } from '../tipos'
import { guardarAjustes, guardarPerfil } from '../repos'
import { catalogoCargado } from '../../catalogo/catalogo'
import { generarRutina } from '../../dominio/generador'
import { primerEntrenoDesde } from '../../dominio/semana'

export type DatosAlta = {
  /** El gimnasio del alta. Su `creado` hace de clave: repetir el alta lo actualiza en vez de crear otro. */
  gimnasio: Gimnasio
  perfil: Partial<Perfil>
  medicion: Medicion
  /** Con datos importados, la medición solo se apunta si se ha cambiado algo (o si no hay ninguna). */
  medicionCambiada: boolean
  hoy: string
}

/** Guarda el alta en una sola transacción: si algo falla no queda nada a medias. Devuelve el perfil y la rutina. */
export async function completarAlta(a: DatosAlta): Promise<{ perfil: Perfil; rutina: Omit<Rutina, 'id'> }> {
  return db.transaction('rw', [db.gimnasios, db.perfil, db.mediciones, db.rutinas, db.ajustes], async () => {
    const previo = await db.gimnasios.filter(g => g.creado === a.gimnasio.creado).first()
    const gymId = (await db.gimnasios.put(previo ? { ...a.gimnasio, id: previo.id } : a.gimnasio)) as number
    const perfil = await guardarPerfil(a.perfil)
    // Repetido, la medición ya se guardó la primera vez.
    if (!previo && (a.medicionCambiada || (await db.mediciones.count()) === 0)) await db.mediciones.add(a.medicion)
    const rutina = generarRutina({ perfil, gimnasio: { ...a.gimnasio, id: gymId }, marcas: new Map(), ejercicios: catalogoCargado()?.ejercicios ?? [], calibracion: true })
    const anterior = previo ? await db.rutinas.filter(r => r.activa && r.gimnasioId === gymId).last() : undefined
    await db.rutinas.put(anterior ? { ...rutina, id: anterior.id } : rutina)
    // La semana 1 es la del primer entreno: con el alta en domingo y el primero el martes, el lunes aún es la semana 1.
    await guardarAjustes({ gimnasioActivo: gymId, inicio: primerEntrenoDesde(rutina as Rutina, a.hoy)?.fecha ?? a.hoy })
    return { perfil, rutina }
  })
}
