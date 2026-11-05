// Celebraciones de Inicio: primer entreno, récord nuevo, semana completa y meta conseguida. Cada una sale una sola
// vez (su clave se guarda en los ajustes) y solo lo reciente: un récord de hace un mes ya no se celebra.
import type { Sesion } from '../datos/tipos'
import { lunesDe, semanaDe, sumarDias } from './fechas'
import { textoMarca } from './formato'
import { t, tn } from '../i18n'

export type Celebracion = { clave: string; tipo: 'primer-entreno' | 'meta' | 'semana' | 'record'; titulo: string; texto: string }

/**
 * Claves que se recuerdan. Al recortar se pierden las más viejas, pero nunca las que aún podrían salir (ver
 * anotarCelebradas): una meta conseguida lo sigue estando para siempre. Un récord o una semana pasados ya no vuelven.
 */
export const MAX_CELEBRADAS = 100

/** Días que un récord o el primer entreno se pueden celebrar todavía (por si no se abre Inicio ese mismo día). */
const DIAS_RECORD = 2
const DIAS_PRIMERO = 7

type Entrada = {
  hoy: string
  /** Sesiones hechas, en cualquier orden. */
  sesiones: Sesion[]
  /** Entrenos que tocan a la semana (los días fijos de la rutina); 0 sin rutina. */
  fijos: number
  metas: { id: number; titulo: string; conseguida: boolean }[]
  nombre: (id: string) => string
}

/** Lo que se podría celebrar hoy, de lo más importante a lo menos (sin mirar si ya se celebró). */
export function celebracionesPosibles(o: Entrada): Celebracion[] {
  const hechas = o.sesiones.filter(s => s.estado === 'hecha').sort((a, b) => b.inicio - a.inicio)
  const out: Celebracion[] = []

  if (hechas.length === 1 && hechas[0]!.fecha >= sumarDias(o.hoy, -DIAS_PRIMERO)) {
    out.push({ clave: 'primer-entreno', tipo: 'primer-entreno', titulo: t('¡Primer entreno hecho!'), texto: t('Lo más difícil es empezar, y ya lo has hecho.') })
  }

  for (const m of o.metas) {
    if (m.conseguida) out.push({ clave: `meta:${m.id}`, tipo: 'meta', titulo: t('¡Meta conseguida!'), texto: m.titulo })
  }

  // Días distintos con entreno (dos el mismo día cuentan como uno), igual que la racha.
  const semana = semanaDe(o.hoy).filter(f => f <= o.hoy)
  const dias = new Set(hechas.filter(s => semana.includes(s.fecha)).map(s => s.fecha)).size
  if (o.fijos > 0 && dias >= o.fijos) {
    out.push({ clave: `semana:${lunesDe(o.hoy)}`, tipo: 'semana', titulo: t('¡Semana completa!'), texto: tn(o.fijos, 'Has hecho el entreno de esta semana.', 'Has hecho los {n} entrenos de esta semana.') })
  }

  // Solo el último entreno de verdad (si es reciente): si después hubo otro sin récords, la frase «en tu último
  // entreno» ya no sería cierta. La clave es su hora de inicio, que no cambia al recuperar una copia.
  const ultimo = hechas[0]
  const rs = ultimo && ultimo.fecha >= sumarDias(o.hoy, -DIAS_RECORD) ? recordsDe(ultimo) : []
  if (ultimo && rs.length) {
    const { ejercicio, marca } = rs[0]!
    const nombre = o.nombre(ejercicio).toLowerCase()
    out.push({
      clave: `record:${ultimo.inicio}`, tipo: 'record', titulo: t('¡Récord nuevo!'),
      texto: rs.length === 1
        ? t('En {ejercicio}: {marca}.', { ejercicio: nombre, marca })
        : t('{n} récords en tu último entreno, entre ellos {ejercicio}.', { n: rs.length, ejercicio: nombre }),
    })
  }
  return out
}

function recordsDe(s: Sesion): { ejercicio: string; marca: string }[] {
  return s.ejercicios.flatMap(e => e.series
    .filter(x => x.record && x.hecha && !x.calentamiento && x.peso != null && x.reps != null)
    .map(x => ({ ejercicio: e.ejercicio, marca: textoMarca({ peso: x.peso!, reps: x.reps!, lastre: e.registro === 'corporal' && x.peso! > 0, porLado: x.izq != null && x.der != null }) })))
}

/**
 * Cuál se enseña y qué se marca como visto. Sale solo una (la más importante) para no agobiar, y las demás de ese
 * momento se dan por vistas: suelen venir del mismo entreno. Sin nada guardado aún (`vistas` null: la primera vez
 * con esta versión, o una copia de antes) no se celebra nada: lo que ya había se apunta como visto.
 */
export function celebracionQueToca(posibles: Celebracion[], vistas: string[] | null): { mostrar: Celebracion | null; marcar: string[] } {
  if (vistas == null) return { mostrar: null, marcar: posibles.map(c => c.clave) }
  const nuevas = posibles.filter(c => !vistas.includes(c.clave))
  return { mostrar: nuevas[0] ?? null, marcar: nuevas.map(c => c.clave) }
}

/**
 * Las vistas con las nuevas añadidas, sin repetir y quedándose con las más recientes. Las `vigentes` (las que se
 * podrían celebrar hoy) que ya estaban vistas pasan al final, para que el recorte no las quite: si no, una meta
 * conseguida hace meses volvería a salir cuando los récords y las semanas la empujasen fuera de la lista.
 */
export function anotarCelebradas(vistas: string[] | null, nuevas: string[], vigentes: string[] = []): string[] {
  const antes = vistas ?? []
  const alFinal = [...new Set([...vigentes.filter(c => antes.includes(c)), ...nuevas])]
  return [...antes.filter(c => !alFinal.includes(c)), ...alFinal].slice(-MAX_CELEBRADAS)
}
