// Lógica pura de los retos diarios: catálogo, mejores marcas, récords, rachas y textos de objetivo.
import type { IntentoReto, TipoReto } from '../datos/tipos'
import { sumarDias } from './fechas'
import { t, tk, tn } from '../i18n'

export type EjercicioPostura = 'flexiones' | 'sentadillas' | 'plancha'
export type ModoReto = 'mas-reps' | 'mas-tiempo' | 'menos-tiempo'

export type DefinicionReto = {
  id: TipoReto
  titulo: string
  corto: string
  descripcion: string
  icono: string
  ejercicio: EjercicioPostura
  modo: ModoReto
  /** En «mas-reps», segundos del reto (60). */
  duracionS?: number
  /** En «menos-tiempo», repeticiones válidas que hay que completar. */
  objetivoReps?: number
}

export const RETOS: readonly DefinicionReto[] = [
  {
    id: 'flexiones-60',
    titulo: tk('Flexiones en 60 s'),
    corto: tk('Flexiones · 60 s'),
    descripcion: tk('Todas las flexiones bien hechas que puedas en 60 segundos. Al día siguiente, supera tu marca.'),
    icono: 'fire',
    ejercicio: 'flexiones',
    modo: 'mas-reps',
    duracionS: 60,
  },
  {
    id: 'sentadillas-60',
    titulo: tk('Sentadillas en 60 s'),
    corto: tk('Sentadillas · 60 s'),
    descripcion: tk('Máximas sentadillas con buena profundidad en 60 segundos, contra tu mejor marca.'),
    icono: 'lightning',
    ejercicio: 'sentadillas',
    modo: 'mas-reps',
    duracionS: 60,
  },
  {
    id: 'plancha-max',
    titulo: tk('Plancha máxima'),
    corto: tk('Plancha máx.'),
    descripcion: tk('Aguanta con el cuerpo recto todo el tiempo que puedas sin dejar caer la cadera.'),
    icono: 'timer',
    ejercicio: 'plancha',
    modo: 'mas-tiempo',
  },
  {
    id: 'flexiones-20',
    titulo: tk('20 flexiones contrarreloj'),
    corto: tk('20 flexiones'),
    descripcion: tk('Completa 20 flexiones válidas en el menor tiempo posible y bate tu crono.'),
    icono: 'flag-checkered',
    ejercicio: 'flexiones',
    modo: 'menos-tiempo',
    objetivoReps: 20,
  },
  {
    id: 'sentadillas-30',
    titulo: tk('30 sentadillas contrarreloj'),
    corto: tk('30 sentadillas'),
    descripcion: tk('Completa 30 sentadillas bien hechas lo más rápido que puedas.'),
    icono: 'trophy',
    ejercicio: 'sentadillas',
    modo: 'menos-tiempo',
    objetivoReps: 30,
  },
] as const

export const TIPOS_RETO: readonly TipoReto[] = RETOS.map(r => r.id)

export function retoDe(id: TipoReto): DefinicionReto {
  return RETOS.find(r => r.id === id) ?? RETOS[0]!
}

/** ¿Supera `nuevo` a `anterior` según el modo del reto? */
export function esMejorMarca(nuevo: number, anterior: number, modo: ModoReto): boolean {
  if (!Number.isFinite(nuevo) || nuevo <= 0) return false
  if (!Number.isFinite(anterior) || anterior <= 0) return true
  return modo === 'menos-tiempo' ? nuevo < anterior : nuevo > anterior
}

/** Mejor intento guardado de un reto concreto (null si aún no se ha hecho). */
export function mejorMarcaReto(intentos: readonly IntentoReto[], reto: TipoReto): IntentoReto | null {
  const modo = retoDe(reto).modo
  let mejor: IntentoReto | null = null
  for (const x of intentos) {
    if (x.reto !== reto || x.valor <= 0) continue
    if (!mejor || esMejorMarca(x.valor, mejor.valor, modo)) mejor = x
  }
  return mejor
}

