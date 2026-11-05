// Metas: cuánto llevas de cada una y cuál es la principal (la que se ve en Inicio). Lo usan Progreso → Metas,
// Inicio y las celebraciones, para que «conseguida» signifique lo mismo en todas partes.
import type { Medicion, Meta, Perfil, Sesion } from '../datos/tipos'
import { actualEjercicio, faltaMeta, grasaActual, hitosDominadas, progresoMeta, ultimoValor } from './tendencias'
import { kg, num } from './formato'
import { t } from '../i18n'

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

/** El valor de ahora de una meta, con lo apuntado (null si aún no se sabe o si es una meta libre). */
export function valorMeta(m: Meta, ms: Medicion[], ses: Sesion[], perfil: Perfil, hoy: string): number | null {
  switch (m.tipo) {
    case 'cintura': return ultimoValor(ms, x => x.perimetros?.cintura)?.valor ?? null
    case 'peso': return ultimoValor(ms, x => x.pesoKg)?.valor ?? null
    case 'grasa': return grasaActual(ms, perfil, hoy)
    case 'dominadas': return hitosDominadas(ses).estrictas
    case 'reps':
    case 'ejercicio': return m.ejercicio ? actualEjercicio(ses, m.ejercicio, m.tipo === 'reps' ? 'reps' : 'kg') : null
    default: return null
  }
}

export type EstadoMeta = { actual: number | null; falta: number | null; progreso: number; conseguida: boolean }

/** Cuánto falta y la barra (0 a 1). Una meta libre solo está hecha si se marcó a mano. */
export function estadoMeta(m: Meta, actual: number | null): EstadoMeta {
  if (m.tipo === 'libre') return { actual: null, falta: null, progreso: m.hecha ? 1 : 0, conseguida: !!m.hecha }
  const falta = faltaMeta(m.inicio, actual, m.objetivo)
  const conseguida = !!m.hecha || falta === 0
  return { actual, falta, progreso: conseguida ? 1 : progresoMeta(m.inicio, actual, m.objetivo), conseguida }
}

/**
 * La meta que se ve en Inicio: la primera sin conseguir con un número que seguir (las libres no tienen barra), la de
 * fecha más cercana antes que las que no tienen fecha, y a igualdad la más antigua. Null si no queda ninguna.
 */
export function metaPrincipal<M extends Meta>(metas: M[], actual: (m: M) => number | null): { meta: M; estado: EstadoMeta } | null {
  const vivas = metas
    .filter(m => m.tipo !== 'libre')
    .map(meta => ({ meta, estado: estadoMeta(meta, actual(meta)) }))
    .filter(x => !x.estado.conseguida)
    .sort((a, b) => (a.meta.fecha ?? '9').localeCompare(b.meta.fecha ?? '9') || (a.meta.id ?? 0) - (b.meta.id ?? 0))
  return vivas[0] ?? null
}
