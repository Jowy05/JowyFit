// Crear y guardar un entreno en curso a partir de la rutina activa (o uno libre).
import { db } from '../../../datos/db'
import { gimnasioActivo, leerAjustes, leerPerfil } from '../../../datos/repos'
import { ejercicio } from '../../../catalogo/catalogo'
import { tipoRegistro } from '../../../catalogo/clasificacion'
import { pesoReinicio, seriesSuave } from '../../../dominio/descarga'
import { pesosPara } from '../../../dominio/pesos'
import { sugerenciasDia } from '../../../datos/consultas'
import { anadirCalentamiento, crearSesion } from '../../../dominio/sesion'
import { hoyISO, lunesDe } from '../../../dominio/fechas'
import type { Sesion } from '../../../datos/tipos'
import type { useNav } from '../../nav'

/**
 * Vuelve a la pantalla del entreno en curso. «Restaurar» solo sirve si se minimizó en esta visita;
 * si la app se cerró a mitad (o se salió desde el resumen), hay que abrirla de nuevo.
 */
/**
 * Añade las series de calentamiento y vuelve a numerar todas las series del ejercicio (1, 2, 3…).
 * `anadirCalentamiento` las mete con n = 0, y la pantalla usa `n` para notas y para marcar calentamiento.
 */
export function conCalentamiento(s: Sesion, idx: number, series: { peso: number; reps: number }[]): Sesion {
  const nueva = anadirCalentamiento(s, idx, series)
  nueva.ejercicios[idx]?.series.forEach((x, k) => { x.n = k + 1 })
  return nueva
}

export function abrirEntreno(nav: ReturnType<typeof useNav>) {
  if (nav.estado.minimizada) nav.restaurar()
  else nav.completa('entreno')
}

export async function iniciarEntreno(o: { letra?: string; version?: 'normal' | 'corta'; horaLimite?: string; libre?: boolean }): Promise<number> {
  const ya = await db.sesiones.where('estado').equals('curso').first()
  if (ya?.id) return ya.id
  const g = await gimnasioActivo()
  const perfil = await leerPerfil()
  const r = await db.rutinas.filter(x => x.activa).last()
  const horaLimite = o.horaLimite ?? (perfil ? perfil.horaLimite[perfil.transporte] : undefined)
  let s: Sesion
  if (o.libre || !r) {
    s = { fecha: hoyISO(), rutinaId: r?.id ?? null, letra: 'L', nombre: 'Entreno libre', gimnasioId: g?.id ?? null, inicio: Date.now(), horaLimite, version: 'normal', estado: 'curso', calibracion: false, ejercicios: [] }
  } else {
    const base = r.dias.find(d => d.letra === o.letra) ?? r.dias[0]!
    // Semana suave aceptada en Inicio: mismos ejercicios, 1 serie menos y −10 % de peso.
    const suave = !r.calibracion && (await leerAjustes()).semanaSuave === lunesDe(hoyISO())
    const dia = suave ? { ...base, bloques: base.bloques.map(b => ({ ...b, series: seriesSuave(b.series) })) } : base
    const sug = await sugerenciasDia(base, g)
    const pesoDe = (id: string, peso: number | null) => {
      if (!suave || peso == null || peso <= 0) return peso
      // Si ya tocaba bajar por estancamiento (−10 %), la semana suave no vuelve a bajar encima (antes salía −24 %).
      if (sug.get(id)?.accion === 'bajar') return peso
      const e = ejercicio(id)
      return pesoReinicio(peso, pesosPara(e?.material ?? null, e ? tipoRegistro(e) : 'peso', g))
    }
    s = crearSesion(dia, {
      rutinaId: r.id ?? null, gimnasioId: g?.id ?? null, version: o.version ?? 'normal', horaLimite, calibracion: r.calibracion,
      sugerencias: new Map([...sug].map(([k, v]) => [k, { peso: pesoDe(k, v.peso), reps: v.reps }])),
    })
    if (suave) s.suave = true
  }
  return (await db.sesiones.add(s)) as number
}