/** ¿Es nuevo récord frente a todos los intentos previos de ese reto? */
export function esNuevoRecordReto(previos: readonly IntentoReto[], reto: TipoReto, valor: number): boolean {
  if (valor <= 0) return false
  const mejor = mejorMarcaReto(previos, reto)
  return !mejor || esMejorMarca(valor, mejor.valor, retoDe(reto).modo)
}

/** Formato corto de tiempo para marcas y cronómetros («45 s» o «1:25»). */
export function formatoTiempoReto(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  if (s < 60) return `${s} s`
  const min = Math.floor(s / 60)
  const resto = s % 60
  return `${min}:${String(resto).padStart(2, '0')}`
}

/** Texto legible de la marca de un reto («34 reps», «1:45», «28 s»). */
export function textoMarcaReto(valor: number, modo: ModoReto): string {
  if (modo === 'mas-reps') return tn(Math.round(valor), '{n} rep', '{n} reps')
  return formatoTiempoReto(valor)
}

/** Qué toca superar hoy para batir tu mejor marca. */
export function textoRetoHoy(mejor: IntentoReto | null, def: DefinicionReto): string {
  if (!mejor) return t('Primera marca: haz tu primer intento')
  if (def.modo === 'mas-reps') return t('Hoy: supera {n} reps', { n: mejor.valor })
  if (def.modo === 'mas-tiempo') return t('Hoy: supera {tiempo}', { tiempo: formatoTiempoReto(mejor.valor) })
  return t('Hoy: baja de {tiempo}', { tiempo: formatoTiempoReto(mejor.valor) })
}

/** Diferencia frente al récord anterior al acabar un intento. */
export function textoComparativaRecord(valor: number, anterior: IntentoReto | null, def: DefinicionReto): string {
  if (!anterior) return t('Primera marca guardada')
  const dif = Math.round(valor - anterior.valor)
  if (dif === 0) return t('Igualaste tu mejor marca')
  if (def.modo === 'mas-reps') {
    return dif > 0 ? t('+{n} sobre tu récord', { n: dif }) : t('A {n} de tu récord', { n: Math.abs(dif) })
  }
  if (def.modo === 'mas-tiempo') {
    return dif > 0 ? t('+{tiempo} sobre tu récord', { tiempo: formatoTiempoReto(dif) }) : t('A {tiempo} de tu récord', { tiempo: formatoTiempoReto(Math.abs(dif)) })
  }
  return dif < 0
    ? t('{tiempo} más rápido que tu récord', { tiempo: formatoTiempoReto(Math.abs(dif)) })
    : t('+{tiempo} frente a tu récord', { tiempo: formatoTiempoReto(dif) })
}

/** Días seguidos completando al menos un reto (racha actual y mejor racha histórica). */
export function rachaRetos(intentos: readonly IntentoReto[], hoy: string): { actual: number; mejor: number; hechoHoy: boolean } {
  const dias = [...new Set(intentos.filter(i => i.valor > 0).map(i => i.fecha.slice(0, 10)))].sort()
  if (!dias.length) return { actual: 0, mejor: 0, hechoHoy: false }
  const conjunto = new Set(dias)
  const hechoHoy = conjunto.has(hoy)
  // La racha sigue viva si se hizo hoy o ayer.
  let actual = 0
  let cursor = hechoHoy ? hoy : sumarDias(hoy, -1)
  while (conjunto.has(cursor)) {
    actual++
    cursor = sumarDias(cursor, -1)
  }
  let mejor = 0
  let corrida = 0
  let prev: string | null = null
  for (const d of dias) {
    corrida = prev && sumarDias(prev, 1) === d ? corrida + 1 : 1
    if (corrida > mejor) mejor = corrida
    prev = d
  }
  return { actual, mejor, hechoHoy }
}
