// Pesos reales disponibles en el gimnasio: mancuernas, barra con discos y máquinas.
// Sirve para que el stepper salte a pesos que existen y para la calculadora de discos.
import type { Gimnasio, TipoRegistro } from '../datos/tipos'

export const BARRAS: Record<string, number> = { barbell: 20, ez_bar: 10, trap_bar: 25, smith_machine: 15 }

export function mancuernasDisponibles(g: Pick<Gimnasio, 'mancuernas'>): number[] {
  const s = new Set<number>()
  for (const t of g.mancuernas) {
    if (!(t.paso > 0) || !Number.isFinite(t.desde) || !Number.isFinite(t.hasta)) continue
    // Por índice (no sumando el paso) para que no se acumule error de coma flotante.
    const n = Math.floor((t.hasta - t.desde) / t.paso + 1e-9)
    for (let i = 0; i <= n && i <= 2000; i++) s.add(Math.round((t.desde + i * t.paso) * 100) / 100)
  }
  return [...s].sort((a, b) => a - b)
}

/** Todos los totales posibles con la barra + pares de discos (hasta 300 kg). */
export function pesosBarra(barra: number, discos: number[], max = 300): number[] {
  const lados = new Set<number>([0])
  // Solo discos con peso (un 0 o un negativo daría totales imposibles).
  const pares = [...new Set(discos)].filter(d => Number.isFinite(d) && d > 0).sort((a, b) => b - a)
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
  // −100 … 0 (sin «-0», que se vería como «-0 kg»)
  if (registro === 'asistido') return Array.from({ length: 21 }, (_, i) => (i ? -i * 5 : 0)).reverse()
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

/** Siguiente peso disponible arriba o abajo; sin ninguno en esa dirección se queda donde está (nunca «sube» bajando). */
export function siguiente(lista: number[], valor: number, dir: 1 | -1): number {
  if (!lista.length) return Math.max(0, valor + dir * 2.5)
  if (dir > 0) return lista.find(v => v > valor + 1e-9) ?? Math.max(valor, lista[lista.length - 1]!)
  for (let i = lista.length - 1; i >= 0; i--) if (lista[i]! < valor - 1e-9) return lista[i]!
  return Math.min(valor, lista[0]!)
}

/** Discos que van en cada lado para un total (de mayor a menor). Null si no se puede exacto. */
export function discosPorLado(total: number, barra: number, discos: number[]): number[] | null {
  if (!Number.isFinite(total) || !Number.isFinite(barra)) return null
  // En centésimas de kilo para trabajar con enteros.
  const objetivo = Math.round(((total - barra) / 2) * 100)
  if (objetivo < 0) return null
  if (objetivo === 0) return []
  if (objetivo > 100_000) return null // más de 1000 kg por lado: no es un peso real
  // Un disco de 0 kg (o negativo) cuelga la calculadora en un bucle infinito.
  const tipos = [...new Set(discos.filter(d => Number.isFinite(d) && d > 0).map(d => Math.round(d * 100)))].filter(d => d > 0).sort((a, b) => b - a)
  if (!tipos.length) return null
  // Mínimo número de discos para cada peso (con repetición). El reparto voraz fallaba con juegos
  // como 15 + 10: 20 kg por lado son 10 + 10, no 15 + «5 que no hay».
  const minimo = new Array<number>(objetivo + 1).fill(Infinity)
  minimo[0] = 0
  for (let v = 1; v <= objetivo; v++) for (const d of tipos) if (d <= v && minimo[v - d]! + 1 < minimo[v]!) minimo[v] = minimo[v - d]! + 1
  if (!Number.isFinite(minimo[objetivo]!)) return null
  // Reconstrucción empezando por los más pesados.
  const out: number[] = []
  let v = objetivo
  while (v > 0) {
    const d = tipos.find(x => x <= v && minimo[v - x] === minimo[v]! - 1)!
    out.push(d / 100)
    v -= d
  }
  return out.sort((a, b) => b - a)
}

/** Series de aproximación: ~50 % × 10, ~70 % × 5, ~85 % × 3 (redondeado a pesos reales). */
export function calentamiento(pesoTrabajo: number, lista: number[], minimo = 0): { peso: number; reps: number }[] {
  if (pesoTrabajo <= 0) return []
  const pasos: [number, number][] = pesoTrabajo >= 40 ? [[0.5, 10], [0.7, 5], [0.85, 3]] : [[0.5, 10], [0.75, 5]]
  const out: { peso: number; reps: number }[] = []
  for (const [f, reps] of pasos) {
    const objetivo = pesoTrabajo * f
    // Sin lista de pesos se redondea hacia abajo a 2,5 kg (nada de 25,9 kg).
    const real = lista.length ? ajustarA(lista, objetivo, true) : Math.floor(objetivo / 2.5 + 1e-9) * 2.5
    const p = Math.max(minimo, real)
    // Una aproximación de 0 kg no tiene sentido.
    if (p > 0 && p < pesoTrabajo && !out.some(o => o.peso === p)) out.push({ peso: p, reps })
  }
  return out
}
