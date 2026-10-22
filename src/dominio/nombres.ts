// Nombres que la app guarda al crear la rutina («Cuerpo completo A», «Cuerpo completo · 3 días») y que se enseñan
// en el idioma de la app aunque se guardaran en castellano. Un nombre puesto a mano se queda como está.
import type { DiaRutina } from '../datos/tipos'
import { t } from '../i18n'

/**
 * Nombre del entreno del día («Cuerpo completo A», «Empuje 2»). Se guarda en el idioma en que se creó la rutina;
 * si se creó en castellano (el alta va siempre en castellano), se enseña en el idioma de la app.
 */
export function nombreEntreno(d: Pick<DiaRutina, 'nombre'>): string {
  const dos = /^(.+) 2$/.exec(d.nombre)
  return dos ? t('{nombre} 2', { nombre: t(dos[1]!) }) : t(d.nombre)
}
/** Lo mismo con la estructura guardada («Cuerpo completo · 3 días»). */
export function nombreEstructura(e: string): string {
  const m = /^(Cuerpo completo|Torso \/ Pierna|Empuje \/ Tirón \/ Pierna) · (\d+) días?$/.exec(e)
  if (!m) return e
  const n = Number(m[2])
  if (m[1] === 'Cuerpo completo') return n === 1 ? t('Cuerpo completo · 1 día') : t('Cuerpo completo · {n} días', { n })
  return m[1] === 'Torso / Pierna' ? t('Torso / Pierna · {n} días', { n }) : t('Empuje / Tirón / Pierna · {n} días', { n })
}
