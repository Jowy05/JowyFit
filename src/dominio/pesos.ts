// Pesos reales disponibles en el gimnasio: mancuernas, barra con discos y máquinas.
// Sirve para que el stepper salte a pesos que existen y para la calculadora de discos.
import type { Gimnasio, TipoRegistro } from '../datos/tipos'

export const BARRAS: Record<string, number> = { barbell: 20, ez_bar: 10, trap_bar: 25, smith_machine: 15 }

export function mancuernasDisponibles(g: Pick<Gimnasio, 'mancuernas'>): number[] {
  const s = new Set<number>()
  for (const t of g.mancuernas) {
    if (t.paso <= 0) continue
    for (let v = t.desde; v <= t.hasta + 1e-9; v += t.paso) s.add(Math.round(v * 100) / 100)
  }
  return [...s].sort((a, b) => a - b)
}

/** Todos los totales posibles con la barra + pares de discos (hasta 300 kg). */
export function pesosBarra(barra: number, discos: number[], max = 300): number[] {
  const lados = new Set<number>([0])
  const pares = [...discos].sort((a, b) => b - a)
  // Por lado se pueden combinar discos repetidos: suma de subconjuntos con repetición (hasta 140 kg por lado).
  const limite = (max - barra) / 2
  let frontera = [0]
  for (let i = 0; i < 40 && frontera.length; i++) {
    const nueva: number[] = []
    for (const f of frontera) for (const d of pares) {
      const v = Math.round((f + d) * 100) / 100
      if (v <= limite && !lados.has(v)) { lados.add(v); nueva.push(v) }
    }
    frontera = nueva
  }
  return [...lados].map(l => Math.round((barra + 2 * l) * 100) / 100).sort((a, b) => a - b)
}

/** Lista de pesos para un ejercicio según su material. Máquinas y poleas: de 2,5 en 2,5. */
export function pesosPara(material: string | null, registro: TipoRegistro, g?: Gimnasio | null): number[] {
  if (registro === 'corporal' || registro === 'tiempo' || registro === 'cardio') return []
  if (registro === 'asistido') return Array.from({ length: 21 }, (_, i) => -i * 5).reverse() // −100 … 0
  if ((material === 'dumbbell' || material === 'kettlebell') && g) {
    const m = mancuernasDisponibles(g)
    if (m.length) return m
  }
  if (material && material in BARRAS && g) {
    // Con discos pequeños salen pesos de kilo en kilo: el stepper va de 2,5 en 2,5 (tocando el número se escribe cualquiera).
    const todos = pesosBarra(material === 'barbell' ? g.barraKg : BARRAS[material]!, g.discos)
    const gruesos = todos.filter(v => Math.abs(v / 2.5 - Math.round(v / 2.5)) < 1e-6)
    return gruesos.length >= 10 ? gruesos : todos
  }
  return Array.from({ length: 121 }, (_, i) => i * 2.5) // 0 … 300
}

/** Peso disponible más cercano (por debajo si no hay exacto y `abajo`). */
export function ajustarA(lista: number[], valor: number, abajo = false): number {
  if (!lista.length) return valor
  let mejor = lista[0]!
  for (const v of lista) {
    if (abajo ? v <= valor + 1e-9 : Math.abs(v - valor) < Math.abs(mejor - valor)) mejor = v
    if (abajo && v > valor) break
  }
  return mejor
}

/** Siguiente peso disponible arriba o abajo. */
export function siguiente(lista: number[], valor: number, dir: 1 | -1): number {
  if (!lista.length) return Math.max(0, valor + dir * 2.5)
  if (dir > 0) return lista.find(v => v > valor + 1e-9) ?? lista[lista.length - 1]!
  return [...lista].reverse().find(v => v < valor - 1e-9) ?? lista[0]!
}

/** Discos que van en cada lado para un total (de mayor a menor). Null si no se puede exacto. */
export function discosPorLado(total: number, barra: number, discos: number[]): number[] | null {
  let resto = Math.round(((total - barra) / 2) * 100) / 100
  if (resto < 0) return null
  const out: number[] = []
  for (const d of [...discos].sort((a, b) => b - a)) {
    while (resto + 1e-9 >= d) { out.push(d); resto = Math.round((resto - d) * 100) / 100 }
  }
  return resto < 0.01 ? out : null
}

/** Series de aproximación: ~50 % × 10, ~70 % × 5, ~85 % × 3 (redondeado a pesos reales). */
export function calentamiento(pesoTrabajo: number, lista: number[], minimo = 0): { peso: number; reps: number }[] {
  if (pesoTrabajo <= 0) return []
  const pasos: [number, number][] = pesoTrabajo >= 40 ? [[0.5, 10], [0.7, 5], [0.85, 3]] : [[0.5, 10], [0.75, 5]]
  const out: { peso: number; reps: number }[] = []
  for (const [f, reps] of pasos) {
    const p = Math.max(minimo, ajustarA(lista, pesoTrabajo * f, true))
    if (p < pesoTrabajo && !out.some(o => o.peso === p)) out.push({ peso: p, reps })
  }
  return out
}
