// Perímetros que se miden con cinta métrica, en el orden en que salen en toda la app (alta, perfil y progreso).
// Los nombres van con tk(): se traducen al pintarlos con t(x.t) o t(x.corto).
import type { Medicion } from '../datos/tipos'
import { tk } from '../i18n'

export type Perimetro = keyof NonNullable<Medicion['perimetros']>

/** `t`: el nombre en una etiqueta; `corto`: dentro de una línea («cintura 82 · cuello 38»). */
export const PERIMETROS: readonly { k: Perimetro; t: string; corto: string }[] = [
  { k: 'cintura', t: tk('Cintura'), corto: tk('Cintura') },
  { k: 'cuello', t: tk('Cuello'), corto: tk('cuello') },
  { k: 'cadera', t: tk('Cadera'), corto: tk('cadera') },
  { k: 'pecho', t: tk('Pecho'), corto: tk('pecho') },
  { k: 'brazo', t: tk('Brazo relajado'), corto: tk('brazo') },
  { k: 'brazoContraido', t: tk('Brazo contraído'), corto: tk('brazo contr.') },
  { k: 'muslo', t: tk('Muslo'), corto: tk('muslo') },
]
