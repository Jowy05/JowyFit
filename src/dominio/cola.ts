// Rutina en cola (docs/INVESTIGACION-RUTINAS.md §4.4): toca la siguiente letra tras la última hecha, sea el día que
// sea. Los días de la semana solo sirven para los recordatorios. Si un día no se entrena, la cola espera.
import type { Bloque, DiaRutina, Perfil, Rutina, Sesion } from '../datos/tipos'
import { semanaDe, sumarDias } from './fechas'

/** ¿Va en cola? Las altas nuevas, sí; quien ya tenía rutina por días la conserva hasta que la cambie en Mi plan. */
export const enCola = (p: Pick<Perfil, 'modoRutina'>) => p.modoRutina === 'cola'

/** Días de entrenos que mira la cola: para la siguiente y la más atrasada bastan unas semanas. */
export const DIAS_COLA = 56

type Hecha = Pick<Sesion, 'fecha' | 'letra' | 'estado' | 'inicio'>

export type Cola = {
  /** La que toca ahora. */
  siguiente: DiaRutina
  /** Las que vienen detrás, en orden. */
  despues: DiaRutina[]
  /** La última hecha de esta rutina (para «La última: B, el miércoles»). */
  ultima: { dia: DiaRutina | undefined; fecha: string } | null
  /** Hechas esta semana (lunes a domingo) y cuántas tocan a la semana. */
  hechasSemana: number
  porSemana: number
}

/** Los entrenos de la cola: los días de la rutina que no son opcionales, en su orden. */
export const letrasCola = (r: Pick<Rutina, 'dias'>) => r.dias.filter(d => !d.opcional)

/**
 * La cola de hoy. `sesiones`: las hechas de las últimas semanas, también de la rutina anterior: al rehacerla (modo
 * mayor, una revisión) la cola sigue donde iba, por letras. Con más de 7 días sin entrenar y 2 o más a la semana,
 * toca la que lleva más tiempo sin hacerse (la más atrasada), no la siguiente.
 */
export function colaDe(r: Pick<Rutina, 'dias'>, sesiones: Hecha[], hoy: string, porSemana: number): Cola | null {
  const dias = letrasCola(r)
  if (!dias.length) return null
  const letras = dias.map(d => d.letra)
  const hechas = sesiones
    .filter(s => s.estado === 'hecha' && letras.includes(s.letra))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio)
  const ultima = hechas.at(-1)
  let i = ultima ? (letras.indexOf(ultima.letra) + 1) % letras.length : 0
  if (ultima && porSemana >= 2 && ultima.fecha < sumarDias(hoy, -7)) {
    // La más atrasada: la que no se ha hecho nunca o la de fecha más antigua.
    const ultimaDe = (l: string) => hechas.filter(s => s.letra === l).at(-1)?.fecha ?? ''
    i = letras.reduce((mejor, l, k) => (ultimaDe(l) < ultimaDe(letras[mejor]!) ? k : mejor), i)
  }
  const semana = semanaDe(hoy)
  return {
    siguiente: dias[i]!,
    despues: [1, 2].map(k => dias[(i + k) % dias.length]!).filter((d, k, a) => d !== dias[i] && a.indexOf(d) === k),
    ultima: ultima ? { dia: dias.find(d => d.letra === ultima.letra), fecha: ultima.fecha } : null,
    hechasSemana: hechas.filter(s => s.fecha >= semana[0]! && s.fecha <= semana[6]!).length,
    porSemana,
  }
}

/** Sesión mínima (15-20 min): los 3-4 ejercicios del principio de la que toca, a 2 series, sin dejar una pareja a medias. */
export function diaMinimo(d: DiaRutina): DiaRutina {
  const bloques: Bloque[] = []
  for (const b of d.bloques) {
    if (bloques.length >= 4) break
    // Una superserie entra entera o no entra.
    const pareja = b.superserie ? d.bloques.find(o => o.uid === b.superserie) : undefined
    if (pareja && !bloques.includes(pareja) && bloques.length + 2 > 4) continue
    bloques.push(b)
  }
  return {
    ...d,
    bloques: bloques.map(b => {
      const nb: Bloque = { ...b, series: Math.min(b.series, 2), fueraEnCorta: false }
      if (nb.superserie && !bloques.some(o => o.uid === nb.superserie)) delete nb.superserie
      return nb
    }),
  }
}
