// Formato de public/repdb/catalogo.json (generado por scripts/preparar-repdb.mjs).
import type { EjercicioPropio } from '../datos/tipos'

export type Ejercicio = {
  id: string
  nombre: string
  /** El nombre en castellano (con los arreglos de nombreComun), en cualquier idioma: compara movimientos y se busca. */
  nombreEs?: string
  descripcion: string
  instrucciones: string[]
  consejos: string[]
  categoria: string
  fuerza: string
  mecanica: string
  dificultad: string
  material: string | null
  zona: string
  principales: string[]
  secundarios: string[]
  objetivos: string[]
  etiquetas: string[]
  unilateral: boolean
  pesoCorporal: boolean
  poses: string[] // start/peak o main
  met: number | null
  /** Solo en los creados por el usuario (no vienen de RepDB). */
  propio?: EjercicioPropio
}

export type Musculo = { nombre: string; cientifico: string; zona: string; imagen?: string }
export type Material = { nombre: string; etiquetas: string[]; imagen?: string }

export type Catalogo = {
  fuente: string
  version: number
  generado: string
  etiquetas: Record<string, Record<string, string>>
  musculos: Record<string, Musculo>
  material: Record<string, Material>
  ejercicios: Ejercicio[]
}

/** public/repdb/catalogo.en.json y catalogo.ca.json: los textos en inglés o catalán por id (la app los usa en ese idioma). */
export type TextosCatalogo = {
  version: number
  generado: string
  etiquetas: Record<string, Record<string, string>>
  musculos: Record<string, { nombre: string; cientifico?: string }>
  material: Record<string, { nombre: string }>
  ejercicios: Record<string, { nombre: string; descripcion: string; instrucciones: string[]; consejos: string[] }>
}
