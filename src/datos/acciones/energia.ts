// Escrituras del objetivo de energía: el ajuste de cada 2 semanas que se guarda en el historial (al abrir la app).
import { db } from '../db'
import type { AjusteEnergia } from '../tipos'
import { leerPerfil } from '../repos'
import { comidasEntre, objetivosEnergia } from '../consultas'
import { anadirAjuste, nuevoAjuste, tocaAjuste } from '../../dominio/ajusteEnergia'
import { datosQuincena } from '../../dominio/comida'
import { hoyISO, sumarDias } from '../../dominio/fechas'

/**
 * Si han pasado 2 semanas desde el último (o no hay ninguno), guarda el objetivo de ahora con el de antes y el
 * consejo de la quincena. Devuelve el ajuste guardado, o null si no tocaba.
 */
export async function registrarAjusteEnergia(hoy = hoyISO()): Promise<AjusteEnergia | null> {
  const [perfil, previo] = await Promise.all([leerPerfil(), db.ajustes.get('app')])
  if (!perfil?.altaCompleta || !previo || !tocaAjuste(previo.ultimoAjusteEnergia, hoy)) return null
  const e = await objetivosEnergia(perfil)
  // Las 4 semanas de atrás: el consejo compara estas 2 con las 2 anteriores.
  const [mediciones, comidas] = await Promise.all([db.mediciones.toArray(), comidasEntre(sumarDias(hoy, -27), hoy)])
  const q = datosQuincena({ hoy, mediciones, comidas, objetivoProteina: e.proteina, objetivo: perfil.objetivo })
  // Se vuelve a mirar dentro de la transacción: al abrir y volver a la app a la vez no se guarda dos veces.
  return db.transaction('rw', db.ajustes, async () => {
    const a = await db.ajustes.get('app')
    if (!a || !tocaAjuste(a.ultimoAjusteEnergia, hoy)) return null
    const historial = a.historialEnergia ?? []
    const ajuste = nuevoAjuste({ hoy, historial, ahora: { kcal: e.kcal, proteina: e.proteina, peso: e.peso }, porque: q.tipo, manual: e.manual || a.proteinaManual != null })
    await db.ajustes.put({ ...a, historialEnergia: anadirAjuste(historial, ajuste), ultimoAjusteEnergia: hoy })
    return ajuste
  })
}
