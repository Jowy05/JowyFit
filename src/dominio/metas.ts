// Metas: cuánto llevas de cada una y cuál es la principal (la que se ve en Inicio). Lo usan Progreso → Metas,
// Inicio y las celebraciones, para que «conseguida» signifique lo mismo en todas partes.
import type { HitoMeta, Medicion, Meta, Perfil, Sesion } from '../datos/tipos'
import { actualEjercicio, faltaMeta, grasaActual, hitosDominadas, progresoMeta, ultimoValor } from './tendencias'
import { kg, num } from './formato'
import { t } from '../i18n'

const MAX_HISTORIAL_META = 200

/**
 * Añade (o actualiza si es el mismo día sin nota previa distinta) un avance al histórico de la meta
 * y actualiza `actual` e `inicio`.
 */
export function registrarAvanceMeta<M extends Meta>(meta: M, valor: number, fecha: string, nota?: string): M {
  const limpio = Math.max(0, Math.round(valor * 100) / 100)
  const notaLimpia = nota?.trim() || undefined
  const hito: HitoMeta = { fecha, valor: limpio, ...(notaLimpia ? { nota: notaLimpia } : {}) }
  const prev = [...(meta.historial ?? [])]
  // Si ya hay un registro de hoy y no aporta una nota distinta, se actualiza en sitio; si trae nota nueva, se añade.
  const ultIdx = prev.length - 1
  if (ultIdx >= 0 && prev[ultIdx]!.fecha === fecha && (!notaLimpia || prev[ultIdx]!.nota === notaLimpia)) {
    prev[ultIdx] = { ...prev[ultIdx]!, valor: limpio, ...(notaLimpia ? { nota: notaLimpia } : {}) }
  } else {
    prev.push(hito)
  }
  prev.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return {
    ...meta,
    inicio: meta.inicio ?? 0,
    actual: limpio,
    historial: prev.slice(-MAX_HISTORIAL_META),
  }
}

/** Elimina un hito concreto del histórico y recalcula `actual` con el último que quede (si había alguno). */
export function borrarHitoMeta<M extends Meta>(meta: M, indice: number): M {
  const prev = [...(meta.historial ?? [])]
  if (indice < 0 || indice >= prev.length) return meta
  prev.splice(indice, 1)
  const ultimo = prev.at(-1)
  return {
    ...meta,
    actual: ultimo ? ultimo.valor : undefined,
    historial: prev.length ? prev : undefined,
  }
}

/** La cifra de una meta sin su unidad: los kilos con su formato («47,5»), lo demás como número. */
export const cifraMeta = (v: number, unidad: string) => (unidad === 'kg' ? kg(v) : num(v))

/**
 * La cifra con su unidad, igual en Metas y en Inicio. La unidad la escribe el usuario y se enseña tal cual: solo se
 * traducen «puntos» (los de la grasa, que pone la app) y «reps» pasa a «rep» con un 1.
 */
export const valorTxt = (v: number, unidad: string) =>
  `${cifraMeta(v, unidad)}${unidad ? ` ${unidad === 'reps' && v === 1 ? 'rep' : unidad === 'puntos' ? t('puntos') : unidad}` : ''}`

/** Lo que falta se cuenta en puntos en la grasa (de 25 % a 20 % faltan 5 puntos); en las demás, en su unidad. */
export const unidadFalta = (m: Pick<Meta, 'tipo' | 'unidad'>) => (m.tipo === 'grasa' ? 'puntos' : m.unidad)

/** El valor sacado automáticamente de tus entrenos o mediciones (sin contar lo apuntado a mano en la meta). */
export function valorAutoMeta(m: Pick<Meta, 'tipo' | 'ejercicio'>, ms: Medicion[], ses: Sesion[], perfil: Perfil, hoy: string, nombre?: (id: string) => string): number | null {
  switch (m.tipo) {
    case 'cintura': return ultimoValor(ms, x => x.perimetros?.cintura)?.valor ?? null
    case 'peso': return ultimoValor(ms, x => x.pesoKg)?.valor ?? null
    case 'grasa': return grasaActual(ms, perfil, hoy)
    case 'dominadas': return hitosDominadas(ses, { nombre }).estrictas
    case 'reps':
    case 'ejercicio': return m.ejercicio ? actualEjercicio(ses, m.ejercicio, m.tipo === 'reps' ? 'reps' : 'kg') : null
    default: return null
  }
}

/** El valor de ahora de una meta: combina lo automático con lo apuntado a mano (`actual`), quedándose con el mayor. */
export function valorMeta(m: Meta, ms: Medicion[], ses: Sesion[], perfil: Perfil, hoy: string, nombre?: (id: string) => string): number | null {
  if (m.tipo === 'libre') return m.actual ?? null
  const auto = valorAutoMeta(m, ms, ses, perfil, hoy, nombre)
  if (m.tipo === 'dominadas' || m.tipo === 'reps' || m.tipo === 'ejercicio') {
    if (m.actual == null) return auto
    return auto != null ? Math.max(auto, m.actual) : m.actual
  }
  return auto
}

export type EstadoMeta = { actual: number | null; falta: number | null; progreso: number; conseguida: boolean }

/** Cuánto falta y la barra (0 a 1). Una meta libre sin avance numérico solo está hecha si se marcó a mano. */
export function estadoMeta(m: Meta, actual: number | null): EstadoMeta {
  if (m.tipo === 'libre' && (actual == null || !(m.objetivo > 0))) {
    return { actual: null, falta: null, progreso: m.hecha ? 1 : 0, conseguida: !!m.hecha }
  }
  const inicio = m.inicio ?? (m.tipo === 'dominadas' || m.tipo === 'reps' || m.tipo === 'ejercicio' || m.tipo === 'libre' ? 0 : undefined)
  const falta = faltaMeta(inicio, actual, m.objetivo)
  const conseguida = !!m.hecha || falta === 0
  return { actual, falta, progreso: conseguida ? 1 : progresoMeta(inicio, actual, m.objetivo), conseguida }
}

/**
 * La meta que se ve en Inicio: la primera sin conseguir con un número que seguir (las libres sin avance no tienen barra),
 * la de fecha más cercana antes que las que no tienen fecha, y a igualdad la más antigua. Null si no queda ninguna.
 */
export function metaPrincipal<M extends Meta>(metas: M[], actual: (m: M) => number | null): { meta: M; estado: EstadoMeta } | null {
  const vivas = metas
    .map(meta => ({ meta, estado: estadoMeta(meta, actual(meta)) }))
    .filter(x => (x.meta.tipo !== 'libre' || x.estado.actual != null) && !x.estado.conseguida)
    .sort((a, b) => (a.meta.fecha ?? '9').localeCompare(b.meta.fecha ?? '9') || (a.meta.id ?? 0) - (b.meta.id ?? 0))
  return vivas[0] ?? null
}
