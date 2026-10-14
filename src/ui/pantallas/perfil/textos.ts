// Textos compartidos por las pantallas de Perfil (etiquetas de cada opción y lista de secciones).
import type { Cardio, Dia, Nivel, Perfil, Reps, TipoObjetivo, Trabajo, Zona } from '../../../datos/tipos'
import { DIAS } from '../../../dominio/fechas'

export const OBJETIVO_TXT: Record<TipoObjetivo, string> = { recomposicion: 'Perder grasa y ganar músculo', perder: 'Perder peso', fuerza: 'Ganar fuerza' }
export const NIVEL_TXT: Record<Nivel, string> = { empiezo: 'Empiezo', vuelvo: 'Vuelvo tras un parón', intermedio: 'Intermedio', avanzado: 'Avanzado' }
export const PREFERENCIA_TXT: Record<Perfil['preferencia'], string> = { maquinas: 'Máquinas y poleas', libre: 'Peso libre', mezcla: 'Mezcla' }
export const REPS_TXT: Record<Reps, string> = { pesadas: 'Pocas y pesadas', moderadas: 'Moderadas', mezcla: 'Mezcla' }
export const CARDIO_TXT: Record<Cardio, string> = { nada: 'Nada', pasos: 'Pasos', trote: 'Trote' }
export const TRABAJO_TXT: Record<Trabajo, string> = { sentado: 'Sentado', depie: 'De pie', fisico: 'Físico' }

export const ZONAS_SENSIBLES: { v: Zona; t: string }[] = [
  { v: 'rodilla', t: 'Rodilla' }, { v: 'lumbar', t: 'Lumbar' }, { v: 'hombro', t: 'Hombro' }, { v: 'muneca', t: 'Muñeca' }, { v: 'codo', t: 'Codo' },
]
export const ZONAS_PRIORIDAD: { v: string; t: string }[] = [
  { v: 'abdomen', t: 'Abdomen' }, { v: 'pecho', t: 'Pecho' }, { v: 'brazos', t: 'Brazos' }, { v: 'espalda', t: 'Espalda' },
  { v: 'hombros', t: 'Hombros' }, { v: 'piernas', t: 'Piernas' }, { v: 'gluteo', t: 'Glúteo' },
]

/** Pesos de referencia que se pueden apuntar en Experiencia (clave → nombre). */
export const REFERENCIAS: { k: string; t: string }[] = [
  { k: 'banca', t: 'Press de banca' }, { k: 'sentadilla', t: 'Sentadilla' }, { k: 'pesoMuerto', t: 'Peso muerto' },
  { k: 'remo', t: 'Remo' }, { k: 'pressMilitar', t: 'Press militar' }, { k: 'jalon', t: 'Jalón al pecho' },
]

export type ClaveSeccion = 'datos' | 'cuerpo' | 'objetivos' | 'salud' | 'experiencia' | 'preferencias' | 'horario' | 'alimentacion' | 'vida' | 'seguimiento'

export const SECCIONES: { s: ClaveSeccion; t: string; ico: string }[] = [
  { s: 'datos', t: 'Datos personales', ico: 'identification-card' },
  { s: 'cuerpo', t: 'Cuerpo y composición', ico: 'ruler' },
  { s: 'objetivos', t: 'Objetivos', ico: 'target' },
  { s: 'salud', t: 'Salud', ico: 'first-aid' },
  { s: 'experiencia', t: 'Experiencia', ico: 'medal' },
  { s: 'preferencias', t: 'Preferencias de entreno', ico: 'sliders-horizontal' },
  { s: 'horario', t: 'Horario', ico: 'calendar-blank' },
  { s: 'alimentacion', t: 'Alimentación y suplementos', ico: 'fork-knife' },
  { s: 'vida', t: 'Estilo de vida', ico: 'armchair' },
  { s: 'seguimiento', t: 'Seguimiento', ico: 'chart-line-up' },
]

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** «Mar · Jue · Vie» */
export function diasTxt(dias: Dia[]): string {
  return [...dias].sort((a, b) => a - b).map(d => capital(DIAS[d]!.slice(0, 3))).join(' · ')
}

/** Iniciales para el avatar: «Joel Pérez» → «JP». */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}
