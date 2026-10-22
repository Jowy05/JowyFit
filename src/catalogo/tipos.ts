// Formato de public/repdb/catalogo.json (generado por scripts/preparar-repdb.mjs).
export type Ejercicio = {
  id: string
  nombre: string
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

/** public/repdb/catalogo.en.json: los textos en inglés por id (la app los usa si está en inglés). */
export type TextosCatalogo = {
  version: number
  generado: string
  etiquetas: Record<string, Record<string, string>>
  musculos: Record<string, { nombre: string; cientifico?: string }>
  material: Record<string, { nombre: string }>
  ejercicios: Record<string, { nombre: string; descripcion: string; instrucciones: string[]; consejos: string[] }>
}
