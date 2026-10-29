// Modo mayor (docs/INVESTIGACION-RUTINAS.md §4.7): se propone a partir de los 65 años (corte de la OMS), nunca se
// impone. Con «Ahora no» no se insiste en un año (elección nuestra).
import type { Perfil } from '../datos/tipos'
import { edad as edadDe, sumarDias } from './fechas'
import { t } from '../i18n'

export const EDAD_MODO_MAYOR = 65

/** ¿Hay que proponerlo al generar la rutina? */
export function proponerModoMayor(p: Pick<Perfil, 'nacimiento' | 'modoMayor'>, hoy: string): boolean {
  // Sin fecha de nacimiento no se sabe la edad (deISO('') daría el año 1900).
  if (p.modoMayor?.activo || !/^\d{4}-\d{2}-\d{2}/.test(p.nacimiento)) return false
  const edad = edadDe(p.nacimiento)
  if (!(edad >= EDAD_MODO_MAYOR)) return false
  // Tras un «Ahora no», se vuelve a ofrecer al cabo de un año.
  const no = p.modoMayor?.rechazado
  return !no || no < sumarDias(hoy, -365)
}

/** Por qué se propone: «Te lo proponemos porque tienes 67 años.» */
export const porQueModoMayor = (p: Pick<Perfil, 'nacimiento'>) => t('Te lo proponemos porque tienes {n} años.', { n: edadDe(p.nacimiento) })
