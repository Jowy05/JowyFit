// Resumen de un día de la semana de Inicio (al tocarlo): lo que se entrenó o lo que toca, la comida y los pasos.
import type { Comida, PasosDia, Sesion } from '../datos/tipos'
import type { EstadoDia } from './semana'
import { totalesComida } from './comida'
import { minutosDia } from './rutina'
import { nombreEntreno } from './nombres'
import { resumen } from './sesion'

export type EntrenoHecho = { id: number | null; nombre: string; ejercicios: number; series: number; minutos: number; records: number }

export type ResumenDia = {
  fecha: string
  cuando: 'pasado' | 'hoy' | 'futuro'
  estado: EstadoDia['estado']
  /** Los entrenos terminados ese día (puede haber más de uno), por orden. */
  hechos: EntrenoHecho[]
  /** El de la rutina que tocaba o toca ese día (si no se hizo). */
  plan: { letra: string; nombre: string; ejercicios: number; minutos: number } | null
  /** Null en los días que aún no han llegado: no hay nada que contar. */
  comida: { kcal: number; proteina: number; apuntadas: number } | null
  pasos: { pasos: number; troteKm: number } | null
}

export function resumenDia(o: { dia: EstadoDia; hoy: string; sesiones: (Sesion & { id?: number })[]; comidas: Comida[]; pasos?: PasosDia }): ResumenDia {
  const { dia, hoy } = o
  const cuando = dia.fecha < hoy ? 'pasado' : dia.fecha === hoy ? 'hoy' : 'futuro'
  const hechos = o.sesiones
    .filter(s => s.fecha === dia.fecha && s.estado === 'hecha')
    .sort((a, b) => a.inicio - b.inicio)
    .map((s): EntrenoHecho => {
      const r = resumen(s)
      return {
        id: s.id ?? null, nombre: nombreEntreno(s), ejercicios: r.hechos, series: r.series,
        // Lo que dijo al terminar manda sobre el reloj (la app pudo quedarse abierta en el resumen).
        minutos: s.respuestas?.minutosReales ?? Math.round(r.segundos / 60),
        records: s.ejercicios.reduce((n, e) => n + e.series.filter(x => x.record && x.hecha).length, 0),
      }
    })
  const conPlan = !hechos.length && dia.dia && (dia.estado === 'plan' || dia.estado === 'opcional' || dia.estado === 'perdido')
  const plan = conPlan ? { letra: dia.dia!.letra, nombre: nombreEntreno(dia.dia!), ejercicios: dia.dia!.bloques.length, minutos: minutosDia(dia.dia!) } : null
  const delDia = o.comidas.filter(c => c.fecha === dia.fecha)
  const tot = totalesComida(delDia)
  return {
    fecha: dia.fecha, cuando, estado: dia.estado, hechos, plan,
    comida: cuando === 'futuro' ? null : { kcal: Math.round(tot.kcal), proteina: Math.round(tot.proteina), apuntadas: delDia.length },
    pasos: cuando === 'futuro' ? null : { pasos: o.pasos?.fecha === dia.fecha ? o.pasos.pasos : 0, troteKm: o.pasos?.fecha === dia.fecha ? o.pasos.troteKm ?? 0 : 0 },
  }
}
