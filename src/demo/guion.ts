// Guion de la demo (/Demo): qué captura se enseña, qué se señala y qué se dice. Las capturas y la posición de
// lo señalado salen de la app de verdad (.cache/demo/capturas-demo.mjs → public/demo/ y focos.json).
// Android: un vistazo de un minuto. iPhone: algo más largo, porque explica lo que allí se hace de otra forma
// (instalarla, pasos a mano, pendientes en vez de recordatorios, copia con Compartir) y no promete lo que no hay.
// Los textos son claves de i18n/es.ts (y de ca.ts y en.ts): las capturas siguen en castellano.
import focos from './focos.json'
import type { Clave } from './i18n'

export type Plataforma = 'android' | 'apple'
export type Caja = [number, number, number, number]
export type PasoDemo = { capitulo: Clave; cap: string; foco: string; titulo: Clave; texto: Clave }

/** Pantalla de las capturas (px de CSS). */
export const ANCHO = 390
export const ALTO = 844

// Los ids que tienen sus textos en el diccionario (TypeScript avisa si un paso no los tiene).
type DePaso<K> = K extends `demo.paso.${infer I}.titulo` ? I : never
type DeCapitulo<K> = K extends `demo.capitulo.${infer C}` ? C : never
type IdPaso = DePaso<Clave>
type IdCapitulo = DeCapitulo<Clave>

/** Un paso con sus claves: demo.paso.<id>.titulo y demo.paso.<id>.texto (o el texto que se le pase). */
const paso = (capitulo: IdCapitulo, cap: string, foco: string, id: IdPaso, texto?: Clave): PasoDemo =>
  ({ capitulo: `demo.capitulo.${capitulo}`, cap, foco, titulo: `demo.paso.${id}.titulo`, texto: texto ?? (`demo.paso.${id}.texto` as Clave) })

const comun = (apple: boolean): PasoDemo[] => [
  paso('inicio', 'hoy', 'semana', 'semana'),
  paso('inicio', 'hoy', 'hoy', 'rutina'),
  paso('entreno', 'hoy', 'empezar', 'empezar'),
  paso('entreno', 'serie', 'peso', 'peso'),
  paso('entreno', 'serie', 'esfuerzo', 'esfuerzo'),
  paso('entreno', 'descanso', 'reloj', 'descanso', apple ? 'demo.paso.descanso.texto.apple' : 'demo.paso.descanso.texto.android'),
  paso('entreno', 'ocupado', 'hoja', 'ocupado'),
  paso('comida', 'comida', 'cuanto', 'comida'),
  paso('comida', 'comida', 'escanear', 'escanear'),
  paso('comida', 'proteina', 'proteina', 'proteina'),
]

const progreso: PasoDemo[] = [
  paso('progreso', 'voy-bien', 'nota', 'voy-bien'),
  paso('progreso', 'fuerza', 'grafica', 'fuerza'),
]

export function guion(p: Plataforma): PasoDemo[] {
  if (p === 'android') return [...comun(false), ...progreso]
  return [
    paso('antes', 'instalar', 'compartir', 'compartir'),
    paso('antes', 'instalar', 'anadir', 'anadir'),
    ...comun(true),
    paso('iphone', 'pendientes', 'pendientes', 'pendientes'),
    paso('iphone', 'pasos', 'apuntar', 'pasos'),
    ...progreso,
    paso('iphone', 'copia', 'copia', 'copia'),
  ]
}

/** Caja (px de 390 × 844) de lo que señala un paso, o null si no se capturó. */
export function cajaDe(p: Plataforma, paso: PasoDemo): Caja | null {
  const f = (focos as unknown as Record<string, Record<string, Record<string, Caja | null>>>)[p]?.[paso.cap]?.[paso.foco]
  return f ?? null
}

/** Cuánto dura un paso: lo justo para leerlo con calma (entre 4 y 6,6 s; la de Android, en torno a un minuto). */
export const duracion = (titulo: string, texto: string) => Math.min(6600, Math.max(4000, 1300 + (titulo.length + texto.length) * 34))
