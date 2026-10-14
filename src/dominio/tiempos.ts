// Tiempos del entreno en curso: cuánto falta, si se llega a la hora límite y qué recortar.
import type { EjercicioSesion, Sesion } from '../datos/tipos'
import { minutosDe } from './fechas'

const SERIE_S = 45
const TRANSICION_S = 75

export function restanteEjercicio(e: EjercicioSesion): number {
  if (e.estado === 'hecho' || e.estado === 'saltado') return 0
  const pendientes = e.series.filter(s => !s.hecha && !s.calentamiento).length
  if (!pendientes) return 0
  const serie = e.registro === 'tiempo' ? Math.max(30, e.repsMax) : SERIE_S
  return pendientes * serie + Math.max(0, pendientes - (e.estado === 'curso' ? 0 : 1)) * e.descanso + (e.estado === 'curso' ? 0 : TRANSICION_S)
}

/** Segundos que faltan para acabar (superseries: el descanso cuenta una vez por par). */
export function restanteSesion(s: Sesion): number {
  let t = 0
  s.ejercicios.forEach((e, i) => {
    const j = e.superserie ? s.ejercicios.findIndex(o => o.uid === e.superserie) : -1
    // Segundo del par (su compañero existe y va antes, y sigue vivo): solo cuenta el tiempo de sus series.
    // Antes, con el compañero borrado (findIndex = −1), se le quitaba el descanso igualmente.
    const comp = j >= 0 ? s.ejercicios[j]! : undefined
    if (comp && j < i && comp.estado !== 'hecho' && comp.estado !== 'saltado' && e.estado !== 'hecho' && e.estado !== 'saltado') {
      const pend = e.series.filter(x => !x.hecha && !x.calentamiento).length
      t += pend * (e.registro === 'tiempo' ? Math.max(30, e.repsMax) : SERIE_S)
      return
    }
    t += restanteEjercicio(e)
  })
  return t
}

export type EstadoHora = { minutosTarde: number; finEstimado: number; aTiempo: boolean }

/** Compara el final estimado con la hora límite (HH:MM del mismo día). */
export function estadoHora(s: Sesion, ahora: number): EstadoHora | null {
  if (!s.horaLimite) return null
  const d = new Date(ahora)
  const limite = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutosDe(s.horaLimite)).getTime()
  // Una hora límite anterior al inicio del entreno no tiene sentido (p. ej. entrenar por la tarde).
  if (limite <= s.inicio) return null
  const fin = ahora + restanteSesion(s) * 1000
  const tarde = Math.round((fin - limite) / 60000)
  return { minutosTarde: tarde, finEstimado: fin, aTiempo: tarde <= 0 }
}

export type Recorte = { tipo: 'serie'; uid: string; texto: string } | { tipo: 'corta'; texto: string }

/** Propuesta concreta cuando se va tarde. */
export function propuestaRecorte(s: Sesion, minutosTarde: number, nombre: (id: string) => string): Recorte | null {
  if (minutosTarde < 2) return null
  if (minutosTarde >= 8 && s.version === 'normal') return { tipo: 'corta', texto: `Vas ${minutosTarde} min tarde → pasa a la versión corta` }
  const candidatos = [...s.ejercicios].reverse().filter(e => e.estado === 'pendiente' && e.series.filter(x => !x.hecha && !x.calentamiento).length >= 2)
  const e = candidatos[0]
  if (!e) return null
  return { tipo: 'serie', uid: e.uid, texto: `Vas ${minutosTarde} min tarde → quita 1 serie de ${nombre(e.ejercicio)}` }
}

/** Resto del temporizador de descanso a partir de la marca de tiempo de la última serie. */
export function restoDescanso(finSerie: number, descanso: number, extra: number, ahora: number): number {
  return Math.max(0, Math.round((finSerie + (descanso + extra) * 1000 - ahora) / 1000))
}
