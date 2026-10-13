// Estado de la semana: qué toca cada día, qué se hizo y qué se perdió.
import type { DiaRutina, Rutina, Sesion } from '../datos/tipos'
import { deISO, diaSemana, semanaDe } from './fechas'

export type Recolocada = { fecha: string; letra: string; desde: string }

export type EstadoDia = {
  fecha: string
  estado: 'hecho' | 'plan' | 'perdido' | 'opcional' | 'descanso' | 'movido'
  hoy: boolean
  dia?: DiaRutina
  sesion?: Sesion
}

function planDe(r: Rutina | null | undefined, fecha: string, recolocadas: Recolocada[]): { dia?: DiaRutina; opcional: boolean } {
  if (!r) return { opcional: false }
  const rc = recolocadas.find(x => x.fecha === fecha)
  if (rc) return { dia: r.dias.find(d => d.letra === rc.letra), opcional: false }
  const ds = diaSemana(deISO(fecha))
  const fijo = r.dias.find(d => !d.opcional && d.dia === ds)
  if (fijo) return { dia: fijo, opcional: false }
  const opc = r.dias.find(d => d.opcional && d.dia === ds)
  return opc ? { dia: opc, opcional: true } : { opcional: false }
}

export function estadoSemana(r: Rutina | null | undefined, sesiones: Sesion[], hoy: string, recolocadas: Recolocada[] = []): EstadoDia[] {
  return semanaDe(hoy).map(fecha => {
    const hecha = sesiones.find(s => s.fecha === fecha && s.estado === 'hecha')
    const { dia, opcional } = planDe(r, fecha, recolocadas)
    const esHoy = fecha === hoy
    if (hecha) return { fecha, estado: 'hecho', hoy: esHoy, dia, sesion: hecha }
    if (dia && !opcional) {
      const movida = recolocadas.some(x => x.desde === fecha)
      if (fecha < hoy) return { fecha, estado: movida ? 'movido' : 'perdido', hoy: esHoy, dia }
      return { fecha, estado: 'plan', hoy: esHoy, dia }
    }
    if (dia && opcional) return { fecha, estado: 'opcional', hoy: esHoy, dia }
    return { fecha, estado: 'descanso', hoy: esHoy }
  })
}

export type Tarjeta =
  | { tipo: 'curso' }
  | { tipo: 'hoy'; dia: DiaRutina }
  | { tipo: 'hecho'; sesion: Sesion; proximo?: EstadoDia }
  | { tipo: 'opcional'; dia: DiaRutina }
  | { tipo: 'perdida'; perdido: EstadoDia; destino: string }
  | { tipo: 'descanso'; proximo?: EstadoDia }
  | { tipo: 'sin' }

/** Qué tarjeta «Hoy te toca» mostrar. */
export function tarjetaHoy(r: Rutina | null | undefined, semana: EstadoDia[], hoy: string, enCurso: boolean, perdidaAlSabado: boolean, proximaSemana?: EstadoDia): Tarjeta {
  if (enCurso) return { tipo: 'curso' }
  if (!r) return { tipo: 'sin' }
  const h = semana.find(d => d.fecha === hoy)!
  const proximo = semana.find(d => d.fecha > hoy && d.estado === 'plan') ?? proximaSemana
  // Sesión perdida esta semana que se puede recolocar en el día opcional (hoy o más adelante).
  const perdida = semana.find(d => d.estado === 'perdido')
  const opcional = semana.find(d => d.fecha >= hoy && d.estado === 'opcional')
  if (perdidaAlSabado && perdida && opcional && h.estado !== 'plan') return { tipo: 'perdida', perdido: perdida, destino: opcional.fecha }
  if (h.estado === 'hecho') return { tipo: 'hecho', sesion: h.sesion!, proximo }
  if (h.estado === 'plan' && h.dia) return { tipo: 'hoy', dia: h.dia }
  if (h.estado === 'opcional' && h.dia) return { tipo: 'opcional', dia: h.dia }
  return { tipo: 'descanso', proximo }
}

/** Semanas seguidas (hasta la anterior) cumpliendo todos los días fijos. */
export function racha(r: Rutina | null | undefined, sesiones: Sesion[], hoy: string): number {
  if (!r) return 0
  const fijos = r.dias.filter(d => !d.opcional).length
  if (!fijos) return 0
  let n = 0
  let lunes = semanaDe(hoy)[0]!
  for (let i = 0; i < 52; i++) {
    const d = deISO(lunes); d.setDate(d.getDate() - 7)
    lunes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const semana = semanaDe(lunes)
    const hechas = sesiones.filter(s => s.estado === 'hecha' && semana.includes(s.fecha)).length
    if (hechas >= fijos) n++
    else break
  }
  return n
}
