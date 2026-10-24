// Escrituras de los ejercicios propios. Después de cada una el catálogo se pone al día en el momento:
// la pantalla siguiente (su ficha, la lista) ya lo ve sin esperar a nada.
import { db } from '../db'
import { leerPerfil, perfilPorDefecto, rutinaActiva } from '../repos'
import type { Bloque, EjercicioPropio, Rutina } from '../tipos'
import { usarPropios } from '../../catalogo/catalogo'
import { comoEjercicio } from '../../catalogo/propios'
import { tipoRegistro } from '../../catalogo/clasificacion'
import { hoyISO } from '../../dominio/fechas'
import { bloqueNuevo } from '../../dominio/generador'

/** Lleva al catálogo los ejercicios propios guardados (al abrir la app y después de cada cambio). */
export async function cargarPropios() {
  usarPropios((await db.propios.toArray()).map(comoEjercicio))
}

/**
 * Guarda un ejercicio propio. Si cambia cómo se apunta (kg, repeticiones, segundos, minutos), sus bloques del plan
 * pasan a apuntarse así, con las series y repeticiones de un bloque nuevo: las de antes contaban otra cosa.
 */
export async function guardarPropio(p: EjercicioPropio) {
  const limpio = { ...p, nombre: p.nombre.trim(), notas: p.notas?.trim() || undefined }
  await db.transaction('rw', [db.propios, db.rutinas, db.perfil], async () => {
    const antes = await db.propios.get(p.id)
    await db.propios.put(limpio)
    const e = comoEjercicio(limpio)
    if (!antes || tipoRegistro(comoEjercicio(antes)) === tipoRegistro(e)) return
    const r = await rutinaActiva()
    if (!r) return
    const nuevo = bloqueNuevo(p.id, { perfil: (await leerPerfil()) ?? perfilPorDefecto(), ejercicios: [e] })
    await db.rutinas.put(conBloquesDe(r, p.id, nuevo, CON_KG.has(tipoRegistro(comoEjercicio(antes)))))
  })
  await cargarPropios()
}

const CON_KG = new Set(['peso', 'mancuerna'])

/**
 * Pasa sus bloques al apunte nuevo. Entre kg de barra y kg de cada mancuerna solo cambia eso; si no, series y
 * repeticiones de un bloque nuevo (y, en superserie, las series de la pareja, que van a la vez).
 */
function conBloquesDe(r: Rutina, id: string, nuevo: Bloque, eraConKg: boolean): Rutina {
  const { registro, series, repsMin, repsMax, rpe, descanso } = nuevo
  const soloRegistro = eraConKg && CON_KG.has(registro)
  return {
    ...r,
    dias: r.dias.map(d => ({
      ...d,
      bloques: d.bloques.map(b => {
        if (b.ejercicio !== id) return b
        if (soloRegistro) return { ...b, registro }
        const pareja = b.superserie ? d.bloques.find(o => o.uid === b.superserie) : undefined
        return { ...b, registro, series: pareja ? Math.min(series, pareja.series) : series, repsMin, repsMax, rpe, descanso }
      }),
    })),
  }
}

/** Quita el ejercicio de un plan: su bloque y, si era el «si está ocupado» de otro, de ahí también. */
export function sinEjercicio(r: Rutina, id: string): Rutina {
  return {
    ...r,
    dias: r.dias.map(d => {
      const fuera = new Set(d.bloques.filter(b => b.ejercicio === id).map(b => b.uid))
      return {
        ...d,
        bloques: d.bloques.filter(b => !fuera.has(b.uid)).map(b => {
          const nb = { ...b, alternativas: b.alternativas.filter(a => a !== id) }
          if (nb.superserie && fuera.has(nb.superserie)) delete nb.superserie
          return nb
        }),
      }
    }),
  }
}

/**
 * Borra un ejercicio propio: sale del plan, pero se queda guardado como borrado para que los entrenos ya hechos
 * sigan teniendo su nombre. Devuelve cómo deshacerlo (también vuelve al plan, si el plan no ha cambiado entre medias).
 */
export async function borrarPropio(id: string): Promise<(() => Promise<void>) | undefined> {
  const hecho = await db.transaction('rw', [db.propios, db.rutinas], async () => {
    const p = await db.propios.get(id)
    if (!p) return null
    await db.propios.put({ ...p, borrado: hoyISO() })
    const r = await rutinaActiva()
    if (!r) return { p, antes: null, despues: null }
    const despues = sinEjercicio(r, id)
    await db.rutinas.put(despues)
    return { p, antes: r, despues }
  })
  await cargarPropios()
  if (!hecho) return undefined
  return async () => {
    await db.transaction('rw', [db.propios, db.rutinas], async () => {
      await db.propios.put(hecho.p)
      const ahora = hecho.antes && (await db.rutinas.get(hecho.antes.id))
      if (ahora && JSON.stringify(ahora) === JSON.stringify(hecho.despues)) await db.rutinas.put(hecho.antes!)
    })
    await cargarPropios()
  }
}

/** Vuelve a poner uno borrado (desde su ficha, si se llega por el historial). */
export async function recuperarPropio(id: string) {
  // update con undefined quita el campo.
  await db.propios.update(id, { borrado: undefined })
  await cargarPropios()
}
