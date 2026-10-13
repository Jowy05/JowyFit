// Tendencia del peso: pendiente en kg/semana con los últimos 30 días (lo que pesa un día suelto importa poco).
import type { Medicion } from '../datos/tipos'
import { diasEntre } from './fechas'

export function tendenciaPeso(ms: Medicion[], hoy: string, dias = 30): { kgSemana: number | null; puntos: number[] } {
  const pts = ms
    .filter(m => m.pesoKg != null && diasEntre(m.fecha.slice(0, 10), hoy) <= dias && diasEntre(m.fecha.slice(0, 10), hoy) >= 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(m => ({ x: -diasEntre(m.fecha.slice(0, 10), hoy), y: m.pesoKg! }))
  const puntos = pts.map(p => p.y)
  if (pts.length < 2 || pts[pts.length - 1]!.x - pts[0]!.x < 5) return { kgSemana: null, puntos }
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0)
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  return { kgSemana: den ? Math.round((num / den) * 7 * 10) / 10 : null, puntos }
}

/** Puntos de una línea pequeña (SVG 120×40) para la tendencia. */
export function lineaSpark(ys: number[], ancho = 120, alto = 40): string {
  if (ys.length < 2) return ''
  const min = Math.min(...ys), max = Math.max(...ys)
  const r = max - min || 1
  return ys.map((y, i) => `${Math.round(2 + (i * (ancho - 4)) / (ys.length - 1))},${Math.round(4 + ((max - y) / r) * (alto - 8))}`).join(' ')
}
