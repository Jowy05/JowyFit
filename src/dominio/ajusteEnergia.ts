// Ajustes de cada 2 semanas del objetivo de energía: cuándo toca, qué se guarda y cómo se cuenta en pantalla.
// El objetivo sale del peso y la actividad (no de las kcal apuntadas); el «por qué» es el consejo de la quincena.
import type { AjusteEnergia, ObjetivoDia, TipoConsejo } from '../datos/tipos'
import { diasEntre } from './fechas'
import { kg, num } from './formato'
import { textoConsejo } from './resumen'
import { t } from '../i18n'

/** Cada cuántos días se guarda un ajuste. */
export const DIAS_AJUSTE = 14
/** Ajustes que se guardan (los más nuevos): unos dos años y medio. */
export const HISTORIAL_MAX = 60

/** ¿Toca guardar un ajuste hoy? El primero, en cuanto se abre la app; luego, cada 2 semanas desde el último. */
export function tocaAjuste(ultimo: string | null | undefined, hoy: string): boolean {
  return !ultimo || diasEntre(ultimo, hoy) >= DIAS_AJUSTE
}

/** El ajuste de hoy: el «antes» es el «después» del último (si no hay, es el punto de partida). */
export function nuevoAjuste(o: { hoy: string; historial: AjusteEnergia[]; ahora: ObjetivoDia; porque: TipoConsejo; manual: boolean }): AjusteEnergia {
  const antes = o.historial[o.historial.length - 1]?.despues ?? null
  return { fecha: o.hoy, antes, despues: o.ahora, porque: antes ? o.porque : 'inicio', ...(o.manual ? { manual: true } : {}) }
}

/** Añade el ajuste al final y se queda con los HISTORIAL_MAX más nuevos. */
export function anadirAjuste(historial: AjusteEnergia[], a: AjusteEnergia): AjusteEnergia[] {
  return [...historial, a].slice(-HISTORIAL_MAX)
}

/** Lo que cambió el objetivo: «~2.150 → ~2.100 kcal · 140 → 135 g de proteína», o que se queda igual. */
export function cambioAjuste(a: AjusteEnergia): string {
  const d = a.despues
  if (!a.antes) return t('Empiezas con ~{kcal} kcal y {proteina} g de proteína', { kcal: num(d.kcal, 0), proteina: d.proteina })
  if (a.antes.kcal === d.kcal && a.antes.proteina === d.proteina) return t('Igual que antes: ~{kcal} kcal y {proteina} g de proteína', { kcal: num(d.kcal, 0), proteina: d.proteina })
  return t('~{antes} → ~{despues} kcal · {pantes} → {pdespues} g de proteína', { antes: num(a.antes.kcal, 0), despues: num(d.kcal, 0), pantes: a.antes.proteina, pdespues: d.proteina })
}

/** El peso con el que se calculó, si cambió desde el ajuste anterior (es lo que mueve el objetivo). */
export function cambioPeso(a: AjusteEnergia): string | null {
  const antes = a.antes?.peso, ahora = a.despues.peso
  if (antes == null || ahora == null || Math.abs(antes - ahora) < 0.1) return null
  return t('Tu peso: {antes} → {despues} kg', { antes: kg(antes), despues: kg(ahora) })
}

/** Por qué: el consejo de la quincena, o qué es el primero. Si el objetivo es a mano, se dice. */
export function porqueAjuste(a: AjusteEnergia): string {
  if (a.manual) return t('Tu objetivo lo pones tú a mano: la app no lo cambia.')
  return a.porque === 'inicio' ? t('Punto de partida: calculado con tu peso, tu altura y tu actividad.') : textoConsejo(a.porque)
}
