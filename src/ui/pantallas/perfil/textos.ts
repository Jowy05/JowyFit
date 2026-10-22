// Textos compartidos por las pantallas de Perfil (etiquetas de cada opción y lista de secciones).
// Van marcados con tk(): se calculan al importar, antes de cargar el idioma; se traducen al pintarlos con t(x).
import type { Cardio, Dia, Nivel, Perfil, Reps, TipoObjetivo, Trabajo, Zona } from '../../../datos/tipos'
import { DIAS_ABREV } from '../../../dominio/fechas'
import { idioma, t, tc, tk } from '../../../i18n'

export const OBJETIVO_TXT: Record<TipoObjetivo, string> = { recomposicion: tk('Perder grasa y ganar músculo'), perder: tk('Perder peso'), fuerza: tk('Ganar fuerza') }
export const NIVEL_TXT: Record<Nivel, string> = { empiezo: tk('Empiezo'), vuelvo: tk('Vuelvo tras un parón'), intermedio: tk('Intermedio'), avanzado: tk('Avanzado') }
export const PREFERENCIA_TXT: Record<Perfil['preferencia'], string> = { maquinas: tk('Máquinas y poleas'), libre: tk('Peso libre'), mezcla: tk('Mezcla') }
export const REPS_TXT: Record<Reps, string> = { pesadas: tk('Pocas y pesadas'), moderadas: tk('Moderadas'), mezcla: tk('Mezcla') }
export const CARDIO_TXT: Record<Cardio, string> = { nada: tk('Nada'), pasos: tk('Pasos'), trote: tk('Trote') }
export const TRABAJO_TXT: Record<Trabajo, string> = { sentado: tk('Sentado'), depie: tk('De pie'), fisico: tk('Físico') }

export const ZONAS_SENSIBLES: { v: Zona; t: string }[] = [
  { v: 'rodilla', t: tk('Rodilla') }, { v: 'lumbar', t: tk('Lumbar') }, { v: 'hombro', t: tk('Hombro') }, { v: 'muneca', t: tk('Muñeca') }, { v: 'codo', t: tk('Codo') },
]
export const ZONAS_PRIORIDAD: { v: string; t: string }[] = [
  { v: 'abdomen', t: tk('Abdomen') }, { v: 'pecho', t: tk('Pecho') }, { v: 'brazos', t: tk('Brazos') }, { v: 'espalda', t: tk('Espalda') },
  { v: 'hombros', t: tk('Hombros') }, { v: 'piernas', t: tk('Piernas') }, { v: 'gluteo', t: tk('Glúteo') },
]

/** Pesos de referencia que se pueden apuntar en Experiencia (clave → nombre). */
export const REFERENCIAS: { k: string; t: string }[] = [
  { k: 'banca', t: tk('Press de banca') }, { k: 'sentadilla', t: tk('Sentadilla') }, { k: 'pesoMuerto', t: tk('Peso muerto') },
  { k: 'remo', t: tk('Remo') }, { k: 'pressMilitar', t: tk('Press militar') }, { k: 'jalon', t: tk('Jalón al pecho') },
]

export type ClaveSeccion = 'datos' | 'cuerpo' | 'objetivos' | 'salud' | 'experiencia' | 'preferencias' | 'horario' | 'alimentacion' | 'vida' | 'seguimiento'

/** Secciones del perfil. Las `mas: true` salen plegadas en «Más secciones»: se tocan poco. */
export const SECCIONES: { s: ClaveSeccion; t: string; ico: string; mas?: boolean }[] = [
  { s: 'datos', t: tk('Datos personales'), ico: 'identification-card' },
  { s: 'cuerpo', t: tk('Peso y medidas'), ico: 'ruler' },
  { s: 'objetivos', t: tk('Objetivos'), ico: 'target' },
  // «Horario» se pinta con contexto (tituloSeccion): en Progreso la misma palabra es la hora de un entreno.
  { s: 'horario', t: 'Horario', ico: 'calendar-blank' },
  { s: 'salud', t: tk('Salud y molestias'), ico: 'first-aid' },
  { s: 'preferencias', t: tk('Preferencias de entreno'), ico: 'sliders-horizontal' },
  { s: 'experiencia', t: tk('Tu nivel'), ico: 'medal', mas: true },
  { s: 'seguimiento', t: tk('Pesarte y fotos'), ico: 'chart-line-up', mas: true },
  { s: 'alimentacion', t: tk('Suplementos'), ico: 'fork-knife', mas: true },
  { s: 'vida', t: tk('Tu trabajo'), ico: 'armchair', mas: true },
]

/** Título de una sección del perfil en el idioma de la app. */
export const tituloSeccion = (x: (typeof SECCIONES)[number]) => (x.s === 'horario' ? tc('sección', 'Horario') : t(x.t))

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «Mar · Jue · Vie» (en catalán «Dt. · Dj. · Dv.», en inglés «Tue · Thu · Fri»). */
export function diasTxt(dias: Dia[]): string {
  return [...dias].sort((a, b) => a - b).map(d => capital(DIAS_ABREV[d]!)).join(' · ')
}

/** Minúsculas para meter los días en una frase; en inglés los días van siempre con mayúscula. */
export const enFrase = (s: string) => (idioma() === 'en' ? s : s.toLowerCase())

/** Iniciales para el avatar: «Joel Pérez» → «JP». */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}
