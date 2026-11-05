// Escrituras de las molestias de un ejercicio: «Me duele» en el entreno y aceptar o dejar el cambio que se propone
// cuando molesta varios entrenos seguidos. Cambian la rutina activa (sin rehacerla), la marca «Me duele» y el entreno
// en curso a la vez, en una transacción, y devuelven cómo deshacerlo.
import { db } from '../db'
import type { MarcaEjercicio, Rutina, Sesion } from '../tipos'
import { gimnasioActivo, guardarAjustes, leerAjustes, rutinaActiva } from '../repos'
import { candidatosRutina, sugerenciaPara } from '../consultas'
import { ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { tipoRegistro } from '../../catalogo/clasificacion'
import type { Ejercicio } from '../../catalogo/tipos'
import { alternativaSinMolestia, cambiarEnPlan, zonaMolestia } from '../../dominio/molestias'
import { saltar, sustituir } from '../../dominio/sesion'
import { t } from '../../i18n'

/** Lo que dice el aviso y cómo volver atrás. */
export type HechoMolestia = { texto: string; otro: string | null; deshacer: () => Promise<void> }

const iguales = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** La rutina sin ese ejercicio: en su sitio, uno que no cargue la zona que molesta (o nada si no hay ninguno). */
function sinEjercicio(r: Rutina, id: string, candidatos: Ejercicio[]) {
  const original = ejercicio(id)
  const zona = original ? zonaMolestia(original) : null
  return cambiarEnPlan(r, id, (b, d) => (original
    ? alternativaSinMolestia(original, candidatos, { zona, preferidos: b.alternativas, ocupados: new Set(d.bloques.map(x => x.ejercicio)) })
    : null))
}

/**
 * Quita un ejercicio del plan (cambio o fuera) y lo marca «Me duele» para que no vuelva. `sesion`: el entreno en
 * curso, que también deja de hacerlo (lo cambia si aún no había hecho ninguna serie; si no, lo salta).
 */
async function quitarPorMolestia(id: string, sesion?: { s: Sesion; idx: number }): Promise<HechoMolestia> {
  const [r, candidatos, activo] = await Promise.all([rutinaActiva(), candidatosRutina(), gimnasioActivo()])
  const g = (sesion?.s.gimnasioId != null ? await db.gimnasios.get(sesion.s.gimnasioId) : undefined) ?? activo
  const cambio = r ? sinEjercicio(r, id, candidatos) : null
  const enPlan = cambio?.cambios.find(c => c.despues)?.despues?.ejercicio ?? null
  const quitado = !!cambio?.cambios.length && !enPlan
  let sesionNueva: Sesion | null = null
  if (sesion) {
    const { s, idx } = sesion
    const e = s.ejercicios[idx]!
    // El que se pone en el plan para ese día; en un entreno libre o el sábado armado, uno que valga aquí.
    const delDia = cambio?.cambios.find(c => c.uid === e.uid && c.letra === s.letra)
    const original = ejercicio(id)
    const enSesion = g?.id === activo?.id ? candidatos : await candidatosRutina(g ?? null)
    const delPlan = delDia?.despues && enSesion.find(x => x.id === delDia.despues!.ejercicio)
    const otro = delPlan || (original ? alternativaSinMolestia(original, enSesion, { zona: zonaMolestia(original), ocupados: new Set(s.ejercicios.map(x => x.ejercicio)) }) ?? undefined : undefined)
    if (otro && !e.series.some(x => x.hecha)) {
      const sug = await sugerenciaPara(otro.id, e, g, s.id)
      sesionNueva = sustituir(s, idx, otro.id, 'cambio', { peso: sug.peso ?? null, reps: sug.reps ?? null }, tipoRegistro(otro))
    } else {
      // Con series hechas, lo hecho se queda; el resto no se hace. La molestia queda apuntada en este entreno.
      sesionNueva = saltar(s, idx)
      sesionNueva.ejercicios[idx]!.molestia = true
    }
  }
  const nombre = nombreEjercicio(id)
  // Aunque no cambie ningún día (solo estaba en las alternativas de «Ocupado»), la rutina se guarda si ha cambiado.
  const rutinaPuesta = cambio && r && !iguales(cambio.rutina, r) ? cambio.rutina : null
  const [marcaAntes, rutinaAntes] = await db.transaction('rw', [db.marcas, db.rutinas, db.sesiones], async () => {
    const m = await db.marcas.get(id)
    await db.marcas.put({ ...(m ?? { id }), duele: true })
    const antes = r ? await db.rutinas.get(r.id) : undefined
    if (rutinaPuesta) await db.rutinas.put(rutinaPuesta)
    if (sesionNueva) await db.sesiones.put(sesionNueva)
    return [m, antes] as const
  })
  const texto = enPlan ? t('{antes} fuera de tu plan. En su lugar: {despues}', { antes: nombre, despues: nombreEjercicio(enPlan) })
    : quitado ? t('{ejercicio} fuera de tu plan', { ejercicio: nombre })
    : t('{ejercicio} no volverá a salir', { ejercicio: nombre })
  const deshacer = () => volverAtras(id, { antes: marcaAntes, puesta: { ...(marcaAntes ?? { id }), duele: true } }, rutinaAntes, rutinaPuesta, sesion?.s, sesionNueva)
  return { texto, otro: enPlan, deshacer }
}

/** Deshace un «Me duele» o un cambio aceptado. Lo que se tocó después (otra serie, otro cambio del plan) no se pisa. */
async function volverAtras(id: string, marca: { antes?: MarcaEjercicio; puesta: MarcaEjercicio }, rutinaAntes: Rutina | undefined, rutinaPuesta: Rutina | null, sesionAntes?: Sesion, sesionPuesta?: Sesion | null) {
  await db.transaction('rw', [db.marcas, db.rutinas, db.sesiones], async () => {
    // Si entre medias se tocó la marca en su ficha («No me gusta»…), se deja como está.
    if (iguales(await db.marcas.get(id), marca.puesta)) {
      if (marca.antes) await db.marcas.put(marca.antes)
      else await db.marcas.delete(id)
    }
    if (rutinaAntes && rutinaPuesta && iguales(await db.rutinas.get(rutinaAntes.id!), rutinaPuesta)) await db.rutinas.put(rutinaAntes)
    if (sesionAntes && sesionPuesta && iguales(await db.sesiones.get(sesionAntes.id!), sesionPuesta)) await db.sesiones.put(sesionAntes)
  })
}

/** «Me duele» en el entreno: el ejercicio que toca sale del plan (cambiado por otro o fuera) y de este entreno. */
export function meDuele(s: Sesion, idx: number): Promise<HechoMolestia> {
  const e = s.ejercicios[idx]
  if (!e) return Promise.resolve({ texto: '', otro: null, deshacer: async () => {} })
  return quitarPorMolestia(e.ejercicio, { s, idx })
}

/** «Cambiarlo» en la propuesta de Inicio: el ejercicio que molesta varios entrenos seguidos sale del plan. */
export const cambiarPorMolestia = (id: string): Promise<HechoMolestia> => quitarPorMolestia(id)

/** «Seguir igual»: no se vuelve a proponer hasta que moleste en un entreno posterior a `sesion`. */
export async function seguirConMolestia(id: string, sesion: number): Promise<() => Promise<void>> {
  const antes = (await leerAjustes()).molestiasVistas
  // Solo la última de cada ejercicio, y como mucho 100: la lista no crece sin fin.
  await guardarAjustes({ molestiasVistas: [...(antes ?? []).filter(v => v.ejercicio !== id), { ejercicio: id, sesion }].slice(-100) })
  return async () => { await guardarAjustes({ molestiasVistas: antes }) }
}
