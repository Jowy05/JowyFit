// Objetivos del perfil: los 7 que se eligen, los 3 juegos de parámetros que usa el generador por dentro
// (docs/INVESTIGACION-RUTINAS.md §4.2) y las frases de «Qué hará tu rutina».
import type { Perfil, TipoObjetivo } from '../datos/tipos'
import { t, tk } from '../i18n'

export type Juego = 'salud' | 'musculo' | 'fuerza'

/** Los objetivos tal como se eligen, en orden; `si dudas`: el que se propone. */
export const OBJETIVOS: { v: TipoObjetivo; t: string; d: string }[] = [
  { v: 'salud', t: tk('Salud y moverte mejor'), d: tk('Fuerza para el día a día, sin complicaciones.') },
  { v: 'perder', t: tk('Perder grasa'), d: tk('Menos barriga. La fuerza protege tu músculo.') },
  { v: 'recomposicion', t: tk('Perder grasa y ganar músculo'), d: tk('El peso cambia poco: menos grasa, más músculo.') },
  { v: 'musculo', t: tk('Ganar músculo'), d: tk('Más volumen en las zonas que elijas.') },
  { v: 'fuerza', t: tk('Ganar fuerza'), d: tk('Mover más peso en unos ejercicios básicos.') },
  { v: 'estetica', t: tk('Verte mejor'), d: tk('Proporciones: hombros, espalda, glúteo…') },
  { v: 'peso', t: tk('Ganar peso sano'), d: tk('Si pesas poco: subir de peso con músculo.') },
]
export const NOMBRE_OBJETIVO = Object.fromEntries(OBJETIVOS.map(o => [o.v, o.t])) as Record<TipoObjetivo, string>

/** Lo que añade cada objetivo cuando va de extra («Además: cardio y −300 kcal»). */
const EXTRA_TXT: Record<TipoObjetivo, string> = {
  salud: tk('equilibrio y pasos'), perder: tk('cardio y −300 kcal'), recomposicion: tk('algo menos de calorías'), musculo: tk('más series en tus zonas'),
  fuerza: tk('los 3 básicos con más peso'), estetica: tk('más trabajo en hombros y espalda'), peso: tk('+300 kcal'),
}

/** Perder grasa usa los parámetros de salud; recomposición, verte mejor y ganar peso, los de músculo (D2). */
export const JUEGO: Record<TipoObjetivo, Juego> = { salud: 'salud', perder: 'salud', recomposicion: 'musculo', musculo: 'musculo', estetica: 'musculo', peso: 'musculo', fuerza: 'fuerza' }
export const juegoDe = (o: TipoObjetivo | undefined) => JUEGO[o ?? 'salud'] ?? 'salud'

/** Objetivos con los que subir de peso no es una mala señal (fuerza, músculo, ganar peso): el peso no se juzga. */
export const subirPesoEsBueno = (o: TipoObjetivo) => o === 'fuerza' || o === 'musculo' || o === 'peso'

type Parametros = {
  /** Series a la semana de un músculo prioritario: [con «Un poco más», con «Mucho más»]. */
  prioritario: [number, number]
  /** Series a la semana del resto (mantenimiento). */
  mantenimiento: [number, number]
  repsPrincipal: [number, number]
  repsAccesorio: [number, number]
  /** Esfuerzo (RPE) de los principales y de los accesorios. RPE = 10 − repeticiones de margen. */
  rpePrincipal: number
  rpeAccesorio: number
}

// §4.2: OMS 2020, ACSM 2026, Iversen 2021, Pelland [preprint]; los rangos exactos son elección nuestra.
export const PARAMETROS: Record<Juego, Parametros> = {
  salud: { prioritario: [8, 10], mantenimiento: [4, 6], repsPrincipal: [8, 12], repsAccesorio: [10, 15], rpePrincipal: 7.5, rpeAccesorio: 8 },
  musculo: { prioritario: [12, 16], mantenimiento: [8, 10], repsPrincipal: [6, 10], repsAccesorio: [10, 15], rpePrincipal: 8, rpeAccesorio: 8.5 },
  fuerza: { prioritario: [8, 12], mantenimiento: [4, 6], repsPrincipal: [3, 6], repsAccesorio: [8, 12], rpePrincipal: 8, rpeAccesorio: 8.5 },
}

/** Nunca hasta el fallo (RIR ≥ 1); con quien empieza, vuelve o en modo mayor, siempre 2 de margen (NSCA 2019). */
export const RPE_MAX_GENERAL = 9
export const RPE_MAX_PRUDENTE = 8

export function rpeMaximo(p: Pick<Perfil, 'nivel' | 'modoMayor'>): number {
  return p.nivel === 'empiezo' || p.nivel === 'vuelvo' || p.modoMayor?.activo ? RPE_MAX_PRUDENTE : RPE_MAX_GENERAL
}

export const ZONAS_AFINAR: { v: string; t: string }[] = [
  { v: 'pecho', t: tk('Pecho') }, { v: 'espalda', t: tk('Espalda') }, { v: 'hombros', t: tk('Hombros') }, { v: 'brazos', t: tk('Brazos') },
  { v: 'abdomen', t: tk('Abdomen') }, { v: 'gluteo', t: tk('Glúteo') }, { v: 'piernas', t: tk('Piernas') }, { v: 'gemelos', t: tk('Gemelos') },
]
const nombreZonaAfinar = (z: string) => { const x = ZONAS_AFINAR.find(o => o.v === z); return x ? t(x.t) : z }

/** «Manda «perder grasa». Además: cardio y −300 kcal.» o lo que hace el principal si no hay extras. */
export function mezclaObjetivos(principal: TipoObjetivo, extra: TipoObjetivo[]): string {
  if (!extra.length) return t('El principal decide las series y las repeticiones. Los demás suman sin cambiarlo.')
  return t('Manda «{objetivo}». Además: {extra}.', { objetivo: t(NOMBRE_OBJETIVO[principal]).toLowerCase(), extra: extra.map(o => t(EXTRA_TXT[o])).join(t(' y ')) })
}

/** Las frases de «Qué hará tu rutina» para un objetivo y unas zonas. */
export function queHaraRutina(p: Pick<Perfil, 'objetivo' | 'objetivosExtra' | 'zonasPrioridad' | 'zonasMucho'>): string[] {
  const juego = juegoDe(p.objetivo)
  const par = PARAMETROS[juego]
  const zonas = p.zonasPrioridad.filter(z => ZONAS_AFINAR.some(o => o.v === z))
  const out = zonas.map(z => t('{zona}: unas {n} series a la semana.', { zona: nombreZonaAfinar(z), n: (p.zonasMucho ?? []).includes(z) ? par.prioritario[1] : par.prioritario[0] }))
  out.push(zonas.length
    ? t('Lo demás, {min}-{max} series a la semana.', { min: par.mantenimiento[0], max: par.mantenimiento[1] })
    : t('Todo el cuerpo, {min}-{max} series a la semana.', { min: par.mantenimiento[0], max: par.mantenimiento[1] }))
  const objetivo = t(NOMBRE_OBJETIVO[p.objetivo] ?? NOMBRE_OBJETIVO.salud).toLowerCase()
  out.push(juego === 'fuerza' ? t('Con «{objetivo}»: pocas repeticiones (3-6) y más peso.', { objetivo })
    : juego === 'musculo' ? t('Con «{objetivo}»: repeticiones de 6 a 10 en los ejercicios grandes.', { objetivo })
    : t('Con «{objetivo}»: repeticiones de 8 a 12, sin llegar al límite.', { objetivo }))
  if (p.objetivo === 'perder' || p.objetivosExtra?.includes('perder')) out.push(t('Cardio y pasos, pero siempre con fuerza: protege tu músculo.'))
  return out
}
